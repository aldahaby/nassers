# iOS selective content blocking: research

Question this milestone must answer:

> Can Focusling keep native Instagram useful while reliably interrupting only Reels during a focus session?

**Status:** research done and proof-of-concept code written. **Not yet answered.** The answer needs the
physical-iPhone test matrix in `docs/IOS_DEVICE_TEST_PLAN.md`. Nothing below claims native Reels
blocking works; it states what current Apple documentation allows and what still has to be proven on
a device.

Sources: Apple developer documentation, read in September 2026 (JSON documentation endpoints for the
pages linked below), plus the public README/marketing descriptions of third-party apps (see
`THIRD_PARTY_RESEARCH.md`).

---

## 1. Verified API facts (September 2026)

### Screen capture

| Fact | Source |
|---|---|
| **ScreenCaptureKit is available on iOS/iPadOS 27.0+** (`SCStream`, `SCStreamConfiguration`, `SCContentFilter`, `SCContentSharingPicker`, `SCStreamOutput`, `SCStreamDelegate`) | ScreenCaptureKit framework page, platform list |
| **ReplayKit broadcast APIs are deprecated in iOS 27** (`RPBroadcastSampleHandler`, `RPSystemBroadcastPickerView`, `RPScreenRecorder.startCapture`) | ReplayKit symbol pages |
| iOS capture starts from the **system content-sharing picker** (`SCContentSharingPicker.shared.present()` for full-display capture, `presentForCurrentApplication()` for in-app). The app gets an `SCContentFilter` in `contentSharingPicker(_:didUpdateWith:for:)` and builds an `SCStream` from it | "Capturing screen content on iOS" sample article |
| **Background:** the `screen-capture` value in `UIBackgroundModes` means "the app captures and streams screen content while in the background". Apple's sample uses it "so the stream survives backgrounding for full-display capture" | UIBackgroundModes; "Configuring background execution modes"; iOS sample |
| On iOS, `SCStreamConfiguration` exposes output **width/height**, audio options, dynamic range and presets. `minimumFrameInterval` is **macOS-only**, so on iOS frame-rate throttling has to be done by the app | Per-symbol platform lists |
| `SCShareableContent` and `SCScreenshotManager` are macOS-only; iOS must go through the picker | Per-symbol platform lists |
| `stream(_:didStopWithError:)` is delivered when capture stops; `userStopped` means the person stopped it | SCStreamDelegate |
| `SCContentSharingPicker.isAvailable`: "whether screen recording is supported and allowed on this device" | SCContentSharingPicker |

**Consequence:** on iOS 27 the Apple-recommended architecture runs capture **inside the Focusling
app process**, not in a broadcast upload extension. That is better for us (no 50 MB extension
memory ceiling, and native state lives in the same process as the Screen Time controls), but capture
**ends when the process dies**, including a force quit. That has to be accepted as a product
limitation rather than hidden.

Unknown until tested on a device: whether capture continues through a screen lock; whether the
picker has to be confirmed at every session start (almost certainly yes); how capture behaves when
Instagram shows protected content; and the exact wording of the system recording indicator.

**ReplayKit fallback:** only if the device test shows iOS 27 ScreenCaptureKit cannot keep full-display
capture running while another app is in front. It is deprecated, so it would be a stopgap for
iOS 26 devices at most.

### Screen Time (Family Controls / Managed Settings / Device Activity)

| Fact | Source |
|---|---|
| `AuthorizationCenter.requestAuthorization(for: .individual)` (iOS 16+) lets an individual authorise their own device | FamilyControls |
| `FamilyActivityPicker` returns a `FamilyActivitySelection` of opaque tokens; the app can't learn which apps were chosen | FamilyActivityPicker |
| `ManagedSettingsStore(named:)` (iOS 16+) applies shields; setting a value to `nil` removes it | ManagedSettingsStore |
| Shield appearance comes from a `ShieldConfigurationDataSource` extension; button taps go to a `ShieldActionDelegate` extension, which receives tokens, not app names | ManagedSettingsUI / ShieldActionDelegate |
| `ShieldActionResponse`: `.close` ("close the current application"), `.defer`, `.none` | ShieldActionResponse |
| **DeviceActivity schedules must be at least 15 minutes** (`MonitoringError.intervalTooShort`) | DeviceActivityCenter.MonitoringError |
| `intervalDidEnd(for:)` in a `DeviceActivityMonitor` extension runs even if the app isn't running | DeviceActivityMonitor |
| The Family Controls entitlement is added via the capability for development; **App Store distribution requires Apple's approval** (Family Controls distribution request) | com.apple.developer.family-controls |

### Network Extension URL Filter (iOS 26)

| Fact | Source |
|---|---|
| `NEURLFilterManager` (iOS 26+): "The system filters all URL requests initiated with the **WebKit and URLSession** APIs." | NEURLFilterManager |
| `NEURLFilter` exists "to voluntarily validate URLs for apps that **don't use WebKit or the URL session API**" | NEURLFilter |
| Matching is Bloom filter plus **PIR server** lookup. The app's Info.plist **must** contain `NSPIRConfiguration` with a `PIRServerURL`. No wildcards or regular expressions in the dataset | NEURLFilterManager |

---

## 2. The four strategies

### A. Visual detection (screen capture, then on-device classifier, then shield)
- **How:** full-display `SCStream`, sample about 1 frame per second, downscale, classify the
  current surface on-device, and require several positive votes in a rolling window. On a confident
  Reels detection, apply a temporary `ManagedSettings` shield to the user-selected Instagram token.
  The Focusling shield appears, and "Back to focus" returns `.close`.
- **Why it can be selective:** it recognises the Reels *interface* (layout plus UI text cues), not
  video bytes. DMs, feed, profiles and posts are never shielded.
- **Risks:** accuracy and false positives; Instagram UI changes; the visible recording indicator;
  one picker confirmation per session; battery; capture ends if Focusling is force-quit.
- **Precedent:** Slowth ships this pattern (ReplayKit broadcast extension, Core ML classifier,
  3-of-5 votes, Screen Time shield), per its public README. We do our own implementation on
  iOS 27's ScreenCaptureKit.

### B. iOS 26 URL Filter (`NEURLFilterManager`)
- Applies only to **WebKit/URLSession** traffic. Instagram's native app runs its own networking
  stack: Meta has published that Instagram for iOS uses its own QUIC implementation, mvfst. That
  traffic is very likely **outside** the URL filter, unless Instagram voluntarily called
  `NEURLFilter`, which there is no reason to expect.
- Even if it were covered, Reels video comes from the same media CDN as feed videos and Stories, and
  Bloom/PIR matching has no wildcards. Distinguishing Reels by URL is implausible.
- A PIR server is **required** (the plist key is mandatory), which means server infrastructure.
- **Verdict:** not viable for native Instagram. It stays interesting for **Safari/WebKit** (for
  example, blocking `instagram.com/reels/` in the browser). The device check in the test plan
  confirms or rejects the "Instagram bypasses it" conclusion; no further investment until then.

### C. Local network / VPN-style filtering (packet tunnel or DNS proxy)
- Without TLS interception (which we will not do), a local tunnel only sees hostnames (SNI/DNS)
  and traffic volume. Reels, feed videos, Stories and Live share media hosts, so blocking video
  hosts breaks **most Instagram video, not just Reels**. That fails the "Reels-only" requirement by
  construction.
- It also takes over the single system VPN slot (conflicts with users' VPNs), costs battery, faces
  App Store scrutiny, and breaks whenever Meta changes infrastructure.
- **Verdict:** not selective enough. At most a crude "no Instagram video" mode. Not pursued.

### D. Filtered web experience (ScrollGuard-style)
- A Shortcuts automation ("when Instagram opens, open Focusling's filtered web view") plus a web
  view or Safari Web Extension that hides Reels/Explore with CSS/JS. It works reliably on the
  *web* and is selective, but it **isn't native Instagram**: no native notifications in the
  filtered view, weaker posting and Stories creation, a Shortcuts setup step the app can't automate,
  and dependence on Instagram's web markup.
- **Verdict:** a reasonable **compatibility fallback** for users who refuse screen recording.
  Not the primary architecture. Not built this milestone.

---

## 3. Decision matrix

Legend: ✅ good · ⚠️ partial/uncertain · ❌ poor. "(device)" means the answer still needs the
physical-iPhone test.

| Criterion | A. Visual detection | B. URL filter | C. VPN/DNS filter | D. Filtered web |
|---|---|---|---|---|
| Works in native Instagram | ⚠️ expected (device) | ❌ Instagram uses its own QUIC stack, outside the WebKit/URLSession filter | ⚠️ affects traffic, not UI | ❌ replaces the native app |
| Reels-only selectivity | ⚠️ depends on detector accuracy (device) | ❌ Reels URLs not distinguishable | ❌ shared video CDN | ✅ on web |
| DMs preserved | ✅ never shielded unless misclassified | n/a | ⚠️ text yes, video messages no | ⚠️ web DMs only |
| Stories preserved | ✅ unless configured | n/a | ❌ same video hosts | ✅ |
| Setup friction | ⚠️ 2 permissions plus a picker per session | ⚠️ VPN-style permission | ⚠️ VPN profile | ❌ Shortcuts automation |
| Visible iOS indicator | ⚠️ recording indicator (by design) | none | VPN icon | none |
| Battery | ⚠️ capture plus inference at ~1 fps (device) | ✅ | ⚠️ tunnel overhead | ✅ |
| Reliability | ⚠️ (device) | ❌ | ❌ breaks with CDN changes | ⚠️ breaks with web markup |
| App Store viability | ⚠️ precedent exists (Slowth is on the App Store) | ✅ but needs a PIR server | ⚠️ VPN scrutiny | ⚠️ |
| Entitlement complexity | Family Controls (distribution approval) | NE URL filter plus PIR | NE packet tunnel | none |
| Survives Focusling backgrounded | ✅ documented `screen-capture` mode (device) | ✅ | ✅ | n/a |
| Survives force quit | ❌ capture is in-process | ✅ | ✅ | n/a |
| Privacy | ⚠️ sensitive; mitigated by on-device-only processing | ✅ | ⚠️ sees hostnames | ✅ |
| Maintenance when Instagram's UI changes | ⚠️ detector updates needed | n/a | ❌ | ⚠️ selectors |
| Coexists with other VPNs | ✅ | ✅ | ❌ | ✅ |
| Technical risk | High but testable | Rejected by docs | Rejected by selectivity | Low but not native |

**Chosen:** **A. Visual detection** for "Reels only", with **whole-app Screen Time shielding** as the
explicit user-chosen fallback. B and C are rejected for native Instagram on documented grounds
(B's scope is WebKit/URLSession; C cannot see beyond hostnames without TLS interception). A small
device check for B is still in the test plan so the conclusion rests on observation, not only
documentation. D is kept as a future compatibility option.

---

## 4. Chosen architecture (A plus whole-app fallback)

```
JS (game)                       Native (Swift, Expo module "FocuslingProtection")
─────────                       ────────────────────────────────────────────────────
FocusProtectionService  ──────► ProtectionCoordinator (single source of truth)
  ├ MockProtectionService          ├ FamilyControlsService   (auth, picker, tokens)
  └ IOSProtectionService           ├ ShieldController        (ManagedSettingsStore, named stores)
                                   ├ SessionScheduler        (DeviceActivity ≥15 min)
                                   ├ ScreenCaptureController (SCContentSharingPicker + SCStream)
                                   ├ ContentSurfaceDetector  (Vision text + layout heuristics)
                                   ├ DetectionPolicy         (confidence, votes, window, cooldown)
                                   ├ InterventionController  (temporary Reels shield)
                                   └ SharedState             (App Group, session ID)
Extensions: ShieldConfiguration · ShieldAction · DeviceActivityMonitor
```

- Native state is authoritative. JS shows "Reels protection active" only after native confirms
  capture is running for *this* session ID.
- Every native event carries the session ID. Anything with a stale ID is ignored.
- One cleanup path (`endProtection(sessionId, reason)`) stops capture and detection, clears the
  temporary and whole-app shields, and stops DeviceActivity monitoring.

### Detector (first POC)
- **No ML model yet**, and not production-ready. A Vision text-recognition pass (`.fast`) on a
  downscaled frame, plus layout heuristics tuned to the Reels viewer:
  - a "Reels" header or tab label in the top band
  - a right-edge column of numeric engagement counts (likes, comments, shares)
  - an audio attribution line ("Original audio" or a music line) or a caption with "Follow" in the
    bottom band
  - no feed/DM chrome (such as "Message…" or a "Send" composer)
- **"Vertical video" alone never counts:** a full-screen feed video lacks the right-rail counts
  plus audio line combination.
- Output: `{ app: 'instagram' | 'unknown', surface: 'reels' | 'other', confidence }`. OCR text is
  used in memory for scoring only and is never logged or stored.
- `DetectionPolicy` (configurable): confidence threshold 0.75, 3 votes in the last 5 samples,
  minimum 1.5 s between the first and confirming vote, 20 s cooldown after an intervention.
- **Path to production:** replace the heuristic with our own Core ML classifier trained on
  consented, self-captured screenshots from the debug-only data collection flow (labels
  `instagram_reels`, `instagram_home`, `instagram_dm`, `instagram_post`, `instagram_profile`,
  `other`). No third-party model or weights.

### Intervention
1. Confident Reels detection for the current session.
2. `ShieldController` puts the Instagram token in the **temporary** named store
   (`focusling.intervention`).
3. The system shows Focusling's shield over Instagram: "Reels are blocked during this focus
   session." / "Back to focus".
4. ShieldAction: clear the temporary store, then return `.close`, which closes Instagram.
5. The detector cooldown (20 s) prevents an immediate re-shield loop. Opening Instagram again works;
   if it reopens straight into Reels, new votes are needed before another intervention.
6. A safety timer also clears the temporary shield after 60 s if no shield action arrives.
7. **Detection is not failure:** no game state changes. The session continues; rewards, streak and
   happiness are untouched.

To verify on device: that `ManagedSettingsStore` changes made while Instagram is frontmost show the
shield immediately; that clearing the store inside the ShieldAction handler before `.close` leaves
Instagram unshielded next time; the latency from detection to shield.

### Whole-app mode
The selection's app tokens go into the session store (`focusling.session`). DeviceActivity
monitoring runs for `max(session, 15 min)` so `intervalDidEnd` removes the shield even if Focusling
was force-quit. The app also clears it on completion and early end. For sessions under 15 minutes
(debug), a force-quit Focusling leaves the shield in place until the 15-minute interval ends;
Emergency cleanup in Developer Tools clears it at once.

---

## 5. Privacy
- Frames are processed in memory, on device, and dropped after classification. Nothing is
  written, uploaded or logged. No audio, no microphone.
- OCR strings are never logged. Diagnostics expose only `{surface, confidence, votes}`.
- Tokens are opaque, stored only on device (App Group) and never logged or displayed.
- Debug data collection (debug builds only): explicit opt-in, a visible "collecting" banner, saved
  locally to the app container, exported manually through the share sheet, and compiled out of
  release builds.
- The system recording indicator is never hidden or worked around.

## 6. Entitlements and capabilities
| Target | Entitlements / keys |
|---|---|
| App | `com.apple.developer.family-controls`, App Group `group.com.focusling.app`, `UIBackgroundModes: [screen-capture]` |
| ShieldConfiguration ext | Family Controls, App Group |
| ShieldAction ext | Family Controls, App Group |
| DeviceActivityMonitor ext | Family Controls, App Group |

Development: Family Controls works with development signing on a physical device. **Distribution
requires Apple's Family Controls approval for each bundle ID.** ScreenCaptureKit on iOS needs no
special entitlement in the documentation (the persistent-content-capture entitlement is for VNC apps
and not requested).

## 7. Open questions only a device can answer
1. Does full-display `SCStream` keep delivering frames while Instagram is frontmost for 5–30 minutes?
2. Screen lock and unlock: does the stream stop (`didStopWithError`), pause, or continue?
3. Does the picker have to be confirmed at every session start?
4. Detector accuracy across the manual matrix (DMs, feed, carousel, video posts, profile, search,
   Stories, Reels).
5. Time from Reels to shield; shield-loop behaviour; `.close` behaviour.
6. CPU, memory, thermal and battery over 15–30 minutes at about 1 fps.
7. URL-filter spot check: does a Bloom entry for an Instagram media host affect the native app at all?
