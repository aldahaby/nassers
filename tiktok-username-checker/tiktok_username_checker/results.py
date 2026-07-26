"""Durable CSV output for check results."""

from __future__ import annotations

import csv
import logging
import os
import threading
import time
from pathlib import Path

from .models import CSV_FIELDS, CheckResult

LOGGER = logging.getLogger(__name__)


class CsvResultWriter:
    """Appends results to a CSV file, flushing periodically.

    The writer is safe to call from several worker threads and always leaves a
    valid CSV behind, even if the process is interrupted.
    """

    def __init__(
        self,
        path: str | os.PathLike[str],
        *,
        append: bool = True,
        flush_every: int = 25,
        flush_interval: float = 2.0,
    ) -> None:
        self._path = Path(path)
        self._append = append
        self._flush_every = max(1, flush_every)
        self._flush_interval = max(0.0, flush_interval)
        self._lock = threading.Lock()
        self._handle = None
        self._writer: csv.DictWriter | None = None
        self._since_flush = 0
        self._last_flush = time.monotonic()
        self._written = 0

    @property
    def path(self) -> Path:
        return self._path

    @property
    def written(self) -> int:
        with self._lock:
            return self._written

    def open(self) -> "CsvResultWriter":
        parent = self._path.parent
        if parent and not parent.exists():
            parent.mkdir(parents=True, exist_ok=True)

        existing = self._path.exists() and self._path.stat().st_size > 0
        mode = "a" if (self._append and existing) else "w"
        self._handle = self._path.open(mode, newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._handle, fieldnames=list(CSV_FIELDS))
        if mode == "w" or not existing:
            self._writer.writeheader()
            self._handle.flush()
        return self

    def write(self, result: CheckResult) -> None:
        if self._writer is None or self._handle is None:
            raise RuntimeError("writer is not open")
        with self._lock:
            self._writer.writerow(result.to_row())
            self._written += 1
            self._since_flush += 1
            now = time.monotonic()
            if (
                self._since_flush >= self._flush_every
                or now - self._last_flush >= self._flush_interval
            ):
                self._handle.flush()
                self._since_flush = 0
                self._last_flush = now

    def flush(self) -> None:
        with self._lock:
            if self._handle is not None:
                self._handle.flush()
                self._since_flush = 0
                self._last_flush = time.monotonic()

    def close(self) -> None:
        with self._lock:
            if self._handle is not None:
                try:
                    self._handle.flush()
                    os.fsync(self._handle.fileno())
                except (OSError, ValueError):  # pragma: no cover - best effort
                    pass
                self._handle.close()
            self._handle = None
            self._writer = None

    def __enter__(self) -> "CsvResultWriter":
        return self.open()

    def __exit__(self, *exc_info: object) -> None:
        self.close()


def load_previous_results(path: str | os.PathLike[str]) -> dict[str, str]:
    """Return ``{username: status}`` from an existing results CSV.

    Missing or unreadable files yield an empty mapping; later rows win so a
    re-checked username reflects its most recent status.
    """
    target = Path(path)
    if not target.exists():
        return {}

    previous: dict[str, str] = {}
    try:
        with target.open("r", newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames is None or "username" not in reader.fieldnames:
                LOGGER.warning("%s has no username column; ignoring for resume", target)
                return {}
            for row in reader:
                username = (row.get("username") or "").strip()
                if username:
                    previous[username] = (row.get("status") or "").strip()
    except (OSError, csv.Error) as exc:
        LOGGER.warning("could not read %s for resume: %s", target, exc)
    return previous


class AvailableNameLog:
    """Appends every available username to a plain text file as it is found."""

    def __init__(self, path: str | os.PathLike[str]) -> None:
        self._path = Path(path)
        self._lock = threading.Lock()
        self._handle = None

    def open(self) -> "AvailableNameLog":
        parent = self._path.parent
        if parent and not parent.exists():
            parent.mkdir(parents=True, exist_ok=True)
        self._handle = self._path.open("a", encoding="utf-8")
        return self

    def write(self, username: str) -> None:
        if self._handle is None:
            raise RuntimeError("log is not open")
        with self._lock:
            self._handle.write(f"{username}\n")
            self._handle.flush()

    def close(self) -> None:
        with self._lock:
            if self._handle is not None:
                self._handle.close()
            self._handle = None

    def __enter__(self) -> "AvailableNameLog":
        return self.open()

    def __exit__(self, *exc_info: object) -> None:
        self.close()
