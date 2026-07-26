import unittest

from tiktok_username_checker.validation import (
    ValidationError,
    describe_problem,
    is_valid,
    normalize,
    validate,
)


class ValidationTests(unittest.TestCase):
    def test_accepts_four_character_names(self):
        for username in ("abcd", "a1b2", "1234", "a_b_", "ab_c", "_abc", "____"):
            with self.subTest(username=username):
                self.assertTrue(is_valid(username), username)

    def test_period_allowed_at_start_and_middle(self):
        for username in (".abc", "a.bc", "ab.c", "..ab", "a..b", "...a", "._.a"):
            with self.subTest(username=username):
                self.assertTrue(is_valid(username), username)

    def test_period_rejected_at_end(self):
        for username in ("abc.", "a.b.", "....", "...."):
            with self.subTest(username=username):
                self.assertEqual(describe_problem(username)[0], "trailing_period")

    def test_underscore_allowed_at_end(self):
        self.assertTrue(is_valid("abc_"))

    def test_length_must_be_exactly_four(self):
        for username in ("", "a", "ab", "abc", "abcde", "abcdef"):
            with self.subTest(username=username):
                self.assertEqual(describe_problem(username)[0], "bad_length")

    def test_specials_count_towards_length(self):
        self.assertTrue(is_valid("a._b"))
        self.assertEqual(describe_problem("a._")[0], "bad_length")
        self.assertEqual(describe_problem("a._bc")[0], "bad_length")

    def test_rejects_disallowed_characters(self):
        for username in ("ABCD", "aBcd", "ab-c", "ab c", "ab!c", "abcé", "ab\tc", "a bc"):
            with self.subTest(username=username):
                problem = describe_problem(username)
                self.assertIsNotNone(problem)
                self.assertEqual(problem[0], "illegal_character")

    def test_rejects_emoji_and_astral_characters(self):
        # An emoji counts as one character, so length is fine but the
        # character itself is not allowed.
        self.assertEqual(describe_problem("ab\U0001f600c")[0], "illegal_character")
        # Three characters: length is what fails first.
        self.assertEqual(describe_problem("ab\U0001f600")[0], "bad_length")

    def test_validate_raises_with_reason(self):
        with self.assertRaises(ValidationError) as caught:
            validate("abc.")
        self.assertEqual(caught.exception.reason, "trailing_period")
        self.assertEqual(caught.exception.username, "abc.")

    def test_validate_returns_username(self):
        self.assertEqual(validate("ab.c"), "ab.c")

    def test_normalize_strips_whitespace_and_at_sign(self):
        self.assertEqual(normalize("  @ab.c \n"), "ab.c")
        self.assertEqual(normalize("@ abcd"), "abcd")

    def test_normalize_case_folding_is_opt_in(self):
        self.assertEqual(normalize("ABCD"), "ABCD")
        self.assertEqual(normalize("ABCD", fold_case=True), "abcd")


if __name__ == "__main__":
    unittest.main()
