// The starting config for the deck. Everything here can be changed live
// from the navbar; the navbar calls deck.configure(patch) and keeps a
// mirror of this object in React state.
export const DEFAULT_CONFIG = {
  // Sizing
  width: 960,
  height: 700,
  margin: 0.04,
  minScale: 0.2,
  maxScale: 2.0,

  // Chrome
  controls: true,
  controlsTutorial: true,
  controlsLayout: 'bottom-right', // bottom-right | edges
  controlsBackArrows: 'faded',    // faded | hidden | visible
  progress: true,
  slideNumber: 'c/t',             // false | true ('h.v') | 'h/v' | 'c' | 'c/t'
  showSlideNumber: 'all',         // all | print | speaker

  // Navigation
  hash: true,
  respondToHashChanges: true,
  history: false,
  keyboard: true,
  overview: true,
  center: true,
  touch: true,
  loop: false,
  rtl: false,
  navigationMode: 'default',      // default | linear | grid
  shuffle: false,
  fragments: true,
  fragmentInURL: true,
  help: true,
  pause: true,
  jumpToSlide: true,
  showNotes: false,
  showHiddenSlides: false,
  mouseWheel: false,
  previewLinks: false,
  hideInactiveCursor: true,
  hideCursorTime: 5000,

  // Media
  autoPlayMedia: null,            // null (per-element) | true | false
  preloadIframes: null,

  // Auto-animate
  autoAnimate: true,
  autoAnimateEasing: 'ease',
  autoAnimateDuration: 1.0,
  autoAnimateUnmatched: true,

  // Auto-slide
  autoSlide: 0,                   // ms, 0 = off
  autoSlideStoppable: true,
  defaultTiming: null,

  // Transitions
  transition: 'slide',            // none | fade | slide | convex | concave | zoom
  transitionSpeed: 'default',     // default | fast | slow
  backgroundTransition: 'fade',

  // Scroll view (reveal 5+)
  view: null,                     // null | 'scroll'
  scrollLayout: 'full',           // full | compact
  scrollSnap: 'mandatory',        // false | proximity | mandatory
  scrollProgress: 'auto',         // auto | true | false

  // Print
  pdfSeparateFragments: true,
  pdfMaxPagesPerSlide: Number.POSITIVE_INFINITY,

  // Misc
  viewDistance: 3,
  display: 'block',
};

// Options that exist in the config but are not honored by deck.configure()
// after init (reveal reads them once). Changing these needs a page reload.
export const REQUIRES_RELOAD = new Set(['hash', 'history', 'shuffle', 'showHiddenSlides', 'embedded']);
