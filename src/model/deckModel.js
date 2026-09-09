/**
 * The deck document. Everything the editor touches lives in this plain
 * JSON shape; the presenter turns it into reveal.js <section>s.
 *
 * doc   { title, slides: Slide[] }
 * Slide { id, blocks: Block[], bg, transition, autoAnimate, autoslide,
 *         hidden, notes, subslides: Slide[] }        // subslides = vertical
 * Block { id, type, x, y, w, h, content, props, style, fragment,
 *         fragmentIndex, dataId }
 */

let counter = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const FRAGMENT_EFFECTS = [
  '', 'fade-in', 'fade-out', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
  'fade-in-then-out', 'fade-in-then-semi-out', 'current-visible', 'grow', 'shrink', 'strike',
  'semi-fade-out', 'highlight-red', 'highlight-green', 'highlight-blue',
  'highlight-current-red', 'highlight-current-green', 'highlight-current-blue',
];

export const TRANSITIONS = ['', 'none', 'fade', 'slide', 'convex', 'concave', 'zoom'];

export const BG_TYPES = [
  { value: 'none', label: 'Theme default' },
  { value: 'color', label: 'Solid color' },
  { value: 'gradient', label: 'Gradient (CSS)' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'iframe', label: 'Web page' },
];

export const CODE_LANGS = ['python', 'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'html', 'css', 'sql', 'bash', 'json', 'go', 'rust', 'plaintext'];

/** Toolbox entries. `w`/`h` are default sizes in slide pixels. */
export const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: 'H', w: 800, h: 110, content: 'Heading', props: { level: 2 } },
  { type: 'text', label: 'Text', icon: '¶', w: 700, h: 120, content: 'Double-click to edit this text.' },
  { type: 'list', label: 'Bullet list', icon: '•', w: 640, h: 220, content: 'First point\nSecond point\nThird point', props: { ordered: false } },
  { type: 'image', label: 'Image', icon: '▣', w: 480, h: 300, content: '', props: { fit: 'contain' } },
  { type: 'code', label: 'Code', icon: '</>', w: 800, h: 300, content: 'def hello(name):\n    return f"Hello, {name}!"', props: { lang: 'python', lines: '' } },
  { type: 'markdown', label: 'Markdown', icon: 'M↓', w: 700, h: 260, content: '## Markdown\n\n- **bold**, *italic*, `code`\n- [links](https://revealjs.com)' },
  { type: 'math', label: 'Math', icon: '∑', w: 600, h: 120, content: '\\[ \\sigma = \\sqrt{\\frac{1}{N}\\sum_{i=1}^{N}(x_i-\\mu)^2} \\]' },
  { type: 'video', label: 'Video', icon: '▶', w: 640, h: 360, content: '', props: { autoplay: false, loop: false, muted: false, controls: true } },
  { type: 'iframe', label: 'Web page', icon: '⧉', w: 800, h: 500, content: 'https://revealjs.com' },
  { type: 'box', label: 'Box', icon: '▭', w: 300, h: 160, content: '', style: { bg: '#2a9d8f' } },
];

export const DEFAULT_STYLE = { fontSize: '', color: '', align: '', opacity: 1, bg: '', padding: 0, radius: 0 };

export function newBlock(type, x, y) {
  const def = BLOCK_TYPES.find((b) => b.type === type) || BLOCK_TYPES[1];
  return {
    id: uid('b'),
    type: def.type,
    x: Math.round(x ?? 80),
    y: Math.round(y ?? 80),
    w: def.w,
    h: def.h,
    content: def.content,
    props: { ...(def.props || {}) },
    style: { ...DEFAULT_STYLE, ...(def.style || {}) },
    fragment: '',
    fragmentIndex: null,
    dataId: '',
  };
}

export function newSlide(partial = {}) {
  return {
    id: uid('s'),
    blocks: [],
    bg: { type: 'none', value: '', opacity: 1 },
    transition: '',
    autoAnimate: false,
    autoslide: 0,
    hidden: false,
    notes: '',
    subslides: [],
    ...partial,
  };
}

export function newDoc(title = 'Untitled deck') {
  const s = newSlide();
  s.blocks.push({ ...newBlock('heading', 80, 260), w: 800, content: title });
  return { title, slides: [s] };
}

/** Deep clone a slide with fresh ids (for duplicate). */
export function cloneSlide(slide) {
  const copy = structuredClone(slide);
  copy.id = uid('s');
  copy.blocks.forEach((b) => { b.id = uid('b'); });
  copy.subslides = copy.subslides.map(cloneSlide);
  return copy;
}

export function getSlide(doc, h, v = 0) {
  const top = doc.slides[h];
  if (!top) return null;
  return v === 0 ? top : top.subslides[v - 1] || null;
}

/** Runs `fn(slide)` on the slide at (h, v) inside a cloned doc and returns the clone. */
export function withSlide(doc, h, v, fn) {
  const next = structuredClone(doc);
  const s = getSlide(next, h, v);
  if (s) fn(s, next);
  return next;
}

// ── starter deck ────────────────────────────────────────────────────
const SVG_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#2d6cdf"/><stop offset="1" stop-color="#8e2de2"/></linearGradient></defs>
       <rect width="640" height="360" fill="url(#g)"/>
       <circle cx="480" cy="110" r="60" fill="#ffd166"/>
       <polygon points="0,360 200,180 320,280 420,220 640,360" fill="#1b1f3a"/>
     </svg>`
  );

function b(type, x, y, w, h, content, extra = {}) {
  const blk = newBlock(type, x, y);
  return { ...blk, w, h, content: content ?? blk.content, ...extra, props: { ...blk.props, ...(extra.props || {}) }, style: { ...blk.style, ...(extra.style || {}) } };
}

export function starterDoc() {
  return {
    title: "Jonathan's Studio",
    slides: [
      newSlide({
        bg: { type: 'gradient', value: 'linear-gradient(135deg, #1b2a49 0%, #0f4c81 60%, #2e86ab 100%)', opacity: 1 },
        notes: 'Speaker notes live in the Slide panel. Press S while presenting.',
        blocks: [
          b('heading', 40, 200, 880, 110, "Jonathan's Studio", { props: { level: 1 }, style: { fontSize: '0.8em' } }),
          b('text', 130, 350, 700, 120, 'Drag things around. Double-click text to edit. Present when ready.'),
        ],
      }),
      newSlide({
        blocks: [
          b('heading', 80, 60, 800, 90, 'Fragments'),
          b('list', 130, 180, 700, 260, 'Each block can be a fragment\nPick the effect in the block panel\nSet an index to control order', {}),
          b('text', 130, 470, 700, 80, 'This line fades up last.', { fragment: 'fade-up', style: { fontSize: '0.7em' } }),
        ],
      }),
      newSlide({
        blocks: [
          b('heading', 80, 40, 800, 90, 'Code'),
          b('code', 80, 150, 800, 380, 'def binary_search(items, target):\n    lo, hi = 0, len(items) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if items[mid] == target:\n            return mid\n        if items[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1', { props: { lang: 'python', lines: '1|3-4|5-6|11' } }),
        ],
        subslides: [
          newSlide({
            blocks: [
              b('heading', 80, 60, 800, 90, 'Vertical slide'),
              b('text', 130, 200, 700, 120, 'This lives under "Code". Add more with Slide → Add vertical slide.'),
            ],
          }),
        ],
      }),
      newSlide({
        blocks: [
          b('heading', 80, 40, 800, 90, 'Pictures & markdown'),
          b('image', 60, 160, 420, 300, SVG_IMAGE),
          b('markdown', 500, 160, 420, 360, '### Markdown block\n\n- rendered with **marked**\n- supports `inline code`\n- and [links](https://revealjs.com)\n\nDrop an image file anywhere on the canvas to add it.', { style: { fontSize: '0.6em' } }),
        ],
      }),
      newSlide({
        autoAnimate: true,
        blocks: [
          b('heading', 80, 60, 800, 90, 'Auto-animate'),
          b('box', 120, 260, 120, 120, '', { dataId: 'box', style: { bg: '#e63946', radius: 8 } }),
          b('text', 130, 470, 700, 80, 'Same data-id on the next slide → it tweens.', { style: { fontSize: '0.7em' } }),
        ],
      }),
      newSlide({
        autoAnimate: true,
        blocks: [
          b('heading', 80, 60, 800, 90, 'Auto-animate'),
          b('box', 520, 200, 320, 320, '', { dataId: 'box', style: { bg: '#457b9d', radius: 160 } }),
          b('math', 80, 300, 420, 120, '\\[ \\hat{y} = \\operatorname{softmax}(Wx + b) \\]'),
        ],
      }),
    ],
  };
}
