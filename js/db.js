// IndexedDB aikuisen tekemille äänityksille. Data tallennetaan ArrayBufferina,
// koska se toimii luotettavimmin Safarissa.

const DB_NAME = 'tavusaari';
const STORE = 'sounds';
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getSound = (key) => run('readonly', (s) => s.get(key)).catch(() => null);
export const putSound = (key, data, mime) => run('readwrite', (s) => s.put({ key, data, mime, at: Date.now() }));
export const deleteSound = (key) => run('readwrite', (s) => s.delete(key));
export const listSoundKeys = () => run('readonly', (s) => s.getAllKeys()).catch(() => []);
