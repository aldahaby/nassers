"""Concurrent orchestration over an arbitrarily long stream of usernames."""

from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass, field
from typing import Callable, Iterable

from .checker import TikTokUsernameChecker
from .models import ABORTED_REASON, Availability, CheckResult
from .results import CsvResultWriter

LOGGER = logging.getLogger(__name__)

ResultCallback = Callable[[CheckResult], None]


@dataclass
class Summary:
    """Aggregate counts for a run."""

    counts: dict[str, int] = field(
        default_factory=lambda: {status.value: 0 for status in Availability}
    )
    total: int = 0
    cancelled: int = 0
    elapsed_seconds: float = 0.0
    interrupted: bool = False

    def record(self, result: CheckResult) -> None:
        self.total += 1
        self.counts[result.status.value] = self.counts.get(result.status.value, 0) + 1

    @property
    def available(self) -> int:
        return self.counts.get(Availability.AVAILABLE.value, 0)

    @property
    def taken(self) -> int:
        return self.counts.get(Availability.TAKEN.value, 0)

    @property
    def invalid(self) -> int:
        return self.counts.get(Availability.INVALID.value, 0)

    @property
    def errors(self) -> int:
        return self.counts.get(Availability.ERROR.value, 0)

    @property
    def rate(self) -> float:
        return self.total / self.elapsed_seconds if self.elapsed_seconds > 0 else 0.0


class CheckRunner:
    """Runs checks across a thread pool while streaming results to disk.

    Usernames are consumed lazily and only a bounded number of checks are ever
    in flight, so an input of millions of candidates uses constant memory.
    """

    def __init__(
        self,
        checker: TikTokUsernameChecker,
        writer: CsvResultWriter,
        *,
        workers: int = 8,
        stop: threading.Event | None = None,
        logger: logging.Logger | None = None,
        progress_every: int = 25,
        on_result: ResultCallback | None = None,
    ) -> None:
        if workers < 1:
            raise ValueError("workers must be at least 1")
        self._checker = checker
        self._writer = writer
        self._workers = workers
        self._stop = stop or threading.Event()
        self._log = logger or LOGGER
        self._progress_every = max(1, progress_every)
        self._on_result = on_result

    def run(self, usernames: Iterable[str], *, expected_total: int | None = None) -> Summary:
        summary = Summary()
        started = time.monotonic()
        max_in_flight = self._workers * 4
        pending: set[Future[CheckResult]] = set()
        owners: dict[Future[CheckResult], str] = {}
        source = iter(usernames)
        exhausted = False

        with ThreadPoolExecutor(
            max_workers=self._workers, thread_name_prefix="checker"
        ) as pool:
            while not self._stop.is_set():
                while not exhausted and len(pending) < max_in_flight and not self._stop.is_set():
                    try:
                        username = next(source)
                    except StopIteration:
                        exhausted = True
                        break
                    future = pool.submit(self._check, username)
                    pending.add(future)
                    owners[future] = username

                if not pending:
                    if exhausted:
                        break
                    continue

                done, pending = wait(pending, return_when=FIRST_COMPLETED)
                self._drain(done, owners, summary, started, expected_total)

            if self._stop.is_set():
                summary.interrupted = True
                for future in pending:
                    future.cancel()

            while pending:
                done, pending = wait(pending, return_when=FIRST_COMPLETED)
                self._drain(done, owners, summary, started, expected_total)

        self._writer.flush()
        summary.elapsed_seconds = time.monotonic() - started
        return summary

    def _check(self, username: str) -> CheckResult:
        return self._checker.check(username)

    def _drain(
        self,
        done: set[Future[CheckResult]],
        owners: dict[Future[CheckResult], str],
        summary: Summary,
        started: float,
        expected_total: int | None,
    ) -> None:
        for future in done:
            username = owners.pop(future, "<unknown>")
            if future.cancelled():
                continue
            try:
                result = future.result()
            except Exception as exc:  # pragma: no cover - worker crash guard
                self._log.exception("unhandled error checking %s", username)
                result = CheckResult(
                    username=username,
                    status=Availability.ERROR,
                    reason="internal_error",
                    detail=f"{type(exc).__name__}: {exc}",
                )

            if result.status is Availability.ERROR and result.reason == ABORTED_REASON:
                # Cancelled by shutdown, not answered: leave the username
                # unrecorded so a later --resume run still checks it.
                summary.cancelled += 1
                self._log.debug("%s: check cancelled before completion", result.username)
                continue

            self._writer.write(result)
            summary.record(result)
            if self._on_result is not None:
                self._on_result(result)

            self._log.debug(
                "%s -> %s (%s, %d attempt(s), %d ms)",
                result.username,
                result.status.value,
                result.reason,
                result.attempts,
                result.elapsed_ms,
            )

            if summary.total % self._progress_every == 0:
                self._log_progress(summary, started, expected_total)

    def _log_progress(self, summary: Summary, started: float, expected_total: int | None) -> None:
        elapsed = max(time.monotonic() - started, 1e-9)
        rate = summary.total / elapsed
        message = (
            f"checked {summary.total}"
            + (f"/{expected_total}" if expected_total else "")
            + f" | available {summary.available} | taken {summary.taken} "
            f"| invalid {summary.invalid} | errors {summary.errors} "
            f"| {rate:.2f}/s"
        )
        if expected_total and rate > 0:
            remaining = max(expected_total - summary.total, 0)
            message += f" | eta {_format_duration(remaining / rate)}"
        self._log.info(message)


def _format_duration(seconds: float) -> str:
    seconds = int(max(seconds, 0))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}h{minutes:02d}m"
    if minutes:
        return f"{minutes}m{secs:02d}s"
    return f"{secs}s"
