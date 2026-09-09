/**
 * Declarative navbar menus.
 *
 * Every item gets a `ctx` object:
 *   ctx.deck        — the live Reveal instance
 *   ctx.config      — mirror of the current reveal config (React state)
 *   ctx.setOption   — (key, value) → updates state and calls deck.configure()
 *   ctx.live        — { h, v, total, isOverview, isPaused, isAutoSliding, isScrollView }
 *   ctx.theme / ctx.setTheme / ctx.codeTheme / ctx.setCodeTheme
 *   ctx.notify(msg) — small toast
 *   ctx.reset()     — reset all settings
 *
 * Item types:
 *   action  { label, key?, run(ctx), disabled?(ctx) }
 *   toggle  { label, key?, isOn(ctx), apply(ctx) }
 *   radio   { label, isActive(ctx), apply(ctx) }
 *   select  { label, value(ctx), choices:[{value,label}], apply(ctx, v) }
 *   number  { label, value(ctx), min, max, step, apply(ctx, v) }
 *   goto    { }                     — h / v inputs + Go button
 *   heading { label }               — non-interactive sub-heading
 *   sep     {}                      — divider
 */
import { THEMES, CODE_THEMES } from '../deck/themes.js';

// ── helpers ──────────────────────────────────────────────────────────
const sep = { type: 'sep' };
const heading = (label) => ({ type: 'heading', label });
const action = (label, run, key, extra = {}) => ({ type: 'action', label, run, key, ...extra });

const optToggle = (key, label, hint) => ({
  type: 'toggle',
  label,
  key: hint,
  isOn: (ctx) => Boolean(ctx.config[key]),
  apply: (ctx) => ctx.setOption(key, !ctx.config[key]),
});

const optRadio = (key, label, value) => ({
  type: 'radio',
  label,
  isActive: (ctx) => ctx.config[key] === value,
  apply: (ctx) => ctx.setOption(key, value),
});

const optSelect = (key, label, choices) => ({
  type: 'select',
  label,
  choices,
  value: (ctx) => String(ctx.config[key]),
  apply: (ctx, v) => {
    const match = choices.find((c) => String(c.value) === v);
    ctx.setOption(key, match ? match.value : v);
  },
});

const optNumber = (key, label, min, max, step) => ({
  type: 'number',
  label,
  min,
  max,
  step,
  value: (ctx) => ctx.config[key],
  apply: (ctx, v) => ctx.setOption(key, v),
});

const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom'];

// ── menus ────────────────────────────────────────────────────────────
// `modes` = which app modes the menu shows in. Menus without `alwaysOn`
// are disabled until a reveal deck is running (present mode).
export const MENUS = [
  {
    id: 'file',
    label: 'File',
    modes: ['edit', 'present'],
    alwaysOn: true,
    items: [
      action('Present', (c) => c.setMode('present'), 'F5', { hideIn: 'present' }),
      action('Back to editor', (c) => c.setMode('edit'), undefined, { hideIn: 'edit' }),
      sep,
      action('Undo', (c) => c.undo(), 'Ctrl+Z', { disabled: (c) => !c.canUndo }),
      action('Redo', (c) => c.redo(), 'Ctrl+Y', { disabled: (c) => !c.canRedo }),
      sep,
      action('New deck', (c) => c.file.newDeck()),
      action('Load starter deck', (c) => c.file.loadStarter()),
      action('Import deck (.json)…', (c) => c.file.importJson()),
      sep,
      action('Download deck (.json)', (c) => c.file.exportJson()),
      action('Download standalone .html', (c) => c.file.exportHtml()),
      heading('The .html file runs on its own — put it on any web host and share the link.'),
    ],
  },
  {
    id: 'navigate',
    label: 'Navigate',
    modes: ['present'],
    items: [
      action('First slide', (c) => c.deck.slide(0, 0), 'Home'),
      action('Previous', (c) => c.deck.prev(), '←'),
      action('Next', (c) => c.deck.next(), '→'),
      action('Last slide', (c) => c.deck.slide(c.deck.getHorizontalSlides().length - 1), 'End'),
      sep,
      action('Left', (c) => c.deck.left(), 'H'),
      action('Right', (c) => c.deck.right(), 'L'),
      action('Up', (c) => c.deck.up(), 'K'),
      action('Down', (c) => c.deck.down(), 'J'),
      sep,
      action('Previous fragment', (c) => c.deck.prevFragment()),
      action('Next fragment', (c) => c.deck.nextFragment()),
      sep,
      { type: 'goto' },
    ],
  },
  {
    id: 'view',
    modes: ['present'],
    label: 'View',
    items: [
      {
        type: 'toggle',
        label: 'Overview',
        key: 'O',
        isOn: (c) => c.live.isOverview,
        apply: (c) => c.deck.toggleOverview(),
      },
      {
        type: 'toggle',
        label: 'Pause (black screen)',
        key: 'B',
        isOn: (c) => c.live.isPaused,
        apply: (c) => c.deck.togglePause(),
      },
      {
        type: 'toggle',
        label: 'Scroll view',
        key: 'R',
        isOn: (c) => c.live.isScrollView,
        apply: (c) => c.deck.toggleScrollView(),
      },
      action('Fullscreen', (c) => c.fullscreen(), 'F'),
      action('Speaker notes', (c) => c.deck.getPlugin('notes')?.open(), 'S'),
      action('Jump to slide…', (c) => c.deck.toggleJumpToSlide(), 'G'),
      action('Search…', (c) => c.deck.getPlugin('search')?.toggle(), 'Ctrl+Shift+F'),
      action('Keyboard shortcuts', (c) => c.deck.toggleHelp(), '?'),
      sep,
      heading('Alt+click (or Ctrl+click on Linux) zooms into part of a slide'),
      sep,
      action('Re-sync layout', (c) => { c.deck.sync(); c.deck.layout(); }),
    ],
  },
  {
    id: 'theme',
    modes: ['edit', 'present'],
    alwaysOn: true,
    label: 'Theme',
    items: [
      ...THEMES.map((t) => ({
        type: 'radio',
        label: t.label,
        isActive: (c) => c.theme === t.id,
        apply: (c) => c.setTheme(t.id),
      })),
      sep,
      heading('Code theme'),
      ...CODE_THEMES.map((t) => ({
        type: 'radio',
        label: t.label,
        isActive: (c) => c.codeTheme === t.id,
        apply: (c) => c.setCodeTheme(t.id),
      })),
    ],
  },
  {
    id: 'transition',
    modes: ['present'],
    label: 'Transition',
    items: [
      heading('Slide transition'),
      ...TRANSITIONS.map((t) => optRadio('transition', t[0].toUpperCase() + t.slice(1), t)),
      optSelect('transitionSpeed', 'Speed', [
        { value: 'default', label: 'Default' },
        { value: 'fast', label: 'Fast' },
        { value: 'slow', label: 'Slow' },
      ]),
      sep,
      optSelect('backgroundTransition', 'Background transition', TRANSITIONS.map((t) => ({ value: t, label: t }))),
      sep,
      heading('Auto-animate'),
      optToggle('autoAnimate', 'Enabled'),
      optSelect('autoAnimateEasing', 'Easing', [
        { value: 'ease', label: 'ease' },
        { value: 'ease-in', label: 'ease-in' },
        { value: 'ease-out', label: 'ease-out' },
        { value: 'ease-in-out', label: 'ease-in-out' },
        { value: 'linear', label: 'linear' },
      ]),
      optNumber('autoAnimateDuration', 'Duration (s)', 0.1, 5, 0.1),
      optToggle('autoAnimateUnmatched', 'Animate unmatched elements'),
    ],
  },
  {
    id: 'playback',
    modes: ['present'],
    label: 'Playback',
    items: [
      heading('Auto-slide every'),
      optRadio('autoSlide', 'Off', 0),
      optRadio('autoSlide', '2 seconds', 2000),
      optRadio('autoSlide', '5 seconds', 5000),
      optRadio('autoSlide', '10 seconds', 10000),
      optRadio('autoSlide', '30 seconds', 30000),
      {
        type: 'toggle',
        label: 'Auto-slide running',
        key: 'A',
        isOn: (c) => c.live.isAutoSliding,
        apply: (c) => c.deck.toggleAutoSlide(),
        disabled: (c) => !c.config.autoSlide,
      },
      optToggle('autoSlideStoppable', 'Stop on user input'),
      sep,
      optToggle('loop', 'Loop deck'),
      action('Shuffle slides now', (c) => { c.deck.shuffle(); c.deck.sync(); c.deck.slide(0); }),
      sep,
      optSelect('autoPlayMedia', 'Autoplay media', [
        { value: null, label: 'Per element' },
        { value: true, label: 'Always' },
        { value: false, label: 'Never' },
      ]),
      optSelect('preloadIframes', 'Preload iframes', [
        { value: null, label: 'Per element' },
        { value: true, label: 'Always' },
        { value: false, label: 'Never' },
      ]),
    ],
  },
  {
    id: 'display',
    modes: ['present'],
    label: 'Display',
    items: [
      optToggle('controls', 'Arrow controls'),
      optSelect('controlsLayout', 'Controls position', [
        { value: 'bottom-right', label: 'Bottom right' },
        { value: 'edges', label: 'Screen edges' },
      ]),
      optSelect('controlsBackArrows', 'Back arrows', [
        { value: 'faded', label: 'Faded' },
        { value: 'hidden', label: 'Hidden' },
        { value: 'visible', label: 'Visible' },
      ]),
      optToggle('controlsTutorial', 'Bounce arrow hint on first slide'),
      sep,
      optToggle('progress', 'Progress bar'),
      optSelect('slideNumber', 'Slide number', [
        { value: false, label: 'Off' },
        { value: true, label: 'h.v' },
        { value: 'h/v', label: 'h/v' },
        { value: 'c', label: 'Current' },
        { value: 'c/t', label: 'Current / total' },
      ]),
      optSelect('showSlideNumber', 'Show number in', [
        { value: 'all', label: 'All views' },
        { value: 'print', label: 'Print only' },
        { value: 'speaker', label: 'Speaker view only' },
      ]),
      sep,
      optToggle('center', 'Vertically center content'),
      optToggle('rtl', 'Right-to-left'),
      optSelect('navigationMode', 'Navigation mode', [
        { value: 'default', label: 'Default (↓ for vertical)' },
        { value: 'linear', label: 'Linear (← → walks everything)' },
        { value: 'grid', label: 'Grid (keeps vertical index)' },
      ]),
      sep,
      optToggle('fragments', 'Fragments'),
      optToggle('fragmentInURL', 'Fragment index in URL'),
      optToggle('previewLinks', 'Preview links in overlay'),
      optToggle('showNotes', 'Show notes on slide'),
      optToggle('hideInactiveCursor', 'Hide idle cursor'),
      sep,
      optToggle('keyboard', 'Keyboard shortcuts'),
      optToggle('touch', 'Touch navigation'),
      optToggle('mouseWheel', 'Mouse wheel navigation'),
      optToggle('overview', 'Allow overview'),
      optToggle('help', 'Allow ? help overlay'),
      optToggle('pause', 'Allow B pause'),
      sep,
      optToggle('showHiddenSlides', 'Show hidden slides (reload)'),
      optToggle('hash', 'Slide index in URL hash (reload)'),
      optToggle('history', 'Browser history per slide (reload)'),
    ],
  },
  {
    id: 'layout',
    modes: ['edit', 'present'],
    alwaysOn: true,
    label: 'Size',
    items: [
      heading('Slide canvas'),
      ...[
        [960, 700, '960 × 700 (default)'],
        [1024, 768, '1024 × 768 (4:3)'],
        [1280, 720, '1280 × 720 (16:9)'],
        [1920, 1080, '1920 × 1080 (16:9 HD)'],
      ].map(([w, h, label]) => ({
        type: 'radio',
        label,
        isActive: (c) => c.config.width === w && c.config.height === h,
        apply: (c) => c.setOptions({ width: w, height: h }),
      })),
      optSelect('margin', 'Margin', [
        { value: 0, label: '0' },
        { value: 0.04, label: '4% (default)' },
        { value: 0.1, label: '10%' },
        { value: 0.2, label: '20%' },
      ]),
      optNumber('minScale', 'Min scale', 0.1, 1, 0.1),
      optNumber('maxScale', 'Max scale', 1, 5, 0.5),
      sep,
      heading('Scroll view'),
      optSelect('scrollLayout', 'Layout', [
        { value: 'full', label: 'Full (one slide per screen)' },
        { value: 'compact', label: 'Compact' },
      ]),
      optSelect('scrollSnap', 'Snap', [
        { value: 'mandatory', label: 'Mandatory' },
        { value: 'proximity', label: 'Proximity' },
        { value: false, label: 'Off' },
      ]),
      optSelect('scrollProgress', 'Scroll progress bar', [
        { value: 'auto', label: 'Auto' },
        { value: true, label: 'On' },
        { value: false, label: 'Off' },
      ]),
      sep,
      optNumber('viewDistance', 'Preload distance (slides)', 1, 10, 1),
    ],
  },
  {
    id: 'export',
    modes: ['present'],
    label: 'Export',
    items: [
      action('Print / save as PDF…', (c) => c.openPrintView()),
      optToggle('pdfSeparateFragments', 'One PDF page per fragment'),
      sep,
      action('Copy link to this slide', (c) => c.copy(window.location.href, 'Link copied')),
      action('Copy deck state (JSON)', (c) => c.copy(JSON.stringify(c.deck.getState()), 'State copied')),
      sep,
      action('Reset all settings', (c) => c.reset()),
    ],
  },
];
