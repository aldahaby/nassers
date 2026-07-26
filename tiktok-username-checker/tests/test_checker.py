import threading
import unittest

from tests.fake_tiktok import CAPTCHA_PAGE, not_found_body, taken_body
from tiktok_username_checker.checker import TikTokUsernameChecker
from tiktok_username_checker.http_client import HttpResponse, TransportError
from tiktok_username_checker.models import Availability
from tiktok_username_checker.ratelimit import AdaptiveRateLimiter
from tiktok_username_checker.retry import RetryPolicy

FAST_RETRY = RetryPolicy(max_attempts=3, base_delay=0.0, multiplier=1.0, max_delay=0.0, jitter=0.0)


class ScriptedClient:
    """Returns queued responses (or raises queued exceptions) in order."""

    def __init__(self, script):
        self.script = list(script)
        self.calls = []

    def get(self, url, *, allow_redirects=True):
        self.calls.append(url)
        item = self.script.pop(0) if self.script else self.script_default()
        if isinstance(item, Exception):
            raise item
        return item

    def script_default(self):
        raise AssertionError("client called more times than the script allows")


def response(status, body="", headers=None, truncated=False):
    return HttpResponse(
        status_code=status,
        text=body,
        headers=headers or {},
        url="http://test/@name",
        truncated=truncated,
    )


def make_checker(script, **kwargs):
    client = ScriptedClient(script)
    limiter = AdaptiveRateLimiter(rate=1000.0, burst=1000.0)
    kwargs.setdefault("confirm_available", False)
    kwargs.setdefault("confirm_delay", 0.0)
    checker = TikTokUsernameChecker(
        client,
        limiter,
        kwargs.pop("retry_policy", FAST_RETRY),
        profile_url_template="http://test/@{username}",
        **kwargs,
    )
    return checker, client, limiter


class CheckerTests(unittest.TestCase):
    def test_invalid_username_never_hits_the_network(self):
        checker, client, _ = make_checker([])
        result = checker.check("toolong")
        self.assertIs(result.status, Availability.INVALID)
        self.assertEqual(result.reason, "bad_length")
        self.assertEqual(client.calls, [])
        self.assertEqual(result.http_status, None)

    def test_trailing_period_is_invalid(self):
        checker, client, _ = make_checker([])
        result = checker.check("abc.")
        self.assertIs(result.status, Availability.INVALID)
        self.assertEqual(result.reason, "trailing_period")
        self.assertEqual(client.calls, [])

    def test_404_means_available(self):
        checker, client, _ = make_checker([response(404, not_found_body())])
        result = checker.check("zq7_")
        self.assertIs(result.status, Availability.AVAILABLE)
        self.assertEqual(result.reason, "http_404")
        self.assertEqual(result.http_status, 404)
        self.assertEqual(result.attempts, 1)
        self.assertEqual(client.calls, ["http://test/@zq7_"])

    def test_200_with_profile_means_taken(self):
        checker, _, _ = make_checker([response(200, taken_body("ab.c"))])
        result = checker.check("ab.c")
        self.assertIs(result.status, Availability.TAKEN)
        self.assertEqual(result.reason, "profile_data_present")

    def test_periods_are_url_encoded_nowhere_and_passed_through(self):
        checker, client, _ = make_checker([response(404, not_found_body())])
        checker.check(".ab1")
        self.assertEqual(client.calls, ["http://test/@.ab1"])

    def test_429_is_retried_then_succeeds(self):
        checker, client, limiter = make_checker(
            [response(429, headers={"retry-after": "0"}), response(404, not_found_body())]
        )
        before = limiter.rate
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.AVAILABLE)
        self.assertEqual(result.attempts, 2)
        self.assertEqual(len(client.calls), 2)
        self.assertLess(limiter.rate, before)

    def test_transport_errors_are_retried(self):
        checker, client, _ = make_checker(
            [
                TransportError("boom", kind="connection_error"),
                TransportError("boom", kind="timeout"),
                response(200, taken_body("abcd")),
            ]
        )
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.TAKEN)
        self.assertEqual(result.attempts, 3)

    def test_exhausted_retries_produce_an_error_result(self):
        checker, client, _ = make_checker([response(503) for _ in range(3)])
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.ERROR)
        self.assertEqual(result.reason, "http_503")
        self.assertEqual(result.attempts, 3)
        self.assertEqual(len(client.calls), 3)

    def test_captcha_page_never_reports_available(self):
        checker, _, _ = make_checker([response(200, CAPTCHA_PAGE) for _ in range(3)])
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.ERROR)
        self.assertEqual(result.reason, "challenge_page")

    def test_403_is_error_not_available(self):
        checker, _, limiter = make_checker([response(403, "denied") for _ in range(3)])
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.ERROR)
        self.assertEqual(result.reason, "http_403")
        self.assertLess(limiter.rate, 1000.0)

    def test_404_that_still_contains_a_profile_is_taken(self):
        checker, _, _ = make_checker([response(404, taken_body("abcd"))])
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.TAKEN)

    def test_confirmation_second_look_agrees(self):
        checker, client, _ = make_checker(
            [response(404, not_found_body()), response(404, not_found_body())],
            confirm_available=True,
        )
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.AVAILABLE)
        self.assertTrue(result.confirmed)
        self.assertEqual(result.attempts, 2)
        self.assertEqual(len(client.calls), 2)

    def test_confirmation_overrides_a_false_available(self):
        checker, _, _ = make_checker(
            [response(404, not_found_body()), response(200, taken_body("abcd"))],
            confirm_available=True,
        )
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.TAKEN)
        self.assertTrue(result.confirmed)

    def test_inconclusive_confirmation_reports_unconfirmed_available(self):
        checker, _, _ = make_checker(
            [response(404, not_found_body())] + [response(503) for _ in range(3)],
            confirm_available=True,
        )
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.AVAILABLE)
        self.assertFalse(result.confirmed)
        self.assertIn("confirmation inconclusive", result.detail)

    def test_stop_event_aborts_without_requests(self):
        stop = threading.Event()
        stop.set()
        checker, client, _ = make_checker([], stop=stop)
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.ERROR)
        self.assertEqual(result.reason, "aborted")
        self.assertEqual(client.calls, [])

    def test_truncated_body_is_noted(self):
        checker, _, _ = make_checker(
            [response(200, "<html>partial", truncated=True) for _ in range(3)]
        )
        result = checker.check("abcd")
        self.assertIs(result.status, Availability.ERROR)
        self.assertIn("truncated", result.detail)

    def test_elapsed_time_is_recorded(self):
        checker, _, _ = make_checker([response(404, not_found_body())])
        result = checker.check("abcd")
        self.assertGreaterEqual(result.elapsed_ms, 0)
        self.assertEqual(result.profile_url, "https://www.tiktok.com/@abcd")


if __name__ == "__main__":
    unittest.main()
