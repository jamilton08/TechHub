/* ============================================================================
   HSCT WORLD KIT  v0.3  (goes with HSCT LESSON KIT v1.1)
   A lesson's work screen as a small top-down world: the student makes a
   character, walks a tile map Pokémon-style, talks to NPCs, reads signs,
   enters buildings, and sits down at a desk, whiteboard or computer to do a
   PART of the lesson there (a "panel": the same kind of builder function the
   levels already use). Finishing panels unlocks doors. The lesson kit still
   does the clock, log, saves and the result file; this kit only replaces
   "click Next" with "walk there".

   Inline this block in a lesson between <!-- HSCT WORLD START --> and
   <!-- HSCT WORLD END -->, after the lesson kit. No images: every tile and
   sprite is drawn in code, so a lesson stays one self-contained HTML file.

   ---------------------------------------------------------------------------
   A WORLD IS: maps (tile grids + objects), panels (work), one player.

     const world = HSCTWorld.create({
       mount: '#world',                 // element that gets the stage
       state: () => L.world,            // plain JSON object the kit reads/writes:
                                        //   { map, x, y, facing, look, name, visited, opened, flags }
       start: { map: 'campus', x: 5, y: 9, facing: 'down' },
       maps: { campus: {...}, hall: {...} },
       panels: { quiz: {...}, notes: {...} },
       objective: () => 'Find the Team Hall',     // text in the HUD (optional)
       onPanelOpen: (id) => {}, onPanelClose: (id) => {},
       onEnterMap: (id) => {},
     });

   A MAP:
     { title: 'Campus', rows: [ 'TTTT...', ... ], objects: [ ... ] }
     rows are strings, one char per tile. Legend (built in):
       .  grass      ,  grass + flowers    =  path       ~  water (solid)
       T  tree (solid)   #  stone wall (solid)   f  fence (solid)
       _  wood floor     r  rug on floor        W  interior wall (solid)
       b  bookshelf (solid)   c  counter (solid)   x  nothing / black (solid)
     objects (x, y in tiles):
       { type: 'building', x, y, w, h, label, color, door: { x, y } }
           a house drawn over the tiles; its body is solid except the door tile
       { type: 'portal', x, y, to: { map, x, y, facing } }      step on → go there
       { type: 'portal', x, y, to: { panel: 'quiz' } }          step on → open a panel
       { type: 'npc', x, y, name, look, facing, say }           press A facing it
           say: 'text' | ['line', 'line'] | (ctx) => string|array   (ctx = { state, world })
       { type: 'sign', x, y, text }                             press A facing it
       { type: 'hotspot', x, y, panel, label, icon,             press A facing it → panel
         locked: (ctx) => false | 'why it is locked' }          icon: desk | pc | board | chest | flag
     Any object can carry `locked`; a locked portal or hotspot says why instead of opening.
     Any object can carry `hidden: (ctx) => bool` to disappear (e.g. after a quest).

   A PANEL:
     { title, subtitle, build(host, api), done: (ctx) => bool|number, rebuild: false }
       build renders the work into `host` (a div) the first time it opens
       (every time, if rebuild: true). api = { close(), world, state }.
       done drives the ✓ / ★ markers on the map (true, or a fraction 0..1).

   PLAYER LOOK (a plain object the character creator edits):
     { skin: '#f1c27d', hair: '#3b2a1a', shirt: '#1f3fae', pants: '#2f3b5c', hat: null|'#b3261e' }
     HSCTWorld.characterPicker(el, { look, onChange })  renders a creator with a live sprite
     HSCTWorld.randomLook()

   METHODS: world.sync() after a save is restored · world.refresh() after XP changes
            world.say(name, lines) · world.openPanel(id) · world.closePanel()
            world.teleport(map, x, y, facing) · world.setLook(look) · world.focus()
            world.pause() / world.resume() · world.toast(text) (non-blocking, v0.2)

   NEW IN v0.2 — tall grass, items, encounters, toasts, a HUD slot:
     tile  g  tall grass: walkable; the player sinks into it (Pokémon-style) and
              every step onto it can roll an ENCOUNTER (see cfg.grass).
     object { type: 'item', x, y, icon: 'coin'|'chip'|'chest'|..., id, label,
              hidden, onPick: (ctx, item) => string|void }
              walkable; stepping on it picks it up ONCE (S.picked[id] = true, so a
              save remembers), calls onPick, and toasts whatever it returns.
              id defaults to map:x,y.
     cfg.grass = { chance: 0.18, cooldown: 2, onFind: (ctx, where) => string|void }
              rolled on every arrival onto a g tile, at most once per `cooldown`
              steps; the kit draws the sparkle, the lesson decides what was found
              (give a coin, log it) and returns the toast text. `where` = { map, x, y }.
     cfg.onPick(item, ctx)   global fallback when an item has no onPick of its own
     cfg.hud = (ctx) => 'html'   extra HUD text (coins, parts built), re-read on refresh()
     S.steps  counts tiles walked (the lesson can use it for pacing)

   NEW IN v0.3 — the drive module:
     tiles  R  road   Y  road with a dashed center line   L  parking lot   S  sidewalk
            R, Y and L are drivable (and walkable). Everything else is on foot only.
     object { type: 'car', id, x, y, color, label, parked, locked }
            a car on the map. Face it and press A to get in; the player becomes the
            car: faster, only on drivable tiles, and doors refuse it ("park first")
            unless the portal has `drive: true` (a road out of town, a parking garage).
            A again gets out onto the nearest walkable tile and leaves the car there.
            Where every car is lives in S.cars[id] = { map, x, y } and S.driving = id|null,
            so a save remembers the car exactly where it was parked. `parked: true`
            cars are scenery (solid, "Not your car."); `locked: (ctx) => 'why'` refuses.
     cfg.onDrive(driving, carId)   called on get in / get out
     world.driving → the car id or null · world.carAt(id) → { map, x, y }
   ========================================================================== */
(function () {
  'use strict';
  var T = 16;                 // tile size in sprite pixels
  var VIEW_W = 20, VIEW_H = 12;   // tiles on screen
  var STEP_MS = 150;          // one tile of walking
  var LEGEND = {
    '.': { k: 'grass' }, ',': { k: 'flowers' }, '=': { k: 'path' }, '~': { k: 'water', solid: true },
    'T': { k: 'tree', solid: true }, '#': { k: 'wall', solid: true }, 'f': { k: 'fence', solid: true },
    '_': { k: 'floor' }, 'r': { k: 'rug' }, 'W': { k: 'iwall', solid: true }, 'b': { k: 'shelf', solid: true },
    'c': { k: 'counter', solid: true }, 'x': { k: 'void', solid: true }, ' ': { k: 'void', solid: true },
    'g': { k: 'tallgrass', grass: true },
    'R': { k: 'road', drive: true }, 'Y': { k: 'roadline', drive: true }, 'L': { k: 'lot', drive: true }, 'S': { k: 'walk' },
  };
  var DRIVE_MS = 70;
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function hash(x, y, s) { var h = (x * 374761393 + y * 668265263 + (s || 0) * 1274126177) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

  /* ---------------------------------------------------------------- tiles */
  var TILE_PAINT = {
    grass: function (c, x, y) { c.fillStyle = '#5fae4b'; c.fillRect(0, 0, T, T); c.fillStyle = '#54a042'; for (var i = 0; i < 5; i++) { var px = Math.floor(hash(x, y, i) * 15), py = Math.floor(hash(y, x, i + 9) * 15); c.fillRect(px, py, 2, 1); } },
    flowers: function (c, x, y) { TILE_PAINT.grass(c, x, y); var cols = ['#ffd84d', '#ff7aa8', '#ffffff']; for (var i = 0; i < 3; i++) { c.fillStyle = cols[Math.floor(hash(x, y, 30 + i) * 3)]; c.fillRect(2 + Math.floor(hash(x, y, 40 + i) * 12), 2 + Math.floor(hash(y, x, 50 + i) * 12), 2, 2); } },
    path: function (c, x, y) { c.fillStyle = '#d8b878'; c.fillRect(0, 0, T, T); c.fillStyle = '#c9a765'; for (var i = 0; i < 4; i++) c.fillRect(Math.floor(hash(x, y, i + 3) * 14), Math.floor(hash(y, x, i + 7) * 14), 2, 2); },
    water: function (c, x, y) { c.fillStyle = '#3f7fd6'; c.fillRect(0, 0, T, T); c.fillStyle = '#6fa3ec'; c.fillRect(2 + Math.floor(hash(x, y, 1) * 6), 3 + Math.floor(hash(x, y, 2) * 4), 6, 1); c.fillRect(1 + Math.floor(hash(x, y, 3) * 8), 10 + Math.floor(hash(x, y, 4) * 4), 5, 1); },
    tree: function (c, x, y) { TILE_PAINT.grass(c, x, y); c.fillStyle = '#5a3d1e'; c.fillRect(6, 11, 4, 5); c.fillStyle = '#2f7a3a'; c.fillRect(2, 3, 12, 9); c.fillRect(4, 1, 8, 2); c.fillRect(1, 5, 14, 5); c.fillStyle = '#3f9a4a'; c.fillRect(4, 3, 5, 3); c.fillRect(3, 7, 3, 2); },
    wall: function (c) { c.fillStyle = '#8a8f9a'; c.fillRect(0, 0, T, T); c.fillStyle = '#6f7480'; c.fillRect(0, 7, T, 1); c.fillRect(0, 15, T, 1); c.fillRect(7, 0, 1, 7); c.fillRect(3, 8, 1, 7); c.fillRect(11, 8, 1, 7); },
    fence: function (c, x, y) { TILE_PAINT.grass(c, x, y); c.fillStyle = '#b8864e'; c.fillRect(0, 6, T, 2); c.fillRect(0, 11, T, 2); c.fillStyle = '#8f6236'; c.fillRect(3, 3, 3, 12); c.fillRect(10, 3, 3, 12); },
    floor: function (c, x, y) { c.fillStyle = '#c9a775'; c.fillRect(0, 0, T, T); c.fillStyle = '#b8955f'; c.fillRect(0, 3, T, 1); c.fillRect(0, 11, T, 1); c.fillRect(Math.floor(hash(x, y, 5) * 12), 4, 1, 7); },
    rug: function (c, x, y) { TILE_PAINT.floor(c, x, y); c.fillStyle = '#b3463c'; c.fillRect(1, 1, 14, 14); c.fillStyle = '#d9705f'; c.fillRect(3, 3, 10, 10); c.fillStyle = '#b3463c'; c.fillRect(5, 5, 6, 6); },
    iwall: function (c) { c.fillStyle = '#7a6350'; c.fillRect(0, 0, T, T); c.fillStyle = '#f0e3cf'; c.fillRect(0, 9, T, 7); c.fillStyle = '#5c4838'; c.fillRect(0, 8, T, 1); c.fillStyle = '#8c745f'; c.fillRect(0, 0, T, 2); },
    shelf: function (c, x, y) { c.fillStyle = '#6b4a2b'; c.fillRect(0, 0, T, T); var cols = ['#b3261e', '#1f3fae', '#1f7a3d', '#e0a000', '#7a3fb0']; for (var r = 0; r < 2; r++) for (var i = 0; i < 4; i++) { c.fillStyle = cols[Math.floor(hash(x + i, y + r, 11) * 5)]; c.fillRect(2 + i * 3, 2 + r * 7, 2, 5); } },
    counter: function (c) { c.fillStyle = '#a0785a'; c.fillRect(0, 0, T, T); c.fillStyle = '#c99b78'; c.fillRect(0, 0, T, 5); c.fillStyle = '#7d5b43'; c.fillRect(0, 5, T, 1); },
    void: function (c) { c.fillStyle = '#05040f'; c.fillRect(0, 0, T, T); },
    tallgrass: function (c, x, y) { c.fillStyle = '#3f8f35'; c.fillRect(0, 0, T, T); c.fillStyle = '#2f7a2a'; for (var i = 0; i < 6; i++) { var px = Math.floor(hash(x, y, 60 + i) * 14), py = 3 + Math.floor(hash(y, x, 70 + i) * 10); c.fillRect(px, py, 2, 4); c.fillRect(px + 1, py - 2, 1, 2); } c.fillStyle = '#5fae4b'; for (var j = 0; j < 4; j++) c.fillRect(Math.floor(hash(x, y, 80 + j) * 15), Math.floor(hash(y, x, 90 + j) * 15), 1, 2); },
  };
  TILE_PAINT.road = function (c, x, y) { c.fillStyle = '#3d3f48'; c.fillRect(0, 0, T, T); c.fillStyle = '#474a54'; for (var i = 0; i < 3; i++) c.fillRect(Math.floor(hash(x, y, 100 + i) * 14), Math.floor(hash(y, x, 110 + i) * 14), 2, 1); };
  TILE_PAINT.roadline = function (c, x, y) { TILE_PAINT.road(c, x, y); c.fillStyle = '#e8c547'; c.fillRect(7, 2, 2, 5); c.fillRect(7, 10, 2, 5); };
  TILE_PAINT.lot = function (c, x, y) { c.fillStyle = '#4a4d57'; c.fillRect(0, 0, T, T); c.fillStyle = '#f0f0f0'; if (hash(x, y, 120) < 0.5) c.fillRect(0, 0, 1, T); };
  TILE_PAINT.walk = function (c, x, y) { c.fillStyle = '#b9b6ae'; c.fillRect(0, 0, T, T); c.fillStyle = '#a7a49c'; c.fillRect(0, 0, T, 1); c.fillRect(0, 0, 1, T); c.fillStyle = '#c6c3bb'; c.fillRect(Math.floor(hash(x, y, 130) * 12), Math.floor(hash(y, x, 140) * 12), 3, 2); };
  /* cars: 16×16 per direction, body color from the object */
  var carCache = {};
  function carSprite(color, dir) {
    var key = color + '|' + dir;
    if (carCache[key]) return carCache[key];
    var cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    var c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    var dark = 'rgba(0,0,0,.35)', glass = '#9fd8ff', wheel = '#15151a', light = '#fff7c2', tail = '#ff4d4d';
    if (dir === 'up' || dir === 'down') {
      c.fillStyle = wheel; c.fillRect(2, 2, 2, 4); c.fillRect(12, 2, 2, 4); c.fillRect(2, 10, 2, 4); c.fillRect(12, 10, 2, 4);
      c.fillStyle = color; c.fillRect(4, 1, 8, 14);
      c.fillStyle = dark; c.fillRect(4, 1, 1, 14); c.fillRect(11, 1, 1, 14);
      c.fillStyle = glass; if (dir === 'up') c.fillRect(5, 3, 6, 3); else c.fillRect(5, 10, 6, 3);
      c.fillStyle = light; if (dir === 'up') { c.fillRect(4, 1, 2, 1); c.fillRect(10, 1, 2, 1); } else { c.fillRect(4, 14, 2, 1); c.fillRect(10, 14, 2, 1); }
      c.fillStyle = tail; if (dir === 'up') { c.fillRect(4, 14, 2, 1); c.fillRect(10, 14, 2, 1); } else { c.fillRect(4, 1, 2, 1); c.fillRect(10, 1, 2, 1); }
    } else {
      var mirror = dir === 'left';
      c.fillStyle = wheel; c.fillRect(2, 2, 4, 2); c.fillRect(10, 2, 4, 2); c.fillRect(2, 12, 4, 2); c.fillRect(10, 12, 4, 2);
      c.fillStyle = color; c.fillRect(1, 4, 14, 8);
      c.fillStyle = dark; c.fillRect(1, 4, 14, 1); c.fillRect(1, 11, 14, 1);
      c.fillStyle = glass; c.fillRect(mirror ? 3 : 10, 5, 3, 6);
      c.fillStyle = light; c.fillRect(mirror ? 1 : 14, 5, 1, 2); c.fillRect(mirror ? 1 : 14, 9, 1, 2);
      c.fillStyle = tail; c.fillRect(mirror ? 14 : 1, 5, 1, 2); c.fillRect(mirror ? 14 : 1, 9, 1, 2);
    }
    carCache[key] = cv;
    return cv;
  }
  /* the top of the grass, drawn over the player's legs when they stand in it */
  function paintGrassOver(c, x, y) { c.fillStyle = '#3f8f35'; c.fillRect(0, 10, T, 6); c.fillStyle = '#2f7a2a'; for (var i = 0; i < 6; i++) { var px = Math.floor(hash(x, y, 60 + i) * 14), py = 3 + Math.floor(hash(y, x, 70 + i) * 10); if (py + 4 > 10) c.fillRect(px, Math.max(10, py), 2, py + 4 - Math.max(10, py)); } }
  var ICON_PAINT = {
    desk: function (c) { c.fillStyle = '#8a5a30'; c.fillRect(1, 5, 14, 8); c.fillStyle = '#5c3b1e'; c.fillRect(2, 13, 2, 3); c.fillRect(12, 13, 2, 3); c.fillStyle = '#fff8e6'; c.fillRect(3, 7, 6, 4); c.fillStyle = '#1f3fae'; c.fillRect(4, 8, 4, 1); },
    pc: function (c) { c.fillStyle = '#8a5a30'; c.fillRect(1, 9, 14, 5); c.fillStyle = '#2a2a35'; c.fillRect(3, 2, 10, 8); c.fillStyle = '#39e6ff'; c.fillRect(4, 3, 8, 5); c.fillStyle = '#5c3b1e'; c.fillRect(2, 14, 2, 2); c.fillRect(12, 14, 2, 2); },
    board: function (c) { c.fillStyle = '#4b4b55'; c.fillRect(1, 1, 14, 11); c.fillStyle = '#f6f6ff'; c.fillRect(2, 2, 12, 9); c.fillStyle = '#1f3fae'; c.fillRect(4, 4, 7, 1); c.fillRect(4, 6, 5, 1); c.fillStyle = '#b3261e'; c.fillRect(4, 8, 8, 1); c.fillStyle = '#4b4b55'; c.fillRect(3, 12, 2, 4); c.fillRect(11, 12, 2, 4); },
    chest: function (c) { c.fillStyle = '#8a5a30'; c.fillRect(2, 5, 12, 9); c.fillStyle = '#b8864e'; c.fillRect(2, 5, 12, 3); c.fillStyle = '#ffd84d'; c.fillRect(7, 8, 2, 3); },
    flag: function (c) { c.fillStyle = '#5c4838'; c.fillRect(4, 2, 2, 13); c.fillStyle = '#ff6fd8'; c.fillRect(6, 2, 8, 6); },
    coin: function (c) { c.fillStyle = '#b8964a'; c.fillRect(4, 3, 8, 10); c.fillRect(3, 4, 10, 8); c.fillStyle = '#ffd84d'; c.fillRect(4, 3, 7, 9); c.fillRect(3, 4, 9, 7); c.fillStyle = '#fff3b0'; c.fillRect(5, 4, 2, 2); c.fillStyle = '#b8964a'; c.fillRect(7, 6, 2, 4); },
    chip: function (c) { c.fillStyle = '#2a2a35'; c.fillRect(3, 3, 10, 10); c.fillStyle = '#39e6ff'; c.fillRect(5, 5, 6, 6); c.fillStyle = '#9aa3c4'; for (var i = 0; i < 4; i++) { c.fillRect(4 + i * 2.5, 1, 1, 2); c.fillRect(4 + i * 2.5, 13, 1, 2); c.fillRect(1, 4 + i * 2.5, 2, 1); c.fillRect(13, 4 + i * 2.5, 2, 1); } },
    kiosk: function (c) { c.fillStyle = '#7a3fb0'; c.fillRect(2, 2, 12, 12); c.fillStyle = '#f0e3cf'; c.fillRect(4, 4, 8, 6); c.fillStyle = '#7a3fb0'; c.fillRect(7, 5, 2, 3); c.fillRect(7, 9, 2, 1); c.fillStyle = '#4b2a70'; c.fillRect(2, 14, 12, 2); },
    gate: function (c) { c.fillStyle = '#5b6485'; c.fillRect(2, 1, 3, 15); c.fillRect(11, 1, 3, 15); c.fillStyle = '#9aa3c4'; c.fillRect(5, 3, 6, 2); c.fillRect(5, 8, 6, 2); c.fillRect(5, 13, 6, 2); c.fillStyle = '#b3261e'; c.fillRect(7, 5, 2, 3); },
  };
  function paintTile(c, kind, x, y) { c.save(); c.translate(x * T, y * T); (TILE_PAINT[kind] || TILE_PAINT.void)(c, x, y); c.restore(); }

  /* ------------------------------------------------------------- sprites */
  /* 12×16 pixel templates. H hair, S skin, E eye, C shirt, P pants, B boots, A hat, . clear. */
  var TPL = {
    down: [
      '....AAAA....', '...AAAAAA...', '...HHHHHH...', '..HHHHHHHH..', '..HSSSSSSH..', '..HSESSESH..', '...SSSSSS...', '....SSSS....',
      '...CCCCCC...', '..SCCCCCCS..', '..SCCCCCCS..', '...CCCCCC...', '...PPPPPP...', '...PPP.PP...', '...PP..PP...', '...BB..BB...'],
    down2: [
      '....AAAA....', '...AAAAAA...', '...HHHHHH...', '..HHHHHHHH..', '..HSSSSSSH..', '..HSESSESH..', '...SSSSSS...', '....SSSS....',
      '...CCCCCC...', '..SCCCCCCS..', '..SCCCCCCS..', '...CCCCCC...', '...PPPPPP...', '...PP.PPP...', '...PP..PP...', '...BB..BB...'],
    up: [
      '....AAAA....', '...AAAAAA...', '...HHHHHH...', '..HHHHHHHH..', '..HHHHHHHH..', '..HHHHHHHH..', '...SHHHHS...', '....SSSS....',
      '...CCCCCC...', '..SCCCCCCS..', '..SCCCCCCS..', '...CCCCCC...', '...PPPPPP...', '...PPP.PP...', '...PP..PP...', '...BB..BB...'],
    up2: [
      '....AAAA....', '...AAAAAA...', '...HHHHHH...', '..HHHHHHHH..', '..HHHHHHHH..', '..HHHHHHHH..', '...SHHHHS...', '....SSSS....',
      '...CCCCCC...', '..SCCCCCCS..', '..SCCCCCCS..', '...CCCCCC...', '...PPPPPP...', '...PP.PPP...', '...PP..PP...', '...BB..BB...'],
    right: [
      '....AAAA....', '...AAAAAA...', '...HHHHHH...', '...HHHHHH...', '...HHSSSS...', '...HHSSES...', '....SSSS....', '.....SSS....',
      '....CCCCC...', '....CCCCCS..', '....CCCCCS..', '....CCCCC...', '....PPPPP...', '....PPPPP...', '.....PPP....', '.....BBB....'],
    right2: [
      '....AAAA....', '...AAAAAA...', '...HHHHHH...', '...HHHHHH...', '...HHSSSS...', '...HHSSES...', '....SSSS....', '.....SSS....',
      '....CCCCC...', '...SCCCCC...', '...SCCCCC...', '....CCCCC...', '....PPPPP...', '...PP..PP...', '...PP..PP...', '...BB..BB...'],
  };
  var DEFAULT_LOOK = { skin: '#f1c27d', hair: '#3b2a1a', shirt: '#1f3fae', pants: '#2f3b5c', hat: null };
  var SKINS = ['#ffe0c2', '#f1c27d', '#d9a066', '#b07a45', '#8d5524', '#5c3a1e'];
  var HAIRS = ['#1b1b1b', '#3b2a1a', '#8a5a30', '#d9a53c', '#b3261e', '#f0f0f0', '#1f3fae', '#ff6fd8'];
  var SHIRTS = ['#1f3fae', '#b3261e', '#1f7a3d', '#e0a000', '#7a3fb0', '#ff6fd8', '#39b6c6', '#f0f0f0', '#2a2a35'];
  var PANTS = ['#2f3b5c', '#1b1b1b', '#5c4838', '#7a1f3d', '#355e3b', '#c9c9c9'];
  var HATS = [null, '#b3261e', '#1f3fae', '#1b1b1b', '#ffd84d'];
  var spriteCache = {};
  function spriteKey(look, dir, frame) { return [look.skin, look.hair, look.shirt, look.pants, look.hat || '', dir, frame].join('|'); }
  function sprite(look, dir, frame) {
    var key = spriteKey(look, dir, frame);
    if (spriteCache[key]) return spriteCache[key];
    var mirror = dir === 'left';
    var tpl = TPL[(mirror ? 'right' : dir) + (frame ? '2' : '')];
    var cv = document.createElement('canvas'); cv.width = 12; cv.height = 16;
    var c = cv.getContext('2d');
    var map = { H: look.hair, S: look.skin, E: '#1b1b1b', C: look.shirt, P: look.pants, B: '#2a2a2a', A: look.hat || look.hair };
    for (var y = 0; y < 16; y++) for (var x = 0; x < 12; x++) {
      var ch = tpl[y][x];
      if (ch === '.') continue;
      if (ch === 'A' && !look.hat) { if (y < 2) continue; }
      c.fillStyle = map[ch]; c.fillRect(mirror ? 11 - x : x, y, 1, 1);
    }
    spriteCache[key] = cv;
    return cv;
  }
  function drawSprite(c, look, dir, frame, px, py) { c.drawImage(sprite(look, dir, frame), Math.round(px + 2), Math.round(py - 6)); }

  /* ------------------------------------------------------------ the world */
  function create(cfg) {
    if (!cfg || !cfg.mount || !cfg.maps || !cfg.state) throw new Error('HSCTWorld.create needs { mount, maps, state }');
    var mount = typeof cfg.mount === 'string' ? document.querySelector(cfg.mount) : cfg.mount;
    if (!mount) throw new Error('HSCTWorld: mount element not found');
    injectCss();
    var panels = cfg.panels || {};
    var S = null;                 // the saved state object (from cfg.state())
    var map = null, mapId = null; // current map
    var staticCv = null;          // the map painted once
    var player = { x: 0, y: 0, facing: 'down', moving: null, path: [] };
    var cam = { x: 0, y: 0 };
    var held = {};
    var paused = false, panelOpen = null, dialog = null, transition = 0, lastT = 0, frameClock = 0;
    var prompt = null;
    var effects = [], sinceFind = 99, toastQ = [], toastTimer = null;   // v0.2: sparkles, encounter cooldown, toasts
    /* v0.3: every car in every map, with the map it started on */
    var cars = [];
    Object.keys(cfg.maps).forEach(function (mid) { (cfg.maps[mid].objects || []).forEach(function (o) { if (o.type === 'car') { o.id = o.id || (mid + ':car:' + o.x + ',' + o.y); o._home = mid; cars.push(o); } }); });
    function carPos(o) { var p = S.cars && S.cars[o.id]; return p ? p : { map: o._home, x: o.x, y: o.y }; }
    function carById(id) { return cars.filter(function (c) { return c.id === id; })[0] || null; }
    function driving() { return S.driving ? carById(S.driving) : null; }
    function stepMs() { return driving() ? DRIVE_MS : STEP_MS; }
    var VW = VIEW_W, VH = VIEW_H;   // tiles on screen; smaller on phones so the sprites stay big

    mount.innerHTML = '<div class="hw-stage" tabindex="0" aria-label="The map. Arrow keys or WASD walk, Space or Enter talks and uses things.">'
      + '<div class="hw-hud"><span class="hw-map"></span><span class="hw-obj"></span><span class="hw-extra"></span><button type="button" class="hw-tasks-btn">Tasks</button></div>'
      + '<div class="hw-view"><canvas class="hw-cv" width="' + (VW * T) + '" height="' + (VH * T) + '"></canvas><div class="hw-labels"></div><div class="hw-fade"></div><div class="hw-toast" hidden></div>'
      + '<div class="hw-dialog" hidden><div class="hw-dname"></div><div class="hw-dtext"></div><div class="hw-dmore">▼</div></div>'
      + '<div class="hw-prompt" hidden></div>'
      + '<div class="hw-pad"><button type="button" data-d="up" aria-label="Walk up">▲</button><button type="button" data-d="left" aria-label="Walk left">◀</button><button type="button" data-d="right" aria-label="Walk right">▶</button><button type="button" data-d="down" aria-label="Walk down">▼</button></div>'
      + '<button type="button" class="hw-a" aria-label="Talk or use (A)">A</button>'
      + '<div class="hw-tasks" hidden><div class="hw-tasks-in"><h4>Where to go</h4><ul></ul><button type="button" class="hw-tasks-close">Close</button></div></div>'
      + '</div><p class="hw-help">Arrows / WASD walk · click a spot to walk there · <b>Space</b>, <b>Enter</b> or <b>A</b> talks, reads and sits down · <b>Esc</b> closes</p></div>'
      + '<div class="hw-panel" hidden><div class="hw-panel-bar"><button type="button" class="hw-back">← Back to the map</button><div class="hw-panel-title"></div></div><div class="hw-panel-body"></div></div>';
    var stage = mount.querySelector('.hw-stage'), view = mount.querySelector('.hw-view'), cv = mount.querySelector('.hw-cv'), ctx = cv.getContext('2d');
    var labels = mount.querySelector('.hw-labels'), fade = mount.querySelector('.hw-fade');
    var dlg = mount.querySelector('.hw-dialog'), dname = mount.querySelector('.hw-dname'), dtext = mount.querySelector('.hw-dtext'), dmore = mount.querySelector('.hw-dmore');
    var promptEl = mount.querySelector('.hw-prompt');
    var panelEl = mount.querySelector('.hw-panel'), panelBody = mount.querySelector('.hw-panel-body'), panelTitle = mount.querySelector('.hw-panel-title');
    var hudMap = mount.querySelector('.hw-map'), hudObj = mount.querySelector('.hw-obj'), hudExtra = mount.querySelector('.hw-extra'), toastEl = mount.querySelector('.hw-toast');
    var tasksEl = mount.querySelector('.hw-tasks');
    ctx.imageSmoothingEnabled = false;
    var panelNodes = {};
    function fitView() {
      var narrow = view.clientWidth > 0 && view.clientWidth < 560;
      var w = narrow ? 12 : VIEW_W, h = narrow ? 8 : VIEW_H;
      if (w === VW && h === VH && cv.width === w * T) return;
      VW = w; VH = h; cv.width = w * T; cv.height = h * T; ctx.imageSmoothingEnabled = false;
      view.style.aspectRatio = w + ' / ' + h;
      if (map) snapCamera();
    }
    window.addEventListener('resize', fitView);

    var ctxOf = function () { return { state: S, world: api }; };
    var evalProp = function (v) { return typeof v === 'function' ? v(ctxOf()) : v; };

    /* ---- map helpers ---- */
    function tileAt(x, y) { if (!map || y < 0 || y >= map.h || x < 0 || x >= map.w) return LEGEND['x']; return LEGEND[map.rows[y][x]] || LEGEND['x']; }
    function itemId(o) { return o.id || (mapId + ':' + o.x + ',' + o.y); }
    function isPicked(o) { return o.type === 'item' && S.picked && S.picked[itemId(o)]; }
    function objectsAt(x, y) {
      var out = map.objs.filter(function (o) { return o.type !== 'car' && !evalProp(o.hidden) && !isPicked(o) && (o.type === 'building' ? (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) : (o.x === x && o.y === y)); });
      cars.forEach(function (o) { if (evalProp(o.hidden) || S.driving === o.id) return; var p = carPos(o); if (p.map === mapId && p.x === x && p.y === y) out.push(o); });
      return out;
    }
    function itemAt(x, y) { return objectsAt(x, y).filter(function (o) { return o.type === 'item'; })[0] || null; }
    function solidAt(x, y) {
      var t = tileAt(x, y);
      if (t.solid) return true;
      if (S.driving && !t.drive) return true;   /* v0.3: a car stays on the road */
      var os = objectsAt(x, y);
      for (var i = 0; i < os.length; i++) {
        var o = os[i];
        if (o.type === 'building') { if (!(o.door && o.door.x === x && o.door.y === y)) return true; }
        else if (o.type === 'npc' || o.type === 'sign' || o.type === 'hotspot' || o.type === 'car') return true;
      }
      return false;
    }
    /* walkable on foot, regardless of the car */
    function footFree(x, y) { var t = tileAt(x, y); if (t.solid) return false; var os = objectsAt(x, y); for (var i = 0; i < os.length; i++) { var o = os[i]; if (o.type === 'building' ? !(o.door && o.door.x === x && o.door.y === y) : (o.type === 'npc' || o.type === 'sign' || o.type === 'hotspot' || o.type === 'car')) return false; } return !portalAt(x, y); }
    function portalAt(x, y) { return objectsAt(x, y).filter(function (o) { return o.type === 'portal'; })[0] || null; }
    function interactableAt(x, y) { return objectsAt(x, y).filter(function (o) { return o.type === 'npc' || o.type === 'sign' || o.type === 'hotspot' || o.type === 'car'; })[0] || null; }
    /* v0.3: get in / get out */
    function getIn(car) {
      var why = evalProp(car.locked);
      if (car.parked) { say(null, why || 'Not your car.'); return; }
      if (why) { say(null, typeof why === 'string' ? why : 'You can\'t take that car right now.'); return; }
      var p = carPos(car);
      S.driving = car.id; S.cars = S.cars || {}; S.cars[car.id] = { map: mapId, x: p.x, y: p.y };
      player.x = p.x; player.y = p.y; player.moving = null; player.path = []; S.x = p.x; S.y = p.y;
      toast((car.label || 'The car') + ' — arrows drive, A gets out.');
      if (cfg.onDrive) cfg.onDrive(true, car.id);
      refresh(); updatePrompt();
    }
    function getOut() {
      var car = driving(); if (!car) return;
      var order = [player.facing].concat(Object.keys(DIRS).filter(function (k) { return k !== player.facing; }));
      for (var i = 0; i < order.length; i++) {
        var d = DIRS[order[i]], nx = player.x + d[0], ny = player.y + d[1];
        if (footFree(nx, ny)) {
          S.cars[car.id] = { map: mapId, x: player.x, y: player.y };
          S.driving = null;
          player.x = nx; player.y = ny; player.facing = order[i]; S.x = nx; S.y = ny; S.facing = order[i]; player.moving = null; player.path = [];
          if (cfg.onDrive) cfg.onDrive(false, car.id);
          refresh(); updatePrompt();
          return;
        }
      }
      toast('Nowhere to get out here. Pull over first.');
    }

    function loadMap(id) {
      var m = cfg.maps[id];
      if (!m) throw new Error('HSCTWorld: no map "' + id + '"');
      mapId = id;
      map = { id: id, title: m.title || id, rows: m.rows, h: m.rows.length, w: Math.max.apply(null, m.rows.map(function (r) { return r.length; })), objs: m.objects || [] };
      map.rows = m.rows.map(function (r) { while (r.length < map.w) r += 'x'; return r; });
      staticCv = document.createElement('canvas'); staticCv.width = map.w * T; staticCv.height = map.h * T;
      var c = staticCv.getContext('2d'); c.imageSmoothingEnabled = false;
      for (var y = 0; y < map.h; y++) for (var x = 0; x < map.w; x++) paintTile(c, tileAt(x, y).k, x, y);
      map.objs.forEach(function (o) { if (o.type === 'building') paintBuilding(c, o); });
      map.objs.forEach(function (o) {
        if (o.type === 'sign') { c.save(); c.translate(o.x * T, o.y * T); c.fillStyle = '#5c4838'; c.fillRect(7, 8, 2, 8); c.fillStyle = '#b8864e'; c.fillRect(2, 2, 12, 7); c.fillStyle = '#5c4838'; c.fillRect(4, 4, 8, 1); c.fillRect(4, 6, 6, 1); c.restore(); }
        if (o.type === 'portal' && !o.quiet) { c.save(); c.translate(o.x * T, o.y * T); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(2, 13, 12, 2); c.restore(); }
      });
      S.visited = S.visited || {}; S.visited[id] = true;
      hudMap.textContent = map.title;
      labels.innerHTML = '';
      map.objs.forEach(function (o) { if (o.type === 'building' && o.label) { var d = document.createElement('div'); d.className = 'hw-label'; d.textContent = o.label; d._o = o; labels.appendChild(d); } });
      if (cfg.onEnterMap) cfg.onEnterMap(id);
      renderTasks();
    }
    function paintBuilding(c, o) {
      var x0 = o.x * T, y0 = o.y * T, w = o.w * T, h = o.h * T, roofH = Math.max(T, Math.round(h * 0.42));
      c.fillStyle = o.wall || '#f3e6cf'; c.fillRect(x0, y0 + roofH, w, h - roofH);
      c.fillStyle = '#c9b89a'; c.fillRect(x0, y0 + h - 2, w, 2);
      c.fillStyle = o.color || '#b3463c'; c.fillRect(x0 - 2, y0, w + 4, roofH);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x0 - 2, y0 + roofH - 3, w + 4, 3);
      c.fillStyle = 'rgba(255,255,255,.18)'; for (var i = 2; i < w + 2; i += 8) c.fillRect(x0 - 2 + i, y0 + 2, 3, roofH - 7);
      for (var wx = x0 + 6; wx < x0 + w - 10; wx += 16) { if (o.door && Math.abs(wx - (o.door.x * T + 4)) < 10) continue; c.fillStyle = '#5f8fd9'; c.fillRect(wx, y0 + roofH + 4, 8, 7); c.fillStyle = '#fff'; c.fillRect(wx + 3, y0 + roofH + 4, 1, 7); c.fillRect(wx, y0 + roofH + 7, 8, 1); }
      if (o.door) { var dx = o.door.x * T, dy = o.door.y * T; c.fillStyle = '#5c3b1e'; c.fillRect(dx + 3, dy + 2, 10, 14); c.fillStyle = '#ffd84d'; c.fillRect(dx + 10, dy + 9, 2, 2); }
    }

    /* ---- player placement ---- */
    function place(x, y, facing) { player.x = x; player.y = y; player.facing = facing || player.facing; player.moving = null; player.path = []; S.map = mapId; S.x = x; S.y = y; S.facing = player.facing; snapCamera(); }
    function snapCamera() { cam.x = clampCam(player.x * T + T / 2 - (VW * T) / 2, map.w * T, VW * T); cam.y = clampCam(player.y * T + T / 2 - (VH * T) / 2, map.h * T, VH * T); }
    function clampCam(v, mapPx, viewPx) { if (mapPx <= viewPx) return (mapPx - viewPx) / 2; return Math.max(0, Math.min(mapPx - viewPx, v)); }
    function sync() {
      S = cfg.state();
      if (!S.look) S.look = Object.assign({}, DEFAULT_LOOK);
      var st = cfg.start || { map: Object.keys(cfg.maps)[0], x: 1, y: 1 };
      var id = S.map && cfg.maps[S.map] ? S.map : st.map;
      loadMap(id);
      place(typeof S.x === 'number' ? S.x : st.x, typeof S.y === 'number' ? S.y : st.y, S.facing || st.facing || 'down');
      if (solidAt(player.x, player.y)) place(st.x, st.y, st.facing || 'down');
      refresh();
    }

    /* ---- movement ---- */
    function tryStep(dir) {
      if (player.moving || paused || dialog || panelOpen || transition) return false;
      player.facing = dir; S.facing = dir;
      var d = DIRS[dir], nx = player.x + d[0], ny = player.y + d[1];
      if (solidAt(nx, ny)) { updatePrompt(); return false; }
      player.moving = { fx: player.x, fy: player.y, tx: nx, ty: ny, t: 0 };
      return true;
    }
    function arrive() {
      player.x = player.moving.tx; player.y = player.moving.ty; player.moving = null;
      S.x = player.x; S.y = player.y; S.steps = (S.steps || 0) + 1;
      var p = portalAt(player.x, player.y);
      if (p) { player.path = []; usePortal(p); return; }
      /* v0.2: items are picked up by stepping on them, once */
      var it = itemAt(player.x, player.y);
      if (it) {
        S.picked = S.picked || {}; S.picked[itemId(it)] = true;
        sparkle(player.x, player.y);
        var msg = it.onPick ? it.onPick(ctxOf(), it) : cfg.onPick ? cfg.onPick(it, ctxOf()) : (it.label ? 'Found ' + it.label + '!' : null);
        if (msg) toast(msg);
        refresh();
      }
      /* v0.2: tall grass can hide something */
      sinceFind++;
      if (tileAt(player.x, player.y).grass && cfg.grass && !it) {
        var g = cfg.grass, cd = g.cooldown == null ? 2 : g.cooldown;
        if (sinceFind > cd && Math.random() < (g.chance == null ? 0.18 : g.chance)) {
          sinceFind = 0;
          sparkle(player.x, player.y);
          var found = g.onFind ? g.onFind(ctxOf(), { map: mapId, x: player.x, y: player.y }) : null;
          if (found) toast(found);
          refresh();
        }
      }
      updatePrompt();
      if (cfg.onMove) cfg.onMove(player.x, player.y, mapId);
    }
    function sparkle(x, y) { effects.push({ x: x, y: y, t0: frameClock }); }
    function toast(text, ms) {
      toastQ.push({ text: String(text), ms: ms || 2200 });
      if (!toastTimer) nextToast();
    }
    function nextToast() {
      var t = toastQ.shift();
      if (!t) { toastTimer = null; toastEl.hidden = true; return; }
      toastEl.textContent = t.text; toastEl.hidden = false;
      toastTimer = setTimeout(function () { toastEl.hidden = true; toastTimer = setTimeout(nextToast, 160); }, t.ms);
    }
    function usePortal(p) {
      var why = evalProp(p.locked);
      if (why) { say(null, typeof why === 'string' ? why : 'That way is locked for now.'); stepBack(); return; }
      if (S.driving && !p.drive) { say(null, p.parkMsg || 'Park first. You can\'t drive through a door.'); stepBack(); return; }
      if (p.to && p.to.panel) { openPanel(p.to.panel, function () { stepBack(); }); return; }
      if (p.to && p.to.map) {
        transition = 1;
        fade.style.opacity = 1;
        setTimeout(function () { loadMap(p.to.map); place(p.to.x, p.to.y, p.to.facing || 'down'); if (S.driving) S.cars[S.driving] = { map: mapId, x: player.x, y: player.y }; fade.style.opacity = 0; setTimeout(function () { transition = 0; updatePrompt(); }, 220); }, 220);
      }
    }
    function stepBack() { var d = DIRS[player.facing]; var bx = player.x - d[0], by = player.y - d[1]; if (!solidAt(bx, by)) { player.moving = { fx: player.x, fy: player.y, tx: bx, ty: by, t: 0 }; player.facing = { up: 'down', down: 'up', left: 'right', right: 'left' }[player.facing]; } }
    function walkTo(tx, ty) {
      if (paused || dialog || panelOpen || transition) return;
      var target = interactableAt(tx, ty);
      var goal = null;
      if (target || solidAt(tx, ty)) {
        var best = null;
        Object.keys(DIRS).forEach(function (k) { var d = DIRS[k], ax = tx + d[0], ay = ty + d[1]; if (!solidAt(ax, ay)) { var dist = Math.abs(ax - player.x) + Math.abs(ay - player.y); if (!best || dist < best.dist) best = { x: ax, y: ay, dist: dist, face: { up: 'down', down: 'up', left: 'right', right: 'left' }[k] }; } });
        if (!best) return;
        goal = best;
      } else goal = { x: tx, y: ty };
      var path = bfs(player.x, player.y, goal.x, goal.y);
      if (!path) return;
      player.path = path;
      player.pathEnd = target ? { face: goal.face, obj: target } : null;
    }
    function bfs(sx, sy, tx, ty) {
      if (sx === tx && sy === ty) return [];
      var seen = {}; seen[sx + ',' + sy] = null;
      var q = [[sx, sy]], n = 0;
      while (q.length && n++ < 2500) {
        var cur = q.shift();
        var ks = Object.keys(DIRS);
        for (var i = 0; i < ks.length; i++) {
          var d = DIRS[ks[i]], nx = cur[0] + d[0], ny = cur[1] + d[1], key = nx + ',' + ny;
          if (key in seen || solidAt(nx, ny)) continue;
          seen[key] = ks[i];
          if (nx === tx && ny === ty) { var path = [], x = nx, y = ny; while (!(x === sx && y === sy)) { var dir = seen[x + ',' + y]; path.unshift(dir); var dd = DIRS[dir]; x -= dd[0]; y -= dd[1]; } return path; }
          if (portalAt(nx, ny) && !(nx === tx && ny === ty)) continue;   // don't walk through a door on the way somewhere else
          q.push([nx, ny]);
        }
      }
      return null;
    }

    /* ---- interaction ---- */
    function facingTile() { var d = DIRS[player.facing]; return { x: player.x + d[0], y: player.y + d[1] }; }
    function interact() {
      if (paused || panelOpen || transition) return;
      if (dialog) { advanceDialog(); return; }
      if (player.moving) return;
      if (S.driving) { getOut(); return; }
      var f = facingTile(), o = interactableAt(f.x, f.y);
      if (!o) return;
      if (o.type === 'car') { getIn(o); return; }
      if (o.type === 'sign') { say(null, evalProp(o.text)); return; }
      if (o.type === 'npc') { if (!o.fixed) o._face = { up: 'down', down: 'up', left: 'right', right: 'left' }[player.facing]; say(o.name, evalProp(o.say)); return; }
      if (o.type === 'hotspot') { var why = evalProp(o.locked); if (why) { say(null, typeof why === 'string' ? why : 'Locked for now.'); return; } openPanel(o.panel); }
    }
    function updatePrompt() {
      if (S.driving && !dialog && !panelOpen) { promptEl.innerHTML = '<kbd>A</kbd> Get out'; promptEl.hidden = false; prompt = null; return; }
      var f = facingTile(), o = interactableAt(f.x, f.y);
      if (!o || dialog || panelOpen) { promptEl.hidden = true; prompt = null; return; }
      prompt = o;
      var verb = o.type === 'npc' ? 'Talk to ' + (o.name || 'them') : o.type === 'sign' ? 'Read the sign' : o.type === 'car' ? (o.parked ? 'Look at ' + (o.label || 'the car') : 'Get in ' + (o.label || 'the car')) : (evalProp(o.locked) ? '🔒 ' : '') + (o.label || 'Use');
      promptEl.innerHTML = '<kbd>A</kbd> ' + esc(verb);
      promptEl.hidden = false;
    }

    /* ---- dialogue ---- */
    function say(name, lines) {
      if (lines == null) return;
      var arr = Array.isArray(lines) ? lines.slice() : [String(lines)];
      arr = arr.filter(function (l) { return l != null && String(l).length; });
      if (!arr.length) return;
      dialog = { name: name, lines: arr, i: 0, shown: 0, done: false };
      dname.textContent = name || ''; dname.hidden = !name;
      dlg.hidden = false; promptEl.hidden = true;
      typeLine();
    }
    function typeLine() {
      var line = dialog.lines[dialog.i];
      dialog.shown = 0; dialog.done = false; dmore.style.visibility = 'hidden';
      clearInterval(dialog.timer);
      dialog.timer = setInterval(function () { dialog.shown += 2; dtext.textContent = line.slice(0, dialog.shown); if (dialog.shown >= line.length) { finishLine(); } }, 16);
    }
    function finishLine() { clearInterval(dialog.timer); dtext.textContent = dialog.lines[dialog.i]; dialog.done = true; dmore.style.visibility = 'visible'; dmore.textContent = dialog.i < dialog.lines.length - 1 ? '▼' : '✕'; }
    function closeDialog() { if (!dialog) return; clearInterval(dialog.timer); dialog = null; dlg.hidden = true; }
    function advanceDialog() {
      if (!dialog) return;
      if (!dialog.done) { finishLine(); return; }
      if (dialog.i < dialog.lines.length - 1) { dialog.i++; typeLine(); return; }
      clearInterval(dialog.timer); dialog = null; dlg.hidden = true; updatePrompt();
    }

    /* ---- panels ---- */
    function openPanel(id, onClose) {
      var p = panels[id];
      if (!p) { say(null, 'Nothing here yet (panel "' + id + '" is not defined).'); return; }
      panelOpen = { id: id, onClose: onClose };
      S.opened = S.opened || {}; S.opened[id] = (S.opened[id] || 0) + 1;
      held = {};
      panelTitle.innerHTML = '<b>' + esc(evalProp(p.title) || id) + '</b>' + (p.subtitle ? '<span>' + esc(evalProp(p.subtitle)) + '</span>' : '');
      panelBody.innerHTML = '';
      var node = panelNodes[id];
      if (!node || p.rebuild) { node = document.createElement('div'); node.className = 'hw-panel-host'; p.build(node, { close: closePanel, world: api, state: S, id: id }); panelNodes[id] = node; }
      panelBody.appendChild(node);
      stage.hidden = true; panelEl.hidden = false;
      promptEl.hidden = true;
      window.scrollTo(0, Math.max(0, mount.getBoundingClientRect().top + window.scrollY - 10));
      if (cfg.onPanelOpen) cfg.onPanelOpen(id);
      var first = node.querySelector('input,button,textarea,select,[tabindex]'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    }
    function closePanel() {
      if (!panelOpen) return;
      var id = panelOpen.id, cb = panelOpen.onClose;
      panelOpen = null;
      panelEl.hidden = true; stage.hidden = false;
      if (cfg.onPanelClose) cfg.onPanelClose(id);
      refresh();
      if (cb) cb();
      focus();
      updatePrompt();
    }
    mount.querySelector('.hw-back').onclick = closePanel;

    /* ---- HUD / tasks list ---- */
    function doneOf(id) { var p = panels[id]; if (!p || !p.done) return 0; var v = p.done(ctxOf()); return v === true ? 1 : v === false || v == null ? 0 : Math.max(0, Math.min(1, +v)); }
    function renderTasks() {
      var ul = tasksEl.querySelector('ul'), items = [];
      Object.keys(cfg.maps).forEach(function (mid) {
        (cfg.maps[mid].objects || []).forEach(function (o) {
          var pid = o.type === 'hotspot' ? o.panel : (o.type === 'portal' && o.to && o.to.panel) ? o.to.panel : null;
          if (!pid || !panels[pid] || evalProp(o.hidden)) return;
          var d = doneOf(pid), why = evalProp(o.locked);
          items.push('<li class="' + (d >= 1 ? 'ok' : why ? 'lock' : '') + '"><span class="ic">' + (d >= 1 ? '✓' : why ? '🔒' : d > 0 ? '◐' : '○') + '</span><span><b>' + esc(evalProp(panels[pid].title) || pid) + '</b> <small>' + esc(cfg.maps[mid].title || mid) + (o.label ? ' · ' + o.label : '') + '</small>' + (why && typeof why === 'string' ? '<small class="why">' + esc(why) + '</small>' : '') + '</span></li>');
        });
      });
      ul.innerHTML = items.join('') || '<li>Nothing to do yet.</li>';
      if (cfg.objective) hudObj.textContent = cfg.objective(ctxOf()) || '';
      if (cfg.hud) hudExtra.innerHTML = cfg.hud(ctxOf()) || '';
    }
    mount.querySelector('.hw-tasks-btn').onclick = function () { tasksEl.hidden = false; renderTasks(); };
    mount.querySelector('.hw-tasks-close').onclick = function () { tasksEl.hidden = true; focus(); };

    /* ---- render loop ---- */
    function draw(dt) {
      frameClock += dt;
      if (player.moving) {
        player.moving.t += dt / stepMs();
        if (player.moving.t >= 1) arrive();
      }
      if (!player.moving && !dialog && !panelOpen && !paused && !transition) {
        if (player.path.length) { var dir = player.path.shift(); if (!tryStep(dir)) player.path = []; if (!player.path.length && player.pathEnd && !player.moving) { player.facing = player.pathEnd.face; player.pathEnd = null; updatePrompt(); } }
        else if (player.pathEnd) { player.facing = player.pathEnd.face; S.facing = player.facing; player.pathEnd = null; updatePrompt(); }
        else { var ks = ['up', 'down', 'left', 'right']; for (var i = 0; i < ks.length; i++) if (held[ks[i]]) { tryStep(ks[i]); break; } }
      }
      var px = player.x * T, py = player.y * T;
      if (player.moving) { var m = player.moving, e = m.t; px = (m.fx + (m.tx - m.fx) * e) * T; py = (m.fy + (m.ty - m.fy) * e) * T; }
      var cx = clampCam(px + T / 2 - (VW * T) / 2, map.w * T, VW * T), cy = clampCam(py + T / 2 - (VH * T) / 2, map.h * T, VH * T);
      cam.x += (cx - cam.x) * Math.min(1, dt / 80); cam.y += (cy - cam.y) * Math.min(1, dt / 80);
      var ox = Math.round(cam.x), oy = Math.round(cam.y);
      ctx.fillStyle = '#05040f'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(staticCv, -ox, -oy);
      /* dynamic objects, sorted by y so the player walks in front of/behind things */
      var drawables = [];
      map.objs.forEach(function (o) {
        if (evalProp(o.hidden)) return;
        if (o.type === 'npc') drawables.push({ y: o.y * T, f: function () { var look = Object.assign({}, DEFAULT_LOOK, o.look || {}); var bob = Math.floor(frameClock / 600) % 2; drawSprite(ctx, look, o._face || o.facing || 'down', 0, o.x * T - ox, o.y * T - oy - bob); } });
        if (o.type === 'hotspot') drawables.push({ y: o.y * T - 1, f: function () { ctx.save(); ctx.translate(o.x * T - ox, o.y * T - oy); (ICON_PAINT[o.icon] || ICON_PAINT.desk)(ctx); ctx.restore(); drawMarker(o, o.x * T - ox, o.y * T - oy); } });
        if (o.type === 'item' && !isPicked(o)) drawables.push({ y: o.y * T - 2, f: function () { var bob = Math.round(Math.sin(frameClock / 250 + o.x) * 1.5); ctx.save(); ctx.translate(o.x * T - ox, o.y * T - oy + bob); (ICON_PAINT[o.icon] || ICON_PAINT.coin)(ctx); ctx.restore(); } });
        if (o.type === 'portal' && o.to && o.to.panel) drawables.push({ y: o.y * T - 1, f: function () { drawMarker(o, o.x * T - ox, o.y * T - oy - 10); } });
        if (o.type === 'building' && o.door) { var pid = portalPanelOf(o); if (pid) drawables.push({ y: 0, f: function () { drawMarkerFor(pid, o, (o.x + o.w / 2) * T - T / 2 - ox, o.y * T - oy - 2); } }); }
      });
      /* v0.3: parked cars on this map */
      cars.forEach(function (o) { if (evalProp(o.hidden) || S.driving === o.id) return; var p = carPos(o); if (p.map !== mapId) return; drawables.push({ y: p.y * T, f: function () { ctx.drawImage(carSprite(o.color || '#b3261e', o.facing || 'down'), p.x * T - ox, p.y * T - oy); } }); });
      drawables.push({ y: py, f: function () {
        var car = driving();
        if (car) { var bump = player.moving ? (Math.floor(frameClock / 90) % 2) : 0; ctx.drawImage(carSprite(car.color || '#b3261e', player.facing), Math.round(px - ox), Math.round(py - oy - bump)); return; }
        var frame = player.moving ? Math.floor(frameClock / 120) % 2 : 0;
        drawSprite(ctx, S.look, player.facing, frame, px - ox, py - oy);
        /* v0.2: in tall grass the player's legs are hidden by the blades */
        var gx = player.moving ? player.moving.tx : player.x, gy = player.moving ? player.moving.ty : player.y;
        if (tileAt(gx, gy).grass && (!player.moving || player.moving.t > 0.5)) { ctx.save(); ctx.translate(gx * T - ox, gy * T - oy); paintGrassOver(ctx, gx, gy); ctx.restore(); }
      } });
      drawables.sort(function (a, b) { return a.y - b.y; }).forEach(function (d) { d.f(); });
      /* v0.2: sparkles for finds and pickups */
      for (var ei = effects.length - 1; ei >= 0; ei--) {
        var ef = effects[ei], age = frameClock - ef.t0;
        if (age > 700) { effects.splice(ei, 1); continue; }
        ctx.save(); ctx.translate(ef.x * T - ox, ef.y * T - oy);
        for (var k = 0; k < 6; k++) { var ang = k * 1.047 + age / 400, r = 3 + age / 60; ctx.fillStyle = k % 2 ? '#ffd84d' : '#fff'; ctx.fillRect(Math.round(8 + Math.cos(ang) * r) - 1, Math.round(6 + Math.sin(ang) * r - age / 90) - 1, 2, 2); }
        ctx.restore();
      }
      /* labels follow the camera */
      var scale = view.clientWidth / cv.width;
      for (var i = 0; i < labels.children.length; i++) { var L = labels.children[i], o = L._o; L.style.left = ((o.x + o.w / 2) * T - ox) * scale + 'px'; L.style.top = (o.y * T - oy - 4) * scale + 'px'; }
    }
    function portalPanelOf(b) { var p = map.objs.filter(function (o) { return o.type === 'portal' && o.x === b.door.x && o.y === b.door.y; })[0]; return p && p.to && p.to.panel ? p.to.panel : null; }
    function drawMarker(o, x, y) { var pid = o.panel || (o.to && o.to.panel); if (pid) drawMarkerFor(pid, o, x, y - 10); }
    function drawMarkerFor(pid, o, x, y) {
      var d = doneOf(pid), why = evalProp(o.locked);
      var bob = Math.sin(frameClock / 300) * 1.5;
      ctx.save(); ctx.translate(Math.round(x), Math.round(y + bob));
      if (d >= 1) { ctx.fillStyle = '#1f7a3d'; ctx.fillRect(4, 0, 8, 8); ctx.fillStyle = '#fff'; ctx.fillRect(6, 4, 1, 2); ctx.fillRect(7, 5, 1, 1); ctx.fillRect(8, 3, 1, 2); ctx.fillRect(9, 2, 1, 1); }
      else if (why) { ctx.fillStyle = '#5b6485'; ctx.fillRect(5, 3, 6, 5); ctx.fillStyle = '#9aa3c4'; ctx.fillRect(6, 1, 1, 3); ctx.fillRect(9, 1, 1, 3); ctx.fillRect(6, 1, 4, 1); }
      else { ctx.fillStyle = '#ffd84d'; ctx.fillRect(6, 0, 4, 5); ctx.fillRect(6, 6, 4, 2); }
      ctx.restore();
    }
    function loop(t) { var dt = Math.min(50, t - (lastT || t)); lastT = t; if (!panelOpen && mount.isConnected) draw(dt); api._raf = requestAnimationFrame(loop); }

    /* ---- input ---- */
    var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    function onKey(e) {
      if (panelOpen || paused) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Escape') { if (dialog) { closeDialog(); updatePrompt(); } if (!tasksEl.hidden) tasksEl.hidden = true; return; }
      if (!tasksEl.hidden) return;
      var d = KEYS[e.key];
      if (d) { e.preventDefault(); if (e.type === 'keydown') { held[d] = true; player.path = []; if (dialog) return; if (!player.moving) { player.facing = d; S.facing = d; updatePrompt(); } } else delete held[d]; return; }
      if (e.type === 'keydown' && (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E')) { e.preventDefault(); interact(); }
    }
    stage.addEventListener('keydown', onKey); stage.addEventListener('keyup', onKey);
    stage.addEventListener('blur', function () { held = {}; });
    mount.querySelectorAll('.hw-pad button').forEach(function (b) {
      var d = b.dataset.d;
      var down = function (e) { e.preventDefault(); held[d] = true; player.path = []; if (!player.moving && !dialog) { player.facing = d; updatePrompt(); } };
      var up = function (e) { e.preventDefault(); delete held[d]; };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    mount.querySelector('.hw-a').addEventListener('click', function () { interact(); focus(); });
    cv.addEventListener('click', function (e) {
      if (dialog) { advanceDialog(); return; }
      var r = cv.getBoundingClientRect(), scale = r.width / cv.width;
      var tx = Math.floor((e.clientX - r.left) / scale / T + cam.x / T), ty = Math.floor((e.clientY - r.top) / scale / T + cam.y / T);
      walkTo(tx, ty); focus();
    });
    dlg.addEventListener('click', advanceDialog);
    function focus() { try { stage.focus({ preventScroll: true }); } catch (e) {} }

    /* ---- public ---- */
    function refresh() { renderTasks(); }
    var api = {
      sync: sync, refresh: refresh, say: say, toast: toast, sparkle: sparkle, openPanel: openPanel, closePanel: closePanel, focus: focus,
      getOut: getOut, carAt: function (id) { var c = carById(id); return c ? carPos(c) : null; }, get driving() { return S.driving || null; },
      teleport: function (m, x, y, facing) { closeDialog(); if (m !== mapId) loadMap(m); place(x, y, facing); if (S.driving) S.cars[S.driving] = { map: mapId, x: x, y: y }; updatePrompt(); },
      setLook: function (look) { S.look = Object.assign({}, DEFAULT_LOOK, look || {}); },
      pause: function () { paused = true; held = {}; }, resume: function () { paused = false; },
      get map() { return mapId; }, get player() { return { x: player.x, y: player.y, facing: player.facing }; }, get state() { return S; },
      destroy: function () { cancelAnimationFrame(api._raf); mount.innerHTML = ''; },
    };
    fitView();
    sync();
    api._raf = requestAnimationFrame(loop);
    return api;
  }

  /* ------------------------------------------------- character creator */
  function characterPicker(el, opts) {
    el = typeof el === 'string' ? document.querySelector(el) : el;
    injectCss();
    opts = opts || {};
    var look = Object.assign({}, DEFAULT_LOOK, opts.look || {});
    var dir = 'down', frame = 0;
    var rows = [['skin', 'Skin', SKINS], ['hair', 'Hair', HAIRS], ['shirt', 'Shirt', SHIRTS], ['pants', 'Pants', PANTS], ['hat', 'Hat', HATS]];
    el.innerHTML = '<div class="hw-picker"><div class="hw-preview"><canvas width="48" height="64"></canvas><div class="hw-turn"><button type="button" data-t="-1" aria-label="Turn left">↺</button><button type="button" data-t="1" aria-label="Turn right">↻</button></div></div><div class="hw-swatches">'
      + rows.map(function (r) { return '<div class="hw-row"><span>' + r[1] + '</span><div>' + r[2].map(function (c) { return '<button type="button" data-k="' + r[0] + '" data-c="' + (c || '') + '" class="hw-sw' + (c ? '' : ' none') + '" style="background:' + (c || 'transparent') + '" aria-label="' + r[1] + ' ' + (c || 'none') + '"></button>'; }).join('') + '</div></div>'; }).join('')
      + '<button type="button" class="hw-rand">Surprise me</button></div></div>';
    var cvs = el.querySelector('canvas'), c = cvs.getContext('2d'); c.imageSmoothingEnabled = false;
    function paint() {
      c.clearRect(0, 0, 48, 64); c.save(); c.scale(4, 4); c.drawImage(sprite(look, dir, frame), 0, 0); c.restore();
      el.querySelectorAll('.hw-sw').forEach(function (b) { b.classList.toggle('on', (look[b.dataset.k] || '') === b.dataset.c); });
      if (opts.onChange) opts.onChange(Object.assign({}, look));
    }
    el.querySelectorAll('.hw-sw').forEach(function (b) { b.onclick = function () { look[b.dataset.k] = b.dataset.c || null; paint(); }; });
    el.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { var order = ['down', 'left', 'up', 'right']; dir = order[(order.indexOf(dir) + (+b.dataset.t) + 4) % 4]; paint(); }; });
    el.querySelector('.hw-rand').onclick = function () { look = randomLook(); paint(); };
    var walk = setInterval(function () { if (!el.isConnected) { clearInterval(walk); return; } frame = frame ? 0 : 1; paint(); }, 400);
    paint();
    return { get look() { return Object.assign({}, look); }, set: function (l) { look = Object.assign({}, DEFAULT_LOOK, l || {}); paint(); } };
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function randomLook() { return { skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS), hat: Math.random() < 0.3 ? pick(HATS.slice(1)) : null }; }

  /* -------------------------------------------------------------- css */
  var CSS = '.hw-stage [hidden],.hw-stage[hidden],.hw-panel[hidden]{display:none !important}.hw-stage{outline:none !important;position:relative}.hw-stage:focus-visible .hw-view{box-shadow:0 0 0 3px #a9b7ea}'
    + '.hw-hud{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:14px;margin:0 0 8px;color:var(--muted,#5b6485)}.hw-hud .hw-map{font-weight:700;color:var(--ink,#101a3f)}.hw-hud .hw-obj{flex:1;min-width:0}.hw-hud .hw-obj:not(:empty)::before{content:"Objective: ";color:var(--muted,#5b6485);font-weight:600}'
    + '.hw-tasks-btn,.hw-tasks-close{font:600 13px inherit;padding:5px 11px;border-radius:999px;border:1.5px solid var(--line,#d3d9ee);background:#fff;color:var(--ink,#101a3f);cursor:pointer}'
    + '.hw-view{position:relative;width:100%;max-width:960px;aspect-ratio:5/3;background:#05040f;border-radius:12px;overflow:hidden;box-shadow:0 14px 34px -22px rgba(16,26,63,.9);user-select:none;-webkit-user-select:none;touch-action:none}'
    + '.hw-cv{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;cursor:pointer}'
    + '.hw-labels{position:absolute;inset:0;pointer-events:none}.hw-label{position:absolute;transform:translate(-50%,-100%);font:700 12px "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.04em;color:#fff;background:rgba(5,4,15,.75);padding:2px 7px;border-radius:6px;white-space:nowrap}'
    + '.hw-fade{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .22s;pointer-events:none}'
    + '.hw-toast{position:absolute;left:50%;top:16%;transform:translateX(-50%);background:#ffd84d;color:#101a3f;border:2px solid #101a3f;font:700 14px "IBM Plex Sans",system-ui,sans-serif;padding:7px 14px;border-radius:999px;pointer-events:none;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis;box-shadow:0 6px 18px -8px rgba(0,0,0,.6);animation:hwpop .18s ease-out}'
    + '@keyframes hwpop{from{transform:translateX(-50%) scale(.85);opacity:0}}.hw-hud .hw-extra{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:13px;white-space:nowrap}'
    + '@media (max-width:560px){.hw-hud .hw-obj{flex-basis:100%;order:5;font-size:13px}}'
    + '.hw-dialog{position:absolute;left:3%;right:3%;bottom:4%;background:rgba(255,255,255,.96);color:#101a3f;border:3px solid #101a3f;border-radius:10px;padding:10px 40px 10px 14px;font:16px "IBM Plex Sans",system-ui,sans-serif;line-height:1.4;min-height:3.6em;cursor:pointer;box-shadow:0 6px 18px -8px rgba(0,0,0,.6)}'
    + '.hw-dname{font-weight:700;color:#1f3fae;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px}.hw-dmore{position:absolute;right:12px;bottom:8px;font-size:13px;color:#1f3fae;animation:hwbob 1s infinite}'
    + '@keyframes hwbob{50%{transform:translateY(2px)}}'
    + '.hw-prompt{position:absolute;left:50%;top:6%;transform:translateX(-50%);background:rgba(5,4,15,.8);color:#fff;font:600 13px "IBM Plex Sans",system-ui,sans-serif;padding:5px 11px;border-radius:999px;pointer-events:none;white-space:nowrap}.hw-prompt kbd{font:700 11px ui-monospace,monospace;background:#fff;color:#101a3f;border-radius:4px;padding:1px 5px;margin-right:4px}'
    + '.hw-pad{position:absolute;left:10px;bottom:10px;display:grid;grid-template-columns:repeat(3,38px);grid-template-rows:repeat(3,38px);gap:2px;opacity:.9}.hw-pad button{grid-area:auto;border:0;border-radius:8px;background:rgba(255,255,255,.85);color:#101a3f;font-size:16px;cursor:pointer;touch-action:none}'
    + '.hw-pad [data-d=up]{grid-column:2;grid-row:1}.hw-pad [data-d=left]{grid-column:1;grid-row:2}.hw-pad [data-d=right]{grid-column:3;grid-row:2}.hw-pad [data-d=down]{grid-column:2;grid-row:3}'
    + '.hw-a{position:absolute;right:12px;bottom:14px;width:52px;height:52px;border-radius:50%;border:0;background:#ffd84d;color:#101a3f;font:800 18px "IBM Plex Sans",system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8964a}.hw-a:active{transform:translateY(3px);box-shadow:0 1px 0 #b8964a}'
    + '@media (hover:hover) and (pointer:fine){.hw-pad{display:none}.hw-a{display:none}}'
    + '.hw-help{font-size:13px;color:var(--muted,#5b6485);margin:8px 0 0}'
    + '.hw-tasks{position:absolute;inset:0;background:rgba(5,4,15,.6);display:grid;place-items:center;z-index:5}.hw-tasks-in{background:#fff;color:#101a3f;border-radius:12px;padding:16px 18px;min-width:min(90%,420px);max-height:90%;overflow:auto;font:15px "IBM Plex Sans",system-ui,sans-serif}.hw-tasks-in h4{margin:0 0 8px;font-size:16px}.hw-tasks-in ul{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:6px}.hw-tasks-in li{display:grid;grid-template-columns:22px 1fr;gap:6px;align-items:start}.hw-tasks-in li.ok .ic{color:#1f7a3d;font-weight:700}.hw-tasks-in li small{display:block;color:#5b6485;font-size:13px}.hw-tasks-in li small.why{color:#8a5a00}'
    + '.hw-panel{background:#fff;border:1px solid var(--line,#d3d9ee);border-radius:12px;overflow:hidden}.hw-panel-bar{display:flex;gap:12px;align-items:center;padding:10px 14px;background:var(--blue-soft,#e9edf8);border-bottom:1px solid var(--line,#d3d9ee)}.hw-back{font:600 14px inherit;padding:7px 12px;border-radius:8px;border:1.5px solid var(--blue,#1f3fae);background:#fff;color:var(--blue,#1f3fae);cursor:pointer;white-space:nowrap}.hw-panel-title{display:flex;flex-direction:column;min-width:0}.hw-panel-title b{font-size:16px}.hw-panel-title span{font-size:13px;color:var(--muted,#5b6485)}.hw-panel-body{padding:16px 18px}'
    + '.hw-picker{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}.hw-preview{display:grid;gap:6px;justify-items:center;background:#5fae4b;border-radius:12px;padding:14px 18px 10px}.hw-preview canvas{image-rendering:pixelated;image-rendering:crisp-edges;width:96px;height:128px}.hw-turn button{border:0;background:rgba(255,255,255,.85);border-radius:6px;width:30px;height:26px;cursor:pointer;margin:0 2px}'
    + '.hw-swatches{display:grid;gap:8px;flex:1;min-width:220px}.hw-row{display:grid;grid-template-columns:52px 1fr;gap:8px;align-items:center;font-size:14px}.hw-row>div{display:flex;flex-wrap:wrap;gap:5px}.hw-sw{width:26px;height:26px;border-radius:50%;border:2px solid rgba(0,0,0,.15);cursor:pointer;padding:0}.hw-sw.none{background:repeating-linear-gradient(45deg,#ddd 0 3px,#fff 3px 6px) !important}.hw-sw.on{border-color:#101a3f;box-shadow:0 0 0 2px #fff,0 0 0 4px #1f3fae}.hw-rand{justify-self:start;font:600 13px inherit;padding:6px 11px;border-radius:999px;border:1.5px solid var(--line,#d3d9ee);background:#fff;cursor:pointer}';
  function injectCss() { if (document.getElementById('hsct-world-css')) return; var s = document.createElement('style'); s.id = 'hsct-world-css'; s.textContent = CSS; document.head.appendChild(s); }

  window.HSCTWorld = { create: create, characterPicker: characterPicker, randomLook: randomLook, DEFAULT_LOOK: DEFAULT_LOOK, LOOKS: { skins: SKINS, hairs: HAIRS, shirts: SHIRTS, pants: PANTS, hats: HATS }, sprite: sprite, icons: ICON_PAINT, carSprite: carSprite, version: '0.3' };
})();
