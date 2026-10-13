/**
 * Tiles out/still-*.png into 2×2 contact sheets (out/sheet-N.png) for review.
 *   node scripts/sheet.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'out');
const stills = readdirSync(out)
  .filter(f => /^still-[\d.]+\.png$/.test(f))
  .sort((a, b) => parseFloat(a.slice(6)) - parseFloat(b.slice(6)));

for (let i = 0, n = 0; i < stills.length; i += 4, n++) {
  const group = stills.slice(i, i + 4);
  const inputs = [];
  for (let j = 0; j < 4; j++) {
    if (group[j]) inputs.push('-i', join(out, group[j]));
    else inputs.push('-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:d=1');
  }
  const filter = '[0]scale=960:540[a];[1]scale=960:540[b];[2]scale=960:540[c];[3]scale=960:540[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0';
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-frames:v', '1', join(out, `sheet-${n}.png`)], { stdio: 'inherit' });
  console.log(`sheet-${n}:`, group.map(f => f.slice(6, -4)).join(' '));
}
