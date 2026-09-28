/**
 * Projects saved in this browser (IndexedDB). Same interface as apiStore.js,
 * so the page doesn't care which one it's talking to.
 *
 * Two object stores: "projects" (the project JSON, assets listed by name)
 * and "blobs" (the asset bytes, keyed "<projectId>/<name>").
 */
import { portable, summary } from './model.js';

const DB_NAME = 'hsct-arcade';
const DB_VERSION = 1;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('This browser can’t store projects (no IndexedDB).')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open browser storage.'));
    req.onblocked = () => reject(new Error('Close other Python Arcade tabs and reload.'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function tx(stores, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then((r) => { result = r; }, reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage transaction aborted'));
  }));
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const blobKey = (projectId, name) => `${projectId}/${name}`;

export const localStore = {
  kind: 'browser',

  async list() {
    const all = await tx(['projects'], 'readonly', (t) => req(t.objectStore('projects').getAll()));
    return all.map(summary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },

  async get(id) {
    const p = await tx(['projects'], 'readonly', (t) => req(t.objectStore('projects').get(id)));
    if (!p) return null;
    return { ...portable(p), isOwner: true };
  },

  async create(project) {
    const p = { ...portable(project), version: 1, updatedAt: new Date().toISOString() };
    await tx(['projects'], 'readwrite', (t) => req(t.objectStore('projects').put(p)));
    return { ...p, isOwner: true };
  },

  /** Saves title, entry and files. Assets are only changed by putAsset/removeAsset,
   *  so an autosave that races an upload can't drop the new asset. */
  async save(project) {
    return tx(['projects'], 'readwrite', async (t) => {
      const existing = await req(t.objectStore('projects').get(project.id));
      const p = {
        ...portable(project),
        assets: existing ? existing.assets || [] : portable(project).assets,
        version: (project.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      t.objectStore('projects').put(p);
      return { ...p, isOwner: true };
    });
  },

  async remove(id) {
    await tx(['projects', 'blobs'], 'readwrite', async (t) => {
      const p = await req(t.objectStore('projects').get(id));
      for (const a of p?.assets || []) t.objectStore('blobs').delete(blobKey(id, a.name));
      t.objectStore('projects').delete(id);
    });
  },

  /** Store an asset's bytes and list it on the project. Returns the updated project. */
  async putAsset(projectId, name, blob) {
    const meta = { name, type: blob.type || 'application/octet-stream', size: blob.size };
    return tx(['projects', 'blobs'], 'readwrite', async (t) => {
      const p = await req(t.objectStore('projects').get(projectId));
      if (!p) throw new Error('Project not found');
      t.objectStore('blobs').put(blob, blobKey(projectId, name));
      p.assets = [...(p.assets || []).filter((a) => a.name !== name), meta];
      p.updatedAt = new Date().toISOString();
      t.objectStore('projects').put(p);
      return { ...portable(p), isOwner: true };
    });
  },

  async removeAsset(projectId, name) {
    return tx(['projects', 'blobs'], 'readwrite', async (t) => {
      const p = await req(t.objectStore('projects').get(projectId));
      t.objectStore('blobs').delete(blobKey(projectId, name));
      if (!p) return null;
      p.assets = (p.assets || []).filter((a) => a.name !== name);
      p.updatedAt = new Date().toISOString();
      t.objectStore('projects').put(p);
      return { ...portable(p), isOwner: true };
    });
  },

  async getAssetBlob(projectId, asset) {
    const blob = await tx(['blobs'], 'readonly', (t) => req(t.objectStore('blobs').get(blobKey(projectId, asset.name))));
    if (!blob) throw new Error(`Missing asset ${asset.name}`);
    return blob;
  },
};
