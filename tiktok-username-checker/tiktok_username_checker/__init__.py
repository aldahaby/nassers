"""Availability checking for four-character TikTok usernames."""

from .checker import TikTokUsernameChecker
from .http_client import HttpClient
from .models import Availability, CheckResult, Probe, Verdict
from .ratelimit import AdaptiveRateLimiter
from .results import CsvResultWriter
from .retry import RetryPolicy
from .runner import CheckRunner, Summary
from .validation import ValidationError, is_valid, validate

__version__ = "1.0.0"

__all__ = [
    "Availability",
    "AdaptiveRateLimiter",
    "CheckResult",
    "CheckRunner",
    "CsvResultWriter",
    "HttpClient",
    "Probe",
    "RetryPolicy",
    "Summary",
    "TikTokUsernameChecker",
    "ValidationError",
    "Verdict",
    "__version__",
    "is_valid",
    "validate",
]
