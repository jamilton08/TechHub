/**
 * Python Arcade settings. Everything can be overridden at build time with
 * Vite env vars (a `.env` file or Cloudflare Pages → Settings → Variables).
 */
import { version as PYODIDE_VERSION } from 'pyodide/package.json';

const env = import.meta.env;

/** Where the Python runtime is served (scripts/copy-pyodide.mjs puts it here). */
export const PYODIDE_BASE = env.VITE_PYODIDE_BASE || `/pyodide/${PYODIDE_VERSION}/`;

/** Extra packages (numpy, …) aren't self-hosted; they come from Pyodide's CDN on first import. */
export const PYODIDE_PACKAGES = env.VITE_PYODIDE_PACKAGES || `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export { PYODIDE_VERSION };

/**
 * The page that actually runs student code. Today it's on hsct.tech. Once
 * students can open each other's games, host it on its own origin (e.g.
 * https://run.hsct.tech/play/runner.html) so shared code can never reach the
 * logged-in site. Nothing else changes: the two pages only talk by postMessage.
 */
export const RUNNER_URL = env.VITE_ARCADE_RUNNER_URL || '/play/runner.html';

/**
 * The Django API (see backend/README.md), e.g. https://api.hsct.tech/api or
 * /api when it's on the same domain. Empty = no backend yet: projects are
 * saved in this browser only.
 */
export const API_BASE = (env.VITE_API_BASE || '').replace(/\/+$/, '');

/** Where "Sign in" sends students (your Django login / Google sign-in). */
export const LOGIN_URL = env.VITE_LOGIN_URL || (API_BASE ? `${API_BASE}/auth/login/` : '');
