"""Generation of valid four-character username candidates."""

from __future__ import annotations

import itertools
import random
import string
from typing import Iterator

from .validation import ALLOWED_CHARACTERS, DEFAULT_CHARSET, USERNAME_LENGTH

CHARSET_PRESETS: dict[str, str] = {
    "full": DEFAULT_CHARSET,
    "alnum": string.ascii_lowercase + string.digits,
    "letters": string.ascii_lowercase,
    "digits": string.digits,
}


def resolve_charset(spec: str) -> str:
    """Resolve a preset name or a literal character set into usable characters.

    Duplicates are removed, order is preserved, and every character must be
    legal in a username.
    """
    charset = CHARSET_PRESETS.get(spec, spec)
    unique = "".join(dict.fromkeys(charset))
    if not unique:
        raise ValueError("character set is empty")
    invalid = [character for character in unique if character not in ALLOWED_CHARACTERS]
    if invalid:
        rendered = ", ".join(repr(character) for character in invalid)
        raise ValueError(f"character set contains characters TikTok does not allow: {rendered}")
    return unique


def _tail_charset(charset: str) -> str:
    """Characters usable in the final position (a username may not end in '.')."""
    return "".join(character for character in charset if character != ".")


def candidate_space(charset: str) -> int:
    """Number of valid candidates that :func:`iter_all` will produce."""
    charset = resolve_charset(charset)
    return len(charset) ** (USERNAME_LENGTH - 1) * len(_tail_charset(charset))


def candidate_at(index: int, charset: str = DEFAULT_CHARSET) -> str:
    """Return the ``index``-th candidate in :func:`iter_all` order.

    Indexing the space directly lets random sampling draw distinct candidates
    without materialising or rejection-testing millions of strings.
    """
    charset = resolve_charset(charset)
    return _candidate_at(index, charset, _tail_charset(charset))


def _candidate_at(index: int, charset: str, tail: str) -> str:
    if index < 0 or index >= len(charset) ** (USERNAME_LENGTH - 1) * len(tail):
        raise IndexError(f"index {index} is outside the candidate space")
    index, last = divmod(index, len(tail))
    characters = [tail[last]]
    for _ in range(USERNAME_LENGTH - 1):
        index, digit = divmod(index, len(charset))
        characters.append(charset[digit])
    return "".join(reversed(characters))


def iter_all(charset: str = DEFAULT_CHARSET) -> Iterator[str]:
    """Yield every valid candidate over ``charset`` in lexicographic order.

    The final position never uses ``.`` because usernames may not end with a
    period; every other position may.
    """
    charset = resolve_charset(charset)
    tail = _tail_charset(charset)
    if not tail:
        return
    for prefix in itertools.product(charset, repeat=USERNAME_LENGTH - 1):
        head = "".join(prefix)
        for last in tail:
            yield head + last


def iter_random(
    count: int,
    charset: str = DEFAULT_CHARSET,
    *,
    seed: int | None = None,
) -> Iterator[str]:
    """Yield ``count`` distinct random candidates over ``charset``.

    Yields fewer values only when the candidate space itself is smaller than
    ``count``.
    """
    if count <= 0:
        return
    charset = resolve_charset(charset)
    space = candidate_space(charset)
    rng = random.Random(seed)

    if count >= space:
        remaining = list(iter_all(charset))
        rng.shuffle(remaining)
        yield from remaining
        return

    tail = _tail_charset(charset)
    for index in rng.sample(range(space), count):
        yield _candidate_at(index, charset, tail)
