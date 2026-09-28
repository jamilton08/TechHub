# Coin Collector — sprites! Each thing in the game is a class.
# Arrow keys or WASD to move. Collect every coin.
# Shows: pygame.sprite.Sprite, Groups, spritecollide, and drawing
# your own images onto a Surface (swap in a .png from Assets later).
import random
import pygame

pygame.init()
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Coin Collector")
clock = pygame.time.Clock()
font = pygame.font.SysFont("arial", 28, bold=True)


class Player(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        # Draw the player's picture once. To use a picture instead:
        # self.image = pygame.image.load("player.png").convert_alpha()
        self.image = pygame.Surface((48, 48), pygame.SRCALPHA)
        pygame.draw.rect(self.image, (122, 162, 255), (0, 0, 48, 48), border_radius=12)
        pygame.draw.circle(self.image, "white", (16, 18), 6)
        pygame.draw.circle(self.image, "white", (32, 18), 6)
        self.rect = self.image.get_rect(center=(WIDTH // 2, HEIGHT // 2))
        self.speed = 6

    def update(self):
        keys = pygame.key.get_pressed()
        dx = (keys[pygame.K_RIGHT] or keys[pygame.K_d]) - (keys[pygame.K_LEFT] or keys[pygame.K_a])
        dy = (keys[pygame.K_DOWN] or keys[pygame.K_s]) - (keys[pygame.K_UP] or keys[pygame.K_w])
        self.rect.x += dx * self.speed
        self.rect.y += dy * self.speed
        self.rect.clamp_ip(screen.get_rect())


class Coin(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        self.image = pygame.Surface((24, 24), pygame.SRCALPHA)
        pygame.draw.circle(self.image, (255, 205, 60), (12, 12), 12)
        pygame.draw.circle(self.image, (255, 235, 150), (12, 12), 6)
        self.rect = self.image.get_rect(center=(random.randint(20, WIDTH - 20), random.randint(60, HEIGHT - 20)))


player = Player()
coins = pygame.sprite.Group(Coin() for _ in range(15))
everything = pygame.sprite.Group(coins, player)
score = 0

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    everything.update()
    grabbed = pygame.sprite.spritecollide(player, coins, True)  # True = remove them
    score += len(grabbed)

    screen.fill((20, 28, 70))
    everything.draw(screen)
    label = f"Coins: {score}" if coins else f"You got all {score} coins!"
    screen.blit(font.render(label, True, "white"), (16, 12))
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
