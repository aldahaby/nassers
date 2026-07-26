import json
import unittest

from tests.fake_tiktok import CAPTCHA_PAGE, not_found_body, taken_body
from tiktok_username_checker.models import Verdict
from tiktok_username_checker.parsing import looks_like_challenge, parse_profile_page


class ParsingTests(unittest.TestCase):
    def test_universal_data_with_user_means_taken(self):
        probe = parse_profile_page(taken_body("ab.c"), "ab.c")
        self.assertIs(probe.verdict, Verdict.EXISTS)
        self.assertEqual(probe.reason, "profile_data_present")

    def test_universal_data_not_found_status(self):
        probe = parse_profile_page(not_found_body(), "zq7_")
        self.assertIs(probe.verdict, Verdict.NOT_FOUND)
        self.assertEqual(probe.reason, "user_detail_not_found")

    def test_case_difference_still_counts_as_taken(self):
        probe = parse_profile_page(taken_body("ABCD"), "abcd")
        self.assertIs(probe.verdict, Verdict.EXISTS)

    def test_mismatched_unique_id_is_indeterminate(self):
        probe = parse_profile_page(taken_body("zzzz"), "abcd")
        self.assertIs(probe.verdict, Verdict.INDETERMINATE)
        self.assertEqual(probe.reason, "username_mismatch")

    def test_sigi_state_fallback(self):
        payload = {"UserModule": {"users": {"ab_c": {"uniqueId": "ab_c"}}}}
        html = f'<script id="SIGI_STATE" type="application/json">{json.dumps(payload)}</script>'
        probe = parse_profile_page(html, "ab_c")
        self.assertIs(probe.verdict, Verdict.EXISTS)
        self.assertEqual(probe.reason, "sigi_user_present")

    def test_sigi_state_not_found(self):
        payload = {"UserModule": {"users": {}}, "UserPage": {"statusCode": 10221}}
        html = f'<script id="SIGI_STATE" type="application/json">{json.dumps(payload)}</script>'
        probe = parse_profile_page(html, "ab_c")
        self.assertIs(probe.verdict, Verdict.NOT_FOUND)

    def test_raw_html_fallback_for_unique_id(self):
        probe = parse_profile_page('window.x = {"uniqueId":"qq77","id":"1"};', "qq77")
        self.assertIs(probe.verdict, Verdict.EXISTS)
        self.assertEqual(probe.reason, "unique_id_in_html")

    def test_raw_html_fallback_for_status_code(self):
        probe = parse_profile_page('{"statusCode":10221,"statusMsg":"user doesn\'t exist"}', "qq77")
        self.assertIs(probe.verdict, Verdict.NOT_FOUND)
        self.assertEqual(probe.reason, "status_code_in_html")

    def test_captcha_page_is_indeterminate(self):
        probe = parse_profile_page(CAPTCHA_PAGE, "abcd")
        self.assertIs(probe.verdict, Verdict.INDETERMINATE)
        self.assertEqual(probe.reason, "challenge_page")
        self.assertTrue(looks_like_challenge(CAPTCHA_PAGE))

    def test_empty_body_is_indeterminate(self):
        probe = parse_profile_page("   ", "abcd")
        self.assertIs(probe.verdict, Verdict.INDETERMINATE)
        self.assertEqual(probe.reason, "empty_body")

    def test_unknown_status_code_is_indeterminate(self):
        payload = {
            "__DEFAULT_SCOPE__": {
                "webapp.user-detail": {
                    "userInfo": {},
                    "statusCode": 10222,
                    "statusMsg": "account is unavailable",
                }
            }
        }
        html = (
            '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'
            f"{json.dumps(payload)}</script>"
        )
        probe = parse_profile_page(html, "abcd")
        self.assertIs(probe.verdict, Verdict.INDETERMINATE)
        self.assertEqual(probe.reason, "unexpected_status_code")
        self.assertIn("10222", probe.detail)

    def test_malformed_json_falls_back_to_raw_scan(self):
        html = (
            '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'
            '{"__DEFAULT_SCOPE__": {broken</script>'
            '<div data-x=\'{"uniqueId":"ab.c"}\'></div>'
        )
        probe = parse_profile_page(html, "ab.c")
        self.assertIs(probe.verdict, Verdict.EXISTS)

    def test_unrecognised_page_is_indeterminate(self):
        probe = parse_profile_page("<html><body>hello</body></html>", "abcd")
        self.assertIs(probe.verdict, Verdict.INDETERMINATE)
        self.assertEqual(probe.reason, "unrecognised_page")

    def test_status_code_zero_without_user_is_indeterminate(self):
        payload = {
            "__DEFAULT_SCOPE__": {"webapp.user-detail": {"userInfo": {}, "statusCode": 0}}
        }
        html = (
            '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'
            f"{json.dumps(payload)}</script>"
        )
        probe = parse_profile_page(html, "abcd")
        self.assertIs(probe.verdict, Verdict.INDETERMINATE)
        self.assertEqual(probe.reason, "empty_user_detail")


if __name__ == "__main__":
    unittest.main()
