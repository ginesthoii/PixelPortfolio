import pygame
import random
import sys
import os
import json

# -------------------------------
# Init
# -------------------------------
pygame.init()
try:
    pygame.mixer.init()
    AUDIO_OK = True
except Exception:
    AUDIO_OK = False

# -------------------------------
# Display / Globals
# -------------------------------
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Space Fighting Game")
clock = pygame.time.Clock()

# Colors & fonts
WHITE = (255, 255, 255)
RED = (255, 80, 80)
GREEN = (80, 255, 120)
YELLOW = (255, 230, 90)
CYAN = (100, 220, 255)
MAGENTA = (220, 100, 255)
GREY = (180, 180, 180)
BLUE = (90, 180, 255)
ORANGE = (255, 170, 60)
PURPLE = (190, 120, 255)

font_small = pygame.font.SysFont(None, 28)
font_big = pygame.font.SysFont(None, 64)

# -------------------------------
# Assets helpers
# -------------------------------
def load_image(path, size=None, fallback_color=(255, 255, 255)):
    try:
        img = pygame.image.load(path).convert_alpha()
        if size:
            img = pygame.transform.smoothscale(img, size)
        return img
    except Exception:
        surf = pygame.Surface(size if size else (50, 40), pygame.SRCALPHA)
        surf.fill(fallback_color)
        return surf

def load_sound(path):
    if not AUDIO_OK:
        return None
    try:
        return pygame.mixer.Sound(path)
    except Exception:
        return None

# Images (with fallbacks)
player_image = load_image("player_spaceship.png", size=(60, 48), fallback_color=(80, 200, 255))
enemy_image  = load_image("enemy_spaceship.png",  size=(50, 40), fallback_color=(255, 80, 80))
bullet_image = pygame.Surface((6, 16), pygame.SRCALPHA); bullet_image.fill((255, 0, 0))
boss_image   = load_image("boss.png", size=(160, 120), fallback_color=(150, 80, 200))

# SFX (optional)
sfx_shoot = load_sound("shoot.wav")
sfx_hit = load_sound("hit.wav")
sfx_game_over = load_sound("game_over.wav")
sfx_powerup = load_sound("powerup.wav")

def play(snd):
    if snd:
        try:
            snd.play()
        except Exception:
            pass

# -------------------------------
# Nebula + Starfield background
# -------------------------------
class NebulaBlob:
    def __init__(self, w, h, color, radius, speed, x=None, y=None):
        self.w, self.h = w, h
        self.color = color  # (r,g,b,alpha)
        self.radius = radius
        self.speed = speed
        self.x = random.randint(0, w) if x is None else x
        self.y = random.randint(-h, 0) if y is None else y

    def update(self):
        self.y += self.speed
        if self.y - self.radius > self.h:
            self.y = -self.radius - random.randint(10, 200)
            self.x = random.randint(0, self.w)

    def draw(self, surface):
        # soft circle via alpha surface
        s = pygame.Surface((self.radius*2, self.radius*2), pygame.SRCALPHA)
        pygame.draw.circle(s, self.color, (self.radius, self.radius), self.radius)
        surface.blit(s, (int(self.x - self.radius), int(self.y - self.radius)))

class Nebula:
    """Procedural scrolling nebula (multiple translucent blobs)"""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.blobs = []
        # cool-toned cloud layers
        for _ in range(10):
            self.blobs.append(NebulaBlob(w, h, (40, 60, 120, 60), radius=random.randint(80, 140), speed=0.3))
        for _ in range(8):
            self.blobs.append(NebulaBlob(w, h, (90, 30, 140, 50), radius=random.randint(60, 120), speed=0.5))
        for _ in range(8):
            self.blobs.append(NebulaBlob(w, h, (20, 120, 160, 50), radius=random.randint(50, 100), speed=0.7))

    def update(self):
        for b in self.blobs:
            b.update()

    def draw(self, surface):
        for b in self.blobs:
            b.draw(surface)

class Star:
    def __init__(self, layer):
        self.layer = layer
        self.reset()

    def reset(self):
        self.x = random.randint(0, SCREEN_WIDTH - 1)
        self.y = random.randint(-SCREEN_HEIGHT, SCREEN_HEIGHT)
        if self.layer == 0:
            self.speed = 0.5
            self.color = (120, 120, 120)
            self.size = 1
        elif self.layer == 1:
            self.speed = 1.0
            self.color = (180, 180, 180)
            self.size = 1
        else:
            self.speed = 2.0
            self.color = (220, 220, 220)
            self.size = 2

    def update(self):
        self.y += self.speed
        if self.y >= SCREEN_HEIGHT:
            self.y = -5
            self.x = random.randint(0, SCREEN_WIDTH - 1)
        if self.layer == 2 and random.random() < 0.02:
            self.color = (220, 220, 220) if random.random() < 0.5 else (180, 180, 180)

    def draw(self, surface):
        pygame.draw.rect(surface, self.color, (int(self.x), int(self.y), self.size, self.size))

class Starfield:
    def __init__(self, n0=70, n1=50, n2=30):
        self.stars = [Star(0) for _ in range(n0)] + [Star(1) for _ in range(n1)] + [Star(2) for _ in range(n2)]
    def update(self):
        for s in self.stars:
            s.update()
    def draw(self, surface):
        for s in self.stars:
            s.draw(surface)

nebula = Nebula(SCREEN_WIDTH, SCREEN_HEIGHT)
starfield = Starfield()

# -------------------------------
# Sprites
# -------------------------------
class Player(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        self.base_image = player_image
        self.image = self.base_image.copy()
        self.rect = self.image.get_rect()
        self.rect.centerx = SCREEN_WIDTH // 2
        self.rect.bottom = SCREEN_HEIGHT - 20
        self.speed = 5
        self.shoot_delay = 220  # ms
        self.last_shot = pygame.time.get_ticks()
        self.defeated = False
        self.invincible = 0

        self.spread_until = 0
        self.shield_until = 0

    def spread_active(self):
        return pygame.time.get_ticks() < self.spread_until

    def shield_active(self):
        return pygame.time.get_ticks() < self.shield_until

    def update(self):
        if self.defeated:
            return
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            self.rect.x -= self.speed
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            self.rect.x += self.speed
        self.rect.x = max(0, min(self.rect.x, SCREEN_WIDTH - self.rect.width))

        now = pygame.time.get_ticks()
        if keys[pygame.K_SPACE] and (now - self.last_shot) > self.shoot_delay:
            self.last_shot = now
            if self.spread_active():
                # 3-way fan
                for vx in (-3, 0, 3):
                    bullet = PlayerBullet(self.rect.centerx, self.rect.top, vx=vx, vy=-12)
                    all_sprites.add(bullet); bullets.add(bullet)
            else:
                bullet = PlayerBullet(self.rect.centerx, self.rect.top, vx=0, vy=-12)
                all_sprites.add(bullet); bullets.add(bullet)
            play(sfx_shoot)

        # Visual feedback
        if self.invincible > 0:
            self.invincible -= 1
            self.image.set_alpha(140 if (self.invincible // 5) % 2 == 0 else 255)
        else:
            self.image.set_alpha(255)

    def draw_overlay(self, surface):
        # Shield ring
        if self.shield_active():
            r = max(self.rect.width, self.rect.height) // 2 + 8
            center = self.rect.center
            pygame.draw.circle(surface, CYAN, center, r, 2)

class Enemy(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        self.image = enemy_image
        self.rect = self.image.get_rect()
        self.reset()

    def update(self):
        if player.defeated:
            return
        if boss_active:  # pause small enemies during boss for clarity
            return
        self.rect.y += self.speed
        if self.rect.top > SCREEN_HEIGHT:
            self.reset()
        if pygame.sprite.collide_rect(self, player) and not player.defeated:
            handle_player_hit(self)

    def reset(self):
        self.rect.x = random.randint(0, SCREEN_WIDTH - self.rect.width)
        self.rect.y = random.randint(-120, -60)
        self.speed = random.randint(2, 4)

class PlayerBullet(pygame.sprite.Sprite):
    def __init__(self, x, y, vx=0, vy=-12):
        super().__init__()
        self.image = bullet_image
        self.rect = self.image.get_rect()
        self.rect.centerx = x
        self.rect.bottom = y
        self.vx = vx
        self.vy = vy

    def update(self):
        self.rect.x += self.vx
        self.rect.y += self.vy
        if (self.rect.bottom < 0) or (self.rect.right < 0) or (self.rect.left > SCREEN_WIDTH):
            self.kill()

class EnemyBullet(pygame.sprite.Sprite):
    def __init__(self, x, y, vx=0, vy=5):
        super().__init__()
        self.image = pygame.Surface((6, 12), pygame.SRCALPHA)
        self.image.fill((255, 200, 40))
        self.rect = self.image.get_rect(center=(x, y))
        self.vx = vx
        self.vy = vy

    def update(self):
        self.rect.x += self.vx
        self.rect.y += self.vy
        if self.rect.top > SCREEN_HEIGHT or self.rect.left < -20 or self.rect.right > SCREEN_WIDTH + 20:
            self.kill()

class Boss(pygame.sprite.Sprite):
    def __init__(self, hp=60):
        super().__init__()
        self.image = boss_image
        self.rect = self.image.get_rect()
        self.rect.centerx = SCREEN_WIDTH // 2
        self.rect.top = 40
        self.vx = 3
        self.health = hp
        self.max_health = self.health
        self.last_shot = pygame.time.get_ticks()
        self.shot_delay = 700  # ms

    def update(self):
        if player.defeated:
            return
        self.rect.x += self.vx
        if self.rect.left <= 10 or self.rect.right >= SCREEN_WIDTH - 10:
            self.vx *= -1

        now = pygame.time.get_ticks()
        if now - self.last_shot > self.shot_delay:
            self.last_shot = now
            self.shoot_pattern()

        if pygame.sprite.collide_rect(self, player) and player.invincible <= 0 and not player.shield_active():
            handle_player_hit(self, heavy=True)

    def shoot_pattern(self):
        y = self.rect.bottom - 10
        x = self.rect.centerx
        for vx in (-3, 0, 3):
            b = EnemyBullet(x, y, vx=vx, vy=6)
            all_sprites.add(b); enemy_bullets.add(b)

    def damage(self, amount):
        self.health -= amount
        if self.health <= 0:
            self.kill()

class PowerUp(pygame.sprite.Sprite):
    """Two types: 'SPREAD' (fan shot) and 'SHIELD' (damage immunity)"""
    def __init__(self, x, y, kind):
        super().__init__()
        self.kind = kind
        self.image = pygame.Surface((28, 28), pygame.SRCALPHA)
        if self.kind == 'SPREAD':
            pygame.draw.circle(self.image, ORANGE, (14, 14), 14)
            pygame.draw.polygon(self.image, WHITE, [(14,5),(8,14),(20,14)])  # simple "fan" icon
        else:  # SHIELD
            pygame.draw.circle(self.image, PURPLE, (14, 14), 14)
            pygame.draw.circle(self.image, WHITE, (14, 14), 10, 2)
        self.rect = self.image.get_rect(center=(x, y))
        self.vy = 2.5

    def update(self):
        self.rect.y += self.vy
        if self.rect.top > SCREEN_HEIGHT:
            self.kill()

# -------------------------------
# Persistence: High Score
# -------------------------------
HISCORE_FILE = "highscore.dat"

def read_highscore():
    try:
        with open(HISCORE_FILE, "r") as f:
            return int(json.load(f).get("highscore", 0))
    except Exception:
        return 0

def write_highscore(value):
    try:
        with open(HISCORE_FILE, "w") as f:
            json.dump({"highscore": int(value)}, f)
    except Exception:
        pass

# -------------------------------
# Game state / helpers
# -------------------------------
def reset_game():
    global all_sprites, enemies, bullets, enemy_bullets, powerups, player
    global score, lives, game_over, boss_active, boss_defeated, boss, highscore
    all_sprites = pygame.sprite.Group()
    enemies = pygame.sprite.Group()
    bullets = pygame.sprite.Group()
    enemy_bullets = pygame.sprite.Group()
    powerups = pygame.sprite.Group()

    player = Player()
    all_sprites.add(player)

    for _ in range(10):
        e = Enemy()
        all_sprites.add(e); enemies.add(e)

    score = 0
    lives = 3
    game_over = False
    boss_active = False
    boss_defeated = False
    boss = None

    # read once per reset for simplicity
    highscore = read_highscore()

def maybe_spawn_powerup(x, y):
    # 12% chance; 50/50 spread vs shield
    if random.random() < 0.12:
        kind = 'SPREAD' if random.random() < 0.5 else 'SHIELD'
        pu = PowerUp(x, y, kind)
        all_sprites.add(pu); powerups.add(pu)

def handle_player_hit(enemy_sprite_or_boss, heavy=False):
    """Lose life unless shield; brief i-frames; save highscore on death."""
    global lives, game_over, highscore
    if player.invincible > 0 or player.defeated or player.shield_active():
        return
    lives -= 2 if heavy else 1
    play(sfx_hit)
    if isinstance(enemy_sprite_or_boss, Enemy):
        enemy_sprite_or_boss.reset()
    if lives <= 0:
        player.defeated = True
        game_over = True
        play(sfx_game_over)
        if score > highscore:
            highscore = score
            write_highscore(highscore)
    else:
        player.rect.centerx = SCREEN_WIDTH // 2
        player.rect.bottom = SCREEN_HEIGHT - 20
        player.invincible = 120  # ~2 sec at 60fps

def spawn_boss(hp=60):
    global boss_active, boss
    boss_active = True
    b = Boss(hp=hp)
    boss = b
    all_sprites.add(b)

def draw_health_bar(surface, x, y, w, h, pct, fg_color, bg_color=(60, 60, 60)):
    pct = max(0.0, min(1.0, pct))
    pygame.draw.rect(surface, bg_color, (x, y, w, h))
    pygame.draw.rect(surface, fg_color, (x, y, int(w * pct), h))
    pygame.draw.rect(surface, WHITE, (x, y, w, h), 2)

# Initialize
reset_game()

# -------------------------------
# Main loop
# -------------------------------
running = True
while running:
    # Events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if game_over and event.type == pygame.KEYDOWN and event.key == pygame.K_r:
            reset_game()

    # Background
    nebula.update()
    starfield.update()

    if not game_over:
        # Boss triggers at milestones
        if (score >= 500) and (not boss_active) and (not boss_defeated):
            spawn_boss(hp=60)
        if (score >= 1000) and (not boss_active) and boss_defeated:
            # second boss, tougher
            boss_defeated = False
            spawn_boss(hp=90)

        # Update sprites
        all_sprites.update()

        # Player bullets → enemies
        if not boss_active:
            hits = pygame.sprite.groupcollide(enemies, bullets, True, True)
            for enemy_sprite, _bullet_list in hits.items():
                score += 10
                maybe_spawn_powerup(enemy_sprite.rect.centerx, enemy_sprite.rect.centery)
                e = Enemy()
                all_sprites.add(e); enemies.add(e)

        # Player bullets → boss
        if boss_active and boss is not None and boss.alive():
            boss_hits = pygame.sprite.spritecollide(boss, bullets, dokill=True)
            for _ in boss_hits:
                boss.damage(1)
                score += 1  # chip score
            if not boss.alive():
                score += 250
                boss_active = False
                boss_defeated = True

        # Enemy bullets → player
        if pygame.sprite.spritecollide(player, enemy_bullets, dokill=True) and not player.defeated:
            handle_player_hit(None)

        # Player → powerups
        got = pygame.sprite.spritecollide(player, powerups, dokill=True)
        for p in got:
            play(sfx_powerup)
            if p.kind == 'SPREAD':
                player.spread_until = pygame.time.get_ticks() + 8000  # 8s
            elif p.kind == 'SHIELD':
                player.shield_until = pygame.time.get_ticks() + 8000  # 8s

    # ---------------------------
    # Draw
    # ---------------------------
    screen.fill((0, 0, 0))
    nebula.draw(screen)
    starfield.draw(screen)
    all_sprites.draw(screen)
    player.draw_overlay(screen)

    # HUD
    score_surf = font_small.render(f"Score: {score}", True, WHITE)
    lives_surf = font_small.render(f"Lives: {lives}", True, YELLOW if lives > 1 else RED)
    hs_surf = font_small.render(f"High: {max(highscore, score)}", True, GREY)
    screen.blit(score_surf, (10, 10))
    screen.blit(lives_surf, (10, 36))
    screen.blit(hs_surf, (10, 62))

    # Boss UI
    if boss_active and boss and boss.alive():
        pct = boss.health / boss.max_health
        draw_health_bar(screen, 200, 10, 400, 16, pct, MAGENTA)
        boss_label = font_small.render("BOSS", True, WHITE)
        screen.blit(boss_label, (200, 28))

    if boss_defeated and not boss_active and not game_over:
        tip = font_small.render("Boss defeated! Next wave at 1000.", True, GREY)
        screen.blit(tip, tip.get_rect(center=(SCREEN_WIDTH//2, 60)))

    # Game Over overlay
    if game_over:
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 160))
        screen.blit(overlay, (0, 0))

        title = font_big.render("GAME OVER", True, RED)
        tip = font_small.render("Press R to restart", True, WHITE)
        score_msg = font_small.render(f"Final Score: {score}", True, GREEN)
        hi_msg = font_small.render(f"High Score: {highscore}", True, GREY)

        screen.blit(title, title.get_rect(center=(SCREEN_WIDTH//2, SCREEN_HEIGHT//2 - 40)))
        screen.blit(score_msg, score_msg.get_rect(center=(SCREEN_WIDTH//2, SCREEN_HEIGHT//2 + 10)))
        screen.blit(hi_msg, hi_msg.get_rect(center=(SCREEN_WIDTH//2, SCREEN_HEIGHT//2 + 36)))
        screen.blit(tip, tip.get_rect(center=(SCREEN_WIDTH//2, SCREEN_HEIGHT//2 + 70)))

    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()