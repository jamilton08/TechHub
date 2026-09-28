# Snake — arrow keys to turn. Eat the apples, don't bite yourself.
# Shows: a grid, a list as a snake body, and KEYDOWN events.
import random
import pygame

pygame.init()
CELL = 24
COLS, ROWS = 25, 20
screen = pygame.display.set_mode((COLS * CELL, ROWS * CELL))
pygame.display.set_caption("Snake")
clock = pygame.time.Clock()
font = pygame.font.SysFont("arial", 24, bold=True)

DIRECTIONS = {
    pygame.K_UP: (0, -1),
    pygame.K_DOWN: (0, 1),
    pygame.K_LEFT: (-1, 0),
    pygame.K_RIGHT: (1, 0),
}


def random_apple(snake):
    while True:
        spot = (random.randrange(COLS), random.randrange(ROWS))
        if spot not in snake:
            return spot


snake = [(5, 10), (4, 10), (3, 10)]  # the head is snake[0]
direction = (1, 0)
apple = random_apple(snake)
alive = True

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key in DIRECTIONS:
                new = DIRECTIONS[event.key]
                if (new[0] != -direction[0] or new[1] != -direction[1]):  # no U-turns
                    direction = new
            elif event.key == pygame.K_SPACE and not alive:
                snake, direction, alive = [(5, 10), (4, 10), (3, 10)], (1, 0), True
                apple = random_apple(snake)

    if alive:
        head = (snake[0][0] + direction[0], snake[0][1] + direction[1])
        hit_wall = not (0 <= head[0] < COLS and 0 <= head[1] < ROWS)
        if hit_wall or head in snake:
            alive = False
        else:
            snake.insert(0, head)
            if head == apple:
                apple = random_apple(snake)   # grow: keep the tail
            else:
                snake.pop()                    # move: drop the tail

    screen.fill((13, 21, 51))
    pygame.draw.rect(screen, (255, 107, 122), (apple[0] * CELL, apple[1] * CELL, CELL, CELL), border_radius=8)
    for i, (cx, cy) in enumerate(snake):
        color = (95, 245, 154) if i == 0 else (61, 180, 110)
        pygame.draw.rect(screen, color, (cx * CELL + 1, cy * CELL + 1, CELL - 2, CELL - 2), border_radius=5)
    screen.blit(font.render(f"Length: {len(snake)}", True, "white"), (10, 8))
    if not alive:
        over = font.render("Game over — press Space", True, "white")
        screen.blit(over, over.get_rect(center=screen.get_rect().center))

    pygame.display.flip()
    clock.tick(10)  # the snake moves 10 squares per second

pygame.quit()
