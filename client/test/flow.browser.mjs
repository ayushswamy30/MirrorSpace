// Browser test for the anonymous-first auth flow, run against the production
// build. It drives a real Chromium through first run, onboarding, the account
// page and a reload, and checks what actually reached the database.
//
// This is the test that catches things unit tests cannot: a bundle that builds
// but renders nothing, or native form validation swallowing our own.
//
//   npm run build && npm run preview &
//   PREVIEW_URL=http://127.0.0.1:4173 API_URL=http://127.0.0.1:5055/api \
//     node test/flow.browser.mjs
//
// Needs the local Supabase stand-in running (see supabase/tests/README.md),
// since it performs a real anonymous sign-in.
import { chromium } from 'playwright';

const PREVIEW = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const API = process.env.API_URL || 'http://127.0.0.1:5055/api';
const CHROME = process.env.CHROMIUM_PATH || undefined;

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await (await browser.newContext()).newPage();

const errors = [];
page.on('pageerror', e => errors.push(e.message));
// Google-hosted fonts and OAuth are not reachable from a sandbox; not our bugs.
await page.route(/google/, r => r.abort());

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};
const text = () => page.locator('body').innerText().then(t => t.trim());

/** Call the API as the browser's current user. */
const asUser = (path) => page.evaluate(async ({ api, path }) => {
  const key = Object.keys(localStorage).find(k => k.includes('auth-token'));
  const token = JSON.parse(localStorage.getItem(key)).access_token;
  const res = await fetch(api + path, { headers: { authorization: `Bearer ${token}` } });
  return res.json();
}, { api: API, path });

console.log('\n== first run ==');
await page.goto(PREVIEW);
await page.waitForTimeout(2500);
check('the app renders at all', (await page.locator('#root').innerHTML()).length > 0);
check('a brand-new visitor gets onboarding, not a sign-in wall', (await text()).includes("doesn't ask"));
check('an anonymous session was stored', await page.evaluate(() => {
  const k = Object.keys(localStorage).find(k => k.includes('auth-token'));
  return k ? Boolean(JSON.parse(localStorage.getItem(k))?.access_token) : false;
}));

console.log('\n== onboarding ==');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Sleep better' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.locator('.permission-label').first().click();
await page.locator('.onboarding-btn').last().click();
await page.waitForTimeout(2500);

check('lands on Home', (await text()).includes('Vent It Out'));
check('Home offers to save the anonymous space', (await text()).includes('save it'));

const profile = await asUser('/user/profile');
check('onboarding persisted server-side', profile.onboardingComplete === true, JSON.stringify(profile));
check('the chosen intent persisted', (profile.intents || []).includes('sleep_better'), JSON.stringify(profile.intents));
check('the user is anonymous', profile.isAnonymous === true);

console.log('\n== account page ==');
await page.goto(`${PREVIEW}/account`);
await page.waitForTimeout(1500);
const account = await text();
check('offers the upgrade path', account.includes('Save your space'), account.slice(0, 160));
check('offers a magic link', account.includes('send me a link'));
check('offers Google', account.includes('continue with Google'));
check('says plainly what anonymous means', account.toLowerCase().includes('only in this browser'));

await page.getByRole('button', { name: /I already have a space/ }).click();
await page.waitForTimeout(300);
check('switches to restore mode', (await text()).includes('Find your space'));

console.log('\n== email handling ==');
await page.fill('#account-email', 'not-an-email');
await page.locator('button[type=submit]').click();
await page.waitForTimeout(500);
check("a malformed address is rejected in the app's own voice",
  (await text()).includes('does not look like an email'), (await text()).slice(-160));

await page.fill('#account-email', 'nobody@example.com');
await page.locator('button[type=submit]').click();
await page.waitForTimeout(1500);
check('an unknown address does not silently create a new empty space',
  !(await text()).includes('Check your inbox'), (await text()).slice(-160));

console.log('\n== the session survives a reload ==');
await page.goto(PREVIEW);
await page.waitForTimeout(2500);
check('no second onboarding', !(await text()).includes("doesn't ask"));
check('same space', (await text()).includes('Vent It Out'));

console.log('\n== writing as an anonymous user ==');
await page.goto(`${PREVIEW}/vent`);
await page.waitForTimeout(1200);
await page.locator('textarea').first().fill('a private thought, written anonymously');
await page.getByRole('button', { name: /release|save|let it go|done/i }).first().click();
await page.waitForTimeout(2000);
check('the entry reached the database under this account',
  (await asUser('/journal')).total === 1);

console.log('\n== a separate browser profile is a separate user ==');
const other = await (await browser.newContext()).newPage();
await other.route(/google/, r => r.abort());
await other.goto(PREVIEW);
await other.waitForTimeout(2500);
check('starts its own onboarding', (await other.locator('body').innerText()).includes("doesn't ask"));

check('no uncaught page errors throughout', errors.length === 0, errors.join('; '));

console.log(`\n${pass} passed, ${fail} failed\n`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
