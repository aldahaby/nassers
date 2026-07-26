# TikTok 4-character username checker

A command line application that checks whether four-character TikTok usernames
are free, validates every candidate before it is checked, runs many checks
concurrently against TikTok's live site, and records every result in a CSV
file.

## Requirements

* Python 3.10 or newer
* [`requests`](https://pypi.org/project/requests/) — the only third-party
  dependency

```bash
cd tiktok-username-checker
python3 -m pip install -r requirements.txt
```

Optionally install the package so the `tiktok-username-checker` command is on
your `PATH`:

```bash
python3 -m pip install .
```

Without installing, run it as a module from this directory:

```bash
python3 -m tiktok_username_checker --help
```

## Username rules enforced

A candidate is checked only when **all** of these hold:

| Rule | Examples accepted | Examples rejected |
| --- | --- | --- |
| Exactly 4 characters, counting `.` and `_` | `ab.c`, `a__1`, `.x9z` | `abc` (3), `abcde` (5), `a._` (3) |
| Only `a`–`z`, `0`–`9`, `.`, `_` | `q7._`, `0000` | `ABcd`, `ab-c`, `ab c`, `ab😀c` |
| A period may appear anywhere **except** the last position | `.abc`, `a.bc`, `..ab` | `abc.`, `a.b.`, `....` |

Anything else is recorded in the CSV with status `invalid` and is never sent to
TikTok. Uppercase input is rejected by default; pass `--fold-case` to lowercase
it first instead.

## Usage

```bash
# Specific usernames
python3 -m tiktok_username_checker ab.c zz_1 q7.x

# From a file (one per line, '#' comments allowed), or from stdin with '-'
python3 -m tiktok_username_checker --input candidates.txt

# 5000 random four-character candidates, 12 at a time, 6 requests/second
python3 -m tiktok_username_checker --generate 5000 --workers 12 --rate 6 \
    --available-file available.txt

# Every possible letters-and-digits name, resumable across runs
python3 -m tiktok_username_checker --generate-all --charset alnum \
    -o results/alnum.csv --resume --log-file run.log

# Validate a list without touching the network
python3 -m tiktok_username_checker --input candidates.txt --validate-only
```

Interrupt with `Ctrl-C`: in-flight checks finish, the CSV is flushed and a
summary is printed. A second `Ctrl-C` exits immediately.

### Options that matter most

| Option | Purpose |
| --- | --- |
| `-w, --workers` | Concurrent requests (default 8) |
| `-r, --rate` | Target requests per second (default 5); the limiter lowers this automatically when TikTok pushes back and raises it again after clean responses |
| `--retries` | Attempts per request (default 4), with exponential backoff plus jitter and `Retry-After` support |
| `--no-confirm` | Skip the second confirming request for names that look free (roughly halves requests, slightly raises the false-positive risk) |
| `--resume` | Skip usernames already present in the output CSV |
| `--recheck-errors` | With `--resume`, retry the ones that previously errored |
| `--proxy` | Route requests through a proxy, e.g. `http://user:pass@host:port` |
| `--profile-url` | Profile URL template, default `https://www.tiktok.com/@{username}` |
| `--available-file` | Append available names to a plain text file as they are found |

`--generate` and `--generate-all` accept `--charset full` (default, 38
characters: `a-z0-9._`), `alnum`, `letters`, `digits`, or a literal set such as
`--charset abc.1`. The full four-character space is 2,030,264 valid names.

## Output

Results are appended to `results/tiktok_usernames.csv` unless `-o` says
otherwise (`--overwrite` truncates instead). Every checked username produces
exactly one row:

| Column | Meaning |
| --- | --- |
| `username` | The candidate as checked |
| `status` | `available`, `taken`, `invalid` or `error` |
| `reason` | Machine-readable cause, e.g. `http_404`, `profile_data_present`, `bad_length`, `http_429`, `challenge_page`, `transport_timeout` |
| `http_status` | Final HTTP status, blank when no response was received |
| `attempts` | HTTP attempts made, including retries and the confirmation request |
| `elapsed_ms` | Wall-clock time for the check |
| `confirmed` | `true` when a second request agreed with the verdict |
| `profile_url` | The profile URL checked (blank for invalid names) |
| `detail` | Human-readable diagnostics |
| `checked_at` | UTC ISO-8601 timestamp |

```csv
username,status,reason,http_status,attempts,elapsed_ms,confirmed,profile_url,detail,checked_at
ab.c,taken,profile_data_present,200,1,412,false,https://www.tiktok.com/@ab.c,uniqueId=ab.c,2026-07-26T11:19:02+00:00
qq7_,available,http_404,404,2,980,true,https://www.tiktok.com/@qq7_,,2026-07-26T11:19:03+00:00
abc.,invalid,trailing_period,,0,0,false,,must not end with a period,2026-07-26T11:19:03+00:00
```

`error` rows mean the check did not resolve (rate limiting, bot challenge,
network failure). They are never reported as available, and `--resume
--recheck-errors` will revisit them. Checks cancelled by `Ctrl-C` are *not*
written at all, so an interrupted run leaves those names unchecked and a
`--resume` run picks them up.

## How availability is determined

**TikTok publishes no username-availability API.** The only officially exposed,
documented surface that answers the question is the public profile page, which
is what this application uses:

`GET https://www.tiktok.com/@<username>`

Every profile page embeds the JSON the front end hydrates from, in a
`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">` element. The response is
interpreted as follows:

| Response | Verdict |
| --- | --- |
| `200` with `webapp.user-detail.userInfo.user.uniqueId` matching the candidate | **taken** |
| `404`, or a body whose `webapp.user-detail.statusCode` is `10221`/`10202` ("user doesn't exist") | **available** |
| `429`, `401`, `403`, `5xx`, a captcha/verification interstitial, or an unparseable body | retried with backoff, then recorded as **error** |

Older pages that still ship `SIGI_STATE` are handled too, and a last-resort
scan of the raw HTML covers markup changes to the script wrapper. The embedded
JSON is read rather than the rendered markup so that a redesign of the page
does not silently change verdicts.

Names that appear free are re-requested once by default (`--confirm-delay`
apart) and only reported as `available` when the second response agrees — a
disagreement is resolved in favour of `taken`. This is what the `confirmed`
column records.

### Limitations you should know about

* **No official endpoint exists.** The profile page is TikTok's own public
  surface for the question, but its response shapes are not a versioned,
  documented API contract and can change. The parser is defensive and falls
  back through three layers, and an unrecognised page is reported as `error`
  rather than guessed at.
* **"Available" means "no profile currently resolves".** A name freed by a
  banned, deleted or deactivated account returns 404 while TikTok may still
  refuse to hand it out at signup. Treat `available` as "worth trying", not as
  a guarantee.
* **Availability is a moment in time.** A name free during the run may be taken
  minutes later; `checked_at` records when the answer was true.
* **TikTok rate-limits aggressively and serves bot challenges.** Sustained
  high rates lead to `429`s and captcha interstitials, which are recorded as
  `error`, never as `available`. Defaults (8 workers, 5 requests/second) are
  deliberately conservative; raising them increases the error rate rather than
  throughput. Long runs benefit from `--proxy` and `--resume`.
* **Region and login state affect results.** Some accounts are restricted per
  region; a profile hidden in your region could report differently elsewhere.
* Requests carry ordinary browser headers and no authentication, and the
  application reads only public pages. Check TikTok's Terms of Service before
  running large sweeps — the rate limiter exists so runs stay polite.

## Project layout

```
tiktok_username_checker/
    validation.py     username rules (length, character set, trailing period)
    generator.py      candidate generation over the four-character space
    parsing.py        interpretation of TikTok profile pages
    http_client.py    per-thread pooled HTTP with capped body reads
    retry.py          exponential backoff, jitter, Retry-After parsing
    ratelimit.py      adaptive token bucket shared by all workers
    checker.py        one username: probe, retry, classify, confirm
    runner.py         bounded-memory concurrency over a username stream
    results.py        streaming CSV writer, resume support, available-name log
    logging_setup.py  console and file logging
    cli.py            argument parsing, wiring, signals, summary
tests/                unit and end-to-end tests
```

Memory use is constant regardless of input size: candidates are streamed, at
most `workers × 4` checks are in flight, and results are flushed to disk as
they arrive.

## Tests

```bash
cd tiktok-username-checker
python3 -m unittest discover -s tests -t .
```

The end-to-end tests run the checker, runner and CLI over real sockets against
a local server (`tests/fake_tiktok.py`) that replays TikTok's response shapes,
including rate limiting, server errors and captcha pages. No test contacts
TikTok.
