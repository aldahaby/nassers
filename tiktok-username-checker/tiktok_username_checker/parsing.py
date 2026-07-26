"""Interpretation of TikTok profile pages.

TikTok does not publish a username-availability API, so availability is derived
from the public profile page at ``https://www.tiktok.com/@<username>``.  Every
profile page embeds the data the front end hydrates from; the parsers below
read that embedded JSON instead of scraping rendered markup, which makes the
verdict stable against layout changes.
"""

from __future__ import annotations

import json
import re
from typing import Any

from .models import Probe, Verdict

UNIVERSAL_SCRIPT_RE = re.compile(
    r'<script[^>]*\bid="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)
SIGI_SCRIPT_RE = re.compile(
    r'<script[^>]*\bid="SIGI_STATE"[^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)
UNIQUE_ID_RE = re.compile(r'"uniqueId"\s*:\s*"([^"\\]{1,32})"')
STATUS_CODE_RE = re.compile(r'"statusCode"\s*:\s*(\d+)')

#: ``statusCode`` values TikTok returns for a profile that does not exist.
USER_NOT_FOUND_STATUS_CODES = frozenset({10221, 10202})

#: Markers of an interstitial (bot check, captcha, login wall) rather than a
#: profile page.  Only consulted when no verdict could be derived.
CHALLENGE_MARKERS: tuple[str, ...] = (
    "tiktok-verify-page",
    "captcha_verify",
    "captcha-verify",
    "verify-bar-close",
    "slardar/fe/sdk-web",
    "please wait while we verify",
    "access denied",
    "unusual traffic",
)


def _load_script_json(html: str, pattern: re.Pattern[str]) -> dict[str, Any] | None:
    match = pattern.search(html)
    if not match:
        return None
    payload = match.group(1).strip()
    if not payload:
        return None
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def looks_like_challenge(html: str) -> bool:
    """``True`` when the body looks like a bot check instead of a profile."""
    lowered = html.lower()
    return any(marker in lowered for marker in CHALLENGE_MARKERS)


def _from_universal_data(data: dict[str, Any], username: str) -> Probe | None:
    scope = _as_dict(data.get("__DEFAULT_SCOPE__"))
    detail = _as_dict(scope.get("webapp.user-detail"))
    if not detail:
        return None

    user = _as_dict(_as_dict(detail.get("userInfo")).get("user"))
    unique_id = user.get("uniqueId")
    if isinstance(unique_id, str) and unique_id.strip():
        if unique_id.casefold() == username.casefold():
            return Probe(Verdict.EXISTS, "profile_data_present", f"uniqueId={unique_id}")
        return Probe(
            Verdict.INDETERMINATE,
            "username_mismatch",
            f"page returned uniqueId={unique_id!r}",
        )

    status_code = _as_int(detail.get("statusCode"))
    if status_code is None:
        return None
    if status_code in USER_NOT_FOUND_STATUS_CODES:
        return Probe(Verdict.NOT_FOUND, "user_detail_not_found", f"statusCode={status_code}")
    if status_code == 0:
        # statusCode 0 without any user object is not a usable answer.
        return Probe(Verdict.INDETERMINATE, "empty_user_detail", "statusCode=0 without user")
    status_message = detail.get("statusMsg")
    message = f"statusCode={status_code}"
    if isinstance(status_message, str) and status_message:
        message = f"{message} statusMsg={status_message}"
    return Probe(Verdict.INDETERMINATE, "unexpected_status_code", message)


def _from_sigi_state(data: dict[str, Any], username: str) -> Probe | None:
    users = _as_dict(_as_dict(data.get("UserModule")).get("users"))
    for key, value in users.items():
        if key.casefold() == username.casefold():
            return Probe(Verdict.EXISTS, "sigi_user_present", f"uniqueId={key}")
        unique_id = _as_dict(value).get("uniqueId")
        if isinstance(unique_id, str) and unique_id.casefold() == username.casefold():
            return Probe(Verdict.EXISTS, "sigi_user_present", f"uniqueId={unique_id}")

    status_code = _as_int(_as_dict(data.get("UserPage")).get("statusCode"))
    if status_code is not None and status_code in USER_NOT_FOUND_STATUS_CODES:
        return Probe(Verdict.NOT_FOUND, "sigi_not_found", f"statusCode={status_code}")
    return None


def _from_raw_html(html: str, username: str) -> Probe | None:
    for match in UNIQUE_ID_RE.finditer(html):
        if match.group(1).casefold() == username.casefold():
            return Probe(Verdict.EXISTS, "unique_id_in_html", f"uniqueId={match.group(1)}")

    for match in STATUS_CODE_RE.finditer(html):
        code = int(match.group(1))
        if code in USER_NOT_FOUND_STATUS_CODES:
            return Probe(Verdict.NOT_FOUND, "status_code_in_html", f"statusCode={code}")
    return None


def parse_profile_page(html: str, username: str) -> Probe:
    """Derive a :class:`Probe` from a profile page body."""
    if not html.strip():
        return Probe(Verdict.INDETERMINATE, "empty_body", "response body was empty")

    universal = _load_script_json(html, UNIVERSAL_SCRIPT_RE)
    if universal is not None:
        probe = _from_universal_data(universal, username)
        if probe is not None:
            return probe

    sigi = _load_script_json(html, SIGI_SCRIPT_RE)
    if sigi is not None:
        probe = _from_sigi_state(sigi, username)
        if probe is not None:
            return probe

    probe = _from_raw_html(html, username)
    if probe is not None:
        return probe

    if looks_like_challenge(html):
        return Probe(Verdict.INDETERMINATE, "challenge_page", "bot check or captcha returned")

    return Probe(Verdict.INDETERMINATE, "unrecognised_page", "no profile data found in response")
