/**
 * Tiles stills into contact sheets for review.
 *   node scripts/sheet.mjs        → out/sheet-N.png from out/still-*.png   (16:9, 2×2)
 *   node scripts/sheet.mjs reel   → out/rsheet-N.png from out/still-r*.png (9:16, 4 across)
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'out');
const reel = process.argv[2] === 'reel';
const prefix = reel ? 'still-r' : 'still-';
const stills = readdirSync(out)
  .filter(f => f.startsWith(prefix) && /^[\d.]+\.png$/.test(f.slice(prefix.length)))
  .sort((a, b) => parseFloat(a.slice(prefix.length)) - parseFloat(b.slice(prefix.length)));

const [w, h, size] = reel ? [540, 960, '1080x1920'] : [960, 540, '1920x1080'];
const layout = reel ? '0_0|w0_0|w0+w1_0|w0+w1+w2_0' : '0_0|w0_0|0_h0|w0_h0';

for (let i = 0, n = 0; i < stills.length; i += 4, n++) {
  const group = stills.slice(i, i + 4);
  const inputs = [];
  for (let j = 0; j < 4; j++) {
    if (group[j]) inputs.push('-i', join(out, group[j]));
    else inputs.push('-f', 'lavfi', '-i', `color=c=black:s=${size}:d=1`);
  }
  const filter = `[0]scale=${w}:${h}[a];[1]scale=${w}:${h}[b];[2]scale=${w}:${h}[c];[3]scale=${w}:${h}[d];[a][b][c][d]xstack=inputs=4:layout=${layout}`;
  const name = `${reel ? 'rsheet' : 'sheet'}-${n}.png`;
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-frames:v', '1', join(out, name)], { stdio: 'inherit' });
  console.log(`${name}:`, group.map(f => f.slice(prefix.length, -4)).join(' '));
}
