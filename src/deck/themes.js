// Stock reveal.js themes (dist/theme). Copied to /public/reveal by postinstall.
export const THEMES = [
  { id: 'black', label: 'Black', dark: true },
  { id: 'white', label: 'White', dark: false },
  { id: 'league', label: 'League', dark: true },
  { id: 'beige', label: 'Beige', dark: false },
  { id: 'night', label: 'Night', dark: true },
  { id: 'serif', label: 'Serif', dark: false },
  { id: 'simple', label: 'Simple', dark: false },
  { id: 'solarized', label: 'Solarized', dark: false },
  { id: 'moon', label: 'Moon', dark: true },
  { id: 'dracula', label: 'Dracula', dark: true },
  { id: 'sky', label: 'Sky', dark: false },
  { id: 'blood', label: 'Blood', dark: true },
  { id: 'black-contrast', label: 'Black (high contrast)', dark: true },
  { id: 'white-contrast', label: 'White (high contrast)', dark: false },
];

export const CODE_THEMES = [
  { id: 'monokai', label: 'Monokai' },
  { id: 'zenburn', label: 'Zenburn' },
];

// Theme CSS must come *after* reveal.css in the cascade. Vite appends its
// bundled CSS to <head> at load time, so we re-append the theme links to
// keep them last.
function swapLink(id, href) {
  const link = document.getElementById(id);
  if (!link) return;
  if (!link.href.endsWith(href)) link.href = href;
  document.head.appendChild(link);
}

export function applyTheme(id) {
  swapLink('reveal-theme', `/reveal/theme/${id}.css`);
}

export function applyCodeTheme(id) {
  swapLink('code-theme', `/reveal/highlight/${id}.css`);
}
