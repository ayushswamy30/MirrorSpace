"""
Generates every calm sound in assets/sounds/ — synthesised, so there are no
recordings, licences or costs. Deterministic: the same seeds give the same
files, so this script is the source and the .m4a files are its output.

    cd mobile && python scripts/generate-sounds.py [name ...]

Needs numpy, scipy and ffmpeg.

Why it sounds better than the ffmpeg-filter version it replaces:
- Stereo, with the two sides decorrelated, instead of mono.
- Events are modelled, not faked with tremolo: raindrops are tiny decaying
  bubbles with a rising pitch, waves rise, break and wash back with their
  brightness following the energy, embers crackle in bursts, bowls carry
  their real inharmonic overtones with slow beating.
- A soft synthetic room/hall reverb glues each scene together.
- 96 kbps stereo AAC instead of 64 kbps mono.

Each sound is rendered for LOOP + FADE seconds and the tail is crossfaded
(equal power) into the head, so the file loops without a seam. Everything is
matched to -24 LUFS (two-pass loudnorm, linear) so switching never jumps.
"""

import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
LOOP = 64.0          # seconds in the file
FADE = 4.0           # crossfaded seconds
N = int((LOOP + FADE) * SR)
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
TARGET_LUFS = -24
BITRATE = '96k'

t = np.arange(N) / SR


# ---------------------------------------------------------------------------
# Building blocks

def rng(seed):
    return np.random.default_rng(seed)


def colored(r, kind, n=N):
    """White, pink (1/f) or brown (1/f²) noise, unit RMS."""
    x = r.standard_normal(n)
    if kind == 'white':
        return x / np.std(x)
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    spec *= f ** (-0.5 if kind == 'pink' else -1.0)
    y = np.fft.irfft(spec, n)
    return y / np.std(y)


def sos(kind, freq, order=2):
    return signal.butter(order, freq, btype=kind, fs=SR, output='sos')


def lp(x, f, order=2):
    return signal.sosfilt(sos('lowpass', f, order), x)


def hp(x, f, order=2):
    return signal.sosfilt(sos('highpass', f, order), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos('bandpass', [lo, hi], order), x)


def stereo_noise(r, kind, corr=0.35):
    """Two channels of the same colour, partly shared so they sound wide but whole."""
    common = colored(r, kind)
    a, b = colored(r, kind), colored(r, kind)
    k = np.sqrt(corr)
    m = np.sqrt(1 - corr)
    return np.stack([k * common + m * a, k * common + m * b])


def apply(st, fn):
    return np.stack([fn(st[0]), fn(st[1])])


def lfo(r, rate_hz, lo=0.0, hi=1.0, n=N):
    """A smooth random curve wandering between lo and hi, about rate_hz changes a second."""
    k = max(4, int(n / SR * rate_hz) + 4)
    pts = r.random(k)
    x = np.linspace(0, k - 3, n)
    i = np.minimum(np.floor(x).astype(int), k - 4)
    f = x - i
    # Catmull-Rom through the random points
    p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
    y = 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)
    y = np.clip(y, 0, 1)
    return lo + (hi - lo) * y


def pan_gains(p):
    """Equal-power pan; p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def place(buf, start, ev, pan=0.0, gain=1.0):
    s = int(start * SR)
    if s >= N:
        return
    e = min(N, s + len(ev))
    gl, gr = pan_gains(pan)
    buf[0, s:e] += gain * gl * ev[: e - s]
    buf[1, s:e] += gain * gr * ev[: e - s]


def env_ad(n_attack, n_decay):
    a = np.linspace(0, 1, max(1, n_attack)) ** 2
    d = np.exp(-np.linspace(0, 6, max(1, n_decay)))
    return np.concatenate([a, d])


def reverb(st, r, seconds=1.8, mix=0.25, bright=6000):
    """A diffuse tail from exponentially decaying, filtered noise, decorrelated per side."""
    n = int(seconds * SR)
    decay = np.exp(-np.linspace(0, 7, n))
    out = []
    for ch in range(2):
        ir = lp(r.standard_normal(n) * decay, bright)
        ir[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))  # pre-delay softness
        ir /= np.sqrt(np.sum(ir ** 2))
        wet = signal.fftconvolve(st[ch], ir)[: st.shape[1]]
        out.append((1 - mix) * st[ch] + mix * wet)
    return np.stack(out)


def tone(freq, n, partials=((1, 1.0),), detune=0.0, phase=0.0):
    tt = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp in partials:
        y += amp * np.sin(2 * np.pi * freq * ratio * tt + phase)
        if detune:
            y += amp * 0.6 * np.sin(2 * np.pi * (freq * ratio + detune) * tt + phase * 1.3)
    return y


# ---------------------------------------------------------------------------
# Scenes

def rain_bed(r, lo=400, hi=9000, level=1.0, flutter=0.15):
    bed = apply(stereo_noise(r, 'pink', 0.25), lambda x: bp(x, lo, hi))
    bed *= 1 + flutter * (lfo(r, 0.7) - 0.5)
    return level * bed / np.max(np.abs(bed))


def drop_bank(r, count=96, fmin=1500, fmax=4500, tau=(0.004, 0.018)):
    """Raindrop bubbles: a short sine whose pitch rises as it decays, with a click."""
    bank = []
    for _ in range(count):
        f0 = r.uniform(fmin, fmax)
        d = r.uniform(*tau)
        n = int(d * 6 * SR)
        tt = np.arange(n) / SR
        freq = f0 * (1 + 0.6 * tt / (d * 6))
        ph = 2 * np.pi * np.cumsum(freq) / SR
        ev = np.sin(ph) * np.exp(-tt / d)
        click = r.standard_normal(min(n, 60)) * np.exp(-np.arange(min(n, 60)) / 8)
        ev[: len(click)] += 0.6 * click
        bank.append(ev)
    return bank


def scatter(buf, r, bank, per_second, gain=0.05, spread=0.9, density_curve=None):
    count = int(per_second * (LOOP + FADE))
    times = np.sort(r.uniform(0, LOOP + FADE, count))
    for when in times:
        g = gain * r.lognormal(0, 0.6)
        if density_curve is not None:
            g *= density_curve[min(N - 1, int(when * SR))]
        place(buf, when, bank[r.integers(len(bank))], r.uniform(-spread, spread), g)


def rain(seed, rate=280, bright=9000, drop_gain=0.035, window=False, heavy=False):
    r = rng(seed)
    st = rain_bed(r, 400, bright, 0.55 if not heavy else 0.85)
    drops = np.zeros((2, N))
    scatter(drops, r, drop_bank(r), rate, drop_gain)
    if window:
        # close, glassy taps on the pane, fewer and lower
        taps = drop_bank(r, 48, 700, 1600, (0.006, 0.02))
        scatter(drops, r, taps, 4, 0.12, 0.5)
    st = st + drops
    if window:
        st = apply(st, lambda x: lp(x, 4200))
    if heavy:
        st *= 0.75 + 0.5 * lfo(r, 0.12)[None, :]
    return reverb(st, r, 1.2, 0.18)


def thunder(r, buf, when, far=True, gain=0.9):
    n = int(r.uniform(7, 11) * SR)
    rumble = lp(lp(colored(r, 'brown', n), 220 if far else 400), 220 if far else 400)
    e = env_ad(int(r.uniform(0.4, 1.2) * SR), n)[:n]
    # a few rolling sub-swells
    e = e * (0.6 + 0.4 * lfo(r, 1.4, n=n))
    ev = rumble * e
    if not far:
        crack = hp(colored(r, 'white', int(0.4 * SR)), 1200) * np.exp(-np.linspace(0, 8, int(0.4 * SR)))
        ev[: len(crack)] += 0.5 * crack
    ev /= np.max(np.abs(ev))
    place(buf, when, ev, r.uniform(-0.5, 0.5), gain)


def with_thunder(st, seed, count, far=True, gain=0.9):
    r = rng(seed)
    buf = np.zeros_like(st)
    for k in range(count):
        thunder(r, buf, FADE + (LOOP - 14) * (k + 0.3) / count + r.uniform(0, 3), far, gain)
    return st + buf


def waves(seed, period=(8, 11), size=1.0, bright=1.0):
    r = rng(seed)
    st = 0.12 * apply(stereo_noise(r, 'brown', 0.5), lambda x: lp(x, 400))  # distant surf
    low_n = apply(stereo_noise(r, 'brown', 0.4), lambda x: lp(x, 500))
    mid_n = apply(stereo_noise(r, 'pink', 0.3), lambda x: bp(x, 400, 2000))
    hi_n = apply(stereo_noise(r, 'pink', 0.2), lambda x: bp(x, 2000, 8000 * bright))
    e_main = np.zeros(N)
    e_wash = np.zeros(N)
    when = 0.0
    while when < LOOP + FADE:
        rise, fall = r.uniform(2.0, 3.2), r.uniform(4.5, 6.5) * size
        n1, n2 = int(rise * SR), int(fall * SR)
        a = np.linspace(0, 1, n1) ** 2.2
        d = np.exp(-np.linspace(0, 4, n2))
        ev = np.concatenate([a, d]) * r.uniform(0.7, 1.0) * size
        s = int(when * SR)
        e = min(N, s + len(ev))
        e_main[s:e] = np.maximum(e_main[s:e], ev[: e - s])
        # the hiss of foam retreating, a beat after the break
        ws = s + n1 + int(0.4 * SR)
        wash = np.exp(-np.linspace(0, 3, n2)) * np.linspace(1, 0, n2) ** 0.3
        we = min(N, ws + len(wash))
        if ws < N:
            e_wash[ws:we] += 0.6 * wash[: we - ws]
        when += r.uniform(*period)
    pan = 0.35 * (lfo(r, 0.08) - 0.5)
    body = low_n * e_main + 0.8 * mid_n * e_main ** 1.6 + 0.5 * hi_n * (e_main ** 3 + e_wash)
    body[0] *= 1 - pan
    body[1] *= 1 + pan
    return reverb(st + body, r, 2.2, 0.2)


def wind(seed, level=1.0, whistle=0.0, leaves=0.0):
    r = rng(seed)
    gust = lfo(r, 0.18, 0.2, 1.0) ** 1.5
    base = apply(stereo_noise(r, 'brown', 0.4), lambda x: lp(x, 600))
    moving = np.zeros((2, N))
    for lo, hi in [(150, 400), (300, 800), (600, 1500)]:
        w = lfo(r, 0.25)
        moving += apply(stereo_noise(r, 'pink', 0.3), lambda x: bp(x, lo, hi)) * w
    st = (0.6 * base + 0.5 * moving) * gust
    if whistle:
        wh = apply(stereo_noise(r, 'white', 0.6), lambda x: bp(bp(x, 760, 820), 760, 820))
        st += whistle * wh * (gust ** 3)
    if leaves:
        rustle = apply(stereo_noise(r, 'pink', 0.1), lambda x: bp(x, 2500, 9000))
        st += leaves * rustle * (lfo(r, 0.5, 0, 1) ** 2) * gust
    return level * reverb(st, r, 1.5, 0.15)


def crickets(seed, count=5, level=1.0):
    r = rng(seed)
    buf = np.zeros((2, N))
    for _ in range(count):
        f = r.uniform(3900, 5200)
        pulse_n = int(0.012 * SR)
        pulse = np.sin(2 * np.pi * f * np.arange(pulse_n) / SR) * np.hanning(pulse_n)
        per_chirp = r.integers(3, 6)
        gap = r.uniform(0.028, 0.04)
        chirp = np.zeros(int((per_chirp * gap + 0.05) * SR))
        for k in range(per_chirp):
            s = int(k * gap * SR)
            chirp[s : s + pulse_n] += pulse
        period = r.uniform(0.45, 1.1)
        pan, g = r.uniform(-0.9, 0.9), r.uniform(0.2, 1.0)
        when = r.uniform(0, period)
        while when < LOOP + FADE:
            place(buf, when, chirp, pan, g * r.uniform(0.8, 1.0))
            when += period * r.uniform(0.95, 1.05)
    return level * reverb(buf, r, 1.0, 0.3, 9000)


def babble(seed, rate=140, level=1.0, low=False):
    r = rng(seed)
    bank = drop_bank(r, 96, 250 if low else 400, 900 if low else 1600, (0.01, 0.04))
    buf = np.zeros((2, N))
    scatter(buf, r, bank, rate, 0.05, 0.8)
    bed = apply(stereo_noise(r, 'pink', 0.3), lambda x: bp(x, 300, 3000)) * (0.6 + 0.4 * lfo(r, 8))
    st = buf + 0.18 * bed / np.max(np.abs(bed))
    return level * reverb(st, r, 1.0, 0.2)


def fire(seed, crackle_rate=14, roar=1.0, indoor=False):
    r = rng(seed)
    flick = lfo(r, 4, 0.5, 1.0)
    base = roar * 0.5 * apply(stereo_noise(r, 'brown', 0.6), lambda x: lp(x, 380)) * flick
    hiss = 0.04 * apply(stereo_noise(r, 'pink', 0.3), lambda x: hp(x, 3000)) * flick
    buf = np.zeros((2, N))
    count = int(crackle_rate * (LOOP + FADE))
    for when in np.sort(r.uniform(0, LOOP + FADE, count)):
        pan = r.uniform(-0.6, 0.6)
        for k in range(r.integers(1, 5)):  # a crackle is a little burst of clicks
            n = int(r.uniform(0.0006, 0.003) * SR)
            click = bp(r.standard_normal(n + 64), r.uniform(900, 2500), r.uniform(4000, 9000))[:n]
            click *= np.exp(-np.arange(n) / (n / 3))
            place(buf, when + k * r.uniform(0.004, 0.02), click, pan, 0.25 * r.lognormal(0, 0.5))
    for when in np.sort(r.uniform(0, LOOP + FADE, int(0.35 * (LOOP + FADE)))):  # pops
        n = int(0.06 * SR)
        f = r.uniform(300, 900)
        pop = np.sin(2 * np.pi * f * np.arange(n) / SR) * np.exp(-np.arange(n) / (0.012 * SR))
        pop[:80] += r.standard_normal(80) * np.exp(-np.arange(80) / 15)
        place(buf, when, pop, r.uniform(-0.5, 0.5), 0.5)
    st = base + hiss + buf
    if indoor:
        st = apply(st, lambda x: lp(x, 7000))
    return reverb(st, r, 0.9 if indoor else 1.4, 0.18)


def bowls(seed, notes=(196.0, 261.63, 329.63), every=(10, 14)):
    r = rng(seed)
    buf = np.zeros((2, N))
    ratios = [(1, 1.0, 14), (2.71, 0.55, 9), (5.15, 0.25, 6), (8.43, 0.1, 4)]
    when, k = 0.5, 0
    while when < LOOP + FADE:
        f0 = notes[k % len(notes)]
        n = int(22 * SR)
        tt = np.arange(n) / SR
        ev = np.zeros(n)
        for ratio, amp, tau in ratios:
            beat = r.uniform(0.3, 1.4)
            ev += amp * np.exp(-tt / tau) * (np.sin(2 * np.pi * f0 * ratio * tt) + 0.7 * np.sin(2 * np.pi * (f0 * ratio + beat) * tt))
        ev *= 1 - np.exp(-tt / 0.006)  # soft mallet
        place(buf, when, ev, r.uniform(-0.4, 0.4), 0.25)
        when += r.uniform(*every)
        k += 1
    return reverb(buf, r, 4.0, 0.35, 5000)


def chimes(seed):
    r = rng(seed)
    notes = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0]
    gust = lfo(r, 0.15, 0, 1) ** 2
    buf = np.zeros((2, N))
    when = 0.0
    while when < LOOP + FADE:
        g = gust[min(N - 1, int(when * SR))]
        n = int(5 * SR)
        tt = np.arange(n) / SR
        f = notes[r.integers(len(notes))]
        ev = sum(a * np.exp(-tt / d) * np.sin(2 * np.pi * f * m * tt) for m, a, d in [(1, 1, 2.6), (2.76, 0.4, 1.2), (5.4, 0.2, 0.6)])
        ev *= 1 - np.exp(-tt / 0.002)
        place(buf, when, ev, r.uniform(-0.8, 0.8), 0.07 * (0.4 + g))
        when += r.exponential(0.25 + 1.6 * (1 - g))
    st = reverb(buf, r, 3.0, 0.35, 8000) + 0.35 * wind(seed + 1, 0.6)
    return st


def pad(seed, chords, voice_gain=0.12, cutoff=1400, shimmer=0.0, sub=None):
    """Slow chords from detuned, soft-saw voices; chords divide the loop evenly."""
    r = rng(seed)
    seg = (LOOP) / len(chords)
    out = np.zeros((2, N))
    for ch in range(2):
        sig = np.zeros(N)
        for i in range(len(chords) + 2):
            chord = chords[i % len(chords)]
            s = int((i * seg - 3) * SR)
            n = int((seg + 6) * SR)
            if s >= N:
                break
            tt = np.arange(n) / SR
            env = np.minimum(1, np.minimum(tt / 3, (seg + 6 - tt) / 3)).clip(0, 1) ** 1.5
            v = np.zeros(n)
            for f in chord:
                det = f * (1 + (0.002 if ch == 0 else -0.002) * r.uniform(0.5, 1.5))
                for h, a in [(1, 1), (2, 0.35), (3, 0.15), (4, 0.06)]:
                    v += a * np.sin(2 * np.pi * det * h * tt + r.uniform(0, 6.28))
            v *= env * voice_gain
            a0 = max(0, s)
            b0 = min(N, s + n)
            sig[a0:b0] += v[a0 - s : b0 - s]
        sig = lp(sig, cutoff) * (0.85 + 0.15 * lfo(r, 0.1))
        out[ch] = sig
    if sub:
        out += 0.08 * np.stack([tone(sub, N, detune=0.25)] * 2) * (0.7 + 0.3 * lfo(r, 0.05))[None, :]
    if shimmer:
        sh = np.zeros((2, N))
        for when in np.sort(r.uniform(0, LOOP + FADE, int(0.25 * (LOOP + FADE)))):
            n = int(6 * SR)
            tt = np.arange(n) / SR
            f = r.choice([1318.5, 1567.98, 1760.0, 2093.0])
            ev = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / 6) ** 2
            place(sh, when, ev, r.uniform(-0.8, 0.8), shimmer)
        out += sh
    return reverb(out, r, 4.5, 0.4, 4500)


def traffic(seed):
    r = rng(seed)
    st = 0.35 * apply(stereo_noise(r, 'brown', 0.5), lambda x: lp(x, 250))
    buf = np.zeros((2, N))
    when = 0.0
    while when < LOOP + FADE:
        d = r.uniform(4, 8)
        n = int(d * SR)
        body = lp(colored(r, 'pink', n), r.uniform(600, 1100)) * np.sin(np.pi * np.arange(n) / n) ** 3
        sweep = np.linspace(-0.9, 0.9, n) * (1 if r.random() < 0.5 else -1)
        a = (sweep + 1) * np.pi / 4
        s = int(when * SR)
        e = min(N, s + n)
        g = r.uniform(0.2, 0.6)
        buf[0, s:e] += g * np.cos(a[: e - s]) * body[: e - s]
        buf[1, s:e] += g * np.sin(a[: e - s]) * body[: e - s]
        when += r.uniform(2.5, 7)
    hum = 0.02 * np.stack([tone(100, N, ((1, 1), (2, 0.5), (3, 0.2)))] * 2)
    return reverb(st + buf + hum, r, 2.5, 0.3, 3000)


def train(seed):
    r = rng(seed)
    sway = lfo(r, 0.3, 0.8, 1.0)
    rumble = 0.6 * apply(stereo_noise(r, 'brown', 0.7), lambda x: lp(x, 160)) * sway
    roll = 0.18 * apply(stereo_noise(r, 'pink', 0.5), lambda x: bp(x, 300, 1100)) * (0.8 + 0.2 * lfo(r, 6))
    buf = np.zeros((2, N))
    beat = 64 / 40  # 40 joints per loop: the rhythm divides it exactly
    for k in range(int((LOOP + FADE) / beat) + 1):
        for off in (0.0, 0.16):  # front and back axle of the bogie
            n = int(0.09 * SR)
            clack = bp(r.standard_normal(n + 64), 350, 1400)[:n] * np.exp(-np.arange(n) / (0.012 * SR))
            ring = 0.3 * np.sin(2 * np.pi * r.uniform(700, 900) * np.arange(n) / SR) * np.exp(-np.arange(n) / (0.03 * SR))
            place(buf, k * beat + off, clack + ring, 0.0, 0.45 * r.uniform(0.8, 1.0))
    return reverb(rumble + roll + buf, r, 0.8, 0.12, 5000)


def library(seed):
    r = rng(seed)
    room = 0.25 * apply(stereo_noise(r, 'pink', 0.6), lambda x: lp(x, 500))
    hvac = 0.05 * np.stack([lp(colored(r, 'brown'), 120)] * 2) + 0.004 * np.stack([tone(60, N, ((1, 1), (2, 0.6), (3, 0.3)))] * 2)
    buf = np.zeros((2, N))
    when = r.uniform(2, 6)
    while when < LOOP + FADE:
        n = int(r.uniform(0.35, 0.6) * SR)  # a page turning: a filtered noise sweep
        tt = np.linspace(0, 1, n)
        page = bp(r.standard_normal(n + 64), 1500, 7000)[:n] * np.sin(np.pi * tt) ** 2 * (0.5 + 0.5 * np.sin(np.pi * tt * 3) ** 2)
        place(buf, when, page, r.uniform(-0.6, 0.6), 0.12)
        when += r.uniform(7, 15)
    clock = np.zeros((2, N))
    tick = hp(r.standard_normal(300), 2500) * np.exp(-np.arange(300) / 40)
    for k in range(int(LOOP + FADE)):
        place(clock, k, tick, 0.6, 0.012)
    return reverb(room + hvac + buf + clock, r, 1.6, 0.3, 6000)


def deep_space(seed):
    r = rng(seed)
    drone = np.stack([tone(41.2, N, ((1, 1), (2, 0.3)), detune=0.17), tone(61.74, N, ((1, 1),), detune=0.21)]) * 0.12
    drone *= (0.7 + 0.3 * lfo(r, 0.05))[None, :]
    cosmic = np.zeros((2, N))
    for lo, hi in [(80, 200), (200, 500), (500, 1200)]:
        cosmic += apply(stereo_noise(r, 'brown', 0.3), lambda x: bp(x, lo, hi)) * lfo(r, 0.07)
    cosmic *= 0.25
    st = drone + cosmic
    st = st + pad(seed + 1, [[110.0, 164.81, 220.0]], 0.03, 900, shimmer=0.012)
    return reverb(st, r, 5.0, 0.4, 3000)


def mix(*parts):
    return sum(parts)


def finish(st):
    """Gentle high-pass for rumble, soft clip, then the loop crossfade."""
    st = apply(st, lambda x: hp(x, 25))
    st = np.tanh(st / (np.max(np.abs(st)) + 1e-9) * 1.1) * 0.9
    f = int(FADE * SR)
    n = int(LOOP * SR)
    w = np.linspace(0, np.pi / 2, f)
    head = st[:, :f] * np.sin(w) + st[:, n : n + f] * np.cos(w)
    return np.concatenate([head, st[:, f:n]], axis=1)


RECIPES = {
    'white': lambda: apply(stereo_noise(rng(1), 'white', 0.4), lambda x: lp(x, 12000)),
    'pink': lambda: apply(stereo_noise(rng(2), 'pink', 0.4), lambda x: lp(x, 14000)),
    'brown': lambda: apply(stereo_noise(rng(3), 'brown', 0.4), lambda x: lp(x, 2500)),
    'fan': lambda: mix(
        apply(stereo_noise(rng(4), 'brown', 0.7), lambda x: lp(x, 900)),
        0.35 * apply(stereo_noise(rng(5), 'pink', 0.7), lambda x: bp(x, 250, 2200)) * (1 + 0.06 * np.sin(2 * np.pi * 18 * t))[None, :],
        0.03 * np.stack([tone(100, N, ((1, 1), (2, 0.5), (3, 0.25)))] * 2),
    ),
    'gentle-rain': lambda: rain(10),
    'rain-on-window': lambda: rain(11, 160, 6000, 0.03, window=True),
    'rain-thunder': lambda: with_thunder(rain(12, 320), 13, 2, far=False, gain=0.8),
    'monsoon-rain': lambda: with_thunder(mix(rain(14, 1100, 10000, 0.03, heavy=True), 0.6 * babble(15, 80, low=True)), 16, 3, far=False, gain=0.9),
    'rainy-night': lambda: with_thunder(rain(17, 220, 5500), 18, 2, far=True, gain=0.5),
    'calm-ocean': lambda: waves(20, (9, 12), 1.0, 0.8),
    'gentle-waves': lambda: waves(21, (6, 8), 0.6, 1.0),
    'ocean-at-night': lambda: mix(waves(22, (10, 13), 0.9, 0.6), 0.25 * crickets(23, 4)),
    'forest-stream': lambda: mix(babble(24, 160), 0.3 * wind(25, 0.6, leaves=0.5)),
    'gentle-wind': lambda: wind(26, 1.0, whistle=0.05),
    'forest': lambda: mix(wind(27, 0.8, leaves=0.9), 0.2 * babble(28, 30, 0.3)),
    'night-forest': lambda: mix(crickets(29, 7), 0.35 * wind(30, 0.5, leaves=0.3)),
    'fireplace': lambda: fire(31, 12, 1.0, indoor=True),
    'campfire': lambda: mix(fire(32, 18, 0.8), 0.4 * wind(33, 0.6, leaves=0.4), 0.12 * crickets(34, 3)),
    'cozy-cabin': lambda: mix(fire(35, 9, 0.9, indoor=True), 0.5 * apply(rain(36, 200, 5000), lambda x: lp(x, 1600))),
    'library': lambda: library(40),
    'city-night': lambda: traffic(41),
    'train': lambda: train(42),
    'deep-sleep': lambda: mix(apply(stereo_noise(rng(43), 'brown', 0.5), lambda x: lp(x, 500)), 0.5 * pad(44, [[55.0, 82.41, 110.0]], 0.06, 400)),
    'singing-bowls': lambda: bowls(50),
    'wind-chimes': lambda: chimes(51),
    'soft-drone': lambda: pad(52, [[110.0, 164.81, 220.0, 277.18]], 0.08, 1200),
    'dreamy-ambient': lambda: pad(53, [[174.61, 220.0, 261.63, 329.63], [220.0, 261.63, 329.63, 392.0], [146.83, 220.0, 261.63, 349.23], [196.0, 246.94, 293.66, 392.0]], 0.07, 2200, shimmer=0.02, sub=55.0),
    'deep-space': lambda: deep_space(54),
}


def loudnorm(src, dst):
    measure = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-af', f'loudnorm=I={TARGET_LUFS}:TP=-2:LRA=20:print_format=json', '-f', 'null', '-'],
        capture_output=True, text=True,
    ).stderr
    m = json.loads(measure[measure.rindex('{') : measure.rindex('}') + 1])
    af = (
        f"loudnorm=I={TARGET_LUFS}:TP=-2:LRA=20:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
        f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    subprocess.run(
        ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', af, '-ar', str(SR), '-ac', '2', '-c:a', 'aac', '-b:a', BITRATE, '-movflags', '+faststart', dst],
        check=True,
    )


def main(names):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name in names or RECIPES:
            st = finish(RECIPES[name]())
            wav = os.path.join(tmp, f'{name}.wav')
            wavfile.write(wav, SR, (st.T * 32767).astype(np.int16))
            loudnorm(wav, os.path.join(OUT, f'{name}.m4a'))
            print(name)


if __name__ == '__main__':
    main(sys.argv[1:])
