"""Drives the command line end to end against the local TikTok stand-in."""

import csv
import tempfile
import unittest
from pathlib import Path

from tests.fake_tiktok import FakeTikTok
from tiktok_username_checker import cli


class CliEndToEndTests(unittest.TestCase):
    def setUp(self):
        self.server = FakeTikTok(taken={"abcd", "zz.9"}).start()
        self.addCleanup(self.server.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.csv_path = Path(self.tmp.name) / "results.csv"

    def run_cli(self, extra):
        argv = [
            "--profile-url",
            self.server.url_template,
            "-o",
            str(self.csv_path),
            "--rate",
            "200",
            "--retries",
            "2",
            "--retry-base-delay",
            "0.01",
            "--retry-max-delay",
            "0.05",
            "--no-confirm",
            "--quiet",
            *extra,
        ]
        return cli.main(argv)

    def rows(self):
        with self.csv_path.open(newline="", encoding="utf-8") as handle:
            return {row["username"]: row for row in csv.DictReader(handle)}

    def test_full_run_writes_every_result(self):
        exit_code = self.run_cli(["abcd", "zz.9", "qq7_", "abc.", "TOOLONG"])
        self.assertEqual(exit_code, cli.EXIT_OK)
        rows = self.rows()
        self.assertEqual(rows["abcd"]["status"], "taken")
        self.assertEqual(rows["zz.9"]["status"], "taken")
        self.assertEqual(rows["qq7_"]["status"], "available")
        self.assertEqual(rows["abc."]["status"], "invalid")
        self.assertEqual(rows["TOOLONG"]["status"], "invalid")

    def test_available_file_and_resume(self):
        available_path = Path(self.tmp.name) / "available.txt"
        self.run_cli(["qq7_", "abcd", "--available-file", str(available_path)])
        self.assertEqual(available_path.read_text(encoding="utf-8").split(), ["qq7_"])

        requests_before = dict(self.server.requests)
        self.run_cli(["qq7_", "abcd", "77qq", "--resume"])
        rows = self.rows()
        self.assertEqual(len(rows), 3)
        # Already-recorded names were not requested again.
        self.assertEqual(self.server.requests["qq7_"], requests_before["qq7_"])
        self.assertEqual(self.server.requests["abcd"], requests_before["abcd"])
        self.assertEqual(self.server.requests["77qq"], 1)

    def test_generated_batch_with_limit(self):
        exit_code = self.run_cli(
            ["--generate", "40", "--charset", "alnum", "--seed", "5", "--workers", "12"]
        )
        self.assertEqual(exit_code, cli.EXIT_OK)
        rows = self.rows()
        self.assertEqual(len(rows), 40)
        self.assertTrue(all(row["status"] in {"available", "taken"} for row in rows.values()))

    def test_generate_all_with_limit_stops_early(self):
        self.run_cli(["--generate-all", "--charset", "ab.", "--limit", "7"])
        self.assertEqual(len(self.rows()), 7)

    def test_fold_case_makes_uppercase_input_checkable(self):
        self.run_cli(["ABCD", "--fold-case"])
        rows = self.rows()
        self.assertIn("abcd", rows)
        self.assertEqual(rows["abcd"]["status"], "taken")

    def test_dedupe_by_default_for_listed_names(self):
        self.run_cli(["qq7_", "qq7_", "@qq7_"])
        self.assertEqual(len(self.rows()), 1)

    def test_bad_profile_url_is_a_usage_error(self):
        with self.assertRaises(SystemExit) as caught:
            cli.main(["abcd", "--profile-url", "https://example.test/profile"])
        self.assertEqual(caught.exception.code, cli.EXIT_USAGE)

    def test_missing_input_file_is_reported(self):
        exit_code = self.run_cli(["--input", str(Path(self.tmp.name) / "nope.txt")])
        self.assertEqual(exit_code, cli.EXIT_USAGE)

    def test_missing_input_file_is_reported_when_validating(self):
        exit_code = self.run_cli(
            ["--input", str(Path(self.tmp.name) / "nope.txt"), "--validate-only"]
        )
        self.assertEqual(exit_code, cli.EXIT_USAGE)


if __name__ == "__main__":
    unittest.main()
