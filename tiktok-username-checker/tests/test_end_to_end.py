"""End-to-end checks over real sockets against a local TikTok stand-in."""

import csv
import tempfile
import threading
import time
import unittest
from pathlib import Path

from tests.fake_tiktok import FakeTikTok
from tiktok_username_checker.checker import TikTokUsernameChecker
from tiktok_username_checker.http_client import HttpClient
from tiktok_username_checker.ratelimit import AdaptiveRateLimiter
from tiktok_username_checker.results import CsvResultWriter, load_previous_results
from tiktok_username_checker.retry import RetryPolicy
from tiktok_username_checker.runner import CheckRunner

FAST_RETRY = RetryPolicy(max_attempts=4, base_delay=0.01, multiplier=2.0, max_delay=0.1, jitter=0.0)


class EndToEndTests(unittest.TestCase):
    def setUp(self):
        self.server = FakeTikTok(taken={"abcd", "zz.9", "a_b1"}).start()
        self.addCleanup(self.server.stop)
        self.client = HttpClient(connect_timeout=5, read_timeout=5, pool_maxsize=8)
        self.addCleanup(self.client.close)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.csv_path = Path(self.tmp.name) / "results.csv"
        self.stop = threading.Event()

    def build_checker(self, *, rate=200.0, confirm=False, stop=None):
        return TikTokUsernameChecker(
            self.client,
            AdaptiveRateLimiter(rate=rate, burst=rate, min_rate=1.0),
            FAST_RETRY,
            confirm_available=confirm,
            confirm_delay=0.0,
            stop=stop or self.stop,
            profile_url_template=self.server.url_template,
        )

    def run_batch(self, usernames, *, workers=8, confirm=False, checker=None):
        checker = checker or self.build_checker(confirm=confirm)
        with CsvResultWriter(self.csv_path, append=False, flush_every=1) as writer:
            runner = CheckRunner(checker, writer, workers=workers, stop=self.stop)
            summary = runner.run(usernames, expected_total=len(usernames))
        return summary

    def read_rows(self):
        with self.csv_path.open(newline="", encoding="utf-8") as handle:
            return {row["username"]: row for row in csv.DictReader(handle)}

    def test_mixed_batch_over_http(self):
        usernames = ["abcd", "zz.9", "a_b1", "qq7_", ".xy2", "toolong", "AB.c", "ab.."]
        summary = self.run_batch(usernames)

        rows = self.read_rows()
        self.assertEqual(len(rows), len(usernames))
        self.assertEqual(rows["abcd"]["status"], "taken")
        self.assertEqual(rows["zz.9"]["status"], "taken")
        self.assertEqual(rows["a_b1"]["status"], "taken")
        self.assertEqual(rows["qq7_"]["status"], "available")
        self.assertEqual(rows[".xy2"]["status"], "available")
        self.assertEqual(rows["toolong"]["status"], "invalid")
        self.assertEqual(rows["AB.c"]["status"], "invalid")
        self.assertEqual(rows["ab.."]["status"], "invalid")
        self.assertEqual(summary.available, 2)
        self.assertEqual(summary.taken, 3)
        self.assertEqual(summary.invalid, 3)
        self.assertEqual(summary.errors, 0)
        self.assertEqual(summary.total, len(usernames))

        # Invalid names must never reach the server.
        self.assertNotIn("toolong", self.server.requests)
        self.assertNotIn("AB.c", self.server.requests)

    def test_rate_limit_is_retried_and_recovered(self):
        self.server.rate_limited_until_attempt["qq7_"] = 2
        summary = self.run_batch(["qq7_"])
        rows = self.read_rows()
        self.assertEqual(rows["qq7_"]["status"], "available")
        self.assertEqual(int(rows["qq7_"]["attempts"]), 3)
        self.assertEqual(self.server.requests["qq7_"], 3)
        self.assertEqual(summary.errors, 0)

    def test_server_errors_beyond_retries_are_reported_as_errors(self):
        self.server.server_error_until_attempt["qq7_"] = 99
        self.run_batch(["qq7_"])
        rows = self.read_rows()
        self.assertEqual(rows["qq7_"]["status"], "error")
        self.assertEqual(rows["qq7_"]["reason"], "http_503")
        self.assertEqual(int(rows["qq7_"]["attempts"]), FAST_RETRY.max_attempts)

    def test_captcha_is_never_reported_as_available(self):
        self.server.captcha_usernames.add("qq7_")
        self.run_batch(["qq7_"])
        rows = self.read_rows()
        self.assertEqual(rows["qq7_"]["status"], "error")
        self.assertEqual(rows["qq7_"]["reason"], "challenge_page")

    def test_confirmation_doubles_requests_for_available_names(self):
        self.run_batch(["qq7_", "abcd"], confirm=True)
        rows = self.read_rows()
        self.assertEqual(rows["qq7_"]["status"], "available")
        self.assertEqual(rows["qq7_"]["confirmed"], "true")
        self.assertEqual(self.server.requests["qq7_"], 2)
        self.assertEqual(self.server.requests["abcd"], 1)

    def test_large_concurrent_batch(self):
        usernames = [f"{index:04d}" for index in range(240)]
        started = time.monotonic()
        summary = self.run_batch(usernames, workers=16)
        elapsed = time.monotonic() - started

        rows = self.read_rows()
        self.assertEqual(len(rows), 240)
        self.assertEqual(summary.available, 240)
        self.assertEqual(summary.errors, 0)
        self.assertTrue(all(row["status"] == "available" for row in rows.values()))
        self.assertEqual(sum(self.server.requests.values()), 240)
        self.assertLess(elapsed, 30)

    def test_results_are_resumable(self):
        self.run_batch(["abcd", "qq7_"])
        previous = load_previous_results(self.csv_path)
        self.assertEqual(previous, {"abcd": "taken", "qq7_": "available"})

    def test_stop_event_ends_the_run_and_keeps_the_csv_valid(self):
        usernames = [f"{index:04d}" for index in range(500)]
        checker = self.build_checker(rate=40.0)

        def interrupt():
            time.sleep(0.4)
            self.stop.set()

        thread = threading.Thread(target=interrupt)
        thread.start()
        summary = self.run_batch(usernames, workers=4, checker=checker)
        thread.join()

        self.assertTrue(summary.interrupted)
        self.assertLess(summary.total, len(usernames))
        rows = self.read_rows()
        self.assertEqual(len(rows), summary.total)
        # Cancelled checks are never recorded, so a resumed run revisits them.
        self.assertTrue(all(row["status"] != "error" for row in rows.values()))
        self.assertNotIn("aborted", {row["reason"] for row in rows.values()})

    def test_generated_candidates_flow_through(self):
        from tiktok_username_checker.generator import iter_all

        candidates = list(iter_all("ab."))
        summary = self.run_batch(candidates, workers=8)
        self.assertEqual(summary.total, len(candidates))
        self.assertEqual(summary.invalid, 0)
        self.assertEqual(summary.errors, 0)


if __name__ == "__main__":
    unittest.main()
