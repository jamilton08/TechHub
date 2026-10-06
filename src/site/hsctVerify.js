/**
 * Opens result files (.hsct) and save files (.hsctsave) made by the HSCT
 * lesson kit (lesson-template/hsct-lesson.js). The kit wraps a random
 * AES-256-GCM key with the teacher's RSA-OAEP public key (`key` on a result,
 * `tkey` on a save — a save's `key` is the student-side copy the lesson
 * itself can open); the header travels in the clear and is authenticated as
 * AES-GCM additional data. Only the private key can open a file here, and
 * any edit to the header or body makes decryption fail.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();
const CRYPTO_KEYS = new Set(['key', 'kiv', 'tkey', 'iv', 'data']);
export const isSave = (env) => Boolean(env && env.kind === 'save');
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

const b64d = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

export const hasCrypto = () => Boolean(window.crypto && crypto.subtle);

export async function importPrivateKey(jwk) {
  const obj = typeof jwk === 'string' ? JSON.parse(jwk) : jwk;
  if (!obj || obj.kty !== 'RSA' || !obj.d) throw new Error('That is not an RSA private key (expected a JWK with "kty": "RSA" and a "d" field).');
  return crypto.subtle.importKey('jwk', obj, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['unwrapKey']);
}

/** Make a fresh teacher key pair. Returns compact JWKs ready to paste. */
export async function generateKeyPair() {
  const kp = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['wrapKey', 'unwrapKey']
  );
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const priv = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return {
    publicJwk: { kty: 'RSA', n: pub.n, e: pub.e, alg: 'RSA-OAEP-256', ext: true },
    privateJwk: priv,
  };
}

/** Pull every envelope out of a blob of text: a file, or codes pasted one per line. */
export function parseEnvelopes(text) {
  const out = [];
  const push = (o) => { if (o && typeof o === 'object' && o.hsct === 1 && o.data) out.push(o); };
  const t = String(text || '').trim();
  if (!t) return out;
  try {
    const whole = JSON.parse(t);
    if (Array.isArray(whole)) whole.forEach(push); else push(whole);
    if (out.length) return out;
  } catch { /* not one JSON document — scan for several */ }
  let i = 0;
  while ((i = t.indexOf('{"hsct"', i)) !== -1) {
    let depth = 0, inStr = false, escNext = false, j = i;
    for (; j < t.length; j++) {
      const c = t[j];
      if (inStr) { if (escNext) escNext = false; else if (c === '\\') escNext = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
    }
    try { push(JSON.parse(t.slice(i, j))); } catch { /* skip */ }
    i = j;
  }
  return out;
}

async function badgeOf(payloadWithoutBadge) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(payloadWithoutBadge)));
  const bytes = new Uint8Array(hash);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * Open one envelope — a finished result or an in-progress save. Never throws; returns
 *   { ok: true, payload, envelope, save } or { ok: false, error, envelope, save }.
 * `save` is true for a save file; its payload has `state`, `saved`, `n`, `summary`
 * instead of `finished`, `score`, `sections`, `tier`.
 */
export async function openResult(envelope, privateKey) {
  const save = isSave(envelope);
  try {
    /* the header is every clear field, in envelope order — exactly what the kit authenticated */
    const header = {};
    for (const k of Object.keys(envelope)) if (!CRYPTO_KEYS.has(k)) header[k] = envelope[k];
    const wrapped = save ? envelope.tkey : envelope.key;
    if (!wrapped) return { ok: false, error: 'No teacher key in this file', envelope, save };
    const aes = await crypto.subtle.unwrapKey('raw', b64d(wrapped), privateKey, { name: 'RSA-OAEP' }, { name: 'AES-GCM' }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64d(envelope.iv), additionalData: enc.encode(JSON.stringify(header)) },
      aes, b64d(envelope.data)
    );
    const payload = JSON.parse(dec.decode(plain));
    if (save) {
      const { id, ...rest } = payload;
      const expect = await badgeOf(rest);
      if (id !== envelope.id || id !== expect) return { ok: false, error: 'Save id does not match the contents', envelope, save };
    } else {
      const { badge, ...rest } = payload;
      const expect = await badgeOf(rest);
      if (badge !== envelope.badge || badge !== expect) return { ok: false, error: 'Badge code does not match the contents', envelope, save };
    }
    return { ok: true, payload, envelope, save };
  } catch (e) {
    const msg = /OperationError|decrypt|unwrap/i.test(String(e && (e.name || e.message)))
      ? 'Could not open: wrong key, or the file was changed after it was made'
      : (e && e.message) || String(e);
    return { ok: false, error: msg, envelope, save };
  }
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m) return `${m} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}

export function toCsv(rows) {
  const cols = ['student', 'lesson', 'title', 'kind', 'finished', 'seconds', 'activeSeconds', 'earned', 'possible', 'percent', 'tier', 'resumes', 'badge', 'status', 'file'];
  const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\r\n');
}

export const downloadText = (name, text, type = 'text/plain') => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

export { b64 };
