"""An adaptive token-bucket rate limiter shared by all worker threads.

The limiter starts at a configured request rate and reacts to the server:
``penalize()`` multiplicatively lowers the rate when TikTok pushes back,
``reward()`` slowly raises it again after a run of clean responses, and
``pause()`` implements a global cooldown (for example when a ``Retry-After``
header arrives).
"""

from __future__ import annotations

import threading
import time
from typing import Callable

Clock = Callable[[], float]


class AdaptiveRateLimiter:
    """Thread-safe token bucket whose rate adapts to server pushback."""

    def __init__(
        self,
        rate: float,
        *,
        burst: float | None = None,
        min_rate: float = 0.2,
        max_rate: float | None = None,
        penalty_factor: float = 0.5,
        recovery_step: float | None = None,
        successes_before_recovery: int = 20,
        clock: Clock = time.monotonic,
    ) -> None:
        if rate <= 0:
            raise ValueError("rate must be positive")
        if min_rate <= 0:
            raise ValueError("min_rate must be positive")
        if not 0 < penalty_factor < 1:
            raise ValueError("penalty_factor must be between 0 and 1")
        if successes_before_recovery < 1:
            raise ValueError("successes_before_recovery must be at least 1")

        self._clock = clock
        self._condition = threading.Condition()
        self._rate = float(rate)
        self._initial_rate = float(rate)
        self._min_rate = min(float(min_rate), float(rate))
        self._max_rate = float(max_rate) if max_rate is not None else float(rate)
        self._penalty_factor = float(penalty_factor)
        self._recovery_step = (
            float(recovery_step) if recovery_step is not None else max(rate * 0.1, 0.05)
        )
        self._successes_before_recovery = successes_before_recovery
        self._capacity = float(burst) if burst is not None else max(1.0, float(rate))
        self._tokens = self._capacity
        self._updated_at = self._clock()
        self._paused_until = 0.0
        self._successes = 0

    @property
    def rate(self) -> float:
        """Current requests-per-second allowance."""
        with self._condition:
            return self._rate

    def acquire(self, stop: threading.Event | None = None, timeout: float | None = None) -> bool:
        """Block until one request may be sent.

        Returns ``False`` if ``stop`` was set or ``timeout`` elapsed first.
        """
        deadline = None if timeout is None else self._clock() + timeout
        with self._condition:
            while True:
                if stop is not None and stop.is_set():
                    return False

                now = self._clock()
                self._refill(now)

                if now >= self._paused_until and self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return True

                wait_for = 0.0
                if self._tokens < 1.0:
                    wait_for = (1.0 - self._tokens) / self._rate
                wait_for = max(wait_for, self._paused_until - now)

                if deadline is not None:
                    remaining = deadline - now
                    if remaining <= 0:
                        return False
                    wait_for = min(wait_for, remaining)

                # Cap the sleep so stop events and rate changes are noticed
                # promptly even when the computed wait is long.
                self._condition.wait(max(min(wait_for, 0.25), 0.001))

    def penalize(self) -> float:
        """Halve (by ``penalty_factor``) the allowed rate; returns the new rate."""
        with self._condition:
            self._successes = 0
            self._rate = max(self._min_rate, self._rate * self._penalty_factor)
            self._tokens = min(self._tokens, 1.0)
            self._condition.notify_all()
            return self._rate

    def reward(self) -> None:
        """Record a clean response and occasionally restore some rate."""
        with self._condition:
            if self._rate >= self._max_rate:
                self._successes = 0
                return
            self._successes += 1
            if self._successes >= self._successes_before_recovery:
                self._successes = 0
                self._rate = min(self._max_rate, self._rate + self._recovery_step)
                self._condition.notify_all()

    def pause(self, seconds: float) -> None:
        """Block every worker for ``seconds`` (used for ``Retry-After``)."""
        if seconds <= 0:
            return
        with self._condition:
            self._paused_until = max(self._paused_until, self._clock() + seconds)
            self._condition.notify_all()

    def wake(self) -> None:
        """Wake every waiter, e.g. after a stop event has been set."""
        with self._condition:
            self._condition.notify_all()

    def _refill(self, now: float) -> None:
        elapsed = now - self._updated_at
        if elapsed > 0:
            self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
            self._updated_at = now
        elif elapsed < 0:  # pragma: no cover - monotonic clocks do not go back
            self._updated_at = now
