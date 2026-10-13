# Lowkei — promo film

A 2½-minute walkthrough of the app, made in code: React + Framer Motion
rebuild the app's screens (from `mobile/src` and `mobile/DESIGN.md` — same
tokens, type, drawings and copy) inside one phone, and a renderer steps the
page's clock one frame at a time to make a 1080p, 60 fps MP4.

| | |
|---|---|
| `src/scenes.js` | Running order and length of every scene |
| `src/chapters.js` | What each chapter's caption says, which tab is lit, camera moves |
| `src/screens/` | The app screens, one file per chapter, with their taps and timings |
| `src/ui.jsx` | Lowkei's components (header, tab bar, rows, chips, Do/Don't…) |
| `scripts/render.mjs` | Frame-exact renderer (headless Chrome → ffmpeg) |
| `scripts/score.mjs` | The music, synthesised to the cuts, with the app's rain under it |

## Make it

Needs Node 18+, ffmpeg on the PATH and Chrome (or Edge) installed.

```sh
npm install
npm run build
npm run score      # out/score.wav
npm run render     # out/lowkei-promo.mp4 (≈ 10 min on 4 workers)
```

Watch it live while editing: `npm run dev` and open the address it prints
(`?t=64000` starts 64 s in). Check single frames exactly as they will render:
`node scripts/render.mjs --stills 30,71.5` then `node scripts/sheet.mjs`.

## Rules it keeps

- Monochrome, as the app: paper and ink, one signal colour, 600–900 ms eases,
  no bounce. The Mirror is the one dark room.
- Every claim in a caption is something the app does — check `mobile/src`
  before changing copy. The people, numbers and words on screen are made up.
- All motion reads the clock (`src/timeline.jsx`); no CSS transitions or
  timers, so every render is identical.
