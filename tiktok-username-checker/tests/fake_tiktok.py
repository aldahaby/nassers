"""A local HTTP server that replays TikTok's profile-page response shapes.

This exists purely so the retry, parsing, concurrency and CSV layers can be
exercised end to end over real sockets without sending traffic to TikTok.  The
application itself never talks to it.
"""

from __future__ import annotations

import json
import threading
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

TAKEN_TEMPLATE = """<!DOCTYPE html><html><head><title>{username}</title></head><body>
<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{payload}</script>
</body></html>"""

NOT_FOUND_TEMPLATE = """<!DOCTYPE html><html><head><title>Not found</title></head><body>
<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{payload}</script>
</body></html>"""

CAPTCHA_PAGE = """<!DOCTYPE html><html><body><div id="tiktok-verify-page">
Please wait while we verify your request.</div></body></html>"""


def taken_body(username: str) -> str:
    payload = {
        "__DEFAULT_SCOPE__": {
            "webapp.user-detail": {
                "userInfo": {
                    "user": {
                        "id": "6784958473",
                        "uniqueId": username,
                        "nickname": username.upper(),
                    },
                    "stats": {"followerCount": 12},
                },
                "statusCode": 0,
                "statusMsg": "",
            }
        }
    }
    return TAKEN_TEMPLATE.format(username=username, payload=json.dumps(payload))


def not_found_body() -> str:
    payload = {
        "__DEFAULT_SCOPE__": {
            "webapp.user-detail": {
                "userInfo": {},
                "statusCode": 10221,
                "statusMsg": "user doesn't exist",
            }
        }
    }
    return NOT_FOUND_TEMPLATE.format(payload=json.dumps(payload))


class FakeTikTok:
    """Serves ``/@<username>`` with configurable, scripted behaviour."""

    def __init__(self, taken: set[str] | None = None) -> None:
        self.taken = set(taken or ())
        self.requests: Counter[str] = Counter()
        self.rate_limited_until_attempt: dict[str, int] = {}
        self.server_error_until_attempt: dict[str, int] = {}
        self.captcha_usernames: set[str] = set()
        self.retry_after: str | None = "0"
        self._lock = threading.Lock()

        outer = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_GET(self) -> None:  # noqa: N802 - required name
                username = unquote(self.path.lstrip("/"))
                if username.startswith("@"):
                    username = username[1:]
                status, body, headers = outer.respond(username)
                encoded = body.encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(encoded)))
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(encoded)

            def log_message(self, *args: object) -> None:
                return

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    def respond(self, username: str) -> tuple[int, str, dict[str, str]]:
        with self._lock:
            self.requests[username] += 1
            attempt = self.requests[username]
            rate_limit_until = self.rate_limited_until_attempt.get(username, 0)
            error_until = self.server_error_until_attempt.get(username, 0)
            is_captcha = username in self.captcha_usernames
            is_taken = username in self.taken
            retry_after = self.retry_after

        if attempt <= rate_limit_until:
            headers = {"Retry-After": retry_after} if retry_after is not None else {}
            return 429, "<html><body>Too many requests</body></html>", headers
        if attempt <= error_until:
            return 503, "<html><body>Service Unavailable</body></html>", {}
        if is_captcha:
            return 200, CAPTCHA_PAGE, {}
        if is_taken:
            return 200, taken_body(username), {}
        return 404, not_found_body(), {}

    @property
    def url_template(self) -> str:
        host, port = self._server.server_address[:2]
        return f"http://{host}:{port}/@{{username}}"

    def start(self) -> "FakeTikTok":
        self._thread.start()
        return self

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()
        self._thread.join(timeout=5)

    def __enter__(self) -> "FakeTikTok":
        return self.start()

    def __exit__(self, *exc_info: object) -> None:
        self.stop()
