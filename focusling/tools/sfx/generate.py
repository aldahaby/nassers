#!/usr/bin/env python3
"""
Focusling placeholder SFX generator.

Every sound in assets/sfx/ is synthesised from scratch by this script: sine
tones, pitch sweeps, soft noise and a tiny plucked-string model, shaped with
envelopes and a gentle low-pass. No samples, recordings or third-party sounds
are used, so the output is original Focusling audio (see docs/AUDIO_DIRECTION.md).

Deterministic: the same script always produces the same files (fixed noise seed).
Run:  python3 tools/sfx/generate.py
Output: 22.05 kHz, mono, 16-bit PCM WAV, peak-normalised to -1 dBFS; the per-sound
mix level lives in src/config/sounds.ts, not in the files.
"""
import math
import os
import random
import struct
import wave

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'sfx')
TAU = math.pi * 2


def silence(ms):
    return [0.0] * int(SR * ms / 1000)


def env(n, attack_ms=3, release_ms=None, decay=None):
    """Soft attack, then exponential decay (`decay` = time constant, s) or a linear release."""
    a = max(1, int(SR * attack_ms / 1000))
    out = []
    for i in range(n):
        g = min(1.0, i / a)
        t = i / SR
        if decay:
            g *= math.exp(-max(0, t - attack_ms / 1000) / decay)
        if release_ms:
            r = int(SR * release_ms / 1000)
            if i > n - r:
                g *= max(0.0, (n - i) / r)
        out.append(g)
    return out


def bubble(ms, f0, f1, decay=0.035, harm=0.12, attack_ms=2):
    """A bubble: a sine whose pitch glides f0 -> f1 (exponentially), with a quick decay."""
    n = int(SR * ms / 1000)
    e = env(n, attack_ms=attack_ms, decay=decay, release_ms=8)
    out, ph = [], 0.0
    for i in range(n):
        t = i / n
        f = f0 * (f1 / f0) ** t
        ph += TAU * f / SR
        out.append(e[i] * (math.sin(ph) + harm * math.sin(2 * ph)))
    return out


def tone(ms, f, decay=0.2, attack_ms=4, partials=((1, 1.0),), vibrato=0.0, vib_rate=6.0):
    """A soft bell/tone made of a few partials."""
    n = int(SR * ms / 1000)
    e = env(n, attack_ms=attack_ms, decay=decay, release_ms=12)
    out = []
    phases = [0.0] * len(partials)
    for i in range(n):
        t = i / SR
        v = 1 + vibrato * math.sin(TAU * vib_rate * t)
        s = 0.0
        for k, (mult, amp) in enumerate(partials):
            phases[k] += TAU * f * mult * v / SR
            s += amp * math.sin(phases[k])
        out.append(e[i] * s)
    return out


def noise(ms, seed, decay=0.05, attack_ms=6, lp=0.15):
    """Soft filtered noise (an airy puff or breath)."""
    rnd = random.Random(seed)
    n = int(SR * ms / 1000)
    e = env(n, attack_ms=attack_ms, decay=decay, release_ms=10)
    out, y = [], 0.0
    for i in range(n):
        y += lp * ((rnd.random() * 2 - 1) - y)
        out.append(e[i] * y * 3)
    return out


def pluck(ms, f, seed, damp=0.996):
    """Tiny Karplus-Strong pluck: a soft leaf 'plink'."""
    rnd = random.Random(seed)
    period = max(2, int(SR / f))
    buf = [rnd.random() * 2 - 1 for _ in range(period)]
    n = int(SR * ms / 1000)
    out = []
    for i in range(n):
        a = buf[i % period]
        b = buf[(i + 1) % period]
        buf[i % period] = damp * 0.5 * (a + b)
        out.append(a)
    e = env(n, attack_ms=1, release_ms=20)
    return [x * g for x, g in zip(out, e)]


def lowpass(x, a=0.35):
    y, out = 0.0, []
    for s in x:
        y += a * (s - y)
        out.append(y)
    return out


def mix(*parts):
    """Mix (offset_ms, samples, gain) layers."""
    length = max(int(SR * off / 1000) + len(s) for off, s, _ in parts)
    out = [0.0] * length
    for off, s, g in parts:
        o = int(SR * off / 1000)
        for i, v in enumerate(s):
            out[o + i] += v * g
    return out


def note(name):
    """Note name -> Hz (A4 = 440)."""
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    semis = names[name[0]] + (1 if '#' in name else 0) + (int(name[-1]) - 4) * 12
    return 440 * 2 ** (semis / 12)


def bell(ms, n, decay=0.18):
    # Soft, round bell: fundamental plus a quiet octave and fifth (no harsh inharmonics).
    return tone(ms, note(n), decay=decay, partials=((1, 1.0), (2, 0.18), (3, 0.06)))


def write(name, samples):
    samples = lowpass(samples, 0.55)
    peak = max(1e-6, max(abs(s) for s in samples))
    gain = 0.89 / peak  # -1 dBFS
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s * gain)) * 32767)) for s in samples))
    return path, len(samples) * 1000 // SR


SOUNDS = {
    # ── UI palette ──
    'tap': lambda: bubble(70, 880, 1500, decay=0.022),
    'primary': lambda: mix((0, bubble(130, 380, 720, decay=0.05, harm=0.2), 1.0), (8, bubble(90, 760, 1100, decay=0.025), 0.25)),
    'nav': lambda: bubble(50, 1350, 2050, decay=0.014, harm=0.05),
    'back': lambda: bubble(80, 950, 520, decay=0.028),
    'toggle-on': lambda: mix((0, bubble(60, 560, 820, decay=0.02), 0.8), (45, bubble(70, 820, 1250, decay=0.022), 1.0)),
    'toggle-off': lambda: mix((0, bubble(60, 1000, 760, decay=0.02), 1.0), (45, bubble(70, 700, 480, decay=0.022), 0.8)),
    'select': lambda: mix((0, bubble(80, 760, 1250, decay=0.025), 1.0), (35, tone(110, 2637, decay=0.05, partials=((1, 1.0),), vibrato=0.004, vib_rate=30), 0.18)),
    'equip': lambda: mix((0, bubble(130, 420, 760, decay=0.045, harm=0.2), 1.0), (70, bell(150, 'E6', 0.06), 0.22), (120, bell(150, 'G#6', 0.06), 0.2)),
    'confirm': lambda: mix((0, bubble(120, 500, 780, decay=0.04), 1.0), (95, bubble(150, 700, 1080, decay=0.05), 0.9), (110, bell(200, 'E6', 0.08), 0.12)),
    'unlock': lambda: mix(
        (0, bubble(100, 520, 900, decay=0.04), 0.7),
        (60, bell(260, 'C6'), 0.45), (140, bell(260, 'E6'), 0.42), (220, bell(300, 'G6'), 0.4), (300, bell(360, 'C7', 0.22), 0.34),
        (300, tone(220, 3136, decay=0.08, vibrato=0.006, vib_rate=24), 0.06),
    ),
    'purchase': lambda: mix((0, bubble(90, 600, 900, decay=0.03), 0.7), (40, bell(170, 'E6', 0.07), 0.5), (120, bell(200, 'B6', 0.08), 0.42)),
    'unavailable': lambda: lowpass(bubble(120, 300, 210, decay=0.04, harm=0.05), 0.25),
    'focus-start': lambda: mix((0, tone(520, note('G4'), decay=0.28, attack_ms=40, partials=((1, 1.0), (2, 0.1))), 0.8), (30, tone(500, note('D5'), decay=0.26, attack_ms=50), 0.5)),
    'focus-complete': lambda: mix(
        (0, bell(420, 'C5', 0.25), 0.6), (130, bell(420, 'E5', 0.25), 0.55), (260, bell(520, 'G5', 0.3), 0.55),
        (260, bubble(160, 620, 980, decay=0.05), 0.3),
    ),
    # ── Pets (used sparingly: one per ordinary tap, rate-limited) ──
    'pet-cloudling': lambda: mix((0, noise(170, 11, decay=0.05, lp=0.08), 0.5), (20, bubble(140, 480, 760, decay=0.045), 0.8)),
    'pet-sproutling': lambda: mix((0, pluck(170, 880, 21), 0.55), (25, bubble(110, 700, 1100, decay=0.03), 0.6)),
    'pet-emberling': lambda: mix((0, bubble(120, 620, 980, decay=0.035), 0.8), (40, noise(60, 31, decay=0.012, lp=0.5), 0.2), (60, tone(120, 2349, decay=0.04), 0.15)),
    # ── Reaction accents (short, never loops) ──
    'rx-wave': lambda: mix((0, bubble(100, 640, 980, decay=0.03), 1.0), (110, bubble(110, 760, 1150, decay=0.032), 0.8)),
    'rx-hop': lambda: mix((0, bubble(150, 380, 820, decay=0.06), 1.0), (180, bubble(160, 420, 900, decay=0.06), 0.8)),
    'rx-sleepy': lambda: mix((0, noise(460, 41, decay=0.2, attack_ms=80, lp=0.05), 0.5), (40, tone(460, note('E5'), decay=0.2, attack_ms=60, partials=((1, 1.0),)), 0.22)),
    'rx-cool': lambda: mix((0, noise(120, 51, decay=0.05, lp=0.3), 0.35), (90, bubble(90, 700, 1100, decay=0.025), 1.0)),
    'rx-twirl': lambda: mix(*[(i * 55, bell(160, n, 0.07), 0.5) for i, n in enumerate(['C6', 'D6', 'E6', 'G6', 'A6'])]),
    'rx-pixel': lambda: mix(*[(i * 70, tone(70, note(n), decay=0.03, partials=((1, 1.0), (3, 0.18), (5, 0.07))), 0.6) for i, n in enumerate(['E6', 'G6', 'B6'])]),
    'rx-dream': lambda: mix((0, tone(600, note('A5'), decay=0.35, attack_ms=90, vibrato=0.008, vib_rate=5), 0.5), (0, tone(600, note('A5') * 1.006, decay=0.35, attack_ms=90), 0.35)),
    'rx-victory': lambda: mix(*[(i * 70, bell(200, n, 0.08), 0.5) for i, n in enumerate(['C6', 'E6', 'G6', 'C7'])], (280, bubble(150, 520, 900, decay=0.05), 0.4)),
    'rx-firefly': lambda: mix((0, tone(140, 2093, decay=0.05), 0.35), (170, tone(140, 2637, decay=0.05), 0.3), (330, tone(160, 2349, decay=0.06), 0.28)),
}

if __name__ == '__main__':
    for name, make in SOUNDS.items():
        path, ms = write(name, make())
        print(f'{name:16s} {ms:4d} ms  {os.path.getsize(path):6d} B')
