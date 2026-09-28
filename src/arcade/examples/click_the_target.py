# Click the Target — click the circles as fast as you can for 20 seconds.
# Shows: the mouse, timers, and a high score that's saved to a file
# (it appears as highscore.txt in your project after you play).
import random
import pygame

pygame.init()
WIDTH, HEIGHT = 800, 500
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Click the Target")
clock = pygame.time.Clock()
font = pygame.font.SysFont("arial", 30, bold=True)

GAME_SECONDS = 20
RADIUS = 30


def load_high_score():
    try:
        with open("highscore.txt") as f:
            return int(f.read())
    except (FileNotFoundError, ValueError):
        return 0


def save_high_score(value):
    with open("highscore.txt", "w") as f:
        f.write(str(value))


def random_spot():
    return (random.randint(RADIUS, WIDTH - RADIUS), random.randint(80, HEIGHT - RADIUS))


high_score = load_high_score()
target = random_spot()
score = 0
start = pygame.time.get_ticks()
finished = False

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.MOUSEBUTTONDOWN and not finished:
            dx = event.pos[0] - target[0]
            dy = event.pos[1] - target[1]
            if dx * dx + dy * dy <= RADIUS * RADIUS:  # inside the circle?
                score += 1
                target = random_spot()
        elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE and finished:
            score, finished, start = 0, False, pygame.time.get_ticks()

    seconds_left = GAME_SECONDS - (pygame.time.get_ticks() - start) // 1000
    if seconds_left <= 0 and not finished:
        finished = True
        if score > high_score:
            high_score = score
            save_high_score(high_score)

    screen.fill((245, 247, 252))
    if not finished:
        pygame.draw.circle(screen, (122, 28, 44), target, RADIUS)
        pygame.draw.circle(screen, "white", target, RADIUS - 10)
        pygame.draw.circle(screen, (122, 28, 44), target, RADIUS - 20)
    else:
        msg = font.render(f"Time! You scored {score}. Press Space to play again.", True, (31, 63, 174))
        screen.blit(msg, msg.get_rect(center=(WIDTH // 2, HEIGHT // 2)))

    bar = f"Score: {score}    Time: {max(0, seconds_left)}    Best: {high_score}"
    screen.blit(font.render(bar, True, (16, 26, 63)), (20, 20))
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
