"""Username validation rules.

A candidate is accepted only when it is exactly four characters long, built
from lowercase letters, digits, periods and underscores, and does not end with
a period.  Periods are allowed anywhere else, including as the first
character.
"""

from __future__ import annotations

import string

USERNAME_LENGTH = 4

LOWERCASE = string.ascii_lowercase
DIGITS = string.digits
SPECIALS = "._"
ALLOWED_CHARACTERS = frozenset(LOWERCASE + DIGITS + SPECIALS)

#: Characters usable in generated candidates, in a stable order.
DEFAULT_CHARSET = LOWERCASE + DIGITS + SPECIALS


class ValidationError(ValueError):
    """Raised when a candidate violates the username rules."""

    def __init__(self, username: str, reason: str, message: str) -> None:
        super().__init__(f"{username!r}: {message}")
        self.username = username
        self.reason = reason
        self.message = message


def describe_problem(username: str) -> tuple[str, str] | None:
    """Return ``(reason_code, message)`` for an invalid username, else ``None``.

    ``username`` is checked exactly as given; callers are responsible for any
    trimming or case folding they want to allow.
    """
    if len(username) != USERNAME_LENGTH:
        return (
            "bad_length",
            f"must be exactly {USERNAME_LENGTH} characters, got {len(username)}",
        )

    illegal = [character for character in username if character not in ALLOWED_CHARACTERS]
    if illegal:
        rendered = ", ".join(repr(character) for character in dict.fromkeys(illegal))
        return (
            "illegal_character",
            "only lowercase letters, digits, '.' and '_' are allowed; "
            f"found {rendered}",
        )

    if username.endswith("."):
        return ("trailing_period", "must not end with a period")

    return None


def is_valid(username: str) -> bool:
    """``True`` when ``username`` satisfies every rule."""
    return describe_problem(username) is None


def validate(username: str) -> str:
    """Return ``username`` unchanged, raising :class:`ValidationError` if invalid."""
    problem = describe_problem(username)
    if problem is not None:
        reason, message = problem
        raise ValidationError(username, reason, message)
    return username


def normalize(raw: str, *, fold_case: bool = False) -> str:
    """Trim surrounding whitespace and an optional leading ``@``.

    With ``fold_case`` the candidate is lowercased first; TikTok treats
    usernames case-insensitively, but by default uppercase input is rejected so
    that nothing is silently rewritten.
    """
    candidate = raw.strip()
    if candidate.startswith("@"):
        candidate = candidate[1:].strip()
    if fold_case:
        candidate = candidate.lower()
    return candidate
