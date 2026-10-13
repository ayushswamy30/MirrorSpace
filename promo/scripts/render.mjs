/**
 * Renders the film frame by frame.
 *
 *   node scripts/render.mjs                      → out/lowkei-promo.mp4 (16:9, 60 fps, with out/score-promo.wav)
 *   node scripts/render.mjs --film reel          → out/lowkei-reel.mp4  (9:16, with out/score-reel.wav)
 *   node scripts/render.mjs --stills 3,21.5,40   → out/still-3.png … (exact frames, for checking)
 *   options: --fps 60  --workers 4  --chrome <path>
 *
 * The page's clock is virtual: requestAnimationFrame, timers and
 * performance.now() are replaced, and Element.animate is removed so Framer
 * Motion runs every animation on that clock instead of the compositor. Each
 * frame advances the clock by exactly 1/fps, lets React commit, then takes a
 * screenshot — so the video is identical on every render, however slow the
 * machine. Workers render slices in parallel; each one replays the film from
 * the start (without screenshots) to reach its slice, so state is identical.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'out');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const FILM = opt('film', 'promo');
const [VW, VH] = FILM === 'reel' ? [1080, 1920] : [1920, 1080];
const FPS = Number(opt('fps', 60));
const WORKERS = Number(opt('workers', 4));
const stills = opt('stills', null)?.split(',').map(Number);
// --resume keeps slices a previous run finished (out/parts/part-N.mp4).
const RESUME = args.includes('--resume');
const CHROME =
  opt('chrome', null) ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find(p =>
    existsSync(p)
  );

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Build first: npm run build');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

/* ── a tiny static server for dist/ ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer((req, res) => {
  const path = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = existsSync(path) && statSync(path).isFile() ? path : join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/?film=${FILM}`;

/* ── the virtual clock, installed before any page script runs ── */
const SHIM = `(() => {
  const realSetTimeout = window.setTimeout.bind(window);
  let now = 1000;
  const epoch = Date.parse('2026-10-13T21:14:00Z');
  performance.now = () => now;
  Date.now = () => epoch + now;
  const rafs = new Map();
  let rafId = 0;
  window.requestAnimationFrame = cb => { rafs.set(++rafId, cb); return rafId; };
  window.cancelAnimationFrame = id => { rafs.delete(id); };
  const timers = new Map();
  let timerId = 0;
  window.setTimeout = (fn, ms, ...a) => { timers.set(++timerId, { fn, a, at: now + Math.max(0, Number(ms) || 0) }); return timerId; };
  window.setInterval = (fn, ms, ...a) => { const every = Math.max(1, Number(ms) || 1); timers.set(++timerId, { fn, a, at: now + every, every }); return timerId; };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  delete Element.prototype.animate;
  const tick = () => new Promise(r => realSetTimeout(r, 0));
  window.__frame = async ms => {
    now += ms;
    for (let guard = 0; guard < 500; guard++) {
      let next = null;
      for (const entry of timers) if (entry[1].at <= now && (!next || entry[1].at < next[1].at)) next = entry;
      if (!next) break;
      const [id, t] = next;
      if (t.every) t.at += t.every; else timers.delete(id);
      try { t.fn(...t.a); } catch (e) { console.error(e); }
    }
    const batch = [...rafs.values()];
    rafs.clear();
    for (const cb of batch) { try { cb(now); } catch (e) { console.error(e); } }
    await tick();
    await tick();
  };
})();`;

// One browser per page: a background tab in a shared browser can stall
// while loading, so every worker gets a browser whose only tab is in front.
// Each browser keeps its profile in out/profiles: Puppeteer then leaves it
// alone on close (deleting its own temp profile fails on Windows while
// Chrome still holds a file), and closing never takes the run down.
let profiles = 0;
async function openPage() {
  const userDataDir = join(out, 'profiles', `p${process.pid}-${profiles++}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    userDataDir,
    headless: true,
    args: ['--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb', '--font-render-hinting=none']
  });
  const [page] = await browser.pages();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(SHIM);
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  // main.jsx sets this once fonts and every drawing have loaded. Polled from
  // here: the page's own rAF and timers are frozen by the clock above.
  for (let tries = 0; !(await page.evaluate(() => window.__ready === true)); tries++) {
    if (tries > 600) throw new Error('The page never became ready.');
    await new Promise(r => setTimeout(r, 200));
  }
  // Let the first render commit before the clock moves.
  await page.evaluate(() => window.__frame(0));
  const cdp = await page.createCDPSession();
  const close = () => browser.close().catch(e => console.warn('browser close:', e.message));
  return { browser: { close }, page, cdp };
}

function framesIn(file) {
  if (!existsSync(file)) return 0;
  const r = spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file]);
  return r.status === 0 ? parseInt(String(r.stdout), 10) || 0 : 0;
}

const TOTAL = await (async () => {
  const { browser, page } = await openPage();
  const total = await page.evaluate(() => {
    const s = document.querySelector('[data-total]');
    return s ? Number(s.dataset.total) : null;
  });
  await browser.close();
  return total;
})();
if (!TOTAL) throw new Error('The page did not report its length (data-total).');
const FRAMES = Math.round((TOTAL / 1000) * FPS);
const step = 1000 / FPS;

async function shoot(cdp, format) {
  const { data } = await cdp.send('Page.captureScreenshot', format === 'png' ? { format: 'png' } : { format: 'jpeg', quality: 94, optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

if (stills) {
  const { browser, page, cdp } = await openPage();
  const want = [...stills].sort((a, b) => a - b).map(s => Math.round(s * FPS));
  for (let f = 0; f <= want[want.length - 1]; f++) {
    if (want.includes(f)) {
      const file = join(out, `still-${FILM === 'reel' ? 'r' : ''}${(f / FPS).toFixed(2).replace(/\.?0+$/, '')}.png`);
      writeFileSync(file, await shoot(cdp, 'png'));
      console.log('wrote', file);
    }
    await page.evaluate(ms => window.__frame(ms), step);
  }
  await browser.close();
  server.close();
  process.exit(0);
}

/* ── the film: slices in parallel, each piped to its own ffmpeg ── */
const tmp = join(out, `parts-${FILM}`);
if (!RESUME) rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const per = Math.ceil(FRAMES / WORKERS);
const started = Date.now();
let done = 0;

async function worker(w) {
  const from = w * per;
  const to = Math.min(FRAMES, from + per);
  if (from >= to) return null;
  const part = join(tmp, `part-${w}.mp4`);
  if (RESUME && framesIn(part) === to - from) {
    console.log(`part ${w} already rendered`);
    done += to - from;
    return part;
  }
  const { browser, page, cdp } = await openPage();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), part], {
    stdio: ['pipe', 'inherit', 'inherit']
  });
  const finished = new Promise((res, rej) => ff.on('close', code => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)))));
  finished.catch(() => undefined);
  let shot = 0;
  try {
  for (let f = 0; f < to; f++) {
    if (f >= from) {
      const jpg = await shoot(cdp, 'jpeg');
      if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
      done++;
      shot++;
      if (done % 120 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`${done}/${FRAMES} frames · ${rate.toFixed(1)} fps · ~${Math.round((FRAMES - done) / rate)} s left`);
      }
    }
    await page.evaluate(ms => window.__frame(ms), step);
  }
  } catch (e) {
    // Let go of this slice's encoder and browser before it is tried again.
    done -= shot;
    ff.stdin.destroy();
    ff.kill();
    await finished.catch(() => undefined);
    await browser.close();
    throw e;
  }
  ff.stdin.end();
  await finished;
  await browser.close();
  return part;
}

// A browser can die mid-slice (memory, a crashed tab); the slice is then
// rendered again from its start, up to three tries.
async function withRetry(w) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await worker(w);
    } catch (e) {
      if (attempt >= 3) throw e;
      console.warn(`slice ${w} failed (${e.message.split('\n')[0]}); retrying`);
    }
  }
}

const parts = (await Promise.all(Array.from({ length: WORKERS }, (_, w) => withRetry(w)))).filter(Boolean);
server.close();

const list = join(tmp, 'list.txt');
writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
const silent = join(out, `lowkei-${FILM}-silent.mp4`);
await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', silent]);

const score = join(out, `score-${FILM}.wav`);
const final = join(out, `lowkei-${FILM}.mp4`);
if (existsSync(score)) {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', score, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final]);
  console.log('wrote', final);
} else {
  console.log('wrote', silent, `(no score — run: node scripts/score.mjs ${FILM})`);
}
console.log(`${FRAMES} frames in ${Math.round((Date.now() - started) / 1000)} s`);

function run(cmd, a) {
  return new Promise((res, rej) => spawn(cmd, a, { stdio: 'inherit' }).on('close', c => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`)))));
}
