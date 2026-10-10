// Builds the Lowkei site into dist/: every page is complete HTML at build
// time (nothing renders in the browser), plus sitemap.xml and robots.txt.
// No dependencies — `node build.mjs`.
//
// The privacy policy and terms are not copied by hand: they are read from
// server/legal/, the same files the API serves, so the two can't drift.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');
const SITE = (process.env.SITE_URL || 'https://lowkei.vercel.app').replace(/\/$/, '');
const TODAY = new Date().toISOString().slice(0, 10);

const read = p => readFileSync(join(ROOT, p), 'utf8');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------
// Pieces

const VIDEO_CAPTIONS = {
  today: 'Today: the day’s reading, with what to lean into and what to leave',
  checkin: 'Checking in: choosing “heavy”, then “tired”, then what it was around',
  vent: 'Vent: writing a page that nobody else reads',
  mirror: 'The Mirror: choosing a topic and asking a question',
  chart: 'Your chart: thirty days of Inner Weather in a ring',
  mind: 'Mind Chart: placements drawn from ninety days',
  circle: 'Circle: a friend running low, and a nudge from another',
  calm: 'Calm: a guided double sigh, counting each breath',
  wrapped: 'Wrapped: the month, told back'
};

function phone(name, { eager = false, cls = '' } = {}) {
  const caption = VIDEO_CAPTIONS[name];
  return `<div class="phone ${cls}">
  <div class="screen">
    <video data-auto muted loop playsinline preload="none" width="600" height="1298" poster="/media/${name}.webp" aria-label="${esc(caption)}"${eager ? ' fetchpriority="high"' : ''}>
      <source data-src="/media/${name}.webm" type="video/webm">
      <source data-src="/media/${name}.mp4" type="video/mp4">
    </video>
    <button class="btn small ghost play" type="button">Play</button>
  </div>
</div>`;
}

const ART = {
  lily: [480, 455, 'A lily, drawn in ink'],
  eye: [478, 480, 'An eye, drawn in ink'],
  swan: [468, 318, 'A swan, drawn in ink'],
  butterfly: [480, 465, 'A butterfly, drawn in ink'],
  heart: [304, 445, 'An anatomical heart, drawn in ink'],
  cat: [395, 435, 'A cat, drawn in ink'],
  urchin: [480, 444, 'A sea urchin, drawn in ink'],
  orchid: [480, 421, 'An orchid, drawn in ink'],
  stamp: [348, 335, 'A postage stamp, drawn in ink'],
  moka: [379, 480, 'A moka pot, drawn in ink'],
  kittens: [418, 480, 'Two kittens, drawn in ink'],
  king: [192, 480, 'A chess king, drawn in ink']
};

function art(name, cls = 'art', { eager = false } = {}) {
  const [w, h, alt] = ART[name];
  const dark = existsSync(join(ROOT, 'art', `${name}-dark.webp`));
  const img = `<img class="${cls}" src="/art/${name}.webp" width="${w}" height="${h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  return dark ? `<picture><source srcset="/art/${name}-dark.webp" media="(prefers-color-scheme: dark)">${img}</picture>` : img;
}

const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const DOWNLOAD = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v9M4 7l4 4 4-4M2 14h12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

function download(cls = '') {
  return `<a class="btn ${cls}" href="/download">${DOWNLOAD}Download for Android</a>`;
}

// ---------------------------------------------------------------------------
// FAQ — shown on the home page and given to search engines as FAQPage data.

const FAQ = [
  ['Is Lowkei therapy?', 'No. Lowkei is a journal and mood tracker. It can help you notice patterns, but it doesn’t diagnose or treat anything, and it isn’t a substitute for a professional. If you’re in danger, call your local emergency number — in India, 112, or Tele-MANAS on 14416. Lowkei lists more crisis lines under calm → help.'],
  ['Who can read what I write?', 'Only you. Check-ins, vent pages, letters and your Mirror conversation are stored on your phone, encrypted with SQLCipher. They aren’t uploaded to our servers. You can add an app lock as well.'],
  ['Does the Mirror use AI?', 'Yes. The Mirror and vent reflections are written by an AI model, and the app says so before you start. It’s off unless you switch on AI reflections. When it’s on, the message you send passes through our server to Groq to get a reply; neither keeps it, and Groq doesn’t train on it.'],
  ['What does it cost?', 'Lowkei is free to download and use. Lowkei Plus adds the Mirror and the deeper charts for ₹139 a month (₹69 for students); outside India it’s $12.99, or $6.99 for students. Crisis help and your safety plan are always free.'],
  ['Is there an iPhone app?', 'Not yet. Lowkei is on Android first. The iPhone version is planned; the site will say when it’s ready.'],
  ['Do I need an account?', 'No. Lowkei starts anonymously. You can add an email later if you want to move to a new phone — you sign in with a six-digit code, no password.'],
  ['Does Lowkei share my health data?', 'No. If you connect Health Connect, your sleep, steps and heart-rate data are read on your phone and stay there. They aren’t sent to us, to the AI service, or to anyone else, and never used for ads.'],
  ['How do I delete everything?', 'In the app, go to You → Erase → erase everything. It deletes your account on our server and everything on the phone, straight away. You can download a copy of your data first from You → Your data.']
];

const faqHtml = () => `<div class="faq">${FAQ.map(([q, a]) => `
  <details><summary>${esc(q)}</summary><div class="a"><p>${esc(a)}</p></div></details>`).join('')}
</div>`;

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
};

const org = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Lowkei',
  url: SITE,
  logo: `${SITE}/icon-512.png`
};

const app = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: 'Lowkei',
  operatingSystem: 'Android',
  applicationCategory: 'HealthApplication',
  description: 'A private journal and mood tracker. Check in, vent, and see the weather of your weeks. What you write stays on your phone.',
  url: SITE,
  image: `${SITE}/og.jpg`,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }
};

// ---------------------------------------------------------------------------
// Layout

const NAV = [['/#features', 'Features'], ['/pricing', 'Pricing'], ['/#faq', 'FAQ'], ['/about', 'About']];

function crumbs(trail) {
  const items = [['/', 'Lowkei'], ...trail];
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([href, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + href }))
  };
  const html = `<nav class="crumbs wrap" aria-label="Breadcrumb"><ol>${items
    .map(([href, name], i) => (i === items.length - 1 ? `<li><span aria-current="page">${esc(name)}</span></li>` : `<li><a href="${href}">${esc(name)}</a></li>`))
    .join('')}</ol></nav>`;
  return { html, schema };
}

const CSS = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '\n');
const JS = read('site.js');

function layout({ path, title, description, body, schema = [], trail, preload = [] }) {
  const url = SITE + (path === '/' ? '/' : path);
  const bc = trail ? crumbs(trail) : null;
  const ld = [...schema, ...(bc ? [bc.schema] : [])];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#F6F6F3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E0E0E" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lowkei">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Lowkei — a quiet place to notice how you are">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/serif.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/inter-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/mono-500.woff2" as="font" type="font/woff2" crossorigin>
${preload.map(p => `<link rel="preload" href="${p}" as="image" fetchpriority="high">`).join('\n')}
<script>document.documentElement.classList.add('js')</script>
<style>${CSS}</style>
${ld.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Lowkei, home">LOWKEI<span class="dot" aria-hidden="true"></span></a>
    <nav class="nav" aria-label="Main">${NAV.map(([h, l]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    <a class="btn small" href="/download">Download</a>
  </div>
</header>
${bc ? bc.html : ''}
<main id="main">
${body}
</main>
<footer>
  <div class="wrap">
    <div class="cols">
      <div>
        <a class="brand" href="/">LOWKEI<span class="dot" aria-hidden="true"></span></a>
        <p style="margin-top:16px;color:var(--soft);max-width:22em">A quiet place to notice how you are. Made in India.</p>
      </div>
      <div><h2>Product</h2><ul><li><a href="/#features">Features</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/download">Download</a></li><li><a href="/#faq">FAQ</a></li></ul></div>
      <div><h2>Company</h2><ul><li><a href="/about">About</a></li><li><a href="/about#contact">Contact</a></li></ul></div>
      <div><h2>Legal</h2><ul><li><a href="/privacy">Privacy policy</a></li><li><a href="/terms">Terms of use</a></li><li><a href="/terms#copyright">Copyright</a></li></ul></div>
    </div>
    <div class="fine"><span>© ${new Date().getFullYear()} Lowkei</span><span>Not a medical service. In an emergency, call 112.</span></div>
  </div>
</footer>
<script>${JS}</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Pages

const fill = html =>
  html
    .replace(/<!--phone:(\w+)(?::([\w ]+))?-->/g, (_, n, c) => phone(n, { cls: c || '' }))
    .replace(/<!--art:(\w+)(?::([\w ]+))?-->/g, (_, n, c) => art(n, c || 'art'))
    .replace(/<!--download(?::([\w ]+))?-->/g, (_, c) => download(c || ''))
    .replace(/<!--faq-->/g, faqHtml())
    .replace(/<!--arrow-->/g, ARROW);

/** The <main> of a server/legal page, as site prose. */
function legal(name) {
  const html = readFileSync(join(ROOT, '..', 'server', 'legal', `${name}.html`), 'utf8');
  const main = html.match(/<main>([\s\S]*?)<\/main>/)[1].replace(/href="\/privacy"/g, 'href="/privacy"');
  return `<div class="page wrap"><article class="prose">${main.replace(/<h2>(\d+)\. ([^<]*)<\/h2>/g, (_, n, t) => `<h2 id="${t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}">${n}. ${t}</h2>`)}</article></div>`;
}

const pages = [
  {
    path: '/',
    out: 'index.html',
    title: 'Lowkei — a private journal and mood tracker',
    description: 'Check in in ten seconds, write what you can’t say out loud, and see the weather of your weeks. What you write stays on your phone.',
    body: fill(read('pages/index.html')),
    schema: [org, app, faqSchema],
    preload: ['/media/today.webp']
  },
  {
    path: '/pricing',
    out: 'pricing.html',
    title: 'Pricing — Lowkei',
    description: 'Lowkei is free. Lowkei Plus adds the Mirror and the deeper charts: ₹139 a month, or ₹69 for students. Crisis help is always free.',
    body: fill(read('pages/pricing.html')),
    trail: [['/pricing', 'Pricing']]
  },
  {
    path: '/download',
    out: 'download.html',
    title: 'Download Lowkei for Android',
    description: 'Get Lowkei on your Android phone. Free to start, no account needed. iPhone is coming later.',
    body: fill(read('pages/download.html')),
    trail: [['/download', 'Download']]
  },
  {
    path: '/about',
    out: 'about.html',
    title: 'About — Lowkei',
    description: 'Why Lowkei exists, who makes it, and the promises it keeps about your privacy.',
    body: fill(read('pages/about.html')),
    trail: [['/about', 'About']]
  },
  {
    path: '/privacy',
    out: 'privacy.html',
    title: 'Privacy policy — Lowkei',
    description: 'What Lowkei keeps on your phone, what reaches our server, where AI reflections go, and your rights over all of it.',
    body: legal('privacy'),
    trail: [['/privacy', 'Privacy policy']]
  },
  {
    path: '/terms',
    out: 'terms.html',
    title: 'Terms of use — Lowkei',
    description: 'The terms for using Lowkei: what it is and isn’t, subscriptions, Circle, acceptable use and copyright.',
    body: legal('terms'),
    trail: [['/terms', 'Terms of use']]
  }
];

const notFound = layout({
  path: '/404',
  title: 'Not found — Lowkei',
  description: 'This page doesn’t exist.',
  body: `<div class="page wrap" style="text-align:center">${art('king', 'art')}<h1 style="margin-top:28px">Nothing lives here.</h1><p class="lede" style="margin:18px auto 30px">The page may have moved. Everything else is where you left it.</p><div class="ctas" style="justify-content:center"><a class="btn" href="/">Go home</a><a class="btn ghost" href="/download">Download</a></div></div>`
}).replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex">');

// ---------------------------------------------------------------------------
// Write

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const dir of ['fonts', 'art', 'media']) cpSync(join(ROOT, dir), join(OUT, dir), { recursive: true });
for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png', 'og.jpg']) cpSync(join(ROOT, 'public', f), join(OUT, f));

for (const p of pages) {
  const html = layout(p);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) throw new Error(`${p.path} needs exactly one <h1>`);
  writeFileSync(join(OUT, p.out), html);
}
writeFileSync(join(OUT, '404.html'), notFound);

writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${SITE}${p.path}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`
);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`built ${pages.length + 1} pages for ${SITE}`);
