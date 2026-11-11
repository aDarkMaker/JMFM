import {describe, expect, test} from 'bun:test';
import type {UserStorage} from '@/data/user-storage';

const {readVersioned, writeVersioned} = await import('@/data/user-storage');

function memoryStorage(initial: Record<string, string> = {}): UserStorage & {
  dump(): Record<string, string>;
} {
  const map = new Map(Object.entries(initial));
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => {
      map.set(key, value);
    },
    remove: async (key) => {
      map.delete(key);
    },
    keys: async (prefix) =>
      [...map.keys()].filter((key) => !prefix || key.startsWith(prefix)),
    dump: () => Object.fromEntries(map),
  };
}

describe('readVersioned', () => {
  test('returns null for missing keys', async () => {
    expect(await readVersioned(memoryStorage(), 'k', 1)).toBeNull();
  });

  test('routes unversioned legacy payloads through migrate', async () => {
    const storage = memoryStorage({k: JSON.stringify([{id: 1}])});
    const result = await readVersioned(storage, 'k', 1, (legacy) => legacy as {id: number}[]);
    expect(result).toEqual({data: [{id: 1}], version: 0, migrated: true});
  });

  test('reads a current envelope without migrating', async () => {
    const storage = memoryStorage({k: JSON.stringify({v: 1, data: ['a']})});
    const result = await readVersioned(storage, 'k', 1, () => ['b']);
    expect(result).toEqual({data: ['a'], version: 1, migrated: false});
  });

  test('migrates envelopes from older versions', async () => {
    const storage = memoryStorage({k: JSON.stringify({v: 0, data: {old: true}})});
    const result = await readVersioned(storage, 'k', 2, (legacy, from) => ({legacy, from}));
    expect(result).toEqual({data: {legacy: {old: true}, from: 0}, version: 0, migrated: true});
  });

  test('returns null for corrupt JSON and throwing migrate', async () => {
    expect(await readVersioned(memoryStorage({k: '{oops'}), 'k', 1)).toBeNull();
    expect(
      await readVersioned(memoryStorage({k: '{"v":0,"data":1}'}), 'k', 1, () => {
        throw new Error('boom');
      })
    ).toBeNull();
  });
});

describe('writeVersioned', () => {
  test('wraps data in a version envelope', async () => {
    const storage = memoryStorage();
    await writeVersioned(storage, 'k', 1, {a: 1});
    expect(JSON.parse(storage.dump().k!)).toEqual({v: 1, data: {a: 1}});
  });

  test('round-trips through readVersioned', async () => {
    const storage = memoryStorage();
    await writeVersioned(storage, 'k', 1, [1, 2, 3]);
    const result = await readVersioned<number[]>(storage, 'k', 1);
    expect(result?.data).toEqual([1, 2, 3]);
    expect(result?.migrated).toBe(false);
  });
});
