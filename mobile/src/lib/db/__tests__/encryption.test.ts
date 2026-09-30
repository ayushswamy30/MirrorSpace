import type { SQLiteDatabase } from 'expo-sqlite';

import { checkEncryption } from '../database';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-crypto', () => ({}));

function dbAnswering(row: unknown) {
  return { getFirstAsync: jest.fn(async () => row) } as unknown as SQLiteDatabase;
}

test('SQLCipher is recognised by its version', async () => {
  await expect(checkEncryption(dbAnswering({ cipher_version: '4.6.1 community' }), false)).resolves.toEqual({
    encrypted: true,
    cipher: '4.6.1 community'
  });
});

test('in the real app, a plain database is refused rather than written to', async () => {
  await expect(checkEncryption(dbAnswering(null), false)).rejects.toThrow(/refusing/);
});

test('in Expo Go, a plain database opens and says so', async () => {
  await expect(checkEncryption(dbAnswering(null), true)).resolves.toEqual({ encrypted: false });
});
