# MirrorSpace mobile

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
  (tabs)/           Today · Check-in · Mirror · Chart · Circle, behind the session gate
  calm.tsx          calm tools (modal, no session needed)
  help.tsx          crisis lines (modal, no session, no network)
src/components/     Text, Screen, Header, Blocks, Button, TabBar, line icons
src/lib/
  db/               encrypted SQLite: key management, migrations, kv
  supabase.ts       anonymous-first auth, session in the encrypted store
  session.tsx       provisions the API user; opens offline on a cached profile
  api.ts            typed client for the Express API
  unlocks.ts        day 1 / 3 / 7 / 14 / 30 unlocks
  helplines.ts      crisis lines by region
src/theme/          tokens, typography, motion
```

## Running it

SQLCipher, and later HealthKit / Health Connect and widgets, are native
modules that **Expo Go does not include**. You need a development build.

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

- `app.mirrorspace` is a **placeholder** bundle id / package name. It is
  permanent once published — choose the real one first.
- The icon and splash image are still Expo’s template artwork.
- The app ships SQLCipher, so Apple’s export-compliance question
  (`ITSAppUsesNonExemptEncryption`) needs a real answer from counsel; it is
  deliberately left unset.
- `src/lib/helplines.ts` is safety-critical and must be re-verified by the
  clinical advisory board before every release.
