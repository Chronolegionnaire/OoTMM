import { ENV_KEYS } from './util';

const dbPromise = openDatabase();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ootmm', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const os = db.createObjectStore('data', { keyPath: 'key' });
      os.createIndex('key', 'key', { unique: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveData(name: string, data: unknown | null): Promise<void> {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const store = db.transaction('data', 'readwrite').objectStore('data');
    if (data !== null) store.put({ key: name, data });
    else store.delete(name);
    store.transaction.oncomplete = () => resolve();
    store.transaction.onerror = (e) => reject(e);
  });
}

async function loadData<T>(name: string): Promise<T | null> {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const store = db.transaction('data').objectStore('data');
    const request = store.get(name);
    request.onsuccess = () => resolve((request.result?.data as T | undefined) ?? null);
    request.onerror = (e) => reject(e);
  });
}

export async function saveFile(name: string, file: File | null): Promise<void> {
  return saveData(name, file);
}

export async function loadFile(name: string): Promise<File | null> {
  const value = await loadData<unknown>(name);
  return value instanceof File ? value : null;
}

export async function saveFiles(name: string, files: File[]): Promise<void> {
  return saveData(name, files);
}

export async function loadFiles(name: string): Promise<File[] | null> {
  const value = await loadData<unknown>(name);
  if (!Array.isArray(value)) return null;
  return value.filter((entry): entry is File => entry instanceof File);
}

export async function saveFileLocal(name: string, file: File | null): Promise<void[]> {
  return Promise.all(ENV_KEYS.map(x => saveFile(`local:generator:${x}:${name}`, file)));
}

export async function loadFileLocal(name: string): Promise<File | null> {
  for (const e of ENV_KEYS) {
    const file = await loadFile(`local:generator:${e}:${name}`);
    if (file) return file;
  }
  return null;
}

export async function saveFilesLocal(name: string, files: File[]): Promise<void[]> {
  return Promise.all(ENV_KEYS.map(x => saveFiles(`local:generator:${x}:${name}`, files)));
}

export async function loadFilesLocal(name: string): Promise<File[]> {
  for (const e of ENV_KEYS) {
    const files = await loadFiles(`local:generator:${e}:${name}`);
    if (files !== null) return files;
  }
  return [];
}
