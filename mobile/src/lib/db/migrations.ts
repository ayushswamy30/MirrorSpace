import { Platform } from 'react-native';
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
   CREATE INDEX vents_created_at_idx ON vents (created_at);`,

  // 5 — sleep logged by hand, one row per night. wake_date (the morning, in
  // local time) names the night, so logging it twice replaces it.
  `CREATE TABLE sleep_logs (
     wake_date  TEXT PRIMARY KEY NOT NULL,
     bed_at     TEXT NOT NULL,
     wake_at    TEXT NOT NULL,
     minutes    INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
     updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );`,

  // 6 — the Mirror conversation. It lives here and nowhere else: the server
  // answers each turn and keeps none of it.
  `CREATE TABLE mirror_messages (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     role       TEXT NOT NULL CHECK (role IN ('user', 'mirror')),
     content    TEXT NOT NULL,
     created_at TEXT NOT NULL
   );`,

  // 7 — where a night came from. A night logged by hand always wins over one
  // read from Health Connect.
  `ALTER TABLE sleep_logs ADD COLUMN source TEXT NOT NULL DEFAULT 'hand'
     CHECK (source IN ('hand', 'health'));`,

  // 8 — a kept page's delayed reflection: the text, when it may be shown,
  // and where the request stands ('pending' retries on the next open;
  // 'never' for pages that must not be sent, or without consent).
  `ALTER TABLE vents ADD COLUMN reflection TEXT;
   ALTER TABLE vents ADD COLUMN reflection_at TEXT;
   ALTER TABLE vents ADD COLUMN reflection_state TEXT CHECK (reflection_state IN ('pending', 'ready', 'never'));`,

  // 9 — what shape a page was written in: a free page, or a guided one.
  `ALTER TABLE vents ADD COLUMN kind TEXT NOT NULL DEFAULT 'page'
     CHECK (kind IN ('page', 'worry', 'thanks', 'unsent'));`,

  // 10 — letters to future self. Sealed until deliver_at; a heavy stretch
  // moves deliver_at on by a week.
  `CREATE TABLE letters (
     id           TEXT PRIMARY KEY,
     created_at   TEXT NOT NULL,
     body         TEXT NOT NULL,
     deliver_at   TEXT NOT NULL,
     delivered_at TEXT,
     opened_at    TEXT
   );
   CREATE INDEX letters_deliver_at_idx ON letters (deliver_at);`,

  // 11 — personal experiments: seven days of one small change. kept is the
  // JSON list of days the person said they kept it.
  `CREATE TABLE experiments (
     id         TEXT PRIMARY KEY,
     created_at TEXT NOT NULL,
     title      TEXT NOT NULL,
     starts_on  TEXT NOT NULL,
     ends_on    TEXT NOT NULL,
     kept       TEXT NOT NULL DEFAULT '[]',
     stopped_on TEXT
   );`,

  // 12 — "What the Mirror knows": notes the person wrote for the Mirror, and
  // on each Mirror answer, the items it drew on (JSON), so its citations
  // still read true after the notes change.
  `CREATE TABLE mirror_notes (
     id         TEXT PRIMARY KEY,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     body       TEXT NOT NULL
   );
   ALTER TABLE mirror_messages ADD COLUMN sources TEXT;`
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < migrations.length; version++) {
    const step = async (txn: Pick<SQLiteDatabase, 'execAsync'>) => {
      await txn.execAsync(migrations[version]);
      // PRAGMA does not take bound parameters; the value is our own integer.
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    };
    // The browser preview's SQLite has no exclusive transactions; nothing
    // else touches its database while it migrates.
    if (Platform.OS === 'web') await db.withTransactionAsync(() => step(db));
    else await db.withExclusiveTransactionAsync(step);
  }
}
