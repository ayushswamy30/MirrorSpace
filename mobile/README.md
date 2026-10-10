# Lowkei mobile

The iOS and Android app described in *MirrorSpace New Direction Report*
(repo root): Expo (React Native, TypeScript), Expo Router, Reanimated, on top
of the existing Express + Supabase API in `../server`.

## Principles this code holds to

- **Raw writing stays on the phone.** Journals and check-ins live in a local
  SQLCipher database. The 256-bit key is generated on the device and kept in
  the Keychain / Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); it is never
  synced, backed up or sent anywhere. The Supabase session lives in that same
  encrypted store.
- **Help is never gated.** Calm tools and *Need help now* are on every tab and
  sit outside the session gate, so they open offline, before onboarding, and
  when the account can’t be reached.
- **One idea per screen**, big serif sentences, slow (600–900 ms) motion that
  becomes a plain fade under the system’s reduced-motion setting, Dynamic Type
  up to 200%, WCAG 2.2 AA in both themes — enforced by
  `src/theme/__tests__/contrast.test.ts`.
- **No streaks.** Progressive unlocks count calendar days since the account
  began, not days opened (`src/lib/unlocks.ts`).

## Layout

```
src/app/            routes (Expo Router)
  _layout.tsx       fonts, theme, session; the root stack
  (tabs)/           Today · Check-in (+ Vent) · Mirror · Chart · Circle, behind the session gate
  calm.tsx          breathe · ground · sounds · plan (modal, no session needed)
  help.tsx          crisis lines (modal, no session, no network)
  crisis.tsx        elevated / acute response to a screened entry
  plan.tsx          the safety plan on its own, for the crisis card
  you.tsx           app lock, consents, export, erase
src/components/     Text, Screen, Header, Blocks, Button, Chip, TabBar, Vent, SafetyPlan,
                    calm/ (Breather, Grounding, Sounds), line icons
src/lib/
  db/               encrypted SQLite: key management, migrations, kv
  checkIns.ts       the one-tap check-in, stored on the phone
  emotions.ts       the 100-word energy × pleasantness vocabulary
  vents.ts          kept vent pages and the draft
  patterns.ts       check-ins → Inner Weather, facts, the day's reading
  safety/           crisis screening, the safety-event log, answerConcern()
  safetyPlan.ts     the personal safety plan
  calm/             breathing timing, grounding steps, the sound catalogue
  account.ts        export and erase-everything, consent changes
  supabase.ts       anonymous-first auth, session in the encrypted store
  session.tsx       provisions the API user; opens offline on a cached profile
  api.ts            typed client for the Express API
  unlocks.ts        day 1 / 3 / 7 / 14 / 30 unlocks
  helplines.ts      crisis lines by region
src/theme/          tokens, typography, motion — see DESIGN.md
scripts/
  generate-sounds.sh  synthesises every calm sound into assets/sounds/
```

## Building an installable APK

```bash
cd mobile
npx eas-cli@latest build --profile preview --platform android
```

The preview profile talks to the hosted API on Render. EAS builds never see
`.env.local`, so the public values the app needs come from EAS itself:
`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_UNLOCK_ALL` are in `eas.json`, and
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are EAS
environment variables for the `preview` environment (`eas env:list`). Without
them the app stops on launch.

## Updates

Builds carry EAS Update (`expo-updates`): on launch they fetch the newest
JavaScript published to their channel and switch to it on the next launch.
To ship a change to everyone with the APK, without a new build:

```bash
cd mobile
npx eas-cli@latest update --channel preview --environment preview --message "what changed"
```

Only JavaScript and assets travel this way. A new native module, permission or
plugin, or a change to `app.json` that affects the native app, needs a new
build — and a new `version` in `app.json`, since the runtime version follows
it and an update only reaches builds of the same runtime version. Builds made
before updates were added (before October 10, 2026) never update.

## The web app (iPhone)

```bash
cd mobile
npm run build:web   # → dist-web/, served by the site at /app
```

The real app in a browser: signs in, talks to the API, keeps its database in
the browser's private file system. That needs a cross-origin-isolated page,
so the site sends COOP/COEP headers for `/app` (`site/vercel.json`), and the
API must list the site in `CORS_ORIGINS`. There is no SQLCipher in a browser,
so the copy isn't encrypted (You says so), and reminders, the app lock, voice
and Health Connect don't run there. Deploy it with `sh site/deploy.sh`.

## Previewing it in a browser

No phone needed to look at the screens:

```bash
cd mobile
npm run preview     # opens http://localhost:8081
```

The browser preview uses a stand-in profile and fills in a month of made-up
check-ins and nights, so Today and Chart have something to show. It never
talks to Supabase or the API, it isn't encrypted, and reminders, the app lock
and Health Connect don't run there. It's for looking at the design; the real
thing is the phone build below.

## Running it

SQLCipher, reminders (expo-notifications), and Health Connect are native
modules that **Expo Go does not include** (or that crash it on Android). You
need a development build. In Expo Go the app still opens, but the database is
not encrypted (You → Privacy says so) and reminders stay off.

Reminders are local notifications, scheduled on the phone — no push server,
no token, nothing sent anywhere. Once the dev build is installed: You →
Notifications → Daily reminder, then **Send a test** to see one arrive.

```bash
cd mobile
cp .env.example .env.local      # fill in Supabase + API URL
npm install

# build a dev client once (in the cloud — no Xcode or Android Studio needed)
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development-simulator --platform ios

# then, day to day
npx expo start --dev-client
```

With Android Studio or Xcode installed locally, `npm run android` /
`npm run ios` build and launch the dev client directly instead.

The API must be running (`cd ../server && npm run dev`) and reachable from the
phone — see the note on `EXPO_PUBLIC_API_URL` in `.env.example`. Supabase needs
**Anonymous sign-ins** enabled (see the root README).

React Native 0.86 needs Node 20.19.4+, 22.13+ or 24.3+.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run doctor
```

## Before a store build

- `app.mirrorspace` is a **placeholder** bundle id / package name, left over
  from before the app was Lowkei. It is permanent once published — choose
  the real one first. Changing it needs a new Android app in the Firebase
  project and a fresh `google-services.json` for the new package, or Circle
  alerts stop. The EAS slug (`mirrorspace`) is tied to the EAS project id and
  never shown to anyone; it can stay.
- The privacy policy and terms are served by the API at `/privacy` and
  `/terms` (`server/legal/`). Fill in the operator name, grievance officer and
  city before publishing, and keep them in step with `src/lib/consent.ts`.
- The icon and splash image are still Expo’s template artwork.
- The app ships SQLCipher, so Apple’s export-compliance question
  (`ITSAppUsesNonExemptEncryption`) needs a real answer from counsel; it is
  deliberately left unset.
- `src/lib/helplines.ts` is safety-critical and must be re-verified by the
  clinical advisory board before every release. So are the crisis phrase
  lists in `src/lib/safety/screen.ts` (English only so far) and the safety
  plan's wording in `src/lib/safetyPlan.ts`.
- Health Connect (sleep) needs a Health Connect data declaration in the Play
  Console before a Play Store release (approval up to a week, then the
  allow-list takes another 5–7 business days), and the permissions-rationale
  intent should open a proper "why Lowkei reads sleep" screen rather
  than the app's home. Apple Health (HealthKit) needs the paid Apple
  developer account and isn't built yet.
- Two requested calm sounds, Café and Morning Birds, need licence-clean
  recordings; everything else is generated by `scripts/generate-sounds.sh`.
