"""Core data types shared across the application."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone

PROFILE_URL_TEMPLATE = "https://www.tiktok.com/@{username}"

#: Reason recorded when a check was cancelled by a shutdown rather than
#: answered.  Such results are dropped instead of written, so an interrupted
#: run leaves those usernames unchecked and a resumed run picks them up.
ABORTED_REASON = "aborted"


def utc_now_iso() -> str:
    """Current UTC time as an ISO-8601 string with second precision."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class Availability(str, enum.Enum):
    """Outcome of a username check."""

    AVAILABLE = "available"
    TAKEN = "taken"
    INVALID = "invalid"
    ERROR = "error"

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.value


class Verdict(str, enum.Enum):
    """What a single HTTP response tells us about a profile."""

    EXISTS = "exists"
    NOT_FOUND = "not_found"
    INDETERMINATE = "indeterminate"


@dataclass(frozen=True)
class Probe:
    """Result of parsing one profile response."""

    verdict: Verdict
    reason: str
    detail: str = ""


@dataclass(frozen=True)
class CheckResult:
    """A finished check for one username, ready to be written to CSV."""

    username: str
    status: Availability
    reason: str
    http_status: int | None = None
    attempts: int = 0
    elapsed_ms: int = 0
    confirmed: bool = False
    detail: str = ""
    checked_at: str = field(default_factory=utc_now_iso)

    @property
    def profile_url(self) -> str:
        return PROFILE_URL_TEMPLATE.format(username=self.username)

    def to_row(self) -> dict[str, str]:
        return {
            "username": self.username,
            "status": self.status.value,
            "reason": self.reason,
            "http_status": "" if self.http_status is None else str(self.http_status),
            "attempts": str(self.attempts),
            "elapsed_ms": str(self.elapsed_ms),
            "confirmed": "true" if self.confirmed else "false",
            "profile_url": "" if self.status is Availability.INVALID else self.profile_url,
            "detail": self.detail,
            "checked_at": self.checked_at,
        }


CSV_FIELDS: tuple[str, ...] = (
    "username",
    "status",
    "reason",
    "http_status",
    "attempts",
    "elapsed_ms",
    "confirmed",
    "profile_url",
    "detail",
    "checked_at",
)
