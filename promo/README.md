# Lowkei — promo films

Two cuts of the app, made in code: React + Framer Motion rebuild the app's
screens (from `mobile/src` and `mobile/DESIGN.md` — same tokens, type,
drawings and copy) inside one phone, and a renderer steps the page's clock
one frame at a time to make a 60 fps MP4.

- **reel** — vertical 1080×1920, under a minute, for Reels / TikTok / Shorts.
  The phone fills the frame and moves on every cut; a few moments break out
  of the screen. Cuts land on the beat of a 96 bpm score.
- **promo** — the 16:9 walkthrough, 2½ minutes, with a caption per chapter.

| | |
|---|---|
| `src/scenes.js` | Running order and length of every scene, for both cuts |
| `src/reelPlan.js`, `src/Reel.jsx` | The vertical cut: captions, pacing of each screen, camera, break-outs |
| `src/chapters.js`, `src/App.jsx` | The 16:9 cut: chapter captions, which tab is lit, camera moves |
| `src/screens/` | The app screens, one file per chapter, with their taps and timings |
| `src/ui.jsx` | Lowkei's components (header, tab bar, rows, chips, Do/Don't…) |
| `scripts/render.mjs` | Frame-exact renderer (headless Chrome → ffmpeg) |
| `scripts/score.mjs` | The music, synthesised to the cuts, with the app's rain under it |

## Make it

Needs Node 18+, ffmpeg on the PATH and Chrome (or Edge) installed.

```sh
npm install
npm run build
node scripts/score.mjs reel             # out/score-reel.wav
node scripts/render.mjs --film reel     # out/lowkei-reel.mp4  (≈ 4 min on 4 workers)
node scripts/score.mjs                  # out/score-promo.wav
node scripts/render.mjs                 # out/lowkei-promo.mp4 (≈ 8 min)
```

Add `--resume` to a render to keep slices a crashed run already finished.

Watch it live while editing: `npm run dev` and open the address it prints
(`?film=reel`, and `?t=30000` starts 30 s in). Check single frames exactly
as they will render: `node scripts/render.mjs --film reel --stills 9,30.5`
then `node scripts/sheet.mjs reel`.

## Rules it keeps

- Monochrome, as the app: paper and ink, one signal colour, 600–900 ms eases,
  no bounce. The Mirror is the one dark room.
- Every claim in a caption is something the app does — check `mobile/src`
  before changing copy. The people, numbers and words on screen are made up.
- All motion reads the clock (`src/timeline.jsx`); no CSS transitions or
  timers, so every render is identical.
