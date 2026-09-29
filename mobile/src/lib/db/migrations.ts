import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Forward-only migrations, tracked with PRAGMA user_version. Append new steps;
 * never edit one that has shipped, because devices that already ran it will
 * not run it again.
 */
export const migrations: readonly string[] = [
  // 1 — key/value store: auth session, first-open date, small preferences.
  `CREATE TABLE kv (
     key        TEXT PRIMARY KEY NOT NULL,
     value      TEXT NOT NULL,
     updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );`,

  // 2 — check-ins. The word's coordinates are copied in so later edits to the
  // vocabulary never rewrite history. local_date is the calendar day in the
  // timezone the person was in at the time, which is the day patterns count.
  `CREATE TABLE check_ins (
     id           TEXT PRIMARY KEY NOT NULL,
     created_at   TEXT NOT NULL,
     local_date   TEXT NOT NULL,
     emotion      TEXT NOT NULL,
     energy       INTEGER NOT NULL CHECK (energy BETWEEN -5 AND 5 AND energy <> 0),
     pleasantness INTEGER NOT NULL CHECK (pleasantness BETWEEN -5 AND 5 AND pleasantness <> 0),
     tags         TEXT NOT NULL DEFAULT '[]',
     note         TEXT,
     updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );
   CREATE INDEX check_ins_created_at_idx ON check_ins (created_at);`,

  // 3 — safety events: tier, source and time only. Deliberately no text and
  // no reference to the entry that raised it.
  `CREATE TABLE safety_events (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     tier       TEXT NOT NULL CHECK (tier IN ('low', 'elevated', 'acute')),
     source     TEXT NOT NULL CHECK (source IN ('check_in', 'vent', 'chat')),
     created_at TEXT NOT NULL
   );`,

  // 4 — vent pages that were kept. Pages that were let go are never written.
  `CREATE TABLE vents (
     id         TEXT PRIMARY KEY NOT NULL,
     created_at TEXT NOT NULL,
     local_date TEXT NOT NULL,
     body       TEXT NOT NULL
   );
   CREATE INDEX vents_created_at_idx ON vents (created_at);`
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < migrations.length; version++) {
    await db.withExclusiveTransactionAsync(async txn => {
      await txn.execAsync(migrations[version]);
      // PRAGMA does not take bound parameters; the value is our own integer.
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
