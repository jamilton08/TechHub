# HSCT lesson template

Every lesson on TechHub is one self-contained HTML file that ends by handing the
student an encrypted result file to submit in Google Classroom. This folder is
the spec. When a new lesson is written — by Jonathan or by Claude — it starts
from `lesson-starter.html` and follows this document.

## What is in this folder

| File | What it is |
| --- | --- |
| `lesson-starter.html` | A complete, working lesson (a 3-question quiz). Copy it to start a new one. |
| `hsct-lesson.js` | The kit (v1.3): clock, event log, encryption, the standard result card, save/resume, teams, and live presence for worlds. Every lesson inlines this whole file between the `<!-- HSCT KIT START -->` / `END` markers. Never edit it inside a lesson; edit it here and run `node scripts/update-kit.mjs` to re-copy it into every lesson. |
| `teacher-public-key.jwk` | The public key baked into the kit. Safe to share. |
| `teacher-private-key.jwk` | **Opens result files. Keep it out of git** (it is in `.gitignore`). Move a copy somewhere safe. Paste it once into `/lessons/verify`. |

## Anatomy of a lesson

Three screens, in this order. The starter has them as `<section class="view">` blocks.

1. **Intro** — what the lesson is, the rules, and a **full-name field**. The Start
   button refuses an empty name, then calls `HSCT.start(name)`. The clock starts here.
   Below the card, an empty `<div id="hsct-resume"></div>` where `HSCT.resumeUI('#hsct-resume')`
   renders the "pick up where you left off" card, and an empty `<div id="hsct-team"></div>` where
   the kit renders the "work as a team" card (only when the lesson is posted as an assignment).
2. **Work** — the actual lesson: quiz, simulation, lab, reading with a check.
   Call `HSCT.log(type, data)` for anything worth remembering (an answer, a hint,
   a retry, a step). It all ends up inside the result file. Somewhere on this
   screen (a tab, a sidebar, the bottom), `HSCT.saveUI('#hsct-save')` renders the
   "save and continue later" card.
3. **End** — the lesson's own wrap-up (badge, table, feedback) plus an empty
   `<div id="hsct-result"></div>`. Call `HSCT.endScreen('#hsct-result', {...})`
   with the score. The kit renders the standard result card and seals the file.

Register the lesson once at load:

```js
HSCT.lesson({ id: 'binary-basics-check', title: 'Binary basics check', version: '1.0', course: 'computer-science', possible: 30 });
```

`id` must equal the lesson's `slug` in `src/site/lessons.js`. Bump `version` when
the scoring changes so old files can be told apart.

## The kit API

| Call | When | What it does |
| --- | --- | --- |
| `HSCT.lesson({ id, title, version, course, possible })` | once, at load | identifies the lesson |
| `HSCT.start(name)` | Start button | starts the clock; records wall-clock and active (tab visible) time |
| `HSCT.log(type, data)` | any time | appends `{ t: seconds, type, ...data }` to the log (capped at 800) |
| `HSCT.elapsed()` | any time | `{ seconds, activeSeconds }` |
| `HSCT.endScreen(el, opts)` | end screen | renders the card, seals the file, returns a promise of the result |
| `HSCT.finish(opts)` | if you render your own card | seals the file without rendering |
| `HSCT.download()` / `HSCT.copyCode()` | after finish | the two ways a student gets the file out |
| `HSCT.saveable({ get, set, summary, autosave })` | once, at load | how to snapshot and restore the lesson's state (see Saves) |
| `HSCT.resumeUI(el)` | intro screen | renders the resume card: save file, save code, or this browser's autosave |
| `HSCT.saveUI(el)` | work screen | renders the save card: download a save file / copy a save code |
| `HSCT.save()` / `HSCT.restore(text)` | any time | the calls behind those two cards, if a lesson wants its own buttons |
| `HSCT.open(text)` | start screen | opens the student-readable `keep` part of a result file (only if the lesson sealed one) |
| `HSCT.teamUI(el)` / `HSCT.boardUI(el)` | optional | place the team card / the status board yourself (see Teams) |
| `HSCT.team` | any time | `null`, or the team this student is in: `{ code, name, members, you, assignment, leaderboard, connected, submitted }` |

`opts` for `endScreen` / `finish`:

```js
{
  earned: 20, possible: 30,                 // the headline score
  tier: 'Pass',                             // optional label: 'Gold', 'Model coworker', ...
  sections: [                               // optional rows on the card and in the file
    { id: 'q1', title: 'What is 1010?', earned: 10, possible: 10 },
    { id: 'sec3', title: '3. Devices', status: 'Reread' },   // status instead of numbers is fine
  ],
  extra: { answers: [...] },                // anything else, any shape
  keep: {...},                              // optional: a copy the STUDENT can get back with HSCT.open (see Saves)
  note: 'Submit the file in Google Classroom.'   // optional, replaces the default line under the buttons
}
```

The card picks up `--hsct-color` from the lesson's `:root` so it matches the lesson's accent.

## Saves

A student who runs out of time saves, and later brings the save back to the
lesson's start screen and continues — on any device. The kit does all of it;
a lesson supplies two functions:

```js
HSCT.saveable({
  autosave: true,                        // also keep the latest save in this browser (localStorage)
  get: () => state,                      // plain JSON: no DOM nodes, timers, Sets or functions
  set: (s) => { state = s; show('view-work'); render(); HSCT.saveUI('#hsct-save'); },
  summary: () => ({ earned, possible, label }),   // optional: what the teacher sees for a save on /lessons/verify
});
HSCT.resumeUI('#hsct-resume');           // on the intro screen
```

`get` runs on every save (and, with `autosave`, a second after every `HSCT.log`),
so keep it cheap and keep `state` serializable. `set` receives exactly what `get`
returned. Anything that was mid-animation when the save was taken (a device
booting, a timer running) should simply be finished in `set`.

What the kit does on its own:

- The save file is `HSCT-SAVE_<lesson-id>_<Student-Name>_<date>.hsctsave`, or the
  same envelope as a one-line **save code** for devices that block downloads.
- The clock, active time and event log are part of the save and **continue** on
  resume: "time taken" in the result is the total across sessions.
- A save only opens in the lesson it came from, only under the name it was made
  with, and not at all if it was edited after it was made.
- Every resume is recorded in the result file (`resumes: [{ id, savedAt,
  savedSeconds, savedEvents, resumedAt }]`), shown on the result card and on
  `/lessons/verify`. A run resumed three times from the same save looks exactly
  like what it is.
- The moment a result is sealed, the browser's autosave is cleared and `HSCT.save()`
  refuses to run: there is no resuming into a finished run.
- Save files open on `/lessons/verify` too (they carry a second copy of the key,
  wrapped to the teacher's public key), so a student who didn't finish can submit
  the save and you see how far they got, with the lesson's `summary`.

### Letting a student get their work back from a result file

By default a result file opens only for the teacher. A writing lesson may want the
student to be able to recover what they wrote from the `.hsct` itself (they lost
their draft, kept only the result). Opt in per lesson:

```js
HSCT.endScreen('#hsct-result', { earned, possible, sections, extra,
  keep: draftObject });          // whatever the lesson's own draft loader accepts
// later, on the start screen, when a student hands the lesson a .hsct:
HSCT.open(fileText).then(({ keep }) => loadDraft(keep));
```

`keep` is sealed as a **separate** blob with a key derived from the student's name
and the lesson id — the student can read that part back and nothing else. The
graded payload stays wrapped to the teacher only, so a student cannot use the
student-side key to re-encrypt a changed score. A changed or renamed file fails
to open. `HSCT.open` refuses saves, other lessons' files, and results made
before the lesson started keeping a copy.

Honest limits: the save is encrypted so it can't be casually read or edited, but
the lesson has to be able to open it, so a determined student with the console
could read or build one — the same limit the result file has. "Save right before
the hard part, try, resume, try again" is the new thing saves make cheap. It is
visible in the result (resume count, and the saved-at time against the events
that follow), so look there when a score looks off. A lesson can also disable
saving past a point of no return by not rendering the save card after it.

## Teams (v1.2)

When a teacher posts a lesson as an **assignment** on `/teach` (group mode, team
size, due date), the intro screen grows a "Work as a team" card. One student
makes the team and gets a code like `K7P-3QX`; the others open the same lesson,
type the code and their name, and press Start. From then on:

- **One screen, many hands.** The kit shares what `get()` returns with the room
  after every `HSCT.log` (and polls every 2.5 s for changes a lesson makes without
  logging), and calls `set()` on the other members' pages. Last write wins; a write
  based on an older version gets the current state back. So **`set()` must render
  the whole state, including things already done** — in the starter, a question a
  teammate already answered shows as answered.
- **Who did what.** Every `HSCT.log` is tagged with the member (`who` in the event
  log inside the file) and streamed to the server, where it is stored per member.
  The teacher's `/teach` board shows it live; `/lessons/verify` pulls the per-member
  timeline next to the result.
- **The status board.** A floating "Team" panel (bottom right) shows who is in and
  online, each member's action count, the team's progress from `summary()`, the
  class leaderboard (other teams' names and progress — never their codes), and the
  last few actions. `HSCT.boardUI(el)` renders the same board inline if a lesson
  wants it in its own layout.
- **One result.** The first member to reach the end screen seals the team's file;
  it is posted to the room and every member's page receives it (the panel and the
  result card offer the download; a member who reaches the end later gets the same
  file, not a second one). The payload carries `team: { code, name, members[...],
  submittedBy }`, and the header carries `team` and `teamName` in the clear.
- **Sharing less than everything.** By default the whole `get()` state is shared and
  `set()` takes it in. A lesson can narrow that with two optional functions on
  `HSCT.saveable`: `shared()` returns the part to share (the answers, the built
  network — not the avatar's position in a walkable world, not a half-typed text
  box), and `merge(part)` takes a teammate's part in and re-renders. Walkable-world
  lessons should do this, or two students walking at once will fight over one
  character.
- **Worlds are multiplayer** (kit 1.3 + world kit 0.4): each student has their own character and
  sees teammates walk around with name tags; positions go over the websocket and are never stored.
  The world kit registers itself, so by default the team shares the work (answers, parts, picked
  coins) and not position/look — see `README-world.md`.
- **The clock is the team's**: started when the team was made.
- Saves are off in team mode (the state lives on the server); a refresh or a new
  computer rejoins with the same code and name.

Nothing changes for a student working alone: no code, no server call, same file.
A lesson that should never run as a team (a timed quiz, say) opts out with
`HSCT.lesson({ ..., team: false })`. The kit finds the API at `https://api.hsct.tech`
(`http://127.0.0.1:8000` on localhost; override with `window.HSCT_API`), and does
nothing team-related when the file is opened from a folder.

To make this reachable from the site, `LessonPage` passes `?team=CODE` or
`?assignment=ID` from its own URL through to the iframe, so a link
`hsct.tech/lessons/computer-science/binary-basics-check?team=K7P-3QX` lands a student
on the join card with the code filled in.

Upgrading older lessons: `node scripts/update-kit.mjs` swaps the kit block in every
lesson under `public/lesson-files/` and the two starters. Lessons without a
`#hsct-team` element get the team card inserted right under the resume card.

## The result file

`HSCT_<lesson-id>_<Student-Name>_<YYYY-MM-DD_HHMM>.hsct` — a small JSON envelope:

```
{ "hsct": 1, "kit": "1.0", "lesson": "...", "title": "...", "student": "...",
  "finished": "2026-09-15T14:34:02Z", "badge": "N9HA-7G9Z",
  "key": "<AES key wrapped with the teacher's RSA-OAEP public key>",
  "iv": "...", "data": "<AES-256-GCM ciphertext>" }
```

The header fields are readable (so files can be sorted without opening them)
but are authenticated: change one character and the file no longer opens.
Inside `data`, once decrypted on `/lessons/verify`:

```
kit, lesson { id, title, version, course }, student { name },
started, finished, seconds, activeSeconds,
score { earned, possible, percent }, tier, sections[], extra, events[],
team { code, name, assignment, members[], submittedBy } | null,
env { tz, ua, url }, badge
```

`badge` is an 8-character code derived from the contents (SHA-256). It is shown on
screen and inside the file, so a screenshot can be matched to its file.

A save file is the same shape with `"kind": "save"`, an `id` instead of a `badge`,
`saved` instead of `finished`, and three key fields: `key` + `kiv` (the AES key
wrapped with a key derived from the student's name and the lesson id, which is
how the lesson opens it again) and `tkey` (the same AES key wrapped with the
teacher's public key, which is how `/lessons/verify` opens it). Inside: `state`
(whatever `get` returned), `summary`, `n` (save number), plus the same clock and
`events` fields as a result.

"Copy result code" puts the same envelope on the clipboard as one line, for
devices where downloads are blocked. The verify page accepts pasted codes too.

## Where things go

- The lesson file: `public/lesson-files/<course>/<lesson-id>.html`
- Its entry: `src/site/lessons.js` under the right course and topic
  (`slug`, `title`, `description`, `file`, `kind`, `minutes`, `added`, `tags`)
- That is all. The catalog, search, nav, and lesson page read from `lessons.js`.

## Rules every lesson follows

- One file. Inline CSS and JS. Google Fonts are the only outside request allowed
  (no CDN scripts, no images from other sites, no fetch).
- Works standalone (opened from a folder) and inside the site's lesson frame.
- Mobile-friendly at 390px wide; keyboard-usable; visible focus; respects
  `prefers-reduced-motion`.
- Full name is required before the work starts. The clock starts at Start and
  stops at the end screen. No back door from the end screen to a higher score
  without going through the work again (a "Try again" that restarts is fine).
- The end screen is the only place the file is produced, and it is produced
  once per run.
- Nothing about the lesson is stored in `localStorage` unless the lesson needs
  it (the kit does not use storage at all).
- The `HSCT KIT` block is copied verbatim from `hsct-lesson.js`.
- Every lesson calls `HSCT.saveable({ get, set })` and renders both cards
  (`HSCT.resumeUI` on the intro, `HSCT.saveUI` on the work screen). `localStorage`
  is used only by the kit's autosave, keyed by lesson id, and cleared at finish.

## Keys

The kit encrypts with the **public** key in `hsct-lesson.js`. Files can only be
opened with the **private** key, which lives in this folder (ignored by git) and
in the teacher's browser on `/lessons/verify`.

To rotate: on `/lessons/verify`, open "Need a new key pair?" and generate one.
It downloads the new private key and loads it. Then replace `PUBLIC_KEY` in
`hsct-lesson.js` **and in every lesson that inlines the kit** (search for
`var PUBLIC_KEY`). Files sealed with the old key will not open with the new one,
so grade what is outstanding first.

## What this does and does not protect against

- A student cannot read another student's file, cannot read their own, and
  cannot edit a score in a file: any change makes it fail to open.
- A student who reads the page source and uses the browser console could, in
  principle, build a file with a made-up score — the same limit every
  browser-side quiz has. The event log makes that harder to fake (a real run has
  a plausible sequence with timestamps) and the verify page shows it. If a
  result looks off, the log is the first thing to check.

## Checklist before a lesson ships

- [ ] `HSCT.lesson` id equals the slug in `lessons.js`; title matches the card
- [ ] Name required; `HSCT.start` called from the Start button
- [ ] `HSCT.log` on the meaningful actions
- [ ] `HSCT.endScreen` with `earned`, `possible`, and `sections` when there are parts
- [ ] `HSCT.saveable({ get, set })`, resume card on the intro, save card on the work screen; saved halfway, reloaded, resumed, finished — result shows "Resumed 1 time"
- [ ] `<div id="hsct-team"></div>` under the resume card; `set()` renders already-done work (two browser windows in one team stay in step)

- [ ] Played through once: file downloads, opens on `/lessons/verify`, score and time look right
- [ ] Looks right at 390px and inside the site frame; keyboard works end to end
- [ ] File placed in `public/lesson-files/<course>/`; entry added to `lessons.js` with `tags`
