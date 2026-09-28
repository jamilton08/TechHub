# Dodge the Blocks — hold the arrow keys to move. Don't get hit!
# Shows: keyboard input, Rects, collisions, a score, and restarting.
import random
import pygame

pygame.init()
WIDTH, HEIGHT = 600, 700
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Dodge the Blocks")
clock = pygame.time.Clock()
font = pygame.font.SysFont("arial", 28, bold=True)
big_font = pygame.font.SysFont("arial", 56, bold=True)

PLAYER_SPEED = 7


def new_game():
    player = pygame.Rect(WIDTH // 2 - 25, HEIGHT - 80, 50, 50)
    return player, [], 0, False  # player, blocks, score, game_over


player, blocks, score, game_over = new_game()
spawn_timer = 0

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN and event.key == pygame.K_r and game_over:
            player, blocks, score, game_over = new_game()

    if not game_over:
        # move the player with the arrow keys (or A / D)
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            player.x -= PLAYER_SPEED
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            player.x += PLAYER_SPEED
        player.clamp_ip(screen.get_rect())  # stay on screen

        # add a falling block every so often — faster as the score goes up
        spawn_timer += 1
        if spawn_timer > max(10, 40 - score // 5):
            spawn_timer = 0
            size = random.randint(30, 70)
            blocks.append(pygame.Rect(random.randint(0, WIDTH - size), -size, size, size))

        # move the blocks down; count the ones that fall off the bottom
        fall_speed = 4 + score // 10
        for block in blocks[:]:
            block.y += fall_speed
            if block.top > HEIGHT:
                blocks.remove(block)
                score += 1

        # hit?
        if player.collidelist(blocks) != -1:
            game_over = True

    # draw everything
    screen.fill((13, 21, 51))
    for block in blocks:
        pygame.draw.rect(screen, (122, 28, 44), block, border_radius=6)
    pygame.draw.rect(screen, (122, 162, 255), player, border_radius=10)
    screen.blit(font.render(f"Score: {score}", True, "white"), (16, 12))

    if game_over:
        text = big_font.render("GAME OVER", True, (255, 107, 122))
        screen.blit(text, text.get_rect(center=(WIDTH // 2, HEIGHT // 2 - 30)))
        hint = font.render("Press R to play again", True, "white")
        screen.blit(hint, hint.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 30)))

    pygame.display.flip()
    clock.tick(60)

pygame.quit()
