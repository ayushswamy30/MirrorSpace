import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate, migrations } from '../migrations';

/** Just enough of SQLiteDatabase to watch what migrate() runs. */
function fakeDb(startVersion: number) {
  let version = startVersion;
  const executed: string[] = [];

  const txn = {
    execAsync: jest.fn(async (sql: string) => {
      const pragma = sql.match(/PRAGMA user_version = (\d+)/);
      if (pragma) version = Number(pragma[1]);
      else executed.push(sql);
    })
  };

  const db = {
    getFirstAsync: jest.fn(async () => ({ user_version: version })),
    withExclusiveTransactionAsync: jest.fn(async (fn: (t: typeof txn) => Promise<void>) => fn(txn))
  };

  return { db: db as unknown as SQLiteDatabase, executed, version: () => version };
}

test('a fresh database runs every migration, in order', async () => {
  const { db, executed, version } = fakeDb(0);

  await migrate(db);

  expect(executed).toEqual([...migrations]);
  expect(version()).toBe(migrations.length);
});

test('an up-to-date database runs nothing', async () => {
  const { db, executed } = fakeDb(migrations.length);

  await migrate(db);

  expect(executed).toEqual([]);
});
