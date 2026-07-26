import unittest

from tiktok_username_checker.generator import (
    candidate_at,
    candidate_space,
    iter_all,
    iter_random,
    resolve_charset,
)
from tiktok_username_checker.validation import DEFAULT_CHARSET, is_valid


class GeneratorTests(unittest.TestCase):
    def test_resolve_presets(self):
        self.assertEqual(resolve_charset("letters"), "abcdefghijklmnopqrstuvwxyz")
        self.assertEqual(resolve_charset("digits"), "0123456789")
        self.assertEqual(resolve_charset("full"), DEFAULT_CHARSET)

    def test_resolve_literal_charset_deduplicates(self):
        self.assertEqual(resolve_charset("aabb.."), "ab.")

    def test_resolve_rejects_illegal_characters(self):
        with self.assertRaises(ValueError):
            resolve_charset("aB")
        with self.assertRaises(ValueError):
            resolve_charset("")

    def test_candidate_space_matches_enumeration(self):
        for charset in ("ab.", "a1_.", "digits"):
            with self.subTest(charset=charset):
                self.assertEqual(len(list(iter_all(charset))), candidate_space(charset))

    def test_full_space_size(self):
        # 38 options for the first three positions, 37 for the last.
        self.assertEqual(candidate_space("full"), 38 * 38 * 38 * 37)

    def test_all_generated_candidates_are_valid_and_unique(self):
        produced = list(iter_all("a1._"))
        self.assertEqual(len(produced), len(set(produced)))
        for candidate in produced:
            self.assertTrue(is_valid(candidate), candidate)

    def test_random_candidates_are_valid_unique_and_deterministic(self):
        first = list(iter_random(50, "full", seed=7))
        second = list(iter_random(50, "full", seed=7))
        self.assertEqual(first, second)
        self.assertEqual(len(set(first)), 50)
        for candidate in first:
            self.assertTrue(is_valid(candidate), candidate)

    def test_random_count_above_space_yields_whole_space(self):
        produced = list(iter_random(1000, "ab.", seed=1))
        self.assertEqual(sorted(produced), sorted(iter_all("ab.")))

    def test_random_zero_yields_nothing(self):
        self.assertEqual(list(iter_random(0)), [])

    def test_candidate_at_matches_enumeration_order(self):
        for charset in ("ab.", "a1_."):
            with self.subTest(charset=charset):
                expected = list(iter_all(charset))
                actual = [candidate_at(index, charset) for index in range(len(expected))]
                self.assertEqual(actual, expected)

    def test_candidate_at_over_the_full_space(self):
        self.assertEqual(candidate_at(0, "full"), "aaaa")
        self.assertEqual(candidate_at(candidate_space("full") - 1, "full"), "____")
        with self.assertRaises(IndexError):
            candidate_at(candidate_space("full"), "full")
        with self.assertRaises(IndexError):
            candidate_at(-1, "full")

    def test_large_random_sample_is_fast_and_unique(self):
        produced = list(iter_random(50_000, "full", seed=3))
        self.assertEqual(len(produced), 50_000)
        self.assertEqual(len(set(produced)), 50_000)
        for candidate in produced:
            self.assertTrue(is_valid(candidate), candidate)


if __name__ == "__main__":
    unittest.main()
