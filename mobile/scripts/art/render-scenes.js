/**
 * Renders every scene in scenes.html at the sizes Lowkei uses:
 *   wide 1600×1000 — site sections, app cards (cropped to fit)
 *   tall 1080×2160 — full-screen phone backgrounds
 * into assets/scenes/<name>-<size>.webp (and the site's copy).
 *
 *   node scripts/art/render-scenes.js [name ...]     (playwright-core + Chrome + ffmpeg)
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const SCENES = { hills: 7, clouds: 12, nebula: 21, bloom: 33, sunrise: 4, burst: 9, orbs: 16, haze: 28 };
const SIZES = { wide: [1600, 1000], tall: [1080, 2160] };
const page = pathToFileURL(path.join(__dirname, 'scenes.html')).href;
const out = path.join(__dirname, '..', '..', 'assets', 'scenes');
const site = path.join(__dirname, '..', '..', '..', 'site', 'scenes');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(site, { recursive: true });
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const name of names) {
    for (const [size, [w, h]] of Object.entries(SIZES)) {
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      await p.goto(`${page}?scene=${name}&w=${w}&h=${h}&seed=${SCENES[name]}`);
      await p.waitForFunction(() => document.title === 'done', null, { timeout: 120000 });
      const png = path.join(out, `${name}-${size}.png`);
      await p.locator('canvas').screenshot({ path: png });
      await p.close();
      const webp = path.join(out, `${name}-${size}.webp`);
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '82', webp]);
      fs.rmSync(png);
      fs.copyFileSync(webp, path.join(site, path.basename(webp)));
      console.log(name, size, Math.round(fs.statSync(webp).size / 1024) + 'KB');
    }
  }
  await browser.close();
})();
