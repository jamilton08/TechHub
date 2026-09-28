"""pygame.sprite — Sprite, Group and the collision helpers."""
from .rect import Rect


class Sprite:
    def __init__(self, *groups):
        self.__g = {}
        if groups:
            self.add(*groups)

    def _groups(self):
        try:
            return self.__g
        except AttributeError:
            raise AttributeError(
                "This sprite was never set up. Call super().__init__() at the start of your "
                "sprite's __init__ method.") from None

    def add(self, *groups):
        g = self._groups()
        for group in groups:
            if hasattr(group, "_spritegroup"):
                if group not in g:
                    group.add_internal(self)
                    self.add_internal(group)
            else:
                self.add(*group)

    def remove(self, *groups):
        g = self._groups()
        for group in groups:
            if hasattr(group, "_spritegroup"):
                if group in g:
                    group.remove_internal(self)
                    self.remove_internal(group)
            else:
                self.remove(*group)

    def add_internal(self, group):
        self._groups()[group] = 0

    def remove_internal(self, group):
        del self._groups()[group]

    def update(self, *args, **kwargs):
        pass

    def kill(self):
        for group in list(self._groups()):
            group.remove_internal(self)
        self._groups().clear()

    def groups(self):
        return list(self._groups())

    def alive(self):
        return bool(self._groups())

    def __repr__(self):
        return "<%s Sprite(in %d groups)>" % (self.__class__.__name__, len(self._groups()))

    @property
    def layer(self):
        return getattr(self, "_layer", 0)

    @layer.setter
    def layer(self, value):
        self._layer = value


DirtySprite = Sprite
WeakSprite = Sprite
WeakDirtySprite = Sprite


class AbstractGroup:
    _spritegroup = True

    def __init__(self):
        self.spritedict = {}
        self.lostsprites = []

    def sprites(self):
        return list(self.spritedict)

    def add_internal(self, sprite, layer=None):
        self.spritedict[sprite] = None

    def remove_internal(self, sprite):
        r = self.spritedict.pop(sprite, None)
        if r:
            self.lostsprites.append(r)

    def has_internal(self, sprite):
        return sprite in self.spritedict

    def copy(self):
        return self.__class__(self.sprites())

    def __iter__(self):
        return iter(self.sprites())

    def __contains__(self, sprite):
        return sprite in self.spritedict

    def add(self, *sprites):
        for sprite in sprites:
            if isinstance(sprite, Sprite):
                if sprite not in self.spritedict:
                    self.add_internal(sprite)
                    sprite.add_internal(self)
            else:
                try:
                    self.add(*sprite)
                except TypeError:
                    if hasattr(sprite, "_spritegroup"):
                        for s in sprite.sprites():
                            self.add(s)
                    else:
                        raise TypeError("Group.add() needs sprites, got %r" % (sprite,)) from None

    def remove(self, *sprites):
        for sprite in sprites:
            if isinstance(sprite, Sprite):
                if sprite in self.spritedict:
                    self.remove_internal(sprite)
                    sprite.remove_internal(self)
            else:
                self.remove(*sprite)

    def has(self, *sprites):
        if not sprites:
            return False
        for sprite in sprites:
            if isinstance(sprite, Sprite):
                if sprite not in self.spritedict:
                    return False
            elif not self.has(*sprite):
                return False
        return True

    def update(self, *args, **kwargs):
        for sprite in self.sprites():
            sprite.update(*args, **kwargs)

    def draw(self, surface, bgsurf=None, special_flags=0):
        sprites = self.sprites()
        for spr in sprites:
            self.spritedict[spr] = surface.blit(spr.image, spr.rect, None, special_flags)
        self.lostsprites = []
        return [self.spritedict[s] for s in sprites]

    def clear(self, surface, bgd):
        rects = [r for r in self.spritedict.values() if r] + self.lostsprites
        for r in rects:
            if callable(bgd):
                bgd(surface, r)
            else:
                surface.blit(bgd, r, r)

    def empty(self):
        for sprite in self.sprites():
            self.remove_internal(sprite)
            sprite.remove_internal(self)

    def __bool__(self):
        return bool(self.spritedict)

    def __len__(self):
        return len(self.spritedict)

    def __repr__(self):
        return "<%s(%d sprites)>" % (self.__class__.__name__, len(self))


class Group(AbstractGroup):
    def __init__(self, *sprites):
        AbstractGroup.__init__(self)
        self.add(*sprites)


RenderPlain = Group
RenderClear = Group


class RenderUpdates(Group):
    def draw(self, surface, bgsurf=None, special_flags=0):
        return super().draw(surface, bgsurf, special_flags)


class OrderedUpdates(RenderUpdates):
    pass


class LayeredUpdates(Group):
    """Draws sprites in order of their `layer` (lowest first)."""

    def __init__(self, *sprites, **kwargs):
        self._default_layer = kwargs.get("default_layer", 0)
        Group.__init__(self, *sprites)

    def sprites(self):
        return sorted(self.spritedict, key=lambda s: getattr(s, "_layer", self._default_layer))

    def add(self, *sprites, **kwargs):
        layer = kwargs.get("layer")
        for s in sprites:
            if layer is not None and isinstance(s, Sprite):
                s._layer = layer
        super().add(*sprites)

    def layers(self):
        return sorted({getattr(s, "_layer", self._default_layer) for s in self.spritedict})

    def change_layer(self, sprite, new_layer):
        sprite._layer = new_layer

    def get_layer_of_sprite(self, sprite):
        return getattr(sprite, "_layer", self._default_layer)

    def get_top_layer(self):
        return max(self.layers(), default=0)

    def get_bottom_layer(self):
        return min(self.layers(), default=0)

    def get_sprites_from_layer(self, layer):
        return [s for s in self.sprites() if getattr(s, "_layer", self._default_layer) == layer]

    def move_to_front(self, sprite):
        sprite._layer = self.get_top_layer() + 1

    def move_to_back(self, sprite):
        sprite._layer = self.get_bottom_layer() - 1

    def get_top_sprite(self):
        s = self.sprites()
        return s[-1] if s else None

    def get_sprites_at(self, pos):
        return [s for s in self.sprites() if s.rect.collidepoint(pos)]


LayeredDirty = LayeredUpdates


class GroupSingle(AbstractGroup):
    def __init__(self, sprite=None):
        AbstractGroup.__init__(self)
        self.__sprite = None
        if sprite is not None:
            self.add(sprite)

    def copy(self):
        return GroupSingle(self.__sprite)

    def sprites(self):
        return [self.__sprite] if self.__sprite is not None else []

    def add_internal(self, sprite, layer=None):
        if self.__sprite is not None:
            self.__sprite.remove_internal(self)
            self.remove_internal(self.__sprite)
        self.__sprite = sprite
        self.spritedict[sprite] = None

    def remove_internal(self, sprite):
        if sprite is self.__sprite:
            self.__sprite = None
        self.spritedict.pop(sprite, None)

    def _get_sprite(self):
        return self.__sprite

    def _set_sprite(self, sprite):
        self.add_internal(sprite)
        sprite.add_internal(self)

    sprite = property(_get_sprite, _set_sprite)


# ── collisions ────────────────────────────────────────────────────────
def collide_rect(left, right):
    return left.rect.colliderect(right.rect)


class collide_rect_ratio:
    def __init__(self, ratio):
        self.ratio = ratio

    def __call__(self, left, right):
        r = self.ratio
        a = left.rect.inflate(left.rect.w * r - left.rect.w, left.rect.h * r - left.rect.h)
        b = right.rect.inflate(right.rect.w * r - right.rect.w, right.rect.h * r - right.rect.h)
        return a.colliderect(b)


def _radius(sprite, ratio=1.0):
    if hasattr(sprite, "radius"):
        return sprite.radius * ratio
    r = sprite.rect
    return 0.5 * ((r.w ** 2 + r.h ** 2) ** 0.5) * ratio


def collide_circle(left, right):
    dx = left.rect.centerx - right.rect.centerx
    dy = left.rect.centery - right.rect.centery
    rr = _radius(left) + _radius(right)
    return dx * dx + dy * dy <= rr * rr


class collide_circle_ratio:
    def __init__(self, ratio):
        self.ratio = ratio

    def __call__(self, left, right):
        dx = left.rect.centerx - right.rect.centerx
        dy = left.rect.centery - right.rect.centery
        rr = _radius(left, self.ratio) + _radius(right, self.ratio)
        return dx * dx + dy * dy <= rr * rr


def collide_mask(left, right):
    from . import mask as _mask
    xoff = right.rect.x - left.rect.x
    yoff = right.rect.y - left.rect.y
    lm = getattr(left, "mask", None) or _mask.from_surface(left.image)
    rm = getattr(right, "mask", None) or _mask.from_surface(right.image)
    return lm.overlap(rm, (xoff, yoff))


def spritecollide(sprite, group, dokill, collided=None):
    test = collided or collide_rect
    hits = [s for s in group.sprites() if test(sprite, s)]
    if dokill:
        for s in hits:
            s.kill()
    return hits


def spritecollideany(sprite, group, collided=None):
    test = collided or collide_rect
    for s in group.sprites() if hasattr(group, "sprites") else group:
        if test(sprite, s):
            return s
    return None


def groupcollide(groupa, groupb, dokilla, dokillb, collided=None):
    out = {}
    for s in groupa.sprites():
        hits = spritecollide(s, groupb, dokillb, collided)
        if hits:
            out[s] = hits
            if dokilla:
                s.kill()
    return out
