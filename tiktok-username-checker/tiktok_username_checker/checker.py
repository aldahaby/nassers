"""Availability checking for a single username."""

from __future__ import annotations

import logging
import random
import threading
import time
from dataclasses import dataclass

from .http_client import HttpClient, HttpResponse, TransportError
from .models import (
    ABORTED_REASON,
    PROFILE_URL_TEMPLATE,
    Availability,
    CheckResult,
    Probe,
    Verdict,
)
from .parsing import parse_profile_page
from .ratelimit import AdaptiveRateLimiter
from .retry import RetryPolicy, parse_retry_after
from .validation import describe_problem

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class Attempt:
    """A single HTTP attempt and what it told us."""

    probe: Probe
    http_status: int | None
    retry_after: float | None = None
    server_pushback: bool = False


class TikTokUsernameChecker:
    """Decides whether a four-character TikTok username is free.

    Availability is derived from the public profile page.  A page that renders
    a user object means the name is taken; a 404 (or an embedded
    ``user doesn't exist`` status) means no account currently holds it.
    """

    def __init__(
        self,
        client: HttpClient,
        limiter: AdaptiveRateLimiter,
        retry_policy: RetryPolicy,
        *,
        confirm_available: bool = True,
        confirm_delay: float = 1.0,
        stop: threading.Event | None = None,
        logger: logging.Logger | None = None,
        rng: random.Random | None = None,
        profile_url_template: str = PROFILE_URL_TEMPLATE,
    ) -> None:
        self._client = client
        self._profile_url_template = profile_url_template
        self._limiter = limiter
        self._retry = retry_policy
        self._confirm_available = confirm_available
        self._confirm_delay = max(0.0, confirm_delay)
        self._stop = stop or threading.Event()
        self._log = logger or LOGGER
        self._rng = rng or random.Random()
        self._rng_lock = threading.Lock()

    # ------------------------------------------------------------------ public

    def check(self, username: str) -> CheckResult:
        """Check one username and return a fully populated result."""
        started = time.perf_counter()

        problem = describe_problem(username)
        if problem is not None:
            reason, message = problem
            return CheckResult(
                username=username,
                status=Availability.INVALID,
                reason=reason,
                detail=message,
                elapsed_ms=self._elapsed_ms(started),
            )

        attempt, attempts_made = self._probe_with_retries(username)
        verdict = attempt.probe.verdict

        if verdict is Verdict.EXISTS:
            return CheckResult(
                username=username,
                status=Availability.TAKEN,
                reason=attempt.probe.reason,
                http_status=attempt.http_status,
                attempts=attempts_made,
                detail=attempt.probe.detail,
                elapsed_ms=self._elapsed_ms(started),
            )

        if verdict is Verdict.NOT_FOUND:
            return self._finish_available(username, attempt, attempts_made, started)

        return CheckResult(
            username=username,
            status=Availability.ERROR,
            reason=attempt.probe.reason,
            http_status=attempt.http_status,
            attempts=attempts_made,
            detail=attempt.probe.detail,
            elapsed_ms=self._elapsed_ms(started),
        )

    # ----------------------------------------------------------------- private

    def _finish_available(
        self,
        username: str,
        attempt: Attempt,
        attempts_made: int,
        started: float,
    ) -> CheckResult:
        """Re-verify an apparently free username before reporting it."""
        if not self._confirm_available:
            return CheckResult(
                username=username,
                status=Availability.AVAILABLE,
                reason=attempt.probe.reason,
                http_status=attempt.http_status,
                attempts=attempts_made,
                detail=attempt.probe.detail,
                elapsed_ms=self._elapsed_ms(started),
            )

        self._sleep(self._confirm_delay)
        confirmation, confirm_attempts = self._probe_with_retries(username)
        total_attempts = attempts_made + confirm_attempts

        if confirmation.probe.verdict is Verdict.EXISTS:
            # The second look found a real profile: trust the positive answer.
            self._log.warning(
                "%s looked free but the confirmation request found a profile", username
            )
            return CheckResult(
                username=username,
                status=Availability.TAKEN,
                reason=confirmation.probe.reason,
                http_status=confirmation.http_status,
                attempts=total_attempts,
                confirmed=True,
                detail=f"first response said {attempt.probe.reason}; "
                f"{confirmation.probe.detail}",
                elapsed_ms=self._elapsed_ms(started),
            )

        if confirmation.probe.verdict is Verdict.NOT_FOUND:
            return CheckResult(
                username=username,
                status=Availability.AVAILABLE,
                reason=attempt.probe.reason,
                http_status=confirmation.http_status,
                attempts=total_attempts,
                confirmed=True,
                detail=attempt.probe.detail,
                elapsed_ms=self._elapsed_ms(started),
            )

        return CheckResult(
            username=username,
            status=Availability.AVAILABLE,
            reason=attempt.probe.reason,
            http_status=attempt.http_status,
            attempts=total_attempts,
            confirmed=False,
            detail=f"{attempt.probe.detail}; confirmation inconclusive "
            f"({confirmation.probe.reason})",
            elapsed_ms=self._elapsed_ms(started),
        )

    def _probe_with_retries(self, username: str) -> tuple[Attempt, int]:
        """Request the profile page, retrying transient failures with backoff."""
        url = self._profile_url_template.format(username=username)
        last = Attempt(Probe(Verdict.INDETERMINATE, "not_attempted", ""), None)

        for attempt_number in range(1, self._retry.max_attempts + 1):
            if self._stop.is_set():
                return (
                    Attempt(
                        Probe(Verdict.INDETERMINATE, ABORTED_REASON, "shutdown requested"), None
                    ),
                    attempt_number - 1,
                )

            if not self._limiter.acquire(stop=self._stop):
                return (
                    Attempt(
                        Probe(Verdict.INDETERMINATE, ABORTED_REASON, "shutdown requested"), None
                    ),
                    attempt_number - 1,
                )

            last = self._single_attempt(url, username)

            if last.probe.verdict is not Verdict.INDETERMINATE:
                self._limiter.reward()
                return last, attempt_number

            if last.server_pushback:
                new_rate = self._limiter.penalize()
                self._log.warning(
                    "%s: server pushback (%s); rate lowered to %.2f req/s",
                    username,
                    last.probe.reason,
                    new_rate,
                )

            if attempt_number >= self._retry.max_attempts:
                break

            delay = self._backoff_delay(attempt_number, last.retry_after)
            if last.retry_after is not None or last.server_pushback:
                # Hold every worker back, not just this one.
                self._limiter.pause(delay)
            self._log.debug(
                "%s: attempt %d/%d failed (%s); retrying in %.2fs",
                username,
                attempt_number,
                self._retry.max_attempts,
                last.probe.reason,
                delay,
            )
            self._sleep(delay)

        return last, self._retry.max_attempts

    def _single_attempt(self, url: str, username: str) -> Attempt:
        try:
            response = self._client.get(url)
        except TransportError as exc:
            self._log.debug("%s: transport failure: %s", username, exc)
            return Attempt(
                Probe(Verdict.INDETERMINATE, f"transport_{exc.kind}", str(exc)),
                None,
            )
        return self._classify(response, username)

    def _classify(self, response: HttpResponse, username: str) -> Attempt:
        status = response.status_code
        retry_after = parse_retry_after(response.header("retry-after"))

        if status == 200:
            probe = parse_profile_page(response.text, username)
            if probe.verdict is Verdict.INDETERMINATE and response.truncated:
                probe = Probe(probe.verdict, probe.reason, f"{probe.detail}; body truncated")
            return Attempt(probe, status, retry_after, server_pushback=False)

        if status == 404:
            probe = parse_profile_page(response.text, username)
            if probe.verdict is Verdict.EXISTS:
                return Attempt(probe, status, retry_after)
            return Attempt(
                Probe(Verdict.NOT_FOUND, "http_404", probe.detail or "profile page returned 404"),
                status,
                retry_after,
            )

        if status == 429:
            return Attempt(
                Probe(Verdict.INDETERMINATE, "http_429", "rate limited by TikTok"),
                status,
                retry_after,
                server_pushback=True,
            )

        if status in (401, 403):
            return Attempt(
                Probe(
                    Verdict.INDETERMINATE,
                    f"http_{status}",
                    "request blocked; TikTok served a challenge or denied access",
                ),
                status,
                retry_after,
                server_pushback=True,
            )

        if 500 <= status < 600:
            return Attempt(
                Probe(Verdict.INDETERMINATE, f"http_{status}", "server error"),
                status,
                retry_after,
                server_pushback=status == 503,
            )

        if 300 <= status < 400:
            location = response.header("location") or ""
            return Attempt(
                Probe(Verdict.INDETERMINATE, f"http_{status}", f"unfollowed redirect {location}"),
                status,
                retry_after,
            )

        return Attempt(
            Probe(Verdict.INDETERMINATE, f"http_{status}", "unexpected response status"),
            status,
            retry_after,
        )

    def _backoff_delay(self, attempt_number: int, retry_after: float | None) -> float:
        with self._rng_lock:
            delay = self._retry.delay_for(attempt_number, self._rng)
        if retry_after is not None:
            delay = max(delay, min(retry_after, self._retry.max_delay))
        return delay

    def _sleep(self, seconds: float) -> None:
        if seconds > 0:
            self._stop.wait(seconds)

    @staticmethod
    def _elapsed_ms(started: float) -> int:
        return int((time.perf_counter() - started) * 1000)
