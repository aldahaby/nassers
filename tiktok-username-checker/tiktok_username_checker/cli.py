"""Command line interface."""

from __future__ import annotations

import argparse
import signal
import sys
import threading
from pathlib import Path
from typing import Iterable, Iterator, Sequence

from .checker import TikTokUsernameChecker
from .generator import candidate_space, iter_all, iter_random, resolve_charset
from .http_client import HttpClient
from .logging_setup import configure_logging
from .models import PROFILE_URL_TEMPLATE, Availability, CheckResult
from .ratelimit import AdaptiveRateLimiter
from .results import AvailableNameLog, CsvResultWriter, load_previous_results
from .retry import RetryPolicy
from .runner import CheckRunner, Summary
from .validation import describe_problem, normalize

DEFAULT_OUTPUT = "results/tiktok_usernames.csv"

EXIT_OK = 0
EXIT_USAGE = 2
EXIT_INTERRUPTED = 130


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tiktok-username-checker",
        description=(
            "Check whether four-character TikTok usernames are available. "
            "Usernames must be exactly four characters drawn from a-z, 0-9, '.' "
            "and '_', and must not end with a period."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    sources = parser.add_argument_group("input")
    sources.add_argument("usernames", nargs="*", help="usernames to check")
    sources.add_argument(
        "-i",
        "--input",
        action="append",
        default=[],
        metavar="FILE",
        help="read usernames from FILE, one per line ('-' for stdin); repeatable",
    )
    sources.add_argument(
        "--generate",
        type=int,
        metavar="N",
        help="generate N random candidates",
    )
    sources.add_argument(
        "--generate-all",
        action="store_true",
        help="generate every valid candidate over the character set",
    )
    sources.add_argument(
        "--charset",
        default="full",
        help="character set for generation: full, alnum, letters, digits, or literal characters",
    )
    sources.add_argument("--seed", type=int, help="seed for random generation")
    sources.add_argument(
        "--limit", type=int, metavar="N", help="stop after N candidates have been queued"
    )
    sources.add_argument(
        "--fold-case",
        action="store_true",
        help="lowercase input before validating instead of rejecting uppercase",
    )
    sources.add_argument(
        "--dedupe",
        dest="dedupe",
        action="store_true",
        default=None,
        help="drop repeated usernames (default: on unless generating)",
    )
    sources.add_argument(
        "--no-dedupe", dest="dedupe", action="store_false", help="keep repeated usernames"
    )

    output = parser.add_argument_group("output")
    output.add_argument(
        "-o", "--output", default=DEFAULT_OUTPUT, help="CSV file to write results to"
    )
    output.add_argument(
        "--overwrite", action="store_true", help="truncate the CSV instead of appending"
    )
    output.add_argument(
        "--available-file",
        metavar="FILE",
        help="also append every available username to FILE as it is found",
    )
    output.add_argument(
        "--resume",
        action="store_true",
        help="skip usernames already present in the output CSV",
    )
    output.add_argument(
        "--recheck-errors",
        action="store_true",
        help="with --resume, re-check usernames previously recorded as errors",
    )
    output.add_argument("--log-file", metavar="FILE", help="write a debug log to FILE")
    output.add_argument("-v", "--verbose", action="count", default=0, help="more console output")
    output.add_argument("-q", "--quiet", action="store_true", help="warnings and errors only")

    network = parser.add_argument_group("network")
    network.add_argument("-w", "--workers", type=int, default=8, help="concurrent requests")
    network.add_argument(
        "-r", "--rate", type=float, default=5.0, help="target requests per second"
    )
    network.add_argument(
        "--burst", type=float, help="rate limiter burst size (default: the target rate)"
    )
    network.add_argument(
        "--min-rate",
        type=float,
        default=0.5,
        help="floor the adaptive limiter will not drop below",
    )
    network.add_argument("--connect-timeout", type=float, default=10.0, help="connect timeout (s)")
    network.add_argument("--read-timeout", type=float, default=20.0, help="read timeout (s)")
    network.add_argument("--retries", type=int, default=4, help="attempts per request")
    network.add_argument(
        "--retry-base-delay", type=float, default=1.0, help="first backoff delay (s)"
    )
    network.add_argument("--retry-max-delay", type=float, default=30.0, help="backoff ceiling (s)")
    network.add_argument("--proxy", help="proxy URL, e.g. http://user:pass@host:port")
    network.add_argument(
        "--profile-url",
        default=PROFILE_URL_TEMPLATE,
        metavar="TEMPLATE",
        help="profile URL template; must contain {username}",
    )
    network.add_argument(
        "--no-confirm",
        dest="confirm",
        action="store_false",
        help="do not re-verify usernames that look available",
    )
    network.add_argument(
        "--confirm-delay",
        type=float,
        default=1.0,
        help="pause before the confirmation request (s)",
    )

    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="validate the input and exit without contacting TikTok",
    )
    return parser


def _iter_file(path: str) -> Iterator[str]:
    if path == "-":
        for line in sys.stdin:
            yield line
        return
    with Path(path).open("r", encoding="utf-8") as handle:
        for line in handle:
            yield line


def _iter_sources(args: argparse.Namespace) -> Iterator[str]:
    for raw in args.usernames:
        yield raw
    for path in args.input:
        for line in _iter_file(path):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            yield stripped
    if args.generate_all:
        yield from iter_all(args.charset)
    if args.generate:
        yield from iter_random(args.generate, args.charset, seed=args.seed)


def _prepare(
    raw_names: Iterable[str],
    *,
    fold_case: bool,
    dedupe: bool,
    limit: int | None,
    skip: dict[str, str] | None,
    recheck_errors: bool,
    logger,
) -> Iterator[str]:
    """Normalize, optionally dedupe, apply resume filtering and the limit."""
    seen: set[str] = set()
    emitted = 0
    skipped = 0
    for raw in raw_names:
        candidate = normalize(raw, fold_case=fold_case)
        if not candidate:
            continue
        if dedupe:
            if candidate in seen:
                continue
            seen.add(candidate)
        if skip:
            previous = skip.get(candidate)
            if previous is not None and not (
                recheck_errors and previous == Availability.ERROR.value
            ):
                skipped += 1
                continue
        yield candidate
        emitted += 1
        if limit is not None and emitted >= limit:
            break
    if skipped:
        logger.info("skipped %d username(s) already present in the output CSV", skipped)


def _expected_total(args: argparse.Namespace) -> int | None:
    total = len(args.usernames)
    if args.generate_all:
        try:
            total += candidate_space(args.charset)
        except ValueError:
            return None
    if args.generate:
        total += max(0, args.generate)
    if args.input:
        return None  # streamed, length unknown
    if args.limit is not None:
        total = min(total, args.limit)
    return total or None


def _run_validate_only(args: argparse.Namespace, logger) -> int:
    valid = 0
    invalid = 0
    try:
        for raw in _iter_sources(args):
            candidate = normalize(raw, fold_case=args.fold_case)
            problem = describe_problem(candidate)
            if problem is None:
                valid += 1
                print(f"valid   {candidate}")
            else:
                invalid += 1
                print(f"invalid {candidate if candidate else repr(raw)}: {problem[1]}")
    except OSError as exc:
        logger.error("could not read input: %s", exc)
        return EXIT_USAGE
    logger.info("validated %d username(s): %d valid, %d invalid", valid + invalid, valid, invalid)
    return EXIT_OK


def _print_summary(summary: Summary, csv_path: Path, available_path: str | None) -> None:
    print("", file=sys.stderr)
    print("=" * 52, file=sys.stderr)
    print(f"checked      {summary.total}", file=sys.stderr)
    print(f"available    {summary.available}", file=sys.stderr)
    print(f"taken        {summary.taken}", file=sys.stderr)
    print(f"invalid      {summary.invalid}", file=sys.stderr)
    print(f"errors       {summary.errors}", file=sys.stderr)
    print(
        f"elapsed      {summary.elapsed_seconds:.1f}s ({summary.rate:.2f} checks/s)",
        file=sys.stderr,
    )
    print(f"results      {csv_path}", file=sys.stderr)
    if available_path:
        print(f"available in {available_path}", file=sys.stderr)
    if summary.interrupted:
        print(
            "run was interrupted; results written so far are complete"
            + (
                f" ({summary.cancelled} in-flight check(s) were cancelled and left unrecorded)"
                if summary.cancelled
                else ""
            ),
            file=sys.stderr,
        )
    print("=" * 52, file=sys.stderr)


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    logger = configure_logging(
        verbosity=-1 if args.quiet else args.verbose, log_file=args.log_file
    )

    if not args.usernames and not args.input and not args.generate and not args.generate_all:
        parser.error("no usernames given; pass usernames, --input, --generate or --generate-all")
    if args.generate is not None and args.generate <= 0:
        parser.error("--generate requires a positive count")
    if args.limit is not None and args.limit <= 0:
        parser.error("--limit requires a positive count")
    if args.workers < 1:
        parser.error("--workers must be at least 1")
    if args.rate <= 0:
        parser.error("--rate must be positive")
    if args.min_rate <= 0:
        parser.error("--min-rate must be positive")
    if args.retries < 1:
        parser.error("--retries must be at least 1")
    if "{username}" not in args.profile_url:
        parser.error("--profile-url must contain the {username} placeholder")

    try:
        resolve_charset(args.charset)
    except ValueError as exc:
        parser.error(str(exc))

    if args.validate_only:
        return _run_validate_only(args, logger)

    generating = bool(args.generate or args.generate_all)
    dedupe = (not generating) if args.dedupe is None else args.dedupe

    output_path = Path(args.output)
    previous: dict[str, str] = {}
    if args.resume and args.overwrite:
        logger.warning(
            "--resume with --overwrite: skipped usernames will not be carried into the new file"
        )
    if args.resume:
        previous = load_previous_results(output_path)
        if previous:
            logger.info("resume: %d username(s) already recorded in %s", len(previous), output_path)

    stop = threading.Event()

    limiter = AdaptiveRateLimiter(
        rate=args.rate,
        burst=args.burst,
        min_rate=min(args.min_rate, args.rate),
        max_rate=args.rate,
    )

    def request_stop(signum: int, _frame: object) -> None:
        if stop.is_set():
            logger.warning("second signal received; exiting immediately")
            raise SystemExit(EXIT_INTERRUPTED)
        logger.warning("signal %s received; finishing in-flight checks", signum)
        stop.set()
        limiter.wake()

    previous_handlers = {}
    for signum in (signal.SIGINT, signal.SIGTERM):
        try:
            previous_handlers[signum] = signal.signal(signum, request_stop)
        except (ValueError, OSError):  # pragma: no cover - non-main thread
            pass

    retry_policy = RetryPolicy(
        max_attempts=args.retries,
        base_delay=args.retry_base_delay,
        max_delay=args.retry_max_delay,
    )

    available_log: AvailableNameLog | None = None
    exit_code = EXIT_OK
    try:
        with HttpClient(
            connect_timeout=args.connect_timeout,
            read_timeout=args.read_timeout,
            pool_maxsize=max(args.workers, 4),
            proxy=args.proxy,
        ) as client:
            checker = TikTokUsernameChecker(
                client,
                limiter,
                retry_policy,
                confirm_available=args.confirm,
                confirm_delay=args.confirm_delay,
                stop=stop,
                logger=logger,
                profile_url_template=args.profile_url,
            )

            if args.available_file:
                available_log = AvailableNameLog(args.available_file).open()

            def on_result(result: CheckResult) -> None:
                if result.status is Availability.AVAILABLE:
                    suffix = "" if result.confirmed else " (unconfirmed)"
                    logger.info("AVAILABLE %s%s", result.username, suffix)
                    if available_log is not None:
                        available_log.write(result.username)
                elif result.status is Availability.INVALID:
                    logger.warning("invalid %r: %s", result.username, result.detail)

            with CsvResultWriter(output_path, append=not args.overwrite) as writer:
                runner = CheckRunner(
                    checker,
                    writer,
                    workers=args.workers,
                    stop=stop,
                    logger=logger,
                    on_result=on_result,
                )
                usernames = _prepare(
                    _iter_sources(args),
                    fold_case=args.fold_case,
                    dedupe=dedupe,
                    limit=args.limit,
                    skip=previous,
                    recheck_errors=args.recheck_errors,
                    logger=logger,
                )
                logger.info(
                    "starting: %d worker(s), %.2f req/s target, %d attempt(s) per request",
                    args.workers,
                    args.rate,
                    args.retries,
                )
                summary = runner.run(usernames, expected_total=_expected_total(args))
    except OSError as exc:
        logger.error("could not read input: %s", exc)
        return EXIT_USAGE
    except KeyboardInterrupt:  # pragma: no cover - handled via signal normally
        logger.warning("interrupted")
        return EXIT_INTERRUPTED
    finally:
        if available_log is not None:
            available_log.close()
        for signum, handler in previous_handlers.items():
            try:
                signal.signal(signum, handler)
            except (ValueError, OSError):  # pragma: no cover
                pass

    _print_summary(summary, output_path, args.available_file)
    if summary.interrupted:
        exit_code = EXIT_INTERRUPTED
    return exit_code


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
