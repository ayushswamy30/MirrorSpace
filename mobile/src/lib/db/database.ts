import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { inExpoGo } from '../runtime';

import { migrate } from './migrations';

/**
 * The on-device database. Journals, check-ins and the auth session live here,
 * encrypted with SQLCipher (enabled by the expo-sqlite config plugin in
 * app.json).
 *
 * The key is 32 random bytes generated on first launch and held in the
 * Keychain (iOS) / Keystore-backed storage (Android), readable only while the
 * device is unlocked and never included in backups or synced to another
 * device. It never leaves the phone, and the server never sees it.
 *
 * SQLCipher needs a development build; it is not in Expo Go. There, plain
 * SQLite quietly ignores the key, so the database is checked after keying:
 * in Lowkei's own build an unencrypted database is refused outright
 * rather than written to; in Expo Go it opens, and You says it isn't
 * encrypted.
 */

export type Encryption = { encrypted: true; cipher: string } | { encrypted: false };

let encryption: Encryption | null = null;

/** Whether the open database is SQLCipher-encrypted; null until it has opened. */
export function databaseEncryption(): Encryption | null {
  return encryption;
}

/**
 * SQLCipher answers `PRAGMA cipher_version`; plain SQLite doesn't know the
 * pragma and returns nothing.
 */
export async function checkEncryption(
  db: SQLite.SQLiteDatabase,
  allowPlain: boolean = inExpoGo || Platform.OS === 'web'
): Promise<Encryption> {
  const row = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version').catch(() => null);
  if (row?.cipher_version) return { encrypted: true, cipher: row.cipher_version };
  if (!allowPlain) throw new Error('SQLCipher is not active: refusing to store anything unencrypted.');
  return { encrypted: false };
}

// Named before the app was Lowkei. Renaming either would orphan existing data.
const DATABASE_NAME = 'mirrorspace.db';
const KEY_NAME = 'mirrorspace.db.key.v1';

const keyOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function loadOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME, keyOptions);
  if (existing) return existing;

  // No key but possibly a database file: a device backup restored the file
  // onto a phone that never had its key (the key is device-only by design).
  // That file can never be opened again, so clear it rather than failing on
  // every launch.
  await SQLite.deleteDatabaseAsync(DATABASE_NAME).catch(() => undefined);

  const key = toHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(KEY_NAME, key, keyOptions);
  return key;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  // The browser preview has no keystore and no SQLCipher: it opens plain.
  if (Platform.OS === 'web') {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    encryption = await checkEncryption(db);
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await migrate(db);
    return db;
  }

  const key = await loadOrCreateKey();
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // Must be the first statement on the connection. The x'…' form hands
  // SQLCipher a raw 256-bit key, skipping its passphrase derivation — the key
  // is already random, so stretching it adds nothing.
  await db.execAsync(`PRAGMA key = "x'${key}'";`);
  encryption = await checkEncryption(db).catch(async error => {
    await db.closeAsync();
    throw error;
  });

  // Fails with "file is not a database" if the key is wrong. Surfacing that
  // here beats a confusing error on the first real query.
  await db.getFirstAsync('SELECT count(*) FROM sqlite_master');

  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

let pending: Promise<SQLite.SQLiteDatabase> | null = null;

/** The shared connection, opened (and migrated) once per app launch. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!pending) {
    pending = open().catch(error => {
      // Let the next caller retry instead of caching a failure forever.
      pending = null;
      throw error;
    });
  }
  return pending;
}

/**
 * Local half of "erase everything": closes the connection, deletes the file
 * and forgets the key. Without the key, any copy of the file that survived
 * somewhere is unreadable.
 */
export async function destroyLocalData(): Promise<void> {
  if (pending) {
    const db = await pending.catch(() => null);
    pending = null;
    await db?.closeAsync();
  }
  await SQLite.deleteDatabaseAsync(DATABASE_NAME).catch(() => undefined);
  await SecureStore.deleteItemAsync(KEY_NAME, keyOptions);
}
