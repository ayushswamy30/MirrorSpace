import { readFileSync } from 'node:fs';

import express from 'express';

/**
 * The privacy policy and terms, as plain pages at /privacy and /terms — the
 * public URLs the Play Store listing and the app's You tab point to.
 *
 * Unlike everything under /api these are documents, so they get their own
 * content policy: inline styles, nothing else. Read once at startup.
 */

export const PAGES = ['privacy', 'terms'];

const CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function readPage(name) {
  return readFileSync(new URL(`../legal/${name}.html`, import.meta.url), 'utf8');
}

const router = express.Router();

for (const name of PAGES) {
  const html = readPage(name);
  router.get(`/${name}`, (req, res) => {
    res.set('Content-Security-Policy', CSP).set('Cache-Control', 'public, max-age=3600').type('html').send(html);
  });
}

export default router;
