/**
 * Picks where projects are saved:
 *   no VITE_API_BASE            → this browser (IndexedDB)
 *   API set, not signed in      → this browser, with a "Sign in" button
 *   API set, signed in          → the student's account (Django)
 */
import { API_BASE, LOGIN_URL } from '../config.js';
import { localStore } from './localStore.js';
import { apiStore } from './apiStore.js';

export { localStore, apiStore };

export async function chooseStore() {
  if (!API_BASE) return { store: localStore, where: 'browser', canSignIn: false, me: null };
  try {
    const me = await apiStore.me();
    if (me && me.authenticated) return { store: apiStore, where: 'account', canSignIn: false, me };
    return { store: localStore, where: 'browser', canSignIn: Boolean(LOGIN_URL), me };
  } catch {
    return { store: localStore, where: 'browser', canSignIn: Boolean(LOGIN_URL), me: null, offline: true };
  }
}

export function loginHref() {
  if (!LOGIN_URL) return '';
  const u = new URL(LOGIN_URL, location.href);
  u.searchParams.set('next', location.href);
  return u.href;
}

/**
 * Copy every project saved in this browser into the account, assets included.
 * Leaves the browser copies alone (the page offers to clear them after).
 * Returns { moved: [ids], failed: [{ title, message }] }.
 */
export async function moveLocalToAccount(onProgress) {
  const list = await localStore.list();
  const moved = [];
  const failed = [];
  for (let i = 0; i < list.length; i++) {
    const local = await localStore.get(list[i].id);
    onProgress?.(i, list.length, local.title);
    try {
      // remixOf may point at another browser-only project the server doesn't know
      const body = { ...local, remixOf: null };
      const remote = await apiStore.get(local.id);
      if (!remote) await apiStore.create(body);
      else if (String(local.updatedAt) > String(remote.updatedAt)) await apiStore.save({ ...body, version: remote.version });
      for (const a of local.assets) {
        const blob = await localStore.getAssetBlob(local.id, a);
        await apiStore.putAsset(local.id, a.name, blob);
      }
      moved.push(local.id);
    } catch (e) {
      failed.push({ title: local.title, message: e.message });
    }
  }
  onProgress?.(list.length, list.length, '');
  return { moved, failed };
}
