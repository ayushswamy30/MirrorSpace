#!/usr/bin/env sh
# Builds the app for the browser and the site, deploys both to Vercel, and
# points the older lowkei.vercel.app name at the new deployment (it can't be
# attached to the project, so it doesn't follow production on its own).
set -e
cd "$(dirname "$0")"
npm --prefix ../mobile run build:web
npx --yes vercel@latest build --yes --target production
url=$(npx --yes vercel@latest deploy --prebuilt --prod --yes 2>/dev/null | grep -oE 'https://lowkei-[a-z0-9]+-333shubhs-projects\.vercel\.app' | head -1)
echo "deployed $url"
npx --yes vercel@latest alias set "$url" lowkei.vercel.app
