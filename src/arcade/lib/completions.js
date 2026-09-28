/**
 * Autocomplete for pygame names (pygame.display.set_mode, K_LEFT, …) on top
 * of CodeMirror's normal Python completions. Kept in step with the Arcade's
 * pygame layer, so what it suggests is what works.
 */
const API = {
  pygame: 'init quit get_init Rect Color Surface display draw event key mouse time font image transform mixer sprite math mask gfxdraw locals error QUIT KEYDOWN KEYUP MOUSEBUTTONDOWN MOUSEBUTTONUP MOUSEMOTION MOUSEWHEEL TEXTINPUT USEREVENT SRCALPHA FULLSCREEN RESIZABLE BLEND_ADD BLEND_MULT BUTTON_LEFT BUTTON_RIGHT',
  'pygame.display': 'set_mode set_caption get_caption flip update get_surface get_window_size Info init quit set_icon',
  'pygame.draw': 'rect circle ellipse line lines polygon arc aaline aalines',
  'pygame.event': 'get poll wait peek clear post pump Event custom_type set_blocked set_allowed event_name',
  'pygame.key': 'get_pressed get_mods set_repeat get_repeat name key_code get_focused',
  'pygame.mouse': 'get_pos get_pressed get_rel set_visible get_visible get_focused',
  'pygame.time': 'Clock get_ticks wait delay set_timer',
  'pygame.font': 'Font SysFont init get_fonts get_default_font',
  'pygame.image': 'load',
  'pygame.transform': 'scale smoothscale scale_by rotate rotozoom flip scale2x',
  'pygame.mixer': 'Sound music init stop pause unpause get_busy',
  'pygame.mixer.music': 'load play stop pause unpause set_volume get_volume get_busy get_pos rewind unload',
  'pygame.sprite': 'Sprite Group GroupSingle LayeredUpdates spritecollide spritecollideany groupcollide collide_rect collide_circle collide_mask',
  'pygame.math': 'Vector2 Vector3 clamp lerp',
  'pygame.mask': 'from_surface Mask',
};

const KEYS = 'K_a K_b K_c K_d K_e K_f K_g K_h K_i K_j K_k K_l K_m K_n K_o K_p K_q K_r K_s K_t K_u K_v K_w K_x K_y K_z K_0 K_1 K_2 K_3 K_4 K_5 K_6 K_7 K_8 K_9 K_UP K_DOWN K_LEFT K_RIGHT K_SPACE K_RETURN K_ESCAPE K_BACKSPACE K_TAB K_LSHIFT K_RSHIFT K_LCTRL K_RCTRL K_LALT K_RALT K_F1 K_F2 K_F3 K_F4 K_F5 K_F6 K_F7 K_F8 K_F9 K_F10 K_F11 K_F12 K_DELETE K_HOME K_END K_PAGEUP K_PAGEDOWN';

const METHODS = {
  // after a dot on anything, these are common pygame object methods
  any: 'fill blit get_rect get_width get_height get_size convert convert_alpha set_colorkey set_alpha copy get_at set_at render tick get_fps colliderect collidepoint collidelist move move_ip inflate clamp center centerx centery topleft topright bottomleft bottomright midtop midbottom midleft midright left right top bottom width height x y play stop set_volume update draw add remove kill alive sprites empty has normalize length distance_to rotate',
};

const opts = (words, type, detail) => words.split(' ').map((label) => ({
  label,
  type: /^[A-Z][a-z]/.test(label) ? 'class' : /^[A-Z_0-9]+$/.test(label) ? 'constant' : type,
  detail,
}));

const PYGAME_OPTIONS = Object.fromEntries(
  Object.entries(API).map(([mod, words]) => [mod, opts(words, 'function', mod)])
);
PYGAME_OPTIONS.pygame = [...PYGAME_OPTIONS.pygame, ...opts(KEYS, 'constant', 'key')];
const METHOD_OPTIONS = opts(METHODS.any, 'method', 'pygame');

export function pygameCompletions(context) {
  const word = context.matchBefore(/[\w.]*\w?\.?[\w]*$/);
  if (!word) return null;
  const text = word.text;
  const dot = text.lastIndexOf('.');
  if (dot < 0) return null;
  const head = text.slice(0, dot);
  const from = word.from + dot + 1;
  if (PYGAME_OPTIONS[head]) return { from, options: PYGAME_OPTIONS[head], validFor: /^\w*$/ };
  if (/^\w+$/.test(head) && !PYGAME_OPTIONS[head] && context.explicit) {
    return { from, options: METHOD_OPTIONS, validFor: /^\w*$/ };
  }
  if (/^\w+(\.\w+)*$/.test(head) && !head.startsWith('pygame') && text.length > dot + 1) {
    return { from, options: METHOD_OPTIONS, validFor: /^\w*$/ };
  }
  return null;
}
