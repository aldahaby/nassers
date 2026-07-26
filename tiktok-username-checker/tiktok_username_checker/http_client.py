"""Thin HTTP layer over :mod:`requests` with per-thread connection pooling."""

from __future__ import annotations

import random
import threading
from dataclasses import dataclass
from typing import Mapping

import requests
from requests.adapters import HTTPAdapter

DEFAULT_USER_AGENTS: tuple[str, ...] = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
)

BASE_HEADERS: Mapping[str, str] = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,"
    "image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024


class TransportError(Exception):
    """A request failed before a complete response was available."""

    def __init__(self, message: str, *, kind: str) -> None:
        super().__init__(message)
        self.kind = kind


@dataclass(frozen=True)
class HttpResponse:
    """The parts of an HTTP response this application cares about."""

    status_code: int
    text: str
    headers: Mapping[str, str]
    url: str
    truncated: bool = False

    def header(self, name: str) -> str | None:
        return self.headers.get(name)


class HttpClient:
    """Issues GET requests using one pooled :class:`requests.Session` per thread."""

    def __init__(
        self,
        *,
        connect_timeout: float = 10.0,
        read_timeout: float = 20.0,
        user_agents: tuple[str, ...] = DEFAULT_USER_AGENTS,
        pool_maxsize: int = 8,
        proxy: str | None = None,
        max_body_bytes: int = DEFAULT_MAX_BODY_BYTES,
        rng: random.Random | None = None,
    ) -> None:
        if not user_agents:
            raise ValueError("at least one user agent is required")
        self._timeout = (connect_timeout, read_timeout)
        self._user_agents = user_agents
        self._pool_maxsize = max(1, pool_maxsize)
        self._proxies = {"http": proxy, "https": proxy} if proxy else None
        self._max_body_bytes = max_body_bytes
        self._rng = rng or random.Random()
        self._local = threading.local()
        self._sessions: list[requests.Session] = []
        self._lock = threading.Lock()

    def _session(self) -> requests.Session:
        session = getattr(self._local, "session", None)
        if session is not None:
            return session

        session = requests.Session()
        adapter = HTTPAdapter(
            pool_connections=self._pool_maxsize,
            pool_maxsize=self._pool_maxsize,
            max_retries=0,  # retries are handled by the checker, with backoff
        )
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        session.headers.update(BASE_HEADERS)
        with self._lock:
            user_agent = self._rng.choice(self._user_agents)
        session.headers["User-Agent"] = user_agent
        if self._proxies:
            session.proxies.update(self._proxies)

        self._local.session = session
        with self._lock:
            self._sessions.append(session)
        return session

    def get(self, url: str, *, allow_redirects: bool = True) -> HttpResponse:
        """Perform a GET request, raising :class:`TransportError` on failure."""
        session = self._session()
        try:
            response = session.get(
                url,
                timeout=self._timeout,
                allow_redirects=allow_redirects,
                stream=True,
            )
        except requests.exceptions.Timeout as exc:
            raise TransportError(f"timeout requesting {url}: {exc}", kind="timeout") from exc
        except requests.exceptions.TooManyRedirects as exc:
            raise TransportError(f"redirect loop for {url}: {exc}", kind="redirect_loop") from exc
        except requests.exceptions.SSLError as exc:
            raise TransportError(f"TLS failure for {url}: {exc}", kind="tls_error") from exc
        except requests.exceptions.ConnectionError as exc:
            raise TransportError(
                f"connection failure for {url}: {exc}", kind="connection_error"
            ) from exc
        except requests.RequestException as exc:
            raise TransportError(f"request failed for {url}: {exc}", kind="request_error") from exc

        try:
            body, truncated = self._read_body(response, url)
            return HttpResponse(
                status_code=response.status_code,
                text=body,
                headers={key.lower(): value for key, value in response.headers.items()},
                url=response.url,
                truncated=truncated,
            )
        finally:
            response.close()

    def _read_body(self, response: requests.Response, url: str) -> tuple[str, bool]:
        chunks: list[bytes] = []
        size = 0
        truncated = False
        try:
            for chunk in response.iter_content(chunk_size=65536):
                if not chunk:
                    continue
                chunks.append(chunk)
                size += len(chunk)
                if size >= self._max_body_bytes:
                    truncated = True
                    break
        except requests.exceptions.Timeout as exc:
            raise TransportError(f"timeout reading {url}: {exc}", kind="timeout") from exc
        except requests.RequestException as exc:
            raise TransportError(f"failed reading {url}: {exc}", kind="read_error") from exc

        raw = b"".join(chunks)
        # requests falls back to ISO-8859-1 for text/* without an explicit
        # charset, which mangles TikTok's UTF-8 payloads; only trust the
        # header when it actually declares one.
        content_type = response.headers.get("Content-Type", "")
        encoding = response.encoding if "charset=" in content_type.lower() else "utf-8"
        try:
            return raw.decode(encoding or "utf-8", errors="replace"), truncated
        except LookupError:
            return raw.decode("utf-8", errors="replace"), truncated

    def close(self) -> None:
        """Close every session created by this client."""
        with self._lock:
            sessions, self._sessions = self._sessions, []
        for session in sessions:
            try:
                session.close()
            except Exception:  # pragma: no cover - defensive cleanup
                pass

    def __enter__(self) -> "HttpClient":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()
