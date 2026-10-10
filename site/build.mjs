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
const SITE = (process.env.SITE_URL || 'https://getlowkei.vercel.app').replace(/\/$/, '');
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

function phone(name, { eager = false, cls = '', id = '' } = {}) {
  const caption = VIDEO_CAPTIONS[name];
  return `<div class="phone ${cls}"${id ? ` data-id="${id}"` : ''}>
  <div class="screen">
    <video data-auto muted loop playsinline preload="none" width="600" height="1298" poster="/media/${name}.webp" aria-label="${esc(caption)}"${eager ? ' fetchpriority="high"' : ''}>
      <source data-src="/media/${name}.webm" type="video/webm">
      <source data-src="/media/${name}.mp4" type="video/mp4">
    </video>
    <button class="btn small ghost play" type="button">Play</button>
  </div>
</div>`;
}

/** A picture slot (design/images, via mobile/assets/pictures) as a rounded sticker. */
function sticker(slot, alt, cls = 'sticker') {
  return `<img class="${cls}" src="/pictures/${slot}.webp" width="120" height="120" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

/** The settings that matter, as a strip of chips — twice, so it can loop. */
const CHIPS = [
  ['Your words leave this phone', 'Off'],
  ['Ads', 'None'],
  ['Trackers and analytics', 'None'],
  ['AI reflections', 'Your call'],
  ['Health data shared', 'Never'],
  ['Encrypted on Android', 'On'],
  ['Download everything', 'Any time'],
  ['Erase everything', 'One tap']
];
const chipsHtml = () => {
  const one = CHIPS.map(([k, v]) => `<span class="chip"><i aria-hidden="true"></i>${esc(k)} <b>${esc(v)}</b></span>`).join('');
  return `${one}<span aria-hidden="true" style="display:contents">${one}</span>`;
};

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
  ['What does it cost?', 'Nothing. Lowkei is free, and every feature — the Mirror, your charts, Circle, calm — is open to everyone. There are no ads and no in-app purchases.'],
  ['Is there an iPhone app?', 'Yes — on iPhone, Lowkei runs in Safari. Open getlowkei.vercel.app/app, tap Share, then Add to Home Screen, and it opens like any other app. Voice and Health Connect are Android-only for now.'],
  ['Do I need an account?', 'Yes — an email is all it takes. You sign up and sign in with a six-digit code sent to your inbox, so there’s no password to remember, and your account, circle and settings follow you to a new phone. We only ever email you sign-in codes.'],
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
  logo: `${SITE}/icon-512.png`,
  email: 'getlowkei@gmail.com',
  founder: [
    { '@type': 'Person', name: 'Shubh Jadiya', jobTitle: 'Developer' },
    { '@type': 'Person', name: 'Ayush Swamy', jobTitle: 'Developer' }
  ]
};

const app = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: 'Lowkei',
  operatingSystem: 'Android, iOS (web app)',
  applicationCategory: 'HealthApplication',
  description: 'A private journal and mood tracker. Check in, vent, and see the weather of your weeks. What you write stays on your phone.',
  url: SITE,
  image: `${SITE}/og.jpg`,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  isAccessibleForFree: true
};

// ---------------------------------------------------------------------------
// Layout

const NAV = [['/#how', 'How it works'], ['/#features', 'Features'], ['/#privacy', 'Privacy'], ['/#faq', 'FAQ'], ['/about', 'About']];

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
<meta name="theme-color" content="#F7F6FA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0C0B16" media="(prefers-color-scheme: dark)">
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
<meta property="og:image:alt" content="Lowkei — a soft place to notice how you are">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/fraunces-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/dmsans-400.woff2" as="font" type="font/woff2" crossorigin>
${preload.map(p => `<link rel="preload" href="${p}" as="image" fetchpriority="high">`).join('\n')}
<script>document.documentElement.classList.add('js')</script>
<style>${CSS}</style>
${ld.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap">
    <div class="pill">
      <a class="brand" href="/" aria-label="Lowkei, home">lowkei<span class="dot" aria-hidden="true"></span></a>
      <nav class="nav" aria-label="Main">${NAV.map(([h, l]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    </div>
    <div class="pill"><a class="btn small" href="/download">Download</a></div>
  </div>
</header>
${bc ? bc.html : ''}
<main id="main">
${body}
</main>
${path === '/' ? `<div class="sticky-cta">${download()}</div>` : ''}
<footer>
  <div class="wrap">
    <div class="cols">
      <div>
        <a class="brand" href="/" style="padding-left:0">lowkei<span class="dot" aria-hidden="true"></span></a>
        <p style="margin-top:16px;color:var(--soft);max-width:22em">A soft place to notice how you are. Made in India by Shubh Jadiya and Ayush Swamy.</p>
      </div>
      <div><h2>Product</h2><ul><li><a href="/#features">Features</a></li><li><a href="/download">Download</a></li><li><a href="/#faq">FAQ</a></li></ul></div>
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
    .replace(/<!--stack:([\w,]+)-->/g, (_, list) => list.split(',').map((n, i) => phone(n, { id: n, cls: i ? 'hidden-phone' : 'shown' })).join('\n'))
    .replace(/<!--phone:(\w+)(?::([\w ]+))?-->/g, (_, n, c) => phone(n, { cls: c || '' }))
    .replace(/<!--chips-->/g, chipsHtml())
    .replace(/<!--download(?::([\w ]+))?-->/g, (_, c) => download(c || ''))
    .replace(/<!--faq-->/g, faqHtml());

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
    preload: ['/pictures/sky-overcast.webp']
  },
  {
    path: '/download',
    out: 'download.html',
    title: 'Download Lowkei for Android',
    description: 'Get Lowkei on Android, or use it on iPhone in Safari. Free, every feature; sign up with your email.',
    body: fill(read('pages/download.html')),
    trail: [['/download', 'Download']]
  },
  {
    path: '/about',
    out: 'about.html',
    title: 'About — Lowkei',
    description: 'Lowkei is made by Shubh Jadiya and Ayush Swamy, two developers in India. Why it exists and the promises it keeps about your privacy.',
    body: fill(read('pages/about.html')),
    schema: [org],
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
    description: 'The terms for using Lowkei: what it is and isn’t, Circle, acceptable use and copyright.',
    body: legal('terms'),
    trail: [['/terms', 'Terms of use']]
  }
];

const notFound = layout({
  path: '/404',
  title: 'Not found — Lowkei',
  description: 'This page doesn’t exist.',
  body: `<div class="page wrap" style="text-align:center">${sticker('sticker-ghost', 'A small glowing jelly ghost', 'sticker" style="margin:0 auto')}<h1 style="margin-top:28px">Nothing lives here.</h1><p class="lede" style="margin:18px auto 30px">The page may have moved. Everything else is where you left it.</p><div class="ctas" style="justify-content:center"><a class="btn" href="/">Go home</a><a class="btn ghost" href="/download">Download</a></div></div>`
}).replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex">');

// ---------------------------------------------------------------------------
// Write

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const dir of ['fonts', 'media']) cpSync(join(ROOT, dir), join(OUT, dir), { recursive: true });
cpSync(join(ROOT, '..', 'mobile', 'assets', 'pictures'), join(OUT, 'pictures'), { recursive: true });
for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png', 'og.jpg']) cpSync(join(ROOT, 'public', f), join(OUT, f));

for (const p of pages) {
  const html = layout(p);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) throw new Error(`${p.path} needs exactly one <h1>`);
  writeFileSync(join(OUT, p.out), html);
}
writeFileSync(join(OUT, '404.html'), notFound);

// The app itself, for iPhone and any browser: the real app built for the web
// by `npm --prefix mobile run build:web`, served under /app and installable
// from Safari's Share → Add to Home Screen.
const WEB_APP = join(ROOT, '..', 'mobile', 'dist-web');
if (existsSync(WEB_APP)) {
  cpSync(WEB_APP, join(OUT, 'app'), { recursive: true });
  for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) cpSync(join(ROOT, 'public', f), join(OUT, 'app', f));
  cpSync(join(ROOT, 'app', 'sw.js'), join(OUT, 'app', 'sw.js'));
  writeFileSync(
    join(OUT, 'app', 'manifest.webmanifest'),
    JSON.stringify(
      {
        name: 'Lowkei',
        short_name: 'Lowkei',
        description: 'A private journal and mood tracker.',
        id: '/app',
        start_url: '/app',
        scope: '/app',
        display: 'standalone',
        background_color: '#F7F6FA',
        theme_color: '#F7F6FA',
        icons: [
          { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      null,
      2
    )
  );
  const index = join(OUT, 'app', 'index.html');
  const head = `
    <meta name="description" content="Lowkei, the app: check in, vent, and see the weather of your weeks.">
    <meta name="robots" content="noindex">
    <link rel="manifest" href="/app/manifest.webmanifest">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/app/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Lowkei">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="theme-color" content="#F7F6FA" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#0C0B16" media="(prefers-color-scheme: dark)">
    <style>html,body{background:#F7F6FA}@media (prefers-color-scheme: dark){html,body{background:#0C0B16}}</style>
    <script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/app/sw.js', { scope: '/app' }).catch(() => {}));</script>
  </head>`;
  writeFileSync(
    index,
    readFileSync(index, 'utf8')
      .replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"', 'content="width=device-width, initial-scale=1, viewport-fit=cover"')
      .replace('</head>', head)
  );
  console.log('included the web app at /app');
} else {
  console.log('no mobile/dist-web — run `npm --prefix mobile run build:web` to include the app');
}

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
