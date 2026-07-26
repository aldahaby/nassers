import io
import logging
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from tiktok_username_checker import cli
from tiktok_username_checker.models import Availability


class ArgumentTests(unittest.TestCase):
    def parse(self, argv):
        return cli.build_parser().parse_args(argv)

    def test_defaults(self):
        args = self.parse(["abcd"])
        self.assertEqual(args.usernames, ["abcd"])
        self.assertEqual(args.workers, 8)
        self.assertEqual(args.rate, 5.0)
        self.assertEqual(args.retries, 4)
        self.assertTrue(args.confirm)
        self.assertEqual(args.output, cli.DEFAULT_OUTPUT)

    def test_no_input_is_a_usage_error(self):
        with self.assertRaises(SystemExit) as caught:
            cli.main([])
        self.assertEqual(caught.exception.code, cli.EXIT_USAGE)

    def test_invalid_charset_is_a_usage_error(self):
        with self.assertRaises(SystemExit) as caught:
            cli.main(["--generate", "5", "--charset", "AB"])
        self.assertEqual(caught.exception.code, cli.EXIT_USAGE)

    def test_non_positive_generate_is_a_usage_error(self):
        with self.assertRaises(SystemExit) as caught:
            cli.main(["--generate", "0"])
        self.assertEqual(caught.exception.code, cli.EXIT_USAGE)


class ExpectedTotalTests(unittest.TestCase):
    def test_counts_generated_candidates(self):
        args = cli.build_parser().parse_args(["--generate", "25"])
        self.assertEqual(cli._expected_total(args), 25)

    def test_counts_full_space(self):
        args = cli.build_parser().parse_args(["--generate-all", "--charset", "ab."])
        self.assertEqual(cli._expected_total(args), 3 * 3 * 3 * 2)

    def test_unknown_for_streamed_files(self):
        args = cli.build_parser().parse_args(["--input", "-"])
        self.assertIsNone(cli._expected_total(args))


class PrepareTests(unittest.TestCase):
    def prepare(self, raw, **kwargs):
        options = {
            "fold_case": False,
            "dedupe": True,
            "limit": None,
            "skip": None,
            "recheck_errors": False,
            "logger": logging.getLogger("test"),
        }
        options.update(kwargs)
        return list(cli._prepare(raw, **options))

    def test_normalizes_and_dedupes(self):
        self.assertEqual(self.prepare([" @ab.c ", "ab.c", "", "  "]), ["ab.c"])

    def test_dedupe_can_be_disabled(self):
        self.assertEqual(self.prepare(["abcd", "abcd"], dedupe=False), ["abcd", "abcd"])

    def test_limit_applies_after_normalisation(self):
        self.assertEqual(self.prepare(["aaaa", "bbbb", "cccc"], limit=2), ["aaaa", "bbbb"])

    def test_invalid_names_are_kept_so_they_are_recorded(self):
        self.assertEqual(self.prepare(["toolong"]), ["toolong"])

    def test_resume_skips_recorded_names(self):
        skip = {"aaaa": Availability.TAKEN.value, "bbbb": Availability.ERROR.value}
        self.assertEqual(self.prepare(["aaaa", "bbbb", "cccc"], skip=skip), ["cccc"])

    def test_recheck_errors_revisits_failures(self):
        skip = {"aaaa": Availability.TAKEN.value, "bbbb": Availability.ERROR.value}
        self.assertEqual(
            self.prepare(["aaaa", "bbbb", "cccc"], skip=skip, recheck_errors=True),
            ["bbbb", "cccc"],
        )

    def test_fold_case(self):
        self.assertEqual(self.prepare(["AB.C"], fold_case=True), ["ab.c"])


class ValidateOnlyTests(unittest.TestCase):
    def test_reports_valid_and_invalid_without_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "names.txt"
            source.write_text(
                "# comment\nab.c\n\nabc.\nTOOLONG\n@zz_1\n", encoding="utf-8"
            )
            buffer = io.StringIO()
            with redirect_stdout(buffer):
                exit_code = cli.main(["--input", str(source), "--validate-only", "--quiet"])
        output = buffer.getvalue()
        self.assertEqual(exit_code, cli.EXIT_OK)
        self.assertIn("valid   ab.c", output)
        self.assertIn("valid   zz_1", output)
        self.assertIn("invalid abc.", output)
        self.assertIn("invalid TOOLONG", output)
        self.assertNotIn("comment", output)

    def test_validates_generated_candidates(self):
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            exit_code = cli.main(
                ["--generate-all", "--charset", "a.", "--validate-only", "--quiet"]
            )
        self.assertEqual(exit_code, cli.EXIT_OK)
        lines = [line for line in buffer.getvalue().splitlines() if line]
        self.assertTrue(all(line.startswith("valid") for line in lines))
        self.assertEqual(len(lines), 2 * 2 * 2 * 1)


if __name__ == "__main__":
    unittest.main()
