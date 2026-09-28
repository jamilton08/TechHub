# Bouncing Ball — the smallest animation: every frame we erase the
# screen, move the ball a little, draw it again, and show the result.
import pygame

pygame.init()
WIDTH, HEIGHT = 800, 500
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Bouncing Ball")
clock = pygame.time.Clock()

x, y = 100, 100        # where the ball is
speed_x, speed_y = 5, 4  # how far it moves each frame
radius = 30

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    # move
    x += speed_x
    y += speed_y

    # bounce off the walls
    if x - radius < 0 or x + radius > WIDTH:
        speed_x = -speed_x
    if y - radius < 0 or y + radius > HEIGHT:
        speed_y = -speed_y

    # draw
    screen.fill((16, 26, 63))
    pygame.draw.circle(screen, (255, 107, 122), (x, y), radius)
    pygame.display.flip()

    clock.tick(60)  # 60 frames per second

pygame.quit()
