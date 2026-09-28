/**
 * Browser keys → pygame key codes. pygame (SDL2) uses the character code
 * for printable keys (K_a = 97) and 2^30 + scancode for the rest
 * (K_LEFT = 1073741904). This table is the single source of truth: the
 * runner page uses it to translate KeyboardEvent.code, and the worker turns
 * it into the K_* constants the Python side exposes.
 *
 * Each row: [KeyboardEvent.code, constant name, keycode, scancode, key.name()]
 */
const SC = 1 << 30;
const rows = [];

for (let i = 0; i < 26; i++) {
  const ch = String.fromCharCode(97 + i);
  rows.push([`Key${ch.toUpperCase()}`, `K_${ch}`, 97 + i, 4 + i, ch]);
}
for (let d = 0; d <= 9; d++) {
  rows.push([`Digit${d}`, `K_${d}`, 48 + d, d === 0 ? 39 : 29 + d, String(d)]);
}
for (let f = 1; f <= 12; f++) rows.push([`F${f}`, `K_F${f}`, SC + 57 + f, 57 + f, `f${f}`]);
for (let n = 1; n <= 9; n++) rows.push([`Numpad${n}`, `K_KP${n}`, SC + 88 + n, 88 + n, `[${n}]`]);

rows.push(
  ['Numpad0', 'K_KP0', SC + 98, 98, '[0]'],
  ['Enter', 'K_RETURN', 13, 40, 'return'],
  ['Escape', 'K_ESCAPE', 27, 41, 'escape'],
  ['Backspace', 'K_BACKSPACE', 8, 42, 'backspace'],
  ['Tab', 'K_TAB', 9, 43, 'tab'],
  ['Space', 'K_SPACE', 32, 44, 'space'],
  ['Minus', 'K_MINUS', 45, 45, '-'],
  ['Equal', 'K_EQUALS', 61, 46, '='],
  ['BracketLeft', 'K_LEFTBRACKET', 91, 47, '['],
  ['BracketRight', 'K_RIGHTBRACKET', 93, 48, ']'],
  ['Backslash', 'K_BACKSLASH', 92, 49, '\\'],
  ['Semicolon', 'K_SEMICOLON', 59, 51, ';'],
  ['Quote', 'K_QUOTE', 39, 52, "'"],
  ['Backquote', 'K_BACKQUOTE', 96, 53, '`'],
  ['Comma', 'K_COMMA', 44, 54, ','],
  ['Period', 'K_PERIOD', 46, 55, '.'],
  ['Slash', 'K_SLASH', 47, 56, '/'],
  ['CapsLock', 'K_CAPSLOCK', SC + 57, 57, 'caps lock'],
  ['PrintScreen', 'K_PRINTSCREEN', SC + 70, 70, 'printscreen'],
  ['ScrollLock', 'K_SCROLLLOCK', SC + 71, 71, 'scroll lock'],
  ['Pause', 'K_PAUSE', SC + 72, 72, 'pause'],
  ['Insert', 'K_INSERT', SC + 73, 73, 'insert'],
  ['Home', 'K_HOME', SC + 74, 74, 'home'],
  ['PageUp', 'K_PAGEUP', SC + 75, 75, 'page up'],
  ['Delete', 'K_DELETE', 127, 76, 'delete'],
  ['End', 'K_END', SC + 77, 77, 'end'],
  ['PageDown', 'K_PAGEDOWN', SC + 78, 78, 'page down'],
  ['ArrowRight', 'K_RIGHT', SC + 79, 79, 'right'],
  ['ArrowLeft', 'K_LEFT', SC + 80, 80, 'left'],
  ['ArrowDown', 'K_DOWN', SC + 81, 81, 'down'],
  ['ArrowUp', 'K_UP', SC + 82, 82, 'up'],
  ['NumLock', 'K_NUMLOCK', SC + 83, 83, 'numlock'],
  ['NumpadDivide', 'K_KP_DIVIDE', SC + 84, 84, '[/]'],
  ['NumpadMultiply', 'K_KP_MULTIPLY', SC + 85, 85, '[*]'],
  ['NumpadSubtract', 'K_KP_MINUS', SC + 86, 86, '[-]'],
  ['NumpadAdd', 'K_KP_PLUS', SC + 87, 87, '[+]'],
  ['NumpadEnter', 'K_KP_ENTER', SC + 88, 88, 'enter'],
  ['NumpadDecimal', 'K_KP_PERIOD', SC + 99, 99, '[.]'],
  ['NumpadEqual', 'K_KP_EQUALS', SC + 103, 103, '[=]'],
  ['ContextMenu', 'K_MENU', SC + 118, 118, 'menu'],
  ['ControlLeft', 'K_LCTRL', SC + 224, 224, 'left ctrl'],
  ['ShiftLeft', 'K_LSHIFT', SC + 225, 225, 'left shift'],
  ['AltLeft', 'K_LALT', SC + 226, 226, 'left alt'],
  ['MetaLeft', 'K_LMETA', SC + 227, 227, 'left meta'],
  ['ControlRight', 'K_RCTRL', SC + 228, 228, 'right ctrl'],
  ['ShiftRight', 'K_RSHIFT', SC + 229, 229, 'right shift'],
  ['AltRight', 'K_RALT', SC + 230, 230, 'right alt'],
  ['MetaRight', 'K_RMETA', SC + 231, 231, 'right meta'],
);

export const KEY_ROWS = rows;

/** KeyboardEvent.code → [keycode, scancode] */
export const CODE_TO_KEY = new Map(rows.map(([code, , key, scan]) => [code, [key, scan]]));

/** Extra K_ names pygame has that share a keycode with a row above. */
export const KEY_ALIASES = {
  K_KP_0: 'K_KP0', K_KP_1: 'K_KP1', K_KP_2: 'K_KP2', K_KP_3: 'K_KP3', K_KP_4: 'K_KP4',
  K_KP_5: 'K_KP5', K_KP_6: 'K_KP6', K_KP_7: 'K_KP7', K_KP_8: 'K_KP8', K_KP_9: 'K_KP9',
  K_LGUI: 'K_LMETA', K_RGUI: 'K_RMETA', K_LSUPER: 'K_LMETA', K_RSUPER: 'K_RMETA',
  K_NUMLOCKCLEAR: 'K_NUMLOCK', K_SCROLLOCK: 'K_SCROLLLOCK', K_PRINT: 'K_PRINTSCREEN',
};

/** Printable keycodes pygame has constants for but no US key produces on its own. */
export const SHIFTED_KEYS = {
  K_EXCLAIM: 33, K_QUOTEDBL: 34, K_HASH: 35, K_DOLLAR: 36, K_PERCENT: 37, K_AMPERSAND: 38,
  K_LEFTPAREN: 40, K_RIGHTPAREN: 41, K_ASTERISK: 42, K_PLUS: 43, K_COLON: 58, K_LESS: 60,
  K_GREATER: 62, K_QUESTION: 63, K_AT: 64, K_CARET: 94, K_UNDERSCORE: 95,
};

// pygame KMOD_* bits
export const KMOD = {
  LSHIFT: 0x0001, RSHIFT: 0x0002, LCTRL: 0x0040, RCTRL: 0x0080,
  LALT: 0x0100, RALT: 0x0200, LMETA: 0x0400, RMETA: 0x0800,
  NUM: 0x1000, CAPS: 0x2000, MODE: 0x4000,
};
export const MOD_OF_CODE = {
  ShiftLeft: KMOD.LSHIFT, ShiftRight: KMOD.RSHIFT,
  ControlLeft: KMOD.LCTRL, ControlRight: KMOD.RCTRL,
  AltLeft: KMOD.LALT, AltRight: KMOD.RALT,
  MetaLeft: KMOD.LMETA, MetaRight: KMOD.RMETA,
};

/** Python source for the K_* / KMOD_* constants and key names. */
export function keyConstantsPython() {
  const lines = ['# generated from src/arcade/runner/keymap.js', ''];
  for (const [, name, key] of rows) lines.push(`${name} = ${key}`);
  for (const [alias, target] of Object.entries(KEY_ALIASES)) lines.push(`${alias} = ${target}`);
  for (const [name, key] of Object.entries(SHIFTED_KEYS)) lines.push(`${name} = ${key}`);
  lines.push('K_UNKNOWN = 0');
  lines.push(
    'KMOD_NONE = 0',
    ...Object.entries(KMOD).map(([k, v]) => `KMOD_${k} = ${v}`),
    'KMOD_SHIFT = KMOD_LSHIFT | KMOD_RSHIFT',
    'KMOD_CTRL = KMOD_LCTRL | KMOD_RCTRL',
    'KMOD_ALT = KMOD_LALT | KMOD_RALT',
    'KMOD_META = KMOD_LMETA | KMOD_RMETA',
    'KMOD_GUI = KMOD_META',
    'KMOD_LGUI = KMOD_LMETA',
    'KMOD_RGUI = KMOD_RMETA',
  );
  const names = rows.map(([, , key, , nm]) => `${key}: ${JSON.stringify(nm)}`);
  for (const [name, key] of Object.entries(SHIFTED_KEYS)) {
    names.push(`${key}: ${JSON.stringify(String.fromCharCode(key))}`);
  }
  const scans = rows.map(([, , key, scan]) => `${key}: ${scan}`);
  lines.push('', `KEY_NAMES = {${names.join(', ')}}`, `KEY_SCANCODES = {${scans.join(', ')}}`, '');
  return lines.join('\n');
}
