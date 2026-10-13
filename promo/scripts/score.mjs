/**
 * The film's music, synthesised here so it is ours and lines up with the cuts:
 * a soft pad that changes chord on every scene (and halfway through it), a
 * felt-piano figure on a 72 bpm grid, a small bell on each chapter, and the
 * app's own "Gentle Rain" (mobile/assets/sounds) underneath — louder in the
 * Mirror's dark room and when Calm starts the rain.
 *
 *   node scripts/score.mjs        → out/score-promo.wav (48 kHz stereo, 72 bpm)
 *   node scripts/score.mjs reel   → out/score-reel.wav  (96 bpm, with a soft pulse
 *                                   and a breath of air into every cut)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { film } from '../src/scenes.js';

const FILM = process.argv[2] === 'reel' ? 'reel' : 'promo';
const SCENES = film(FILM);
const TOTAL = SCENES[SCENES.length - 1].end;
const REEL = FILM === 'reel';
const BPM = REEL ? 96 : 72;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'out');
mkdirSync(out, { recursive: true });

const SR = 48000;
const LEN = Math.ceil((TOTAL / 1000) * SR);
const L = new Float32Array(LEN);
const R = new Float32Array(LEN);

const midi = n => 440 * 2 ** ((n - 69) / 12);
const sceneAt = id => SCENES.find(s => s.id === id);

// Seeded randomness, so the score is the same on every run.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ── harmony: two chords per scene, D major, darker for the Mirror ── */
const CHORDS = {
  Dmaj9: [38, 50, 54, 57, 61, 64],
  Bm9: [35, 47, 50, 54, 57, 61],
  Gmaj7: [31, 43, 50, 54, 59, 62],
  Em9: [28, 40, 47, 50, 54, 55],
  A6sus: [33, 45, 50, 52, 54, 59],
  Fsharp_m7: [30, 42, 49, 52, 57, 61],
  Bm_dark: [35, 47, 50, 53, 54, 57],
  Gmaj9: [31, 43, 47, 54, 57, 62]
};
const PLAN = REEL
  ? {
      hook: ['Bm9', 'Gmaj7'],
      checkin: ['Dmaj9', 'A6sus'],
      today: ['Gmaj7', 'Dmaj9'],
      vent: ['Bm9', 'Em9'],
      letters: ['Gmaj9', 'A6sus'],
      mirror: ['Bm_dark', 'Fsharp_m7'],
      chart: ['Dmaj9', 'Gmaj7'],
      circle: ['Em9', 'A6sus'],
      calm: ['Gmaj9', 'Dmaj9'],
      crisis: ['Bm9', 'Bm9'],
      lowday: ['Gmaj7', 'Gmaj7'],
      dark: ['Em9', 'Em9'],
      data: ['A6sus', 'A6sus'],
      outro: ['Dmaj9', 'Dmaj9']
    }
  : {
  intro: ['Dmaj9', 'Dmaj9'],
  hook: ['Bm9', 'Gmaj7'],
  begin: ['Dmaj9', 'A6sus'],
  today: ['Gmaj7', 'Dmaj9'],
  checkin: ['Bm9', 'Em9'],
  vent: ['Gmaj9', 'A6sus'],
  mirror: ['Bm_dark', 'Fsharp_m7'],
  chart: ['Dmaj9', 'Gmaj7'],
  circle: ['Em9', 'A6sus'],
  calm: ['Gmaj9', 'Dmaj9'],
  care: ['Bm9', 'Gmaj7'],
  yours: ['Em9', 'A6sus'],
  outro: ['Dmaj9', 'Dmaj9']
};
const timeline = [];
for (const s of SCENES) {
  const [a, b] = PLAN[s.id];
  timeline.push({ at: s.start / 1000, chord: CHORDS[a] }, { at: (s.start + s.dur / 2) / 1000, chord: CHORDS[b] });
}
const chordAt = t => {
  let c = timeline[0];
  for (const e of timeline) if (e.at <= t) c = e;
  return c;
};

/* ── pad: soft, odd-harmonic voices with slow swells, crossfaded per chord ── */
function pad() {
  for (let i = 0; i < timeline.length; i++) {
    const { at, chord } = timeline[i];
    const end = i + 1 < timeline.length ? timeline[i + 1].at : TOTAL / 1000;
    const start = Math.max(0, at - 0.6);
    const stop = Math.min(TOTAL / 1000, end + 2.4);
    const s0 = Math.floor(start * SR);
    const s1 = Math.floor(stop * SR);
    chord.forEach((note, v) => {
      const f = midi(note);
      const gain = (v === 0 ? 0.05 : 0.032) / Math.sqrt(chord.length);
      const detune = [0.9985, 1.0015];
      const phase = [rand() * 6.28, rand() * 6.28];
      for (let s = s0; s < s1; s++) {
        const t = s / SR;
        const env = Math.min(1, (t - start) / 2.2) * Math.min(1, Math.max(0, (stop - t) / 2.4));
        const wob = 1 + 0.12 * Math.sin(2 * Math.PI * 0.11 * t + v);
        for (let ch = 0; ch < 2; ch++) {
          const w = 2 * Math.PI * f * detune[ch] * t + phase[ch];
          const tone = Math.sin(w) + 0.11 * Math.sin(3 * w) + 0.04 * Math.sin(5 * w);
          const y = tone * gain * env * wob;
          if (ch === 0) L[s] += y;
          else R[s] += y;
        }
      }
    });
  }
}

/* ── piano: a sparse figure on chord tones, 72 bpm eighths ── */
function pluck(t0, note, vel, pan) {
  const f = midi(note);
  const s0 = Math.floor(t0 * SR);
  const n = Math.floor(3.2 * SR);
  for (let i = 0; i < n && s0 + i < LEN; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.006) * Math.exp(-t * 1.6);
    const w = 2 * Math.PI * f * t;
    const y = (Math.sin(w) + 0.32 * Math.sin(2 * w) * Math.exp(-t * 3) + 0.1 * Math.sin(3 * w) * Math.exp(-t * 5)) * env * vel;
    L[s0 + i] += y * (1 - pan) * 0.9;
    R[s0 + i] += y * pan * 0.9;
  }
}

function piano() {
  const beat = 60 / BPM;
  const eighth = beat / 2;
  // On the reel the grid starts at 0 so every cut (a multiple of 1.25 s) is on a beat.
  const from = REEL ? 0 : sceneAt('hook').start / 1000 + 0.2;
  const to = sceneAt('outro').start / 1000 + 4;
  const pattern = [0, 2, 1, 3, 2, 4, 3, 1];
  for (let k = 0; from + k * eighth < to; k++) {
    const t = from + k * eighth;
    // Quieter in the Mirror and in Care; rests make it breathe.
    const inScene = SCENES.find(s => t * 1000 >= s.start && t * 1000 < s.end)?.id;
    const quiet = inScene === 'mirror' || inScene === 'care' || inScene === 'crisis';
    if (rand() < (quiet ? 0.55 : REEL ? 0.24 : 0.32)) continue;
    const chord = chordAt(t).chord;
    const upper = chord.slice(1).map(n => n + 12);
    const note = upper[pattern[k % pattern.length] % upper.length];
    const vel = 0.05 + rand() * 0.025;
    pluck(t + (rand() - 0.5) * 0.012, note, vel, 0.3 + rand() * 0.4);
  }
}

/* ── a small bell on each chapter's first frame ── */
function bells() {
  for (const s of SCENES) {
    if (s.id === 'intro' || s.id === 'hook') continue;
    const t0 = s.start / 1000 + 0.05;
    const root = chordAt(t0 + 0.1).chord[1] + 24;
    const f = midi(root);
    const s0 = Math.floor(t0 * SR);
    const g = s.dur <= 1250 ? 0.028 : 0.045;
    for (let i = 0; i < 4 * SR && s0 + i < LEN; i++) {
      const t = i / SR;
      const y = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 1.4) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 4)) * Math.min(1, t / 0.002) * g;
      L[s0 + i] += y * 0.8;
      R[s0 + i] += y;
    }
  }
}

/* ── a low swell under the opening and the last card ── */
function swell(at, dur, note, gain) {
  const s0 = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  const f = midi(note);
  for (let i = 0; i < n && s0 + i < LEN; i++) {
    const t = i / SR;
    const env = Math.sin(Math.PI * Math.min(1, t / dur)) ** 2;
    const y = Math.sin(2 * Math.PI * f * t) * env * gain;
    L[s0 + i] += y;
    R[s0 + i] += y;
  }
}

/* ── reverb: a small Schroeder room per channel ── */
function reverb(buf, offset) {
  const combs = [1557, 1617, 1491, 1422].map(d => ({ d: d + offset, b: new Float32Array(d + offset), i: 0, f: 0 }));
  const alls = [225, 556].map(d => ({ d, b: new Float32Array(d), i: 0 }));
  const wet = new Float32Array(buf.length);
  for (let s = 0; s < buf.length; s++) {
    let y = 0;
    for (const c of combs) {
      const o = c.b[c.i];
      c.f = o * 0.6 + c.f * 0.4;
      c.b[c.i] = buf[s] + c.f * 0.86;
      c.i = (c.i + 1) % c.d;
      y += o;
    }
    for (const a of alls) {
      const o = a.b[a.i];
      a.b[a.i] = y + o * 0.5;
      a.i = (a.i + 1) % a.d;
      y = o - y * 0.5;
    }
    wet[s] = y * 0.25;
  }
  for (let s = 0; s < buf.length; s++) buf[s] = buf[s] * 0.78 + wet[s] * 0.5;
}

/* ── the app's rain, looped, riding a level curve ── */
function rain() {
  const src = join(root, '..', 'mobile', 'assets', 'sounds', 'gentle-rain.m4a');
  if (!existsSync(src)) return console.warn('no rain file; skipping');
  const pcm = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', src, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 }).stdout;
  const data = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
  const frames = data.length / 2;
  const mirror = sceneAt('mirror');
  const calm = sceneAt('calm');
  const rainOn = calm.start / 1000 + 9.6; // when the promo's Calm taps Gentle Rain
  const level = t => {
    let g = 0.07;
    const ms = t * 1000;
    const near = (a, b, fade) => Math.min(1, Math.max(0, Math.min((ms - a) / fade, (b - ms) / fade)));
    g += 0.11 * near(mirror.start, mirror.end, 900);
    if (!REEL) g += 0.2 * near(rainOn * 1000, calm.end, 500);
    return g;
  };
  // A slow crossfade at the loop point keeps the seam inaudible.
  const xf = Math.floor(1.5 * SR);
  for (let s = 0; s < LEN; s++) {
    const p = s % (frames - xf);
    let l = data[p * 2];
    let r = data[p * 2 + 1];
    if (p < xf && s >= frames - xf) {
      const a = p / xf;
      const q = p + frames - xf;
      l = l * a + data[q * 2] * (1 - a);
      r = r * a + data[q * 2 + 1] * (1 - a);
    }
    const g = level(s / SR);
    L[s] += l * g;
    R[s] += r * g;
  }
}

/* ── reel only: a soft kick on beats 1 and 3, a shaker on the eighths ── */
function pulse() {
  const beat = 60 / BPM;
  const from = sceneAt('checkin').start / 1000;
  const to = sceneAt('outro').start / 1000 + 1.25;
  const mirror = sceneAt('mirror');
  const inMirror = t => t * 1000 >= mirror.start && t * 1000 < mirror.end - 1250;
  for (let k = 0; from + k * beat / 2 < to; k++) {
    const t0 = from + (k * beat) / 2;
    if (inMirror(t0)) continue; // the dark room is quiet
    const s0 = Math.floor(t0 * SR);
    if (k % 4 === 0) {
      // kick: a pitch-dropping sine, felt more than heard
      for (let i = 0; i < 0.5 * SR && s0 + i < LEN; i++) {
        const t = i / SR;
        const f = 48 + 70 * Math.exp(-t * 30);
        const y = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 7) * 0.16;
        L[s0 + i] += y;
        R[s0 + i] += y;
      }
    }
    // shaker: a short burst of brightened noise, softer off the beat
    const g = k % 2 === 0 ? 0.012 : 0.007;
    let prev = 0;
    for (let i = 0; i < 0.07 * SR && s0 + i < LEN; i++) {
      const t = i / SR;
      const n = rand() * 2 - 1;
      const hp = n - prev;
      prev = n;
      const y = hp * Math.exp(-t * 60) * g;
      L[s0 + i] += y * 0.8;
      R[s0 + i] += y;
    }
  }
}

/* ── reel only: a breath of air swelling into each cut ── */
function air() {
  for (const sc of SCENES) {
    if (sc.start === 0) continue;
    const len = sc.dur <= 1250 ? 0.3 : 0.55;
    const end = sc.start / 1000;
    const s0 = Math.floor((end - len) * SR);
    let lp = 0;
    for (let i = 0; i < len * SR; i++) {
      const p = i / (len * SR);
      lp += (rand() * 2 - 1 - lp) * (0.02 + p * 0.25);
      const y = lp * p * p * 0.11;
      if (s0 + i >= 0 && s0 + i < LEN) {
        L[s0 + i] += y;
        R[s0 + i] += y * 0.9;
      }
    }
  }
}

pad();
piano();
bells();
if (REEL) {
  pulse();
  air();
  swell(0, 3.8, 38, 0.05);
  swell(sceneAt('outro').start / 1000 + 3.6, 2.6, 38, 0.05);
} else {
  swell(0.3, 6, 38, 0.06);
  swell(sceneAt('outro').start / 1000 + 4.5, 5, 38, 0.05);
}
reverb(L, 0);
reverb(R, 23);
rain();

// Fade in and out, then normalise to -1 dBFS.
for (let s = 0; s < LEN; s++) {
  const t = s / SR;
  const g = Math.min(1, t / 1.2) * Math.min(1, (TOTAL / 1000 - t) / 2.5);
  L[s] *= g;
  R[s] *= g;
}
let peak = 0;
for (let s = 0; s < LEN; s++) peak = Math.max(peak, Math.abs(L[s]), Math.abs(R[s]));
const norm = 0.89 / peak;

const buf = Buffer.alloc(44 + LEN * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + LEN * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(LEN * 4, 40);
for (let s = 0; s < LEN; s++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[s] * norm)) * 32767), 44 + s * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[s] * norm)) * 32767), 46 + s * 4);
}
writeFileSync(join(out, `score-${FILM}.wav`), buf);
console.log(`wrote out/score-${FILM}.wav · ${(TOTAL / 1000).toFixed(1)} s · peak scaled ×${norm.toFixed(2)}`);
