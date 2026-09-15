/**
 * Opens result files made by the HSCT lesson kit (lesson-template/hsct-lesson.js).
 * The kit wraps a random AES-256-GCM key with the teacher's RSA-OAEP public
 * key; the header travels in the clear and is authenticated as AES-GCM
 * additional data. Only the private key can open a file, and any edit to
 * the header or body makes decryption fail.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();
const HEADER_KEYS = ['hsct', 'kit', 'lesson', 'title', 'student', 'finished', 'badge'];
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
 * Open one envelope. Never throws; returns
 *   { ok: true, payload, envelope } or { ok: false, error, envelope }.
 */
export async function openResult(envelope, privateKey) {
  try {
    const header = {};
    for (const k of HEADER_KEYS) header[k] = envelope[k];
    const aes = await crypto.subtle.unwrapKey('raw', b64d(envelope.key), privateKey, { name: 'RSA-OAEP' }, { name: 'AES-GCM' }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64d(envelope.iv), additionalData: enc.encode(JSON.stringify(header)) },
      aes, b64d(envelope.data)
    );
    const payload = JSON.parse(dec.decode(plain));
    const { badge, ...rest } = payload;
    const expect = await badgeOf(rest);
    if (badge !== envelope.badge || badge !== expect) return { ok: false, error: 'Badge code does not match the contents', envelope };
    return { ok: true, payload, envelope };
  } catch (e) {
    const msg = /OperationError|decrypt|unwrap/i.test(String(e && (e.name || e.message)))
      ? 'Could not open: wrong key, or the file was changed after it was made'
      : (e && e.message) || String(e);
    return { ok: false, error: msg, envelope };
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
  const cols = ['student', 'lesson', 'title', 'finished', 'seconds', 'activeSeconds', 'earned', 'possible', 'percent', 'tier', 'badge', 'status', 'file'];
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
