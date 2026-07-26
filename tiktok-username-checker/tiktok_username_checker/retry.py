"""Retry policy used for transient network and server failures."""

from __future__ import annotations

import email.utils
import random
import time
from dataclasses import dataclass
from datetime import timezone


@dataclass(frozen=True)
class RetryPolicy:
    """Exponential backoff with full-range jitter."""

    max_attempts: int = 4
    base_delay: float = 1.0
    multiplier: float = 2.0
    max_delay: float = 30.0
    jitter: float = 0.3

    def __post_init__(self) -> None:
        if self.max_attempts < 1:
            raise ValueError("max_attempts must be at least 1")
        if self.base_delay < 0:
            raise ValueError("base_delay must not be negative")
        if self.multiplier < 1:
            raise ValueError("multiplier must be at least 1")
        if not 0 <= self.jitter <= 1:
            raise ValueError("jitter must be between 0 and 1")

    def delay_for(self, attempt: int, rng: random.Random | None = None) -> float:
        """Delay in seconds to wait after a failed ``attempt`` (1-based)."""
        if attempt < 1:
            raise ValueError("attempt must be at least 1")
        raw = self.base_delay * (self.multiplier ** (attempt - 1))
        delay = min(raw, self.max_delay)
        if self.jitter:
            source = rng or random
            delay *= 1.0 + source.uniform(-self.jitter, self.jitter)
        return max(0.0, delay)


def parse_retry_after(value: str | None, *, now: float | None = None) -> float | None:
    """Parse a ``Retry-After`` header into seconds, or ``None`` if unusable."""
    if not value:
        return None
    text = value.strip()
    try:
        return max(0.0, float(text))
    except ValueError:
        pass
    try:
        parsed = email.utils.parsedate_to_datetime(text)
    except (TypeError, ValueError):
        return None
    if parsed is None:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    reference = time.time() if now is None else now
    return max(0.0, parsed.timestamp() - reference)
