# TechHub — HSCT Technology Department

Two pages in one Vite app:

- `/` — the department site: hero, tech widgets, team, mission, projects.
  Content lives in `src/site/Landing.jsx` (TEAM / PROJECTS arrays at the
  top) — edit the text there, add a teacher's project by adding an object
  with an `href`.
- `/studio` — Jonathan's Studio, a React slide editor on top of
  [reveal.js](https://revealjs.com).
- `/play` — the Python Arcade: write Python games and run them in the
  browser (see [Python Arcade](#python-arcade) below).

Routing is a few lines in `src/main.jsx` (path-based, no library).
`public/_redirects` tells Cloudflare Pages to serve `index.html` for
every path so `/studio` works on a direct visit.

## Deploy (Cloudflare Pages)

Push to GitHub, then in Cloudflare: Workers & Pages → Create → Pages →
Connect to Git → pick the repo. Build command `npm run build`, output
directory `dist`. Node version comes from `.node-version`. Add `hsct.tech`
under the project's Custom domains.

# Jonathan's Studio

A React + Vite slide editor on top of [reveal.js](https://revealjs.com).
Build slides by dragging blocks onto a themed canvas, then present with
every stock reveal.js feature exposed in the menubar.

## Run it

```bash
npm install     # also copies reveal's theme CSS into public/reveal
npm run dev     # http://localhost:5173
npm run build   # static site in dist/ — host it anywhere
```

## Using it

**Edit mode** (default)
- Left strip: slides. Click to select, drag to reorder, `+ Slide` / `+ Vertical`.
- Canvas: the current slide, drawn with the real reveal theme so it looks
  exactly like the presentation. Drag blocks to move, corner/edge handles
  to resize, double-click a heading or text to edit it inline. Drop image
  files or toolbox items onto it. Double-click empty space for a text block.
- Right panel: **Add** (block types), **Block** (content, position, style,
  fragment effect + order, auto-animate id, z-order), **Slide** (background
  color/gradient/image/video/web page, transition, auto-animate, auto-slide,
  hidden, speaker notes).
- Keys: Delete, arrows to nudge (Shift = 10px), Ctrl+D duplicate,
  Ctrl+Z / Ctrl+Y undo/redo, Esc deselect, PageUp/PageDown change slide, F5 present.
- Everything autosaves to this browser (localStorage). Use **File →
  Download deck (.json)** to keep a copy or move it to another machine.

**Present mode**
- Navigate / View / Theme / Transition / Playback / Display / Size / Export
  menus cover the whole reveal.js feature set (overview, pause, scroll view,
  fullscreen, speaker notes, search, jump-to, 14 themes, transitions,
  auto-slide, loop, shuffle, controls, progress, slide numbers, navigation
  modes, canvas size, PDF export…). Keyboard shortcuts still work.
- **File → Download standalone .html** produces one file that runs on its
  own (reveal from a CDN). Put it on GitHub Pages / any web host and share
  the link — no app needed to view it.

## Where things live

```
src/
  main.jsx                   path router: / → site, /studio → studio
  site/Landing.jsx           department site (text + team + projects data)
  site/Widgets.jsx           the tech widgets
  site/site.css              site styles (palette from the shield)
  App.jsx                    modes, settings, reveal instance, file actions
  model/deckModel.js         the JSON shape of a deck + block types + starter deck
  model/ops.js               pure doc→doc operations (add/move/delete blocks & slides)
  model/useDocStore.js       state + undo/redo + localStorage
  editor/Editor.jsx          editor layout, selection, keyboard
  editor/Canvas.jsx          WYSIWYG canvas (drag, resize, inline edit, drops)
  editor/SlideStrip.jsx      thumbnails + reorder
  editor/Toolbox.jsx         add / block inspector / slide settings
  present/BlockContent.jsx   renders a block (shared by editor & presenter)
  present/SlidesFromModel.jsx doc → reveal <section>s
  export/standalone.js       single-file HTML export
  deck/Deck.jsx              mounts reveal.js + plugins
  deck/revealConfig.js       default config the navbar edits
  deck/themes.js             theme list + <link> swapping
  navbar/menus.js            menus as data; navbar/Navbar.jsx renders them
```

## Gotchas

- `Deck` never re-renders (reveal owns that DOM). Present mode remounts it
  with a new `key` each time you switch, which is how edits show up.
- Boolean attributes in slide JSX must be `data-foo=""`, not bare
  `data-foo` — React renders a bare one as `"true"`.
- Math renders via reveal's KaTeX plugin, loaded from a CDN while
  presenting; in the editor you see the raw `\[ … \]` source.
- Video blocks and video backgrounds accept YouTube / Vimeo / Google Drive
  links (turned into an embedded player) or a direct `.mp4` / `.webm` URL.
  In the editor a video/web-page block ignores the mouse until you select
  it; then the player works and you move the block with the grip above it.
- Uploaded images are stored as data URLs inside the deck (kept under 3 MB
  each). For big images paste a URL instead.

# Python Arcade

`/play` is an editor where students write Python — including pygame
games — and run it right in the browser. It uses real CPython 3.14 compiled to
WebAssembly ([Pyodide](https://pyodide.org)), a pygame layer that draws
with the browser's canvas, and a console for `print()` and `input()`.
Projects save as you type.

## How it fits together

```
/play  (src/arcade/ArcadePage.jsx)               the editor page
 ├─ CodeMirror editor, file tabs, Assets, console, dialogs
 ├─ store/            where projects are saved
 │    localStore.js   this browser (IndexedDB) — the default
 │    apiStore.js     a student's account (the Django API in backend/)
 └─ <iframe src="/play/runner.html">             the game screen
      runner/frame.js      canvas, keyboard/mouse → shared memory, sound
      runner/runner.worker.js   Pyodide + the pygame layer, one program at a time
      runner/py/           the Python side: pygame/ package + hsct_runner.py
```

- **The student's program runs in a Web Worker.** A `while True:` game loop
  blocks the worker, not the page, and **Stop** always works. It first
  sends a QUIT event (so a game can save before it closes), then
  KeyboardInterrupt, and if that fails it restarts Python.
- **Frames:** each `pygame.display.flip()` copies the screen into an
  ImageBitmap and posts it to the runner page.
- **Input** goes the other way through a `SharedArrayBuffer` (keys, mouse,
  an event queue, and typed `input()` lines), because a busy worker never
  sees normal messages. SharedArrayBuffer needs the page to be
  *cross-origin isolated*: that's the COOP/COEP headers in
  `public/_headers`, only on `/play`.
- **Pyodide is self-hosted**: `npm install` copies it into
  `public/pyodide/<version>/` (`scripts/copy-pyodide.mjs`). There's no CDN
  for a school filter to block, and browsers cache the ~13 MB for a year.
  The first visit takes a few seconds to load; after that it's quick.
- **The pygame layer** (`runner/py/pygame/`) covers what classes use:
  display, draw, Surface, Rect, Color, event, key, mouse, time, font,
  image, transform, mixer, sprite, math.Vector2, mask and gfxdraw. It speaks
  the real API, so the same code runs at home with
  `pip install pygame-ce`, and **Download → .zip** includes instructions.
  Help → *What works* lists it all.
- **Files a program writes** (a high score, a save file) come back into
  the project as tabs when it ends.

## Settings

All optional, as Vite env vars (`.env.local`, or Cloudflare Pages →
Settings → Environment variables):

| | |
|---|---|
| `VITE_API_BASE` | The Django API, e.g. `https://api.hsct.tech/api`. Unset = save in the browser only. |
| `VITE_LOGIN_URL` | Where **Sign in** goes (must redirect back to `?next=`). |
| `VITE_ARCADE_RUNNER_URL` | Host the game screen on its own origin, e.g. `https://run.hsct.tech/play/runner.html` — do this before students open each other's games (see `backend/README.md`). |
| `VITE_PYODIDE_BASE` / `VITE_PYODIDE_PACKAGES` | Where Python and extra packages (numpy…) load from. |

## Common changes

- **Add an example:** drop a `.py` file in `src/arcade/examples/` and list
  it in `examples/index.js`.
- **Teach the pygame layer something new:** the Python lives in
  `src/arcade/runner/py/pygame/`, and the drawing it calls is the `host`
  object in `runner.worker.js`. New `.py` files there are picked up
  automatically.
- **Error explanations** ("You're joining text and a number…") are in
  `src/arcade/lib/hints.js`.
- **Upgrade Python:** `npm install pyodide@<version> --save-exact`. The copy
  script and the cache-busting path follow it.

## Gotchas

- `npm run dev` sets the COOP/COEP headers itself (`vite.config.js`). If
  `/play` shows "Keyboard input and input() are off", the headers aren't
  reaching the page — check `public/_headers` made it into `dist/`.
- Cross-origin isolation blocks third-party embeds without CORS/CORP on
  `/play`. That's why the headers are limited to `/play`, and why
  `useFonts` loads Google Fonts with `crossorigin`.
- Games written for pygbag (`async def main()` with `await asyncio.sleep(0)`)
  don't run. Use the normal game loop.
