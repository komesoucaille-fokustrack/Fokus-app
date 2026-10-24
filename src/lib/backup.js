/* Copie de secours automatique dans IndexedDB (au cas où Safari viderait le localStorage) */
import { LABO } from '../env';

const DB = LABO ? 'labo-backup' : 'fokus-backup', STORE = 'kv';

function open() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('indisponible'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function backupWrite(json) {
  try {
    const db = await open();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(json, 'state');
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch { /* sauvegarde de secours indisponible : sans conséquence */ }
}

export async function backupRead() {
  try {
    const db = await open();
    const v = await new Promise((res, rej) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get('state');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return v || null;
  } catch { return null; }
}

let timer;
/* Écriture différée (regroupe les sauvegardes rapprochées) */
export function scheduleBackup(json) {
  clearTimeout(timer);
  timer = setTimeout(() => backupWrite(json), 800);
}

/* Au démarrage : demande un stockage persistant, et restaure la copie si le localStorage a été vidé */
export async function restoreIfNeeded(key) {
  try { await navigator.storage?.persist?.(); } catch { /* non supporté */ }
  let has = false;
  try { has = !!localStorage.getItem(key); } catch { /* stockage indisponible */ }
  if (has) return false;
  const v = await backupRead();
  if (!v) return false;
  try { localStorage.setItem(key, v); return true; } catch { return false; }
}
