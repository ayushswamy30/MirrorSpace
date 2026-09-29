import { getDatabase } from './database';

/** Small encrypted key/value store on top of the local database. */
export const kv = {
  async get(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    return row?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO kv (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      key,
      value
    );
  },

  async remove(key: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  }
};
