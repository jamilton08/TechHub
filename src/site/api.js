/**
 * The TechHub API (Django on Hetzner, api.hsct.tech). See backend/README.md.
 *
 *   VITE_API_BASE=https://api.hsct.tech/api   (Cloudflare Pages → Settings → Variables)
 *
 * Empty = no backend: the catalog comes from lessons.js, /teach says so, and
 * lessons run without teams. On localhost it defaults to the dev server.
 */
import { useCallback, useEffect, useState } from 'react';

const env = import.meta.env;
const local = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const API_BASE = (env.VITE_API_BASE || (local ? 'http://127.0.0.1:8000/api' : '')).replace(/\/+$/, '');
export const HAS_API = Boolean(API_BASE);
/** wss://api.hsct.tech/ws — derived from the API base. */
export const WS_BASE = API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '') + '/ws';

const cookie = (name) => (typeof document === 'undefined' ? '' : document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.slice(name.length + 1) || '');

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

/** fetch with the session cookie and CSRF header; throws ApiError with the server's message. */
export async function api(path, { method = 'GET', body, form } = {}) {
  if (!HAS_API) throw new ApiError('No API configured (VITE_API_BASE).', 0);
  const headers = { Accept: 'application/json' };
  const init = { method, headers, credentials: 'include' };
  if (method !== 'GET') headers['X-CSRFToken'] = decodeURIComponent(cookie('csrftoken'));
  if (form) init.body = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const r = await fetch(API_BASE + path, init);
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    let msg = data && typeof data === 'object' ? (data.detail || firstError(data)) : `Request failed (${r.status})`;
    if (Array.isArray(msg)) msg = msg[0];
    throw new ApiError(String(msg || `Request failed (${r.status})`), r.status, data);
  }
  return data;
}
const firstError = (d) => { for (const k of Object.keys(d)) { const v = d[k]; return `${k}: ${Array.isArray(v) ? v[0] : v}`; } return null; };

/** Teacher session: { user, loading, login(username, password), logout() }. */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(HAS_API);
  useEffect(() => {
    if (!HAS_API) return;
    api('/auth/me/').then((me) => setUser(me.authenticated ? me : null)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  const login = useCallback(async (username, password) => { const me = await api('/auth/login/', { method: 'POST', body: { username, password } }); setUser(me); return me; }, []);
  const logout = useCallback(async () => { await api('/auth/logout/', { method: 'POST' }); setUser(null); }, []);
  return { user, loading, login, logout, isTeacher: Boolean(user && user.isTeacher) };
}

export const fmtDateTime = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return iso; } };
export const fmtAgo = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
