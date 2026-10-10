# Lowkei — the site

https://getlowkei.vercel.app — what the app is, recorded in use, where to get
it, and the app itself for iPhone at `/app`.

## Build and deploy

```bash
sh site/deploy.sh
```

That builds the app for the browser (`npm --prefix mobile run build:web`),
builds the site (`node site/build.mjs` → `site/dist`), deploys both to the
Vercel project `lowkei` as production, and points `lowkei.vercel.app` at the
new deployment. Vercel builds nothing itself: the output is built here and
uploaded (`vercel deploy --prebuilt`), because the site reads
`../server/legal` and `../mobile/dist-web`.

- Pages are complete HTML at build time. `site/pages/*.html` are the bodies;
  `build.mjs` wraps them, and fails if a page has more than one `<h1>`.
- The privacy policy and terms come from `server/legal/` — edit them there.
- `getlowkei.vercel.app` is the main address. `lowkei.vercel.app` and
  `lowkei-sigma.vercel.app` redirect to it (`vercel.json`).

## The Android download

`/download/android` is a redirect in `vercel.json` to the current APK from
EAS. After a new `eas build --profile preview`, put the new artifact URL there
and deploy. (Only native changes need a new APK — see “Updates” in
`mobile/README.md`.)

## Pictures and type

The pictures are the app's: `design/images/` → `mobile/assets/pictures/`
(`python mobile/scripts/pictures.py`), copied into the site at build time.
Fraunces and DM Sans are subset and self-hosted in `fonts/` (SIL OFL).

## The recordings

`media/` holds the app recorded from its browser preview (`npm --prefix
mobile run preview`) at 2× and encoded to MP4 and WebM with a WebP poster
each. They load once the page has, and only play while on screen.

## Search Console

Needs the Google account that will own the listing:

1. https://search.google.com/search-console → Add property → URL prefix →
   `https://getlowkei.vercel.app/`.
2. Verify with the HTML tag method: put the `<meta name="google-site-verification">`
   tag into the `<head>` in `build.mjs`, deploy, then press Verify.
3. Sitemaps → submit `sitemap.xml`.
