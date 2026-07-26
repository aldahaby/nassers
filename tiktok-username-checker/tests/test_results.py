import csv
import tempfile
import threading
import unittest
from pathlib import Path

from tiktok_username_checker.models import CSV_FIELDS, Availability, CheckResult
from tiktok_username_checker.results import (
    AvailableNameLog,
    CsvResultWriter,
    load_previous_results,
)


def make_result(username: str, status: Availability = Availability.AVAILABLE) -> CheckResult:
    return CheckResult(
        username=username,
        status=status,
        reason="http_404",
        http_status=404,
        attempts=1,
        elapsed_ms=42,
        confirmed=True,
        detail="",
    )


class CsvWriterTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.path = Path(self._tmp.name) / "nested" / "results.csv"

    def read_rows(self):
        with self.path.open(newline="", encoding="utf-8") as handle:
            return list(csv.DictReader(handle))

    def test_writes_header_and_rows_creating_parent_directories(self):
        with CsvResultWriter(self.path) as writer:
            writer.write(make_result("ab.c"))
            writer.write(make_result("zzzz", Availability.TAKEN))
        rows = self.read_rows()
        self.assertEqual([row["username"] for row in rows], ["ab.c", "zzzz"])
        self.assertEqual(rows[0]["status"], "available")
        self.assertEqual(rows[1]["status"], "taken")
        self.assertEqual(list(rows[0].keys()), list(CSV_FIELDS))
        self.assertEqual(rows[0]["profile_url"], "https://www.tiktok.com/@ab.c")

    def test_invalid_results_have_no_profile_url(self):
        with CsvResultWriter(self.path) as writer:
            writer.write(
                CheckResult(
                    username="toolong",
                    status=Availability.INVALID,
                    reason="bad_length",
                    detail="must be exactly 4 characters, got 7",
                )
            )
        rows = self.read_rows()
        self.assertEqual(rows[0]["profile_url"], "")
        self.assertEqual(rows[0]["status"], "invalid")

    def test_append_keeps_previous_rows_and_writes_one_header(self):
        with CsvResultWriter(self.path) as writer:
            writer.write(make_result("aaaa"))
        with CsvResultWriter(self.path, append=True) as writer:
            writer.write(make_result("bbbb"))
        rows = self.read_rows()
        self.assertEqual([row["username"] for row in rows], ["aaaa", "bbbb"])
        self.assertEqual(self.path.read_text(encoding="utf-8").count("username,status"), 1)

    def test_overwrite_replaces_file(self):
        with CsvResultWriter(self.path) as writer:
            writer.write(make_result("aaaa"))
        with CsvResultWriter(self.path, append=False) as writer:
            writer.write(make_result("bbbb"))
        self.assertEqual([row["username"] for row in self.read_rows()], ["bbbb"])

    def test_fields_with_commas_and_quotes_round_trip(self):
        nasty = CheckResult(
            username="a.b_",
            status=Availability.ERROR,
            reason="transport_timeout",
            detail='timeout, "connection" reset\nsecond line',
        )
        with CsvResultWriter(self.path) as writer:
            writer.write(nasty)
        rows = self.read_rows()
        self.assertEqual(rows[0]["detail"], 'timeout, "connection" reset\nsecond line')

    def test_concurrent_writes_are_serialised(self):
        names = [f"{index:04d}" for index in range(200)]
        with CsvResultWriter(self.path) as writer:
            threads = [
                threading.Thread(target=writer.write, args=(make_result(name),))
                for name in names
            ]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
        rows = self.read_rows()
        self.assertEqual(len(rows), 200)
        self.assertEqual({row["username"] for row in rows}, set(names))

    def test_write_before_open_raises(self):
        with self.assertRaises(RuntimeError):
            CsvResultWriter(self.path).write(make_result("aaaa"))


class LoadPreviousResultsTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.path = Path(self._tmp.name) / "results.csv"

    def test_missing_file_returns_empty(self):
        self.assertEqual(load_previous_results(self.path), {})

    def test_reads_usernames_and_statuses(self):
        with CsvResultWriter(self.path) as writer:
            writer.write(make_result("aaaa"))
            writer.write(make_result("bbbb", Availability.TAKEN))
        self.assertEqual(
            load_previous_results(self.path), {"aaaa": "available", "bbbb": "taken"}
        )

    def test_last_row_wins(self):
        with CsvResultWriter(self.path) as writer:
            writer.write(make_result("aaaa", Availability.ERROR))
            writer.write(make_result("aaaa", Availability.TAKEN))
        self.assertEqual(load_previous_results(self.path), {"aaaa": "taken"})

    def test_unrelated_csv_is_ignored(self):
        self.path.write_text("a,b\n1,2\n", encoding="utf-8")
        self.assertEqual(load_previous_results(self.path), {})


class AvailableNameLogTests(unittest.TestCase):
    def test_appends_names(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sub" / "available.txt"
            with AvailableNameLog(path) as log:
                log.write("ab.c")
                log.write("zz_9")
            with AvailableNameLog(path) as log:
                log.write("qqqq")
            self.assertEqual(
                path.read_text(encoding="utf-8").split(), ["ab.c", "zz_9", "qqqq"]
            )


if __name__ == "__main__":
    unittest.main()
