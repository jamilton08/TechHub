/**
 * Share links that work with no server: the project's code is compressed
 * into the link itself (#share=…). Opening one gives the visitor their own
 * copy. Images and sounds don't fit in a link — use Download for those.
 * Once the Django API is on, projects get real /play/<id> links instead.
 */
const toB64Url = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (text) => {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const canShareByLink = () => typeof CompressionStream !== 'undefined';

export async function encodeShare(project) {
  const payload = {
    v: 1,
    t: project.title,
    e: project.entry,
    f: project.files.map((f) => [f.name, f.content]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
}

export async function decodeShare(token) {
  const bytes = await pipe(fromB64Url(token), new DecompressionStream('deflate-raw'));
  const p = JSON.parse(new TextDecoder().decode(bytes));
  if (!p || p.v !== 1 || !Array.isArray(p.f)) throw new Error('That share link is damaged.');
  return {
    title: String(p.t || 'Shared game'),
    entry: String(p.e || 'main.py'),
    files: p.f.map(([name, content]) => ({ name: String(name), content: String(content) })),
  };
}

export function shareUrl(token) {
  return `${location.origin}/play#share=${token}`;
}
