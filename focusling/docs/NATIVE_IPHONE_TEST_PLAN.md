# Native iPhone test plan

**Status: nothing in this plan has been run.** Every Result cell is empty on purpose. Web,
simulator and Jest tests can't stand in for these rows. Don't mark a row passed without running it
on a physical iPhone and recording the device, iOS version and build.

Companion docs: `IOS_DEVICE_TEST_PLAN.md` (step-by-step selective Reels setup and the detection
matrix), `IOS_SELECTIVE_BLOCKING_RESEARCH.md`, `PREMIUM.md`.

## 0. Readiness audit (from the code, not a device)

| Area | What's in the repo | Known risk / to verify |
|---|---|---|
| Protection module | `modules/focusling-protection/ios` (FamilyControlsService, ShieldController, SessionScheduler, InterventionController, ScreenCaptureController, DetectionCore) | Never compiled in this environment |
| Extensions | `targets/device-activity`, `shield-action`, `shield-config` (iOS 16.4, app group `group.com.focusling.app`) | Signing of 4 bundle IDs with Family Controls + App Groups |
| Entitlements | `app.json`: family-controls, app group, `UIBackgroundModes: ["screen-capture"]` | Family Controls **distribution** approval needed for TestFlight/App Store |
| Reels detection | ScreenCaptureKit on iOS 27 (`SCContentSharingPicker`) | iOS 27 only; whole-app works on 16.4+ |
| Store module | `modules/focusling-store` (StoreKit 2) | Never compiled; needs products or a `.storekit` file |
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

## 9. Accessibility on device
| # | Step | Expected | Result |
|---|---|---|---|
| X1 | VoiceOver through Pet, Focus, Shop, Play, Premium, Room Studio | Every control labelled; Premium marker read as "Premium" | |
| X2 | Largest Dynamic Type (non-accessibility sizes) | No clipped primary actions | |
| X3 | Reduce Motion | Fades instead of bounces/particles | |
| X4 | Close / Restore / Manage on Premium reachable with VoiceOver | Yes | |
