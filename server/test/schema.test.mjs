// Applies every migration in supabase/migrations to a real Postgres — PGlite,
// Postgres compiled to WebAssembly — and checks the parts of the schema that
// security depends on. No Supabase project, Docker or local Postgres needed:
//
//   npm run test:schema
//
// The hosted `auth` schema is stood in for by supabase/tests/local_auth_fixture.sql.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = path.join(root, 'supabase/migrations');
const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
const read = file => fs.readFileSync(file, 'utf8');

async function freshDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;');
  await db.exec(read(path.join(root, 'supabase/tests/local_auth_fixture.sql')));
  for (const m of migrations) await db.exec(read(path.join(migrationsDir, m)));
  return db;
}

async function asUser(db, authUserId, fn) {
  await db.exec(`set role authenticated; set request.jwt.claims = '${JSON.stringify({ sub: authUserId, role: 'authenticated' })}';`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

async function twoUsers(db) {
  const make = async () => {
    const { rows: [auth] } = await db.query('insert into auth.users default values returning id');
    const { rows: [user] } = await db.query('insert into public.users (auth_user_id) values ($1) returning id', [auth.id]);
    return { authId: auth.id, id: user.id };
  };
  return [await make(), await make()];
}

test('every migration applies in order, and re-running them all is harmless', async () => {
  const db = await freshDatabase();
  for (const m of migrations) {
    await assert.doesNotReject(db.exec(read(path.join(migrationsDir, m))), `${m} is not idempotent`);
  }
});

test('every public table has row level security on', async () => {
  const db = await freshDatabase();
  const { rows } = await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(rows, [], `RLS is off on: ${rows.map(r => r.relname).join(', ')}`);
});

test('anon can read nothing', async () => {
  const db = await freshDatabase();
  const { rows } = await db.query(`
    select table_name from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'`);
  assert.deepEqual(rows, []);
});

test('consent log: each person sees only their own, and no client can write it', async () => {
  const db = await freshDatabase();
  const [a, b] = await twoUsers(db);
  await db.query(
    `insert into public.consent_events (user_id, purpose, granted, policy_version)
     values ($1, 'readings', true, 'v1'), ($2, 'health', true, 'v1')`,
    [a.id, b.id]
  );

  const seen = await asUser(db, a.authId, () => db.query('select purpose from public.consent_events'));
  assert.deepEqual(seen.rows, [{ purpose: 'readings' }]);

  await asUser(db, a.authId, () =>
    assert.rejects(
      db.query(`insert into public.consent_events (user_id, purpose, granted, policy_version) values ($1, 'readings', false, 'v1')`, [a.id]),
      /permission denied/
    )
  );
});

test('consent log rejects purposes the app does not ask about', async () => {
  const db = await freshDatabase();
  const [a] = await twoUsers(db);
  await assert.rejects(
    db.query(`insert into public.consent_events (user_id, purpose, granted, policy_version) values ($1, 'marketing', true, 'v1')`, [a.id]),
    /consent_events_purpose_valid/
  );
});

test('erasing the auth identity erases the consent log with it', async () => {
  const db = await freshDatabase();
  const [a] = await twoUsers(db);
  await db.query(`insert into public.consent_events (user_id, purpose, granted, policy_version) values ($1, 'readings', true, 'v1')`, [a.id]);

  await db.query('delete from auth.users where id = $1', [a.authId]);

  const { rows } = await db.query('select count(*)::int as n from public.consent_events');
  assert.equal(rows[0].n, 0);
});

test('circle: a friendship is one row per pair, never with yourself', async () => {
  const db = await freshDatabase();
  const [a, b] = await twoUsers(db);
  await db.query('insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [a.id, b.id]);
  await assert.rejects(
    db.query('insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [b.id, a.id]),
    /friendships_pair_key/
  );
  await assert.rejects(
    db.query('insert into public.friendships (requester_id, addressee_id) values ($1, $1)', [a.id]),
    /friendships_not_self/
  );
});

test('circle: only a weather word and seven numbers can be shared', async () => {
  const db = await freshDatabase();
  const [a] = await twoUsers(db);
  await assert.rejects(
    db.query(`insert into public.circle_status (user_id, weather) values ($1, 'I feel awful')`, [a.id]),
    /circle_status_weather_valid/
  );
  await assert.rejects(
    db.query(`insert into public.circle_status (user_id, rhythm) values ($1, '{1,2,3}')`, [a.id]),
    /circle_status_rhythm_valid/
  );
  await db.query(`insert into public.circle_status (user_id, weather, rhythm) values ($1, 'fog', '{1,2,3,4,5,-1,null}')`, [a.id]);
});

test('circle: a person reads only their own status, and no client writes any', async () => {
  const db = await freshDatabase();
  const [a, b] = await twoUsers(db);
  await db.query(`insert into public.circle_status (user_id, weather) values ($1, 'clear'), ($2, 'storm')`, [a.id, b.id]);

  const seen = await asUser(db, a.authId, () => db.query('select weather from public.circle_status'));
  assert.deepEqual(seen.rows, [{ weather: 'clear' }]);

  await asUser(db, a.authId, () =>
    assert.rejects(db.query(`update public.circle_status set weather = 'mild'`), /permission denied/)
  );
});

test('circle: codes are six readable characters, unique', async () => {
  const db = await freshDatabase();
  const [a, b] = await twoUsers(db);
  await db.query(`update public.users set circle_code = 'K7M2QX' where id = $1`, [a.id]);
  await assert.rejects(db.query(`update public.users set circle_code = 'K7M2QX' where id = $1`, [b.id]), /users_circle_code_key/);
  await assert.rejects(db.query(`update public.users set circle_code = 'O0I1AB' where id = $1`, [b.id]), /users_circle_code_valid/);
});

test('circle: erasing an account takes its friendships, status and nudges with it', async () => {
  const db = await freshDatabase();
  const [a, b] = await twoUsers(db);
  await db.query('insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, $3)', [a.id, b.id, 'accepted']);
  await db.query(`insert into public.circle_status (user_id, weather) values ($1, 'mild')`, [a.id]);
  await db.query('insert into public.circle_nudges (from_user_id, to_user_id) values ($1, $2), ($2, $1)', [a.id, b.id]);

  await db.query('delete from auth.users where id = $1', [a.authId]);

  for (const table of ['friendships', 'circle_status', 'circle_nudges']) {
    const { rows } = await db.query(`select count(*)::int as n from public.${table}`);
    assert.equal(rows[0].n, 0, `${table} kept rows after erase`);
  }
});
