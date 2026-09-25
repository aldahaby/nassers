# Third-party research record

Projects and products consulted while designing iOS selective blocking. **No third-party source code,
models, weights, training data or assets have been copied into Focusling.**

| Project | License | What we looked at | What we learned conceptually | Anything copied? |
|---|---|---|---|---|
| **Slowth** (github.com/skar404/slowth) | **GPLv3**, including its Core ML model and weights | Public README / architecture description only | Native Reels/Shorts detection is shipped on the App Store using Family Controls, a screen-recording classifier (ReplayKit broadcast extension), hierarchical app→surface classification, a 3-of-5 vote rule before intervening, fail-closed when the model can't load, and Screen Time shields for intervention | **No.** GPLv3 architecture reference only. No source code, models, weights, training data or assets copied. Focusling's implementation uses iOS 27 ScreenCaptureKit instead of the now-deprecated ReplayKit, a text/layout heuristic detector, and its own policy thresholds and configuration. |
| **ScrollGuard** (scrollguard.app) | Proprietary | App Store listing and public product descriptions (via search results) | iOS strategy: a Shortcuts automation redirects from the native Instagram app to a filtered web experience; Safari extension hides Reels/Explore | **No.** Concept only (our "Strategy D"). |
| **@bacons/apple-targets** (npm) | MIT | Package README and build scripts | Expo config plugin that generates the Shield Configuration, Shield Action and Device Activity Monitor extension targets outside `/ios` | Used as a **build-time dependency**, not copied |
| **Apple sample "Capturing screen content on iOS"** | Apple sample code license | Documentation article | Picker → `SCContentFilter` → `SCStream` flow, `screen-capture` background mode | No sample code copied; our capture controller is written from the API docs |
| **Meta Engineering: "How Facebook is bringing QUIC to billions"** | Article | Public blog post | Instagram iOS runs Meta's own QUIC stack (mvfst), which informs why a WebKit/URLSession-scoped URL filter is unlikely to see its traffic | n/a |

If Focusling ever chose to reuse Slowth code, models or weights, Focusling as a whole would have to
be distributed under GPLv3. That is **not** the case today.
