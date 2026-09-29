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
   );`
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
