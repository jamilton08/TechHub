# TechHub teacher guide

How to run class with hsct.tech now that it has a backend: posting assignments, watching teams,
collecting work, adding lessons — and how the lesson templates fit in. For the one-time server
setup see `deploy/DEPLOY.md`; for building a lesson see `lesson-template/README.md` and
`lesson-template/README-world.md`. This is the day-to-day page.

```
hsct.tech            the site (Cloudflare Pages) — students and you
hsct.tech/teach      your dashboard (sign in with your Django login)
hsct.tech/lessons/verify   open result files with your private key
api.hsct.tech/admin/ Django admin: every row in the database, when the dashboard isn't enough
lessons.hsct.tech    the lesson HTML files (R2)
```

---

## 1. Assignments

An **assignment** is a lesson posted to a class, with a window and a team size. Without one, a lesson
works exactly as before (solo, no server). With one, the lesson's first screen grows a "Work as a team"
card (or "Join the assignment" for solo mode) and everything the team does shows up on `/teach`.

### Post one
`/teach` → **Post an assignment**:

| Field | Meaning |
|---|---|
| Lesson | any lesson in the catalog that has a file |
| Title | what students and the board call it; defaults to the lesson's title. Use it to tell classes apart: "Final Boss — Period 3" |
| Class | free text, shown on the board and in the student banner |
| Due | optional. After it passes, nobody can **start or join** — teams already working keep going and can still submit |
| Team assignment | on: students form teams up to *Team size*; off: solo, each student is a team of one (you still get the live board and the log) |
| Students see the leaderboard | other teams' names and % on each student's status panel. Off = each team sees only itself |
| Instructions | optional text, stored with the assignment (shown in the API; room to use it in the lesson banner later) |

Post it and you land on the assignment's page with the student link at the top (copy it into Google
Classroom). A link with `?team=CODE` on the end lands a student on the join card with the code filled in.

### Change one
- **Close / Reopen** — the buttons on the Assignments list. Closed = no new teams, no joins, nothing
  new shared; existing teams can still download their file. Reopen to undo.
- **Delete** — removes the assignment **and every team, event and submission under it**. Use Close
  unless you really want it gone.
- **Edit title / due / size / leaderboard / instructions** — Django admin: `api.hsct.tech/admin/` →
  Assignments → the row. (The dashboard doesn't have an edit form yet; say the word and it will.)
- One lesson can have several open assignments at once (two classes). Students pick from a dropdown.

### Watch it
Open an assignment: every team is a card, updated live over the websocket (it says *live* under the
title; if the socket drops it polls every 15 s and says so):

- team name, code, status (`open` → nobody started, `working`, `submitted`, `closed`), phase
  (`intro` / `work` / `end`), members online, total actions, team clock, last activity
- progress bar from the lesson's `summary()` (same number the verify page shows)
- each member: online dot, role, action count, active (tab-visible) time; hover for joined / last seen / rejoins
- **Who did what** — every `HSCT.log` call in order: team clock, who, what, details, server time
- **Close team** — freezes it (no joins, no changes, can still download). **Remove** — deletes it and its log.

### Collect it
**Submissions** on the same page: one row per turned-in file, with the badge code, who pressed finish,
the team, and the *reported* score (what the kit sent in the clear — treat as a preview). Two ways to grade:

- **Open all on /lessons/verify** — hands every envelope to the verify page in one click; load your key
  as usual. Team results get a **Team** panel (members, per-member action counts from the file) and a
  **Who did what — server log** button that pulls the server's timeline next to the score.
- **Download** — the same `.hsct` file a student would have; works with the verify page like any file.

The `.hsct` loop is unchanged: files are encrypted to your public key in the student's browser; the
server stores the sealed envelope and can't read the score. Students can still submit the file in
Google Classroom too (every member gets the same file, so one per student is fine).

---

## 2. What students see

1. Open the lesson from the site. A green banner says an assignment is open.
2. First screen → **Work as a team**: type full name (+ optional role: Programmer / Presenter / Project
   Manager), then **Create a team** (gets a code like `K7P-3QX`) or **Join team** with a teammate's code.
3. Press **Start**. From then on:
   - everyone sees the same lesson state live (an answer on one screen shows on all of them)
   - the floating **Team** panel (bottom right): who's in and online, each member's action count, the
     team's progress, the class leaderboard, the last few actions
   - in a **world** lesson, each student has their own character; teammates walk around with name tags
     (✎ on the tag when they're at a desk); the HUD says who is on this map and who is elsewhere
4. Whoever reaches the end first seals **one** file for the team; it's posted to the room and every
   member's panel offers the download. A member who reaches the end later gets the same file, not a
   second one.
5. Refresh, closed tab, different computer: join again with the same code and the **same name** and they're
   back in the same seat. Same name, different person = the server counts it as a rejoin, not a new member.
6. Solo assignments: "Join the assignment" instead — a team of one, same tracking.

Rules the kit enforces: a team can't exceed the size; nobody can join a submitted or closed team;
nothing can be shared after the team submitted; no code = no server = the lesson runs solo, as always.

---

## 3. Lessons: add, update, hide, remove

`/teach` → **Add or update a lesson**:

1. **Choose the HTML file.** The form fills slug, title and version from the file's `HSCT.lesson({...})`
   call, and picks the course if the file names one.
2. Course (must exist — new courses are made in `/admin/` → Courses), Topic (pick, or **new topic**),
   kind, minutes, tags (search uses them), description, Published.
3. **Upload.** The file goes to R2 as `<course>/<slug>.html`; the catalog entry is created or updated;
   the site shows it on the next page load. No git, no build.

- **New version of a lesson** = upload again with the same slug. The old file is replaced.
- **Hide** a lesson from students: `/admin/` → Lessons → untick Published (you still see it on `/teach`).
- **Delete**: `/admin/` → Lessons → delete (removes the file too), or `DELETE /api/lessons/<course>/<slug>/`.
- **Order** of courses/topics/lessons: the `position` fields in `/admin/`.
- The copies in `public/lesson-files/` and the list in `src/site/lessons.js` are the **fallback** the
  site uses if the API can't be reached and nothing is cached. New lessons don't need to go there.
  (To refresh the fallback from the live catalog one day: it's the JSON at `api.hsct.tech/api/lessons/`.)
- Lessons made before Nov 2026 were re-uploaded with the current kits by the one-time import. A lesson
  file you edit by hand: run `node scripts/update-kit.mjs path/to/lesson.html` before uploading so it
  carries the current kit block.

---

## 4. The templates, and what the kits do for you

Two starters in `lesson-template/`:

| Starter | Use it for | What's inside |
|---|---|---|
| `lesson-starter.html` | screens: quiz, lab, sim, reading | lesson kit 1.3 |
| `lesson-world-starter.html` | a walkable world: maps, buildings, NPCs, desks (panels), items, cars, ships | lesson kit 1.3 + world kit 0.6 |

Every lesson inlines the kit block(s) between `<!-- HSCT KIT START -->…END -->` (and
`<!-- HSCT WORLD START -->…END -->`). Never edit the block inside a lesson; edit
`lesson-template/hsct-lesson.js` / `hsct-world.js` and run `node scripts/update-kit.mjs` to push it
into every lesson (`--check` just lists versions).

### What the lesson kit gives every lesson for free
- the clock, the event log (`HSCT.log`), the encrypted `.hsct` result file and the end-screen card
- save / resume (`HSCT.saveable({ get, set })`, the resume card, the save card, browser autosave)
- **teams** (1.2): the join/create card, live shared state, the floating status board and leaderboard,
  one team file — with **no new calls in the lesson**. It only appears when an assignment is posted.
- **presence** (1.3): `HSCT.sendPos` / `HSCT.onPeer` for anything that wants "see each other"

The one rule a lesson has to follow for teams to work well: **`set(state)` must render the whole
state, including things already done.** A teammate's answer arrives through `set()`, so a question
they answered has to show as answered (the starter's `renderQuestion()` does this). Lessons written
before teams existed usually did this already because saves use the same path.

### What the world kit gives a world lesson
- the map engine: tiles from a row-of-letters map, buildings with doors, portals between maps, NPCs
  that talk, signs, hotspots that open **panels** (your actual work screens), items to pick up, grass
  that hides coins, cars to drive, an objective line, a task list, a HUD slot, a character creator
- **full screen** (0.5): the ⛶ button in the HUD or the **F** key — the map fills the screen, wider view, HUD and desks inside it, Esc leaves
- **your own tiles and ships** (0.6): `cfg.legend` / `cfg.paint` add map letters (open space, decks, hull), a `car` with `sprite: 'ship'` flies; a lesson can make one vehicle the team's (the Spaceverse does)
- **multiplayer** (0.4): teammates drawn as live sprites with name tags, not solid, with a
  "With you / Elsewhere" HUD line. Positions go over the websocket and are never stored.
- **team state that makes sense in a world**: the kit registers itself, so the team shares the *work*
  (answers, parts, picked coins, opened panels, your lesson's own fields) and merges it additively,
  and never shares position, look, visited maps or steps. Nobody gets teleported or re-dressed.
  If your lesson keeps its own counter on screen (XP, parts), re-render it on the `hsct:merged` event:
  `document.addEventListener('hsct:merged', renderXp)` — the world starter does.
- Panels: one that should always show the team's latest (a shared checklist) gets `rebuild: true`.

### Creating a world lesson (the short version)
1. Copy `lesson-world-starter.html`, change `HSCT.lesson({ id, title, version, course, possible })`.
2. Draw maps as rows of letters (`.` grass, `=` path, `W` wall, `_` floor, `~` water, …; add your own with
   `cfg.legend` + `cfg.paint`) and place
   objects: `building` (with `door`), `portal`, `npc`, `sign`, `hotspot` (→ panel), `item`, `car`.
3. Write the panels: `build(el, ctx)` renders the work into the panel; `done()` returns 0–1 or a boolean
   for the ✓/★ marker on the map; log with `HSCT.log` inside them.
4. Keep all state in `L` (plain JSON). `L.world` is the kit's; everything else is yours. `summary()`
   returns `{ earned, possible, label }` — that's the leaderboard and the verify page's number.
5. `HSCT.saveable({ get, set, summary, autosave: true })`, `HSCT.resumeUI`, `HSCT.saveUI`,
   `HSCT.endScreen` as in the starter. Leave `<div id="hsct-team"></div>` under the resume card.
6. Test: two browser windows (one private), make a team, join, Start, walk. Then upload on `/teach`.

`README-world.md` has every object type, option and method with the exact field names.

### Asking Claude for a new lesson
Give it the starter that fits plus the two READMEs and say: *"Build a lesson from
`lesson-template/lesson-world-starter.html` on <topic>: <what students do>, <points>, <time>. Keep the
kit blocks untouched, keep all state in `L`, make `set()` render completed work, listen for
`hsct:merged`, and run `node scripts/update-kit.mjs` on the file."* Then upload the file on `/teach`.

---

## 5. Keys, privacy, limits

- Your **private key** opens every result file. It lives in your browser's verify page and in
  `lesson-template/teacher-private-key.jwk` on your Mac — it is in `.gitignore`, keep it that way.
- Students never sign in. A member is a name + a secret token in their browser's session storage. The
  server keeps: team code and name, member names and roles, timestamps, the event log (what the lesson
  logged, with who did it), the sealed envelope, and the clear summary the kit reports. No emails, no
  accounts, no positions (those are relayed and dropped).
- Teachers are Django users with **staff status**. Another teacher: `/admin/` → Users → add, tick Staff
  (or `createsuperuser` on the server).
- Per team: up to 12 members (you choose the size), 5,000 stored events, 400 KB of shared state.
  Plenty for a class; the box is idle most of the time.

---

## 6. When something looks off

| You see | Check |
|---|---|
| "No backend configured" on `/teach` | Pages variable `VITE_API_BASE` + Retry deployment (`deploy/DEPLOY.md` §1) |
| No "Work as a team" card in a lesson | Is an assignment **open** for that exact slug? Is the lesson on kit ≥ 1.2 (`var KIT = '…'` in the file)? |
| Teams join but screens don't sync | the board says *live*? Server `FRONTEND_ORIGINS` must include `https://lessons.hsct.tech` |
| Board stuck on "reconnecting — polling" | same origins check; it still updates every 15 s meanwhile |
| A student lost their seat | join again with the same code and the same name |
| Lesson iframe blank | `lessons.hsct.tech/<course>/<slug>.html` in a new tab — 404 means the upload didn't land |
| Server side | `cd /opt/hsct/deploy && docker compose ps` / `docker compose logs --tail 50 api`; new code: `./deploy.sh` |
