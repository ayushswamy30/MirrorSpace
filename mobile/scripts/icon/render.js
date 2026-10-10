/**
 * Renders Lowkei's icon (icon.html) into every file the app and site use.
 *
 *   node scripts/icon/render.js          (needs playwright-core and Chrome)
 */
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const html = pathToFileURL(path.join(__dirname, 'icon.html')).href;
const images = path.join(__dirname, '..', '..', 'assets', 'images');
const site = path.join(__dirname, '..', '..', '..', 'site', 'public');

const OUT = [
  ['full', 1024, path.join(images, 'icon.png')],
  ['background', 512, path.join(images, 'android-icon-background.png')],
  ['foreground', 512, path.join(images, 'android-icon-foreground.png')],
  ['mono', 432, path.join(images, 'android-icon-monochrome.png')],
  ['foreground', 400, path.join(images, 'splash-icon.png')],
  ['mono', 96, path.join(images, 'notification-icon.png')],
  ['full', 512, path.join(site, 'icon-512.png')],
  ['full', 192, path.join(site, 'icon-192.png')],
  ['full', 180, path.join(site, 'apple-touch-icon.png')],
  ['full', 64, path.join(site, 'favicon-32.png')]
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const [layer, size, file] of OUT) {
    const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: size / 1024 });
    await page.goto(`${html}?layer=${layer}`, { waitUntil: 'load' });
    await page.screenshot({ path: file, omitBackground: layer !== 'full' && layer !== 'background' });
    await page.close();
    console.log(layer, size, path.basename(file));
  }
  await browser.close();
})();
