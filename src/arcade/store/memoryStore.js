/**
 * Last-resort store when the browser won't allow IndexedDB (some private
 * windows, locked-down profiles). Works for this tab only.
 */
import { portable, summary } from './model.js';

const projects = new Map();
const blobs = new Map();

export const memoryStore = {
  kind: 'memory',
  async list() { return [...projects.values()].map(summary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); },
  async get(id) { const p = projects.get(id); return p ? { ...structuredClone(p), isOwner: true } : null; },
  async create(project) { const p = { ...portable(project), version: 1, updatedAt: new Date().toISOString() }; projects.set(p.id, p); return { ...p, isOwner: true }; },
  async save(project) {
    const p = { ...portable(project), version: (project.version || 0) + 1, updatedAt: new Date().toISOString() };
    if (projects.has(p.id)) p.assets = projects.get(p.id).assets;
    projects.set(p.id, p);
    return { ...structuredClone(p), isOwner: true };
  },
  async remove(id) { projects.delete(id); for (const k of blobs.keys()) if (k.startsWith(`${id}/`)) blobs.delete(k); },
  async putAsset(id, name, blob) {
    const p = projects.get(id);
    blobs.set(`${id}/${name}`, blob);
    p.assets = [...p.assets.filter((a) => a.name !== name), { name, type: blob.type, size: blob.size }];
    return { ...structuredClone(p), isOwner: true };
  },
  async removeAsset(id, name) {
    const p = projects.get(id);
    blobs.delete(`${id}/${name}`);
    p.assets = p.assets.filter((a) => a.name !== name);
    return { ...structuredClone(p), isOwner: true };
  },
  async getAssetBlob(id, asset) { const b = blobs.get(`${id}/${asset.name}`); if (!b) throw new Error('missing'); return b; },
};
