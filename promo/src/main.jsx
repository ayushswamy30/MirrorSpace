import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';

import { createRoot } from 'react-dom/client';

import { App } from './App';
import { Reel } from './Reel';
import { ClockProvider, FILM } from './timeline';
import { ART_NAMES, artUrl } from './ui';

/**
 * Fonts and every drawing load before the clock starts, so no frame of the
 * render shows a fallback face or an empty plate. The renderer waits on
 * window.__ready.
 */
async function preload() {
  const faces = [
    '400 20px "Instrument Serif"',
    'italic 400 20px "Instrument Serif"',
    '400 20px Inter',
    '500 20px Inter',
    '600 20px Inter',
    '400 20px "DM Mono"',
    '500 20px "DM Mono"'
  ];
  await Promise.all(faces.map(f => document.fonts.load(f)));
  await Promise.all(
    ART_NAMES.map(
      name =>
        new Promise(resolve => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = artUrl(name);
        })
    )
  );
}

preload().then(() => {
  createRoot(document.getElementById('root')).render(
    <ClockProvider>
      {FILM === 'reel' ? <Reel /> : <App />}
    </ClockProvider>
  );
  window.__ready = true;
});
