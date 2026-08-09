# Adding fonts and PNGs to CITYBREAKER

## Fonts — done, and how it works now

The game no longer depends on any font your device happens to have.
**Archivo Black is embedded directly in `game.html` as base64** inside two `@font-face` rules
(`font-family: 'CBDisplay'`). It needs no network, no CDN, no CSP exception, and it renders
byte-identically on iPhone, Android and desktop.

That was the whole bug: `Arial Black` does not exist on iOS, so the UI kept falling through to a
thin system face — which is why my screenshots and your screen never matched.

The `@font-face` declares `font-weight: 100 900` on a single-weight file on purpose. That maps any
requested weight onto the real face instead of letting the browser fake a bold, which smears it.

### To swap in a different font later

1. Pick one and get its `.woff2`. Any of these are good chunky/classic choices:
   `Archivo Black` (current), `Bungee`, `Luckiest Guy`, `Passion One`, `Alfa Slab One`, `Titan One`.
2. Get the file URL:
   ```
   curl -A "Mozilla/5.0 Chrome/120" \
     "https://fonts.googleapis.com/css2?family=Bungee&display=swap" | grep -o "https://[^)]*woff2"
   ```
3. Download it and base64 it:
   ```
   curl -A "Mozilla/5.0 Chrome/120" -o f.woff2 "<url from step 2>"
   base64 -w0 f.woff2 > f.b64
   ```
4. In `game.html`, replace the base64 blob inside the `@font-face` whose `src:` is
   `url(data:font/woff2;base64,…)`. Keep `font-weight:100 900`.

Or just tell me the font name and I will do all four steps — I can reach Google Fonts from here.

## PNGs — how to get one into the game

I **cannot** read images you attach to a chat message. They arrive to me as pictures, not as files,
so there is nothing for me to write to disk. There are two ways round that.

### Option A — you put the file in the repo (easiest, works every time)

1. Drop the file into `assets/` in the repo, e.g. `assets/cloud.png`.
2. Commit and push it, or just tell me the filename if you have added it in the web editor.
3. Tell me: *"use assets/cloud.png for the clouds"*.

I will wire it up. In code that is a one-liner — the loader already exists:

```js
const tex = new THREE.TextureLoader().load('./assets/cloud.png');
tex.colorSpace = THREE.SRGBColorSpace;
// transparent PNG on a camera-facing plane:
const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
```

Requirements for it to look right:
- **PNG with a real alpha channel** (transparent background, not white).
- Power-of-two dimensions are ideal (512×512, 1024×512). Not required, but sharper.
- Keep it under ~400 KB or it slows the first load on mobile.

### Option B — paste it as base64

If you can get the file as base64 text (on iPhone: any "file to base64" shortcut or site), paste it
to me in a message and I will write it straight into `assets/` and wire it in. Large images make a
very long message, so this is best for small ones.

### Where PNGs currently plug in

| What | Where it is used | File it would replace |
|---|---|---|
| Clouds | `_cloudSprite()` in `CitySystem` | procedural canvas sprite |
| Villain card portraits | `assets/prev_*.png` | already PNGs — drop in a replacement with the same name |
| Sign faces (Tokyo) | `_signTex(i)` | procedural canvas texture |
| Building facades | `_drawFacade(style)` | procedural canvas texture |

For any of these, the swap is: put the PNG in `assets/`, and I replace the canvas call with a
`TextureLoader().load('./assets/yourfile.png')`.
