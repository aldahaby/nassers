# Native iPhone test plan

**Status: nothing in this plan has been run.** Every Result cell is empty on purpose. Web,
simulator and Jest tests can't stand in for these rows. Don't mark a row passed without running it
on a physical iPhone and recording the device, iOS version and build.

Companion docs: `IOS_DEVICE_TEST_PLAN.md` (step-by-step selective Reels setup and the detection
matrix), `IOS_SELECTIVE_BLOCKING_RESEARCH.md`, `PREMIUM.md`.

## Status (update only after running on hardware)

| Check | Status |
|---|---|
| PLANNER LOGIC VERIFIED (unit + browser tests) | PASS (Jest + web suite m12) |
| IOS NATIVE BUILD COMPILES | UNTESTED |
| PHYSICAL DEVICE INSTALL | UNTESTED |
| WHOLE-APP PROTECTION VERIFIED | UNTESTED |
| SELECTIVE PROTECTION VERIFIED | UNTESTED |
| WIDGET VERIFIED | UNTESTED |
| LIVE ACTIVITY VERIFIED | UNTESTED |
| ONE-TAP PROTECTED START VERIFIED | UNTESTED |
| PDF TEXT / ON-DEVICE OCR VERIFIED | UNTESTED |
| LOCAL NOTIFICATIONS VERIFIED | UNTESTED |

## EAS development build (once the Apple Developer membership is active)

Run from `focusling/`. Never share Apple passwords or 2FA codes with anyone; EAS asks you directly.

```bash
npm ci
npx expo-doctor
npx eas-cli@latest login
npx eas-cli@latest device:create          # register your iPhone (opens a profile link)
npx eas-cli@latest build -p ios --profile development
# install the build from the link on the iPhone, then:
npx expo start --dev-client
```

`eas.json › build.development` has `developmentClient: true` and `distribution: "internal"`
(checked). Add `"appleTeamId"` under `expo.ios` in `app.json` first (the targets plugin warns
without it). The build includes 4 app extensions, declared automatically by `@bacons/apple-targets`
(`expo config --type prebuild` shows them under `extra.eas.build.experimental.ios.appExtensions`):

| Target | Bundle id | Entitlements |
|---|---|---|
| App | `com.focusling.app` | Family Controls, App Group `group.com.focusling.app` |
| StudylingWidgets (widget + Live Activity) | `com.focusling.app.widgets` | App Group |
| FocuslingShieldConfig | `com.focusling.app.shield-config` | Family Controls, App Group |
| FocuslingShieldAction | `com.focusling.app.shield-action` | Family Controls, App Group |
| FocuslingActivityMonitor | `com.focusling.app.device-activity-monitor` | Family Controls, App Group |

Family Controls needs Apple's distribution approval before TestFlight/App Store; development
builds can use the development entitlement.

## 0. Readiness audit (from the code, not a device)

| Area | What's in the repo | Known risk / to verify |
|---|---|---|
| Protection module | `modules/focusling-protection/ios` (FamilyControlsService, ShieldController, SessionScheduler, InterventionController, ScreenCaptureController, DetectionCore) | Never compiled in this environment |
| Extensions | `targets/device-activity`, `shield-action`, `shield-config` (iOS 16.4, app group `group.com.focusling.app`) | Signing of 4 bundle IDs with Family Controls + App Groups |
| Entitlements | `app.json`: family-controls, app group, `UIBackgroundModes: ["screen-capture"]` | Family Controls **distribution** approval needed for TestFlight/App Store |
| Reels detection | ScreenCaptureKit on iOS 27 (`SCContentSharingPicker`) | iOS 27 only; whole-app works on 16.4+ |
| Store module | `modules/focusling-store` (StoreKit 2) | Never compiled; needs products or a `.storekit` file |
| Planner native module | `modules/studyling-native` (PDFKit, Vision OCR, App Group snapshot, ActivityKit) | Never compiled |
| Widget extension | `targets/widgets` (WidgetKit small/medium, Live Activity, iOS 16.4+) | Never compiled; `Info.plist` has `NSSupportsLiveActivities` |
| Notifications | `expo-notifications` plugin, category `studyling.start` with a Start & Lock action | Category registration and response handling untested |
| Deep link | `focusling://planner/start?plan=ID&source=widget` → `app/planner/start.tsx` | Untested from the widget |
| JS fallbacks | Mock protection/store on web and when native modules are missing | Confirm a native build never selects the mock store (`services/index.ts`) |

## 1. Record for every run
Device model · iOS version · build number/commit · Instagram version · Low Power Mode on/off ·
Focus (Do Not Disturb) on/off · Developer tools → Native protection panel values.

## 2. Build and signing
| # | Step | Expected | Result |
|---|---|---|---|
| B1 | `npx expo prebuild -p ios --clean`, then build (Xcode or EAS) | Compiles with both local modules and 3 extensions | |
| B2 | Install on device | Launches to onboarding/pet without a red screen | |
| B3 | Check signing of app + extensions | Family Controls + App Groups present on all 4 | |
| B4 | Cold launch time | Pet visible in under ~2 s on a recent iPhone | |

## 3. Family Controls authorization
| # | Step | Expected | Result |
|---|---|---|---|
| A1 | Protection → Screen Time access → Allow | Apple sheet; status becomes approved | |
| A2 | Deny, then retry | Honest "not allowed" state; no crash; retry possible | |
| A3 | Revoke in iOS Settings → Screen Time while app is open | App notices on next foreground; no stale ✓ | |
| A4 | App picker: select Instagram only | "1 app selected" persists across relaunch | |

## 4. Whole-app blocking
| # | Step | Expected | Result |
|---|---|---|---|
| W1 | Start 5-min session, open Instagram | Shield shows Focusling copy | |
| W2 | Shield action button | Returns to Focusling / closes as designed | |
| W3 | Session completes | Shield clears within seconds; reward granted once | |
| W4 | End early | Shield clears; abandon flow; no reward | |

## 5. Reels detection (iOS 27)
| # | Step | Expected | Result |
|---|---|---|---|
| R1 | Reels-only session; open Reels tab | Intervention within the documented vote window | |
| R2 | Reel from a DM / profile / Explore | Detected (see vectors in `IOS_DEVICE_TEST_PLAN.md`) | |
| R3 | **False positives**: feed, Stories, DMs, profile grid, camera | No intervention | |
| R4 | Intervention clearing: leave Reels | Intervention clears; no lingering shield | |
| R5 | Screen Capture indicator | iOS recording indicator visible while capturing; stops at session end | |
| R6 | Capture denied / picker cancelled | Falls back honestly; offer whole-app; nothing switches silently | |

## 6. Lifecycle
| # | Step | Expected | Result |
|---|---|---|---|
| L1 | Background Focusling during a session | Timer and protection continue | |
| L2 | Force quit during a session | Protection keeps running until scheduled end; app restores session on relaunch | |
| L3 | Session ends while app is killed | Shield clears via DeviceActivity monitor; reward granted once on next open | |
| L4 | Crash/relaunch mid-session (Developer tools crash or kill from Xcode) | No orphaned shield; state reconciled | |
| L5 | Reboot during a session | Shield behaviour documented; no permanent block | |
| L6 | Change device time during a session | No double reward; sane state | |

## 7. Battery, thermal, audio
| # | Step | Expected | Result |
|---|---|---|---|
| P1 | 60-min Reels-only session, screen on | Record battery % used and thermal state | |
| P2 | Same, whole-app mode | Lower drain than P1 | |
| P3 | Music (Apple Music/Spotify) playing, then start a session | Music keeps playing; Focusling UI sounds mix, never pause music | |
| P4 | Podcast playing; tap through UI | Podcast not ducked/stopped by UI sounds | |
| P5 | Bluetooth headphones / AirPods | Sounds route correctly; no lag beyond ~100 ms | |
| P6 | Silent switch on | UI sounds silent (ambient category); haptics still per setting | |
| P7 | Rapid tapping (10 taps/s on a button) | No audio pile-up, no dropped presses, no stutter | |
| P8 | During focus | No idle/pet/reaction sounds; only the start/end cues | |
| P9 | Sound Effects / Haptics off | Fully silent / no haptics | |

## 8. StoreKit (sandbox or `.storekit` configuration)
| # | Step | Expected | Result |
|---|---|---|---|
| S1 | Open Premium | Localized names and prices from StoreKit; no "Demo price" | |
| S2 | Subscribe (sandbox) | Apple sheet; on success, Premium active; Nightglow wearable | |
| S3 | Cancel in sheet | Nothing changes; no error banner | |
| S4 | Ask to Buy / pending | "Waiting for approval" message; unlocks when approved | |
| S5 | Restore on a fresh install | `AppStore.sync` prompt; Premium restored | |
| S6 | Manage subscription | Apple's manage sheet opens | |
| S7 | Let sandbox subscription expire | Returns to Free; Premium pieces hidden, not deleted; free items intact | |
| S8 | Refund / revoke (StoreKit test) | Returns to Free via `Transaction.updates` | |
| S9 | Airplane mode on Premium screen | Graceful "couldn't reach the App Store"; previews still work | |
| S10 | Family Mode Child View | No purchase UI anywhere; Premium page read-only | |

## 9. Planner on device (Studyling)

### App lifecycle
| # | Step | Expected | Result |
|---|---|---|---|
| A1 | Launch, reload, background, force quit, lock/unlock with plans saved | Planner data and pending reminders intact; nothing duplicated | |
| A2 | Import a text-based PDF syllabus | Pages read on device; review shows items with page/line | |
| A3 | Import a scanned (image-only) PDF | Progress shows page N of M; OCR text parsed; OCR-repaired dates marked Needs review | |
| A4 | Same PDF again | "Already imported" (no duplicates, no second OCR pass in the same session) | |
| A5 | Large PDF (40+ pages) | UI stays responsive (work is off the main thread) | |

### Notifications
| # | Step | Expected | Result |
|---|---|---|---|
| N1 | Turn on reminders → Allow | Permission prompt only now; start cues scheduled for the next 72 h | |
| N2 | Turn on reminders → Don't Allow | Calm settings note; planner works; no re-prompt | |
| N3 | Wait for a start cue | Delivered at plan time; Private copy by default | |
| N4 | Tap **Start & Lock** on the notification | App opens straight into the planned session; protection result shown truthfully | |
| N5 | Tap the notification body | Planner opens | |
| N6 | Quiet hours covering a plan | No notification | |
| N7 | Reschedule / skip / complete the assignment | Old notification cancelled; rescheduled one appears once | |
| N8 | Start a session before a later cue | No cue fires during the session | |
| N9 | Revised syllabus moves a deadline earlier | Plans after it cancelled; their notifications gone | |

### Widget (StudylingWidgets)
| # | Step | Expected | Result |
|---|---|---|---|
| W1 | Add small and medium widgets | Studyling, next course/time (small); assignment, minutes, today, Start & Lock (medium) | |
| W2 | Private mode (default) | No course or assignment names | |
| W3 | Detailed mode | Course code + assignment title | |
| W4 | Tap Start / Start & Lock | Planned session starts (source = widget) | |
| W5 | Accept/complete plans | Widget refreshes within seconds (timeline reload) | |
| W6 | Delete the app's data / stale snapshot | Widget shows "No block yet", no crash | |

### Live Activity
| # | Step | Expected | Result |
|---|---|---|---|
| L1 | Start a session | Live Activity starts: Studyling, countdown, protection status | |
| L2 | Lock the phone / Dynamic Island | Countdown runs; compact/minimal views readable | |
| L3 | Private vs Detailed | Private never shows course/assignment | |
| L4 | Protection failed | "Not protected" (never "Protected") | |
| L5 | Complete / end early | Activity ends immediately | |
| L6 | Force quit during a session, relaunch | Activity ended or resumed; no orphan | |

### Time
| # | Step | Expected | Result |
|---|---|---|---|
| T1 | Change time zone with plans | Plans keep absolute times; due times stay in the course zone | |
| T2 | Day rollover with the app open | Today/Upcoming update | |
| T3 | DST change (US: 1 Nov 2026) | Evening windows stay at local evening times | |

## 10. Accessibility on device
| # | Step | Expected | Result |
|---|---|---|---|
| X1 | VoiceOver through Pet, Focus, Shop, Play, Premium, Room Studio | Every control labelled; Premium marker read as "Premium" | |
| X2 | Largest Dynamic Type (non-accessibility sizes) | No clipped primary actions | |
| X3 | Reduce Motion | Fades instead of bounces/particles | |
| X4 | Close / Restore / Manage on Premium reachable with VoiceOver | Yes | |
