/**
 * The shape of a Python Arcade project. This is also the JSON the Django
 * API sends and receives (backend/arcade/serializers.py), so a project moves
 * between "saved in this browser" and "saved to your account" unchanged.
 *
 *   {
 *     id: "uuid",                  // made by the browser, kept by the server
 *     title: "Dodge the blocks",
 *     entry: "main.py",            // the file Run starts
 *     files:  [{ name: "main.py", content: "import pygame…" }],   // code + text files
 *     assets: [{ name: "ship.png", type: "image/png", size: 1834, url? }], // binary files
 *     remixOf: "uuid" | null,
 *     version: 3,                  // bumps on every save (server uses it to spot conflicts)
 *     createdAt, updatedAt,        // ISO strings
 *     // server only: visibility ("private" | "unlisted" | "public"), isOwner
 *   }
 */

export const LIMITS = {
  files: 30,
  fileChars: 200_000,
  assets: 40,
  assetBytes: 5 * 1024 * 1024,
  projectAssetBytes: 25 * 1024 * 1024,
  titleChars: 80,
};

const TEXT_EXT = ['py', 'txt', 'json', 'csv', 'md'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
const SOUND_EXT = ['wav', 'mp3', 'ogg', 'm4a'];
const FONT_EXT = ['ttf', 'otf', 'woff', 'woff2'];

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
};

export const extOf = (name) => (String(name).match(/\.([A-Za-z0-9]+)$/)?.[1] || '').toLowerCase();

export function kindOf(name) {
  const ext = extOf(name);
  if (ext === 'py') return 'code';
  if (TEXT_EXT.includes(ext)) return 'text';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (SOUND_EXT.includes(ext)) return 'sound';
  if (FONT_EXT.includes(ext)) return 'font';
  return null;
}

export const isTextName = (name) => ['code', 'text'].includes(kindOf(name));
export const isAssetName = (name) => ['image', 'sound', 'font'].includes(kindOf(name));
export const mimeOf = (name) => MIME[extOf(name)] || 'application/octet-stream';
export const ACCEPT_UPLOADS = [...TEXT_EXT, ...IMAGE_EXT, ...SOUND_EXT, ...FONT_EXT].map((e) => `.${e}`).join(',');

/** Why a file name won't work, or null if it's fine. */
export function nameProblem(name, taken = []) {
  const n = String(name || '');
  if (!n) return 'Give the file a name.';
  if (n.length > 60) return 'That name is too long.';
  if (/[\\/]/.test(n)) return 'File names can’t contain slashes — every file lives in the project folder.';
  const kind = kindOf(n);
  if (!kind) return `Use one of these endings: .${TEXT_EXT.join(', .')} (code and text), or an image, sound or font.`;
  if (kind === 'code' && !/^[A-Za-z_][A-Za-z0-9_]*\.py$/.test(n)) {
    return 'Python file names can only use letters, numbers and _ and can’t start with a number (so you can import them).';
  }
  if (kind !== 'code' && !/^[A-Za-z0-9_][A-Za-z0-9_. -]*$/.test(n)) return 'Use letters, numbers, spaces, - and _ only.';
  if (['pygame.py', 'random.py', 'math.py', 'time.py', 'json.py', 'sys.py', 'os.py'].includes(n.toLowerCase())) {
    return `A file called ${n} would hide Python’s own ${n.slice(0, -3)} module. Pick another name.`;
  }
  if (taken.some((t) => t.toLowerCase() === n.toLowerCase())) return 'There’s already a file with that name.';
  return null;
}

/** Make an uploaded file's name usable (spaces → _, keep the extension). */
export function cleanUploadName(name) {
  const ext = extOf(name);
  let stem = String(name).replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_\- ]+/g, '').trim().replace(/\s+/g, '_');
  if (kindOf(name) === 'code') {
    stem = stem.replace(/-/g, '_');
    if (!/^[A-Za-z_]/.test(stem)) stem = `file_${stem}`;
  }
  return `${stem || 'file'}.${ext}`;
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

export const STARTER_GAME = `import pygame

pygame.init()
screen = pygame.display.set_mode((800, 500))
pygame.display.set_caption("My Game")
clock = pygame.time.Clock()

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    screen.fill("midnightblue")
    # Draw your game here, for example:
    pygame.draw.circle(screen, "gold", (400, 250), 40)

    pygame.display.flip()
    clock.tick(60)

pygame.quit()
`;

export function newProject({ title = 'Untitled game', files, entry = 'main.py', remixOf = null } = {}) {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    title,
    entry,
    files: files || [{ name: 'main.py', content: STARTER_GAME }],
    assets: [],
    remixOf,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Keep only the fields both stores understand (drops UI-only state). */
export function portable(p) {
  return {
    id: p.id,
    title: String(p.title || 'Untitled game').slice(0, LIMITS.titleChars),
    entry: p.entry || 'main.py',
    files: (p.files || []).map((f) => ({ name: f.name, content: String(f.content ?? '') })),
    assets: (p.assets || []).map(({ name, type, size, url }) => ({ name, type, size, ...(url ? { url } : {}) })),
    remixOf: p.remixOf || null,
    version: p.version || 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export const summary = (p) => ({
  id: p.id, title: p.title, updatedAt: p.updatedAt, createdAt: p.createdAt,
  fileCount: (p.files || []).length + (p.assets || []).length,
});
