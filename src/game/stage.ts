import type { Game } from './game';
import { Enemy, NPC, type Projectile } from './entities';
import { drawPhoto, glow } from './draw';
import { Rect, dist, inRect } from './util';
import type { MeterView } from './store';

export interface Interactable {
  x: number; y: number; r?: number; label: string;
  action: () => void;
  enabled?: () => boolean;
  tool?: number; // 1-4 = requires that tool key instead of E
  id?: string;
}

export interface Platform {
  kind: 'rect' | 'circle';
  x: number; y: number; w: number; h: number; r: number;
  dx: number; dy: number; // movement this frame
  rot?: number; // angular velocity (rad/s) for rotating platforms
  data?: Record<string, number>;
}

export interface Light { x: number; y: number; r: number; rgb?: string; a?: number }

export interface Sprite { y: number; draw: (ctx: CanvasRenderingContext2D) => void }

export abstract class Stage {
  name = '';
  objective = '';
  w = 960; h = 600;
  spawn = { x: 120, y: 300 };
  checkpoint = { x: 120, y: 300 };
  walls: Rect[] = [];
  dynamicWalls: Rect[] = [];
  interacts: Interactable[] = [];
  enemies: Enemy[] = [];
  allies: NPC[] = [];
  npcs: NPC[] = [];
  projectiles: Projectile[] = [];
  platforms: Platform[] = [];
  isVoid: ((x: number, y: number) => boolean) | null = null;
  combat = false;
  allowDodge = true;
  controlLocked = false;
  darkness = 0;
  darkRGB = '4,6,18';
  playerLight = 150;
  rewindUsed = false;
  speedMul = 1;
  t = 0;
  photoIndex = -1;
  photoPos: { x: number; y: number } | null = null;
  bgColor = '#111';

  constructor(public g: Game) {}

  /** build the room */
  abstract setup(): void;
  update(_dt: number): void { /* override */ }
  /** runs before the player moves (move platforms here) */
  preUpdate(_dt: number): void { /* override */ }
  drawBg(ctx: CanvasRenderingContext2D): void { ctx.fillStyle = this.bgColor; ctx.fillRect(0, 0, this.w, this.h); }
  drawFg(_ctx: CanvasRenderingContext2D): void { /* override */ }
  drawScreen(_ctx: CanvasRenderingContext2D): void { /* override */ }
  sprites(): Sprite[] { return []; }
  lights(): Light[] { return []; }
  meters(): MeterView[] { return []; }
  onTool(_n: number): boolean { return false; }
  onRewind(): void { /* override */ }
  onAttack(_x: number, _y: number): boolean { return false; }
  onEnemyDeath(_e: Enemy): void { /* override */ }
  onFatal(): boolean { return false; }
  onEnter(): void { /* called after setup + fade in */ }

  get p() { return this.g.player; }
  solidWalls(): Rect[] { return this.dynamicWalls.length ? this.walls.concat(this.dynamicWalls) : this.walls; }

  setObjective(s: string) { this.objective = s; this.g.syncObjective(); }
  complete() { this.g.completeStage(); }
  say(lines: [string, string][], then?: () => void) { this.g.dialogue(lines, then); }

  platformAt(x: number, y: number): Platform | null {
    for (const pl of this.platforms) {
      if (pl.kind === 'rect' ? inRect(x, y, pl) : dist(x, y, pl.x, pl.y) < pl.r) return pl;
    }
    return null;
  }

  respawnFromFall() {
    this.p.x = this.checkpoint.x; this.p.y = this.checkpoint.y;
    this.p.invuln = 1;
    this.p.hp -= 1;
    this.g.audio.play('hurt');
    if (this.p.hp <= 0) { this.p.hp = 0; this.p.dead = true; this.g.onPlayerDeath(); }
  }

  /** Places this level's hidden Photo of Orion (if not yet collected). */
  placePhoto(x: number, y: number) {
    const idx = this.g.levelIndex;
    if (this.g.save.photos[idx]) return;
    this.photoIndex = idx;
    this.photoPos = { x, y };
    this.interacts.push({
      x, y, r: 30, label: 'Pick up photo', id: 'photo',
      action: () => {
        this.g.collectPhoto(idx);
        this.photoPos = null;
        this.interacts = this.interacts.filter((i) => i.id !== 'photo');
      },
    });
  }

  drawPhotoPickup(ctx: CanvasRenderingContext2D) {
    if (this.photoPos) drawPhoto(ctx, this.photoPos.x, this.photoPos.y - 14, this.t);
  }

  /** Default per-frame bookkeeping (enemies, projectiles, npcs). */
  updateCommon(dt: number) {
    for (const e of this.enemies) e.update(dt, this.g, this);
    this.enemies = this.enemies.filter((e) => !e.dead || e.deathT < 0.05);
    const walls = this.solidWalls();
    for (const n of this.npcs) n.update(dt, walls);
    for (const n of this.allies) n.update(dt, walls);
    const pl = this.p;
    for (const pr of this.projectiles) {
      pr.life -= dt;
      if (pr.homing) {
        const dx = pl.x - pr.x, dy = pl.y - 16 - pr.y, l = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx += (dx / l) * pr.homing * dt * sp; pr.vy += (dy / l) * pr.homing * dt * sp;
        const ns = Math.hypot(pr.vx, pr.vy) || 1; pr.vx = (pr.vx / ns) * sp; pr.vy = (pr.vy / ns) * sp;
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.life <= 0 || pr.x < -50 || pr.y < -50 || pr.x > this.w + 50 || pr.y > this.h + 50) pr.dead = true;
      if (!pr.dead && dist(pr.x, pr.y, pl.x, pl.y - 16) < pr.r + 10) {
        if (pl.bubbleT > 0) { pr.dead = true; this.g.audio.play('bubble'); this.g.particles.burst(pr.x, pr.y, 6, '#bff', 80, 0.3, 2); continue; }
        const res = pl.hurt(pr.dmg, pr.x, pr.y, this);
        if (res !== 'ignored') pr.dead = true;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  drawProjectiles(ctx: CanvasRenderingContext2D) {
    const prev = ctx.globalCompositeOperation;
    for (const pr of this.projectiles) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, pr.x, pr.y, pr.r * 3, pr.rgb ?? '180,120,255', 0.6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = prev;
  }

  /** Helper: draw a floor of tiles */
  tileFloor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size: number, a: string, b: string) {
    ctx.fillStyle = a; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = b;
    for (let ty = 0; ty < h; ty += size) for (let tx = ((ty / size) % 2) * size; tx < w; tx += size * 2) ctx.fillRect(x + tx, y + ty, Math.min(size, w - tx), Math.min(size, h - ty));
  }
  drawWalls(ctx: CanvasRenderingContext2D, top: string, side: string, list: Rect[] = this.walls) {
    for (const w of list) {
      ctx.fillStyle = side; ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = top; ctx.fillRect(w.x, w.y, w.w, Math.min(w.h, Math.max(6, w.h - 14)));
    }
  }
  label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#fff', size = 11) {
    ctx.font = `${size}px ui-monospace, monospace`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
}
