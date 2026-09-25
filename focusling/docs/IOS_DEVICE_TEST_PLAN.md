# iOS device test plan: selective Reels protection

This milestone isn't complete until this plan has been run on a **physical iPhone with iOS 27**
and real Instagram. Web, simulator and unit tests can't answer the key question.

## 0. What you need
- A Mac with Xcode 26+ **or** an EAS account (`npx eas-cli@latest`). EAS builds in the cloud; you
  still install the build on your phone.
- An **Apple Developer Program** membership. Family Controls and App Groups on a personal free team
  may not be signable; the paid program is the reliable route.
- An iPhone on **iOS 27** for Reels-only mode (ScreenCaptureKit on iOS starts at 27). Whole-app mode
  works on iOS 16.4+.
- Instagram installed and signed in.

## 1. One-time setup
1. In `focusling/app.json`, add your Team ID: `"ios": { "appleTeamId": "ABCDE12345", ... }`.
2. Apple Developer portal (EAS usually does this for you; check if the build fails on signing):
   - App IDs: `com.focusling.app`, plus the three extension IDs the plugin creates
     (`com.focusling.app.FocuslingShieldConfig`, `.FocuslingShieldAction`, `.FocuslingActivityMonitor`).
   - Enable **Family Controls (Development)** and **App Groups** (`group.com.focusling.app`) on all four.
3. Build and install:
   - **Mac:** `cd focusling && npm install && npx expo prebuild -p ios --clean && npx expo run:ios --device`
   - **EAS:** `npx eas-cli@latest device:create` (register the phone), then
     `npx eas-cli@latest build -p ios --profile development`, then install from the link and run
     `npx expo start` for the dev client.
4. Optional, on a Mac: `cd modules/focusling-protection/ios/DetectionCore && swift test` (native
   voting policy against the shared vectors).

## 2. Record these for every run
- iPhone model and iOS version, Instagram version.
- Settings → Developer tools → **Native protection** panel: capture, latest classification,
  confidence, votes, last intervention, shield, session ID, last native error.

## 3. Selective setup
| # | Step | Expected | Result |
|---|---|---|---|
| S1 | Focus → Focus protection → **Reels only** | Checklist appears | |
| S2 | Screen Time access → Allow | Apple sheet; row turns ✓ | |
| S3 | Choose → select **Instagram only** in Apple's picker → Done | "1 app selected" | |
| S4 | Screen recognition row | ✓ "available" on iOS 27 | |

## 4. Start
| # | Step | Expected | Result |
|---|---|---|---|
| T1 | Developer tools → **1-min selective test** (or a normal 15 min) | iOS content-sharing picker appears | |
| T2 | Choose full-screen capture, confirm | Recording indicator visible; Focus shows **"Reels protection active"** | |
| T3 | Cancel the picker instead (repeat) | Session does **not** start; "Reels-only protection isn't active" + "Block Instagram entirely instead" | |

## 5. Instagram normal use (no intervention expected)
Spend at least 5–10 minutes in total. Count any false interventions.

| Surface | Time spent | False interventions | Notes |
|---|---|---|---|
| Home feed (scroll) | | | |
| Feed video post (full-screen tap) | | | |
| Carousel post | | | |
| Profile (own and others) | | | |
| Search / Explore grid | | | |
| DMs inbox, read a thread, send a message | | | |
| Stories | | | |

## 6. Reels
| # | Step | Expected | Result (delay, s) |
|---|---|---|---|
| R1 | Tap the Reels tab | Focusling shield "Reels are blocked during this focus session." within ~1–3 s | |
| R2 | Tap "Back to focus" | Instagram closes; session continues | |
| R3 | Reopen Instagram → feed | Usable, no shield | |
| R4 | Open Reels again; repeat ×5 | Interrupted each time (after the 20 s cooldown) | |
| R5 | Open a Reel from the feed, swipe to the next | Interrupted | |
| R6 | Open a Reel shared in DMs | Record what happens (expected: interrupted, since it's the Reels viewer) | |

## 7. Background and lock
| # | Step | Expected | Result |
|---|---|---|---|
| B1 | Focusling backgrounded, Instagram in front, 5+ min | Detection keeps working (R1 still triggers) | |
| B2 | Lock phone 30 s, unlock, open Reels | Record: does capture continue? If Focus shows "Reels protection stopped", tap Restart | |
| B3 | Swipe Focusling away (force quit), open Reels | Expected: **not** interrupted (capture is in-process). Reopen Focusling: "Reels protection stopped" notice | |

## 8. Session end
| # | Step | Expected | Result |
|---|---|---|---|
| E1 | Let the timer expire | Rewards once; recording indicator gone; Reels open normally | |
| E2 | Start again, End session early → confirm | Partial rewards; capture stops; Reels work | |
| E3 | Reset progress (Settings) during a session | Everything stops; no shield remains | |

## 9. Whole app
| # | Step | Expected | Result |
|---|---|---|---|
| W1 | Mode **Entire app**, start 15 min | Opening Instagram shows "Nimbus is focusing with you." | |
| W2 | Force-quit Focusling, open Instagram | Still shielded (DeviceActivity keeps it) | |
| W3 | Wait for the session end (or use Emergency cleanup) | Instagram opens normally | |
| W4 | 1-min whole-app debug test, then force quit | Shield may stay up to 15 min (Apple minimum interval); Emergency cleanup clears it | |

## 10. Performance (a 15–30 minute selective session)
| Metric | How | Result |
|---|---|---|
| Sampling rate | 1 per second (config) | |
| Inference latency | Xcode → Debug navigator, or a time profiler run | |
| CPU % while Instagram is in front | Xcode debug gauges / Instruments | |
| Memory | Xcode gauges | |
| Battery % over 30 min | Settings → Battery before/after | |
| Thermal | Warm? Hot? | |

## 11. URL filter spot check (optional)
`NEURLFilterManager` needs a PIR server declared in Info.plist even for development, and Apple
documents that it only filters WebKit/URLSession traffic, while Instagram uses its own networking
stack. **Skip unless we decide to pursue it.** If pursued: run Apple's PIR sample service locally,
add an Instagram media host to the Bloom filter, and check whether native Instagram is affected at all.

## 12. Send back
- The tables above (results, delays, false interventions).
- Native panel screenshots (they contain no private tokens).
- Anything confusing in the permission and picker flow.
- Optional: labelled samples from the debug collector (Developer tools → sample collection →
  Export). **Avoid DMs and private content.**
