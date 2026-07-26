"""Logging configuration for the command line application."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

CONSOLE_FORMAT = "%(asctime)s %(levelname)-7s %(message)s"
FILE_FORMAT = "%(asctime)s %(levelname)-7s [%(threadName)s] %(name)s: %(message)s"
TIME_FORMAT = "%H:%M:%S"


def configure_logging(verbosity: int = 0, log_file: str | None = None) -> logging.Logger:
    """Configure root logging and return the application logger.

    ``verbosity`` is ``-1`` for quiet, ``0`` for normal and ``1`` or more for
    debug output.  The optional log file always receives debug-level records.
    """
    if verbosity <= -1:
        console_level = logging.WARNING
    elif verbosity == 0:
        console_level = logging.INFO
    else:
        console_level = logging.DEBUG

    root = logging.getLogger()
    for handler in list(root.handlers):
        root.removeHandler(handler)
        handler.close()
    root.setLevel(logging.DEBUG)

    console = logging.StreamHandler(stream=sys.stderr)
    console.setLevel(console_level)
    console.setFormatter(logging.Formatter(CONSOLE_FORMAT, datefmt=TIME_FORMAT))
    root.addHandler(console)

    if log_file:
        path = Path(log_file)
        if path.parent and not path.parent.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(path, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter(FILE_FORMAT))
        root.addHandler(file_handler)

    # urllib3 logs every connection at debug level, which drowns out our own.
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    return logging.getLogger("tiktok_username_checker")
