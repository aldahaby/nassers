import random
import threading
import time
import unittest
from email.utils import formatdate

from tiktok_username_checker.ratelimit import AdaptiveRateLimiter
from tiktok_username_checker.retry import RetryPolicy, parse_retry_after


class FakeClock:
    """A manually advanced monotonic clock."""

    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class RetryPolicyTests(unittest.TestCase):
    def test_delays_grow_exponentially(self):
        policy = RetryPolicy(base_delay=1.0, multiplier=2.0, max_delay=30.0, jitter=0.0)
        self.assertEqual(policy.delay_for(1), 1.0)
        self.assertEqual(policy.delay_for(2), 2.0)
        self.assertEqual(policy.delay_for(3), 4.0)
        self.assertEqual(policy.delay_for(4), 8.0)

    def test_delay_is_capped(self):
        policy = RetryPolicy(base_delay=1.0, multiplier=10.0, max_delay=5.0, jitter=0.0)
        self.assertEqual(policy.delay_for(9), 5.0)

    def test_jitter_stays_within_bounds(self):
        policy = RetryPolicy(base_delay=2.0, multiplier=2.0, max_delay=100.0, jitter=0.5)
        rng = random.Random(0)
        for attempt in range(1, 6):
            expected = min(2.0 * 2 ** (attempt - 1), 100.0)
            delay = policy.delay_for(attempt, rng)
            self.assertGreaterEqual(delay, expected * 0.5 - 1e-9)
            self.assertLessEqual(delay, expected * 1.5 + 1e-9)

    def test_invalid_configuration_rejected(self):
        for kwargs in (
            {"max_attempts": 0},
            {"base_delay": -1},
            {"multiplier": 0.5},
            {"jitter": 2.0},
        ):
            with self.subTest(kwargs=kwargs):
                with self.assertRaises(ValueError):
                    RetryPolicy(**kwargs)

    def test_attempt_must_be_positive(self):
        with self.assertRaises(ValueError):
            RetryPolicy().delay_for(0)


class RetryAfterTests(unittest.TestCase):
    def test_numeric_seconds(self):
        self.assertEqual(parse_retry_after("12"), 12.0)
        self.assertEqual(parse_retry_after(" 3.5 "), 3.5)

    def test_negative_seconds_clamped(self):
        self.assertEqual(parse_retry_after("-5"), 0.0)

    def test_http_date(self):
        now = time.time()
        header = formatdate(now + 30, usegmt=True)
        parsed = parse_retry_after(header, now=now)
        self.assertIsNotNone(parsed)
        self.assertGreaterEqual(parsed, 28.0)
        self.assertLessEqual(parsed, 31.0)

    def test_past_http_date_is_zero(self):
        now = time.time()
        self.assertEqual(parse_retry_after(formatdate(now - 60, usegmt=True), now=now), 0.0)

    def test_unusable_values(self):
        self.assertIsNone(parse_retry_after(None))
        self.assertIsNone(parse_retry_after(""))
        self.assertIsNone(parse_retry_after("soon"))


class RateLimiterTests(unittest.TestCase):
    def test_burst_then_wait(self):
        clock = FakeClock()
        limiter = AdaptiveRateLimiter(rate=2.0, burst=2.0, clock=clock)
        self.assertTrue(limiter.acquire(timeout=0))
        self.assertTrue(limiter.acquire(timeout=0))
        self.assertFalse(limiter.acquire(timeout=0))
        clock.advance(0.5)
        self.assertTrue(limiter.acquire(timeout=0))

    def test_penalize_lowers_rate_with_a_floor(self):
        limiter = AdaptiveRateLimiter(rate=8.0, min_rate=1.0, penalty_factor=0.5)
        self.assertAlmostEqual(limiter.penalize(), 4.0)
        self.assertAlmostEqual(limiter.penalize(), 2.0)
        self.assertAlmostEqual(limiter.penalize(), 1.0)
        self.assertAlmostEqual(limiter.penalize(), 1.0)

    def test_reward_recovers_rate_up_to_the_maximum(self):
        limiter = AdaptiveRateLimiter(
            rate=4.0,
            min_rate=0.5,
            recovery_step=1.0,
            successes_before_recovery=2,
        )
        limiter.penalize()
        limiter.penalize()
        self.assertAlmostEqual(limiter.rate, 1.0)
        for _ in range(20):
            limiter.reward()
        self.assertAlmostEqual(limiter.rate, 4.0)

    def test_pause_blocks_until_elapsed(self):
        clock = FakeClock()
        limiter = AdaptiveRateLimiter(rate=100.0, burst=100.0, clock=clock)
        limiter.pause(5.0)
        self.assertFalse(limiter.acquire(timeout=0))
        clock.advance(5.0)
        self.assertTrue(limiter.acquire(timeout=0))

    def test_stop_event_releases_waiters(self):
        limiter = AdaptiveRateLimiter(rate=0.5, burst=1.0)
        self.assertTrue(limiter.acquire(timeout=1.0))
        stop = threading.Event()
        outcome: list[bool] = []

        def worker() -> None:
            outcome.append(limiter.acquire(stop=stop))

        thread = threading.Thread(target=worker)
        thread.start()
        time.sleep(0.05)
        stop.set()
        limiter.wake()
        thread.join(timeout=5)
        self.assertFalse(thread.is_alive())
        self.assertEqual(outcome, [False])

    def test_rate_is_enforced_across_threads(self):
        limiter = AdaptiveRateLimiter(rate=50.0, burst=1.0)
        started = time.monotonic()
        threads = [
            threading.Thread(target=lambda: limiter.acquire(timeout=5)) for _ in range(10)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=5)
        elapsed = time.monotonic() - started
        # 10 requests at 50/s with a burst of 1 cannot finish faster than ~0.18s.
        self.assertGreaterEqual(elapsed, 0.15)

    def test_invalid_configuration_rejected(self):
        with self.assertRaises(ValueError):
            AdaptiveRateLimiter(rate=0)
        with self.assertRaises(ValueError):
            AdaptiveRateLimiter(rate=1, min_rate=0)
        with self.assertRaises(ValueError):
            AdaptiveRateLimiter(rate=1, penalty_factor=1.0)
        with self.assertRaises(ValueError):
            AdaptiveRateLimiter(rate=1, successes_before_recovery=0)


if __name__ == "__main__":
    unittest.main()
