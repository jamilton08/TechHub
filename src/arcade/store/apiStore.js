/**
 * Projects saved to a student's account through the Django API
 * (backend/arcade). Same interface as localStore.js.
 *
 * Auth is Django's session cookie. Writes send the CSRF token from the
 * `csrftoken` cookie (set by GET /arcade/me/). If the API is on another
 * subdomain (api.hsct.tech), Django sets that cookie for `.hsct.tech` so
 * this page can read it — see backend/README.md.
 */
import { API_BASE } from '../config.js';
import { portable } from './model.js';

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function csrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function call(path, { method = 'GET', body, form } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-CSRFToken'] = csrfToken();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageOf(data) || `The server said ${res.status}`, data);
  return data;
}

/** DRF errors come as {detail} or {field: [messages]} — pull out the first readable one. */
function messageOf(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return messageOf(data[0]);
  if (data.detail) return messageOf(data.detail);
  const first = Object.values(data)[0];
  return messageOf(first);
}

const P = (id = '') => `/arcade/projects/${id ? `${encodeURIComponent(id)}/` : ''}`;
const withOwner = (p) => ({ ...p, isOwner: p.isOwner !== false });

export const apiStore = {
  kind: 'account',

  /** { authenticated: bool, userId?, displayName? } — also sets the CSRF cookie. */
  me: () => call('/arcade/me/'),

  async list() {
    const data = await call(P());
    return (Array.isArray(data) ? data : data.results || []).map((p) => ({
      id: p.id, title: p.title, updatedAt: p.updatedAt, createdAt: p.createdAt, fileCount: p.fileCount ?? 0,
      visibility: p.visibility,
    }));
  },

  async get(id) {
    try { return withOwner(await call(P(id))); }
    catch (e) { if (e.status === 404) return null; throw e; }
  },

  async create(project) {
    const { id, title, entry, files, remixOf } = portable(project);
    return withOwner(await call(P(), { method: 'POST', body: { id, title, entry, files, remixOf } }));
  },

  /** Throws ApiError with status 409 if someone saved a newer version (another tab or device). */
  async save(project) {
    const { title, entry, files, version } = portable(project);
    return withOwner(await call(P(project.id), { method: 'PUT', body: { title, entry, files, version } }));
  },

  async setVisibility(id, visibility) {
    return withOwner(await call(P(id), { method: 'PATCH', body: { visibility } }));
  },

  async remix(id) {
    return withOwner(await call(`${P(id)}remix/`, { method: 'POST', body: {} }));
  },

  remove: (id) => call(P(id), { method: 'DELETE' }),

  async putAsset(projectId, name, blob) {
    const form = new FormData();
    form.append('name', name);
    form.append('file', blob, name);
    await call(`${P(projectId)}assets/`, { method: 'POST', form });
    return this.get(projectId);
  },

  async removeAsset(projectId, name) {
    await call(`${P(projectId)}assets/${encodeURIComponent(name)}/`, { method: 'DELETE' });
    return this.get(projectId);
  },

  async getAssetBlob(projectId, asset) {
    // asset.url is a path on the API server ("/api/arcade/projects/…/assets/ship.png/")
    const apiRoot = new URL(`${API_BASE}/`, location.href);
    const url = asset.url ? new URL(asset.url, apiRoot).href
      : `${API_BASE}${P(projectId)}assets/${encodeURIComponent(asset.name)}/`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new ApiError(res.status, `Could not download ${asset.name}`);
    return res.blob();
  },
};
