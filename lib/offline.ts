import { openDB } from 'idb';
const db = () =>
  openDB('sohoz-workspace-v1', 1, {
    upgrade(db) {
      db.createObjectStore('private');
    },
  });
export async function readCache<T>(key: string): Promise<T | undefined> {
  return (await db()).get('private', key);
}
export async function writeCache(key: string, value: unknown) {
  return (await db()).put('private', value, key);
}
export async function deleteCache(key: string) {
  return (await db()).delete('private', key);
}
export async function clearCache() {
  return (await db()).clear('private');
}
