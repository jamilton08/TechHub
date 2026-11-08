# HSCT World Kit v0.3

Turns a lesson's work screen into a walkable top-down world. Pairs with HSCT Lesson Kit v1.1.

Files
- lesson-template/hsct-world.js          the kit (inline it after hsct-lesson.js, between <!-- HSCT WORLD START/END -->)
- lesson-template/lesson-world-starter.html   copy this to start a world lesson (campus + Team Hall + 3 panels)
- public/lesson-files/computer-science/build-the-final-boss.html   six zones, kiosks, grass coins, a boss fight (v0.2 features)
- public/lesson-files/it-network/manolo-squishy-mafia.html          the drive module: a town, a car, a store, parking (v0.3 features)

What it gives a lesson
- Character creator on the intro screen (skin, hair, shirt, pants, hat), saved with the lesson state
- Tile maps from ASCII rows (grass, path, water, trees, walls, floors, rugs, shelves, counters, tall grass)
- Buildings drawn from one object line; doors are portals to interior maps or straight to a panel
- NPCs with dialogue that can change with progress, signs, desks/whiteboards/computers (hotspots)
- Locked doors/desks with a reason ("finish the hall first"), ✓ / 🔒 / flag markers on the map
- Panels: the actual work, built by a function exactly like a level builder; "Back to the map" returns
- Keyboard (arrows/WASD + Space/Enter/E), click-to-walk with pathfinding, touch D-pad + A button
- Tasks overlay ("Where to go"), objective line in the HUD
- Everything the world does (position, map, look, panels opened, items picked) is plain JSON in L.world, so saves/results work unchanged

New in v0.2
- Tile `g` — tall grass. Walkable; the player sinks into it. Every step onto it can roll an encounter:
    grass: { chance: 0.2, cooldown: 2, onFind: (ctx, where) => 'toast text' }
  The kit draws the sparkle and the toast; the lesson decides what was found (give a coin, log it).
- Items: { type: 'item', x, y, icon: 'coin'|'chip'|'chest', id, onPick: (ctx, item) => 'toast text' }
  Stepping on one picks it up once (S.picked[id] = true, so a save remembers). Items are not solid.
- Toasts: world.toast(text, ms) — a non-blocking banner at the top of the map (queued).
- HUD slot: hud: (ctx) => 'html' — extra text in the HUD (coins, parts built), re-read on refresh().
- New hotspot icons: kiosk, gate, coin, chip. S.steps counts tiles walked.
- Phone-width HUD wraps so the objective line gets its own row.
Everything in v0.1 works unchanged; a v0.1 lesson can inline v0.2 as is.

New in v0.3 — the drive module
- Tiles: `R` road, `Y` road with a dashed center line, `L` parking lot, `S` sidewalk. R, Y and L are
  drivable (and walkable); everything else is on foot only.
- Cars: { type: 'car', id, x, y, color, facing, label, parked, locked }
  Face a car and press A to get in: the player becomes the car (faster, roads only). A again gets out
  onto the nearest walkable tile and leaves the car there. Doors refuse a car ("Park first.") unless the
  portal has `drive: true`. `parked: true` cars are scenery (solid; `locked` is what you see when you
  look at them). `locked: (ctx) => 'why'` refuses a drivable car for now.
- State: S.driving = car id or null; S.cars[id] = { map, x, y } — a save remembers where every car is.
- Hooks and API: cfg.onDrive(driving, carId) · world.driving · world.carAt(id) · world.getOut()
- A lesson can gate a task on the car ("the boxes are in the trunk"): check world.carAt('nena') against
  the driveway tiles, and L.world.driving.
Everything in v0.2 works unchanged; the Boss lesson's inlined v0.2 block can be replaced by v0.3 as is.

Minimal use
  world = HSCTWorld.create({ mount: '#world', state: () => L.world, start: {...}, maps: {...}, panels: {...} });
  world.sync() after HSCT restores a save · world.refresh() after XP changes

See the header comment in hsct-world.js for the full map/object/panel reference.
