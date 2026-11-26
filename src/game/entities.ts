import type { Game } from './game';
import type { Stage } from './stage';
import { drawCharacter, drawOrion, drawEcho, glow, type Variant, type Facing } from './draw';
import { Rect, TAU, clamp, dist, rand } from './util';

export interface Body { x: number; y: number }

/** Moves a body (feet point) with axis-separated AABB collision against walls. */
export function moveBody(b: Body, dx: number, dy: number, walls: Rect[], r = 9, bounds?: { w: number; h: number }) {
  const top = 6, bot = 4;
  b.x += dx;
  for (const w of walls) {
    if (b.x - r < w.x + w.w && b.x + r > w.x && b.y - top < w.y + w.h && b.y + bot > w.y) {
      if (dx > 0) b.x = w.x - r - 0.01; else if (dx < 0) b.x = w.x + w.w + r + 0.01;
      else { // pushed by moving wall — resolve along shortest axis
        const l = b.x + r - w.x, rr2 = w.x + w.w - (b.x - r);
        b.x += l < rr2 ? -l : rr2;
      }
    }
  }
  b.y += dy;
  for (const w of walls) {
    if (b.x - r < w.x + w.w && b.x + r > w.x && b.y - top < w.y + w.h && b.y + bot > w.y) {
      if (dy > 0) b.y = w.y - bot - 0.01; else if (dy < 0) b.y = w.y + w.h + top + 0.01;
    }
  }
  if (bounds) { b.x = clamp(b.x, r, bounds.w - r); b.y = clamp(b.y, top + 4, bounds.h - bot); }
}

export type HurtResult = 'hit' | 'blocked' | 'perfect' | 'ignored';

export class Player {
  x = 0; y = 0;
  facing: Facing = 'down';
  fx = 0; fy = 1;
  walk = 0; moving = false;
  hp = 5; maxHp = 5;
  invuln = 0;
  dodgeT = 0; dodgeCd = 0; dvx = 0; dvy = 0;
  atkT = 0; atkCd = 0;
  blocking = false; blockAge = 99;
  speed = 165;
  frozen = false;
  visible = true;
  variant: Variant = 'arin';
  falling = 0;
  dead = false;
  shieldT = 0; // spirit shield
  bubbleT = 0; // pearl bubble
  glowT = 0; // collar glow
  speedMul = 1;
  constructor(public g: Game) {}

  reset(x: number, y: number) {
    this.x = x; this.y = y; this.hp = this.maxHp; this.invuln = 0; this.dodgeT = 0; this.falling = 0; this.dead = false;
    this.frozen = false; this.visible = true; this.blocking = false; this.atkT = 0; this.shieldT = 0; this.bubbleT = 0; this.speedMul = 1;
    this.variant = 'arin';
  }

  get dodging() { return this.dodgeT > 0; }

  update(dt: number, st: Stage) {
    const inp = this.g.input;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.atkT = Math.max(0, this.atkT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.bubbleT = Math.max(0, this.bubbleT - dt);
    this.glowT = Math.max(0, this.glowT - dt);
    this.blockAge += dt;
    if (this.falling > 0) {
      this.falling -= dt;
      if (this.falling <= 0) { this.falling = 0; st.respawnFromFall(); }
      return;
    }
    if (this.dead) return;
    let { x: ax, y: ay } = this.frozen || st.controlLocked ? { x: 0, y: 0 } : inp.axis;
    if (ax && ay) { ax *= 0.7071; ay *= 0.7071; }
    // Block
    const wantBlock = st.combat && !this.frozen && inp.isDown('KeyQ');
    if (wantBlock && !this.blocking) this.blockAge = 0;
    this.blocking = wantBlock;
    // Dodge
    if (!this.frozen && !st.controlLocked && inp.hit('ShiftLeft', 'ShiftRight') && this.dodgeCd <= 0 && st.allowDodge) {
      const dx = ax || this.fx, dy = ay || this.fy;
      const l = Math.hypot(dx, dy) || 1;
      this.dvx = (dx / l) * 470; this.dvy = (dy / l) * 470;
      this.dodgeT = 0.17; this.dodgeCd = 0.55; this.invuln = Math.max(this.invuln, 0.3);
      this.g.audio.play('dodge');
      for (let i = 0; i < 6; i++) this.g.particles.add({ x: this.x, y: this.y - 16, vx: -this.dvx * 0.1 + rand(-20, 20), vy: -this.dvy * 0.1 + rand(-20, 20), life: 0.35, size: 4, color: 'rgba(160,220,255,0.6)', glow: true });
    }
    let mx: number, my: number;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      mx = this.dvx * dt; my = this.dvy * dt;
    } else {
      const sp = this.speed * this.speedMul * st.speedMul * (this.blocking ? 0.45 : 1);
      mx = ax * sp * dt; my = ay * sp * dt;
    }
    this.moving = !!(ax || ay);
    if (this.moving && !this.blocking) {
      this.fx = ax; this.fy = ay;
      if (Math.abs(ax) > Math.abs(ay)) this.facing = ax > 0 ? 'right' : 'left';
      else this.facing = ay > 0 ? 'down' : 'up';
      this.walk += dt * 12;
    } else if (this.moving) this.walk += dt * 6;
    // platform carry
    const plat = st.platformAt(this.x, this.y);
    if (plat) {
      mx += plat.dx; my += plat.dy;
      if (plat.rot) {
        const ox = this.x - plat.x, oy = this.y - plat.y, a = plat.rot * dt;
        mx += ox * Math.cos(a) - oy * Math.sin(a) - ox; my += ox * Math.sin(a) + oy * Math.cos(a) - oy;
      }
    }
    moveBody(this, mx, my, st.solidWalls(), 9, st);
    // void check
    if (st.isVoid && this.dodgeT <= 0 && !st.platformAt(this.x, this.y) && st.isVoid(this.x, this.y)) {
      this.falling = 0.6; this.g.audio.play('whoosh');
    }
  }

  attack(st: Stage) {
    if (this.atkCd > 0 || this.blocking || this.frozen) return;
    this.atkCd = 0.32; this.atkT = 0.18;
    this.g.audio.play('swing');
    const ax = this.x + this.fx * 22, ay = this.y - 14 + this.fy * 22;
    for (let i = 0; i < 5; i++) this.g.particles.add({ x: ax + rand(-8, 8), y: ay + rand(-8, 8), vx: this.fx * 80, vy: this.fy * 80, life: 0.18, size: 3, color: '#bfefff', glow: true });
    let hitAny = false;
    for (const e of st.enemies) {
      if (e.dead) continue;
      if (dist(ax, ay, e.x, e.y - 12) < 30 + e.r) { e.hurt(e.stunT > 0 ? 2 : 1, this.x, this.y, st); hitAny = true; }
    }
    if (st.onAttack(ax, ay)) hitAny = true;
    if (hitAny) this.g.shakeScreen(3);
  }

  /** Returns how the hit was handled. */
  hurt(dmg: number, fromX: number, fromY: number, st: Stage): HurtResult {
    if (this.dead || this.falling > 0) return 'ignored';
    if (this.invuln > 0 || this.dodgeT > 0) return 'ignored';
    if (this.shieldT > 0) { this.g.audio.play('shield'); this.invuln = 0.4; this.g.floatText(this.x, this.y - 50, 'SHIELDED', '#bfe6ff'); return 'blocked'; }
    if (this.blocking) {
      const dx = fromX - this.x, dy = fromY - this.y;
      const l = Math.hypot(dx, dy) || 1;
      const facingDot = (dx / l) * this.fx + (dy / l) * this.fy;
      if (facingDot > -0.2 || (this.fx === 0 && this.fy === 0)) {
        const perfect = this.blockAge < 0.3;
        this.g.audio.play('block');
        this.g.particles.burst(this.x + (dx / l) * 14, this.y - 16 + (dy / l) * 14, 10, '#ffffff', 160, 0.3, 2);
        this.invuln = 0.25;
        if (perfect) { this.g.floatText(this.x, this.y - 52, 'COUNTER!', '#ffd166'); return 'perfect'; }
        return 'blocked';
      }
    }
    this.hp -= dmg;
    this.invuln = 1;
    this.g.audio.play('hurt');
    this.g.shakeScreen(6);
    this.g.flashScreen('rgba(255,60,60,0.25)');
    const l = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    moveBody(this, ((this.x - fromX) / l) * 18, ((this.y - fromY) / l) * 18, st.solidWalls(), 9, st);
    if (this.hp <= 0) {
      if (st.onFatal()) { this.hp = 1; this.invuln = 2; return 'hit'; }
      this.hp = 0; this.dead = true; this.g.onPlayerDeath();
    }
    return 'hit';
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.visible) return;
    ctx.save();
    if (this.falling > 0) {
      const k = this.falling / 0.6;
      ctx.translate(this.x, this.y); ctx.scale(k, k); ctx.translate(-this.x, -this.y);
      ctx.globalAlpha = k;
    }
    if (this.invuln > 0 && !this.dodging && Math.floor(this.invuln * 20) % 2 === 0) ctx.globalAlpha *= 0.4;
    if (this.dead) { ctx.globalAlpha *= 0.5; }
    drawCharacter(ctx, this.x, this.y, { variant: this.variant, facing: this.facing, walk: this.moving ? this.walk : 0, blocking: this.blocking, attack: this.atkT > 0 ? 1 : 0 });
    if (this.atkT > 0) {
      const a = Math.atan2(this.fy, this.fx);
      ctx.strokeStyle = 'rgba(200,240,255,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x, this.y - 14, 26, a - 1 + (1 - this.atkT / 0.18) * 0.6, a + 0.8); ctx.stroke();
    }
    if (this.blocking) {
      ctx.strokeStyle = this.blockAge < 0.3 ? 'rgba(255,220,120,0.9)' : 'rgba(160,220,255,0.7)'; ctx.lineWidth = 3;
      const a = Math.atan2(this.fy || 1, this.fx);
      ctx.beginPath(); ctx.arc(this.x, this.y - 16, 22, a - 0.9, a + 0.9); ctx.stroke();
    }
    if (this.shieldT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.x, this.y - 18, 34, '150,210,255', 0.35 + 0.1 * Math.sin(this.g.time * 10));
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.bubbleT > 0) {
      ctx.strokeStyle = 'rgba(180,240,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y - 18, 24, 0, TAU); ctx.stroke();
    }
    if (this.glowT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.x, this.y - 18, 60, '255,210,120', 0.35 * Math.min(1, this.glowT));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
}

export class NPC {
  walk = 0; t = Math.random() * 10;
  facing: Facing = 'down';
  target: Body | null = null;
  follow: Body | null = null;
  followDist = 46;
  speed = 150;
  visible = true;
  alpha = 1;
  spirit?: string;
  hood = false;
  dogPose: 'stand' | 'sit' | 'lie' | 'walk' | 'bark' | 'sleep' = 'sit';
  dogDir: 1 | -1 = 1;
  old = false;
  pose: 'stand' | 'kneel' | 'reach' | 'cry' = 'stand';
  moving = false;
  label = '';
  noCollide = false;
  constructor(public variant: Variant | 'dog' | 'echo', public x: number, public y: number) {}

  update(dt: number, walls: Rect[]) {
    this.t += dt;
    let tx: number | null = null, ty = 0, stopAt = 4;
    if (this.target) { tx = this.target.x; ty = this.target.y; }
    else if (this.follow) { tx = this.follow.x; ty = this.follow.y; stopAt = this.followDist; }
    this.moving = false;
    if (tx !== null) {
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
      if (d > stopAt) {
        const sp = Math.min(this.speed * (d > 200 && this.follow ? 1.8 : 1) * dt, d - stopAt + 0.5);
        const mx = (dx / d) * sp, my = (dy / d) * sp;
        if (this.noCollide) { this.x += mx; this.y += my; } else moveBody(this, mx, my, walls);
        this.walk += dt * 11; this.moving = true;
        if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left'; else this.facing = dy > 0 ? 'down' : 'up';
        if (Math.abs(dx) > 2) this.dogDir = dx > 0 ? 1 : -1;
      } else if (this.target && d <= stopAt) {
        this.target = null;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.visible) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    if (this.variant === 'dog') {
      drawOrion(ctx, this.x, this.y, { dir: this.dogDir, pose: this.moving ? 'walk' : this.dogPose, t: this.t, old: this.old, spirit: this.spirit });
    } else if (this.variant === 'echo') {
      drawEcho(ctx, this.x, this.y, this.t);
    } else {
      drawCharacter(ctx, this.x, this.y, { variant: this.variant, facing: this.facing, walk: this.moving ? this.walk : 0, spirit: this.spirit, hood: this.hood, pose: this.pose });
    }
    ctx.restore();
  }
}

export type EnemyKind = 'crab' | 'echo' | 'eel' | 'wisp';

export class Enemy {
  hp: number; maxHp: number;
  r = 12; speed = 70; dmg = 1;
  state: 'chase' | 'windup' | 'lunge' | 'recover' = 'chase';
  st = 0; stunT = 0; flash = 0;
  dead = false; deathT = 0;
  t = Math.random() * 10;
  lx = 0; ly = 0; hitDone = false;
  range = 70;
  windup = 0.55;
  lungeSpeed = 330;
  target: Body | null = null;
  spawnT = 0.4;
  constructor(public kind: EnemyKind, public x: number, public y: number, hp = 3) {
    this.hp = hp; this.maxHp = hp;
    if (kind === 'echo') { this.speed = 85; this.r = 13; }
    if (kind === 'eel') { this.speed = 100; this.lungeSpeed = 380; }
    if (kind === 'wisp') { this.speed = 110; this.r = 10; this.range = 60; this.windup = 0.4; }
  }

  update(dt: number, g: Game, st: Stage) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.dead) { this.deathT += dt; return; }
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    if (this.stunT > 0) { this.stunT -= dt; return; }
    const p = this.target ?? g.player;
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
    switch (this.state) {
      case 'chase': {
        const sp = this.speed * dt;
        moveBody(this, (dx / d) * sp, (dy / d) * sp, st.solidWalls(), 10, st);
        if (d < this.range) { this.state = 'windup'; this.st = this.windup; this.lx = dx / d; this.ly = dy / d; }
        break;
      }
      case 'windup':
        this.st -= dt;
        if (this.st <= 0) { this.state = 'lunge'; this.st = 0.22; this.hitDone = false; }
        break;
      case 'lunge': {
        this.st -= dt;
        moveBody(this, this.lx * this.lungeSpeed * dt, this.ly * this.lungeSpeed * dt, st.solidWalls(), 10, st);
        if (!this.hitDone) {
          const pl = g.player;
          if (dist(pl.x, pl.y, this.x, this.y) < this.r + 14) {
            this.hitDone = true;
            const res = pl.hurt(this.dmg, this.x, this.y, st);
            if (res === 'perfect') { this.stunT = 1.3; this.hurt(2, pl.x, pl.y, st); this.state = 'recover'; this.st = 0.3; return; }
            if (res === 'blocked') { this.state = 'recover'; this.st = 0.6; }
          }
          for (const n of st.allies) {
            if (dist(n.x, n.y, this.x, this.y) < this.r + 12 && !this.hitDone) { this.hitDone = true; }
          }
        }
        if (this.st <= 0) { this.state = 'recover'; this.st = 0.5; }
        break;
      }
      case 'recover':
        this.st -= dt;
        if (this.st <= 0) this.state = 'chase';
        break;
    }
  }

  hurt(dmg: number, fx: number, fy: number, st: Stage) {
    if (this.dead || this.spawnT > 0) return;
    this.hp -= dmg; this.flash = 0.15;
    const g = st.g;
    g.audio.play('hit');
    const l = Math.hypot(this.x - fx, this.y - fy) || 1;
    moveBody(this, ((this.x - fx) / l) * 22, ((this.y - fy) / l) * 22, st.solidWalls(), 10, st);
    g.particles.burst(this.x, this.y - 12, 8, this.kind === 'crab' ? '#ff9f6e' : '#9db4ff', 140, 0.4, 3);
    if (this.state === 'windup') { this.state = 'recover'; this.st = 0.4; }
    if (this.hp <= 0) {
      this.dead = true;
      g.particles.burst(this.x, this.y - 12, 20, this.kind === 'echo' || this.kind === 'wisp' ? '#6c6cff' : '#7fe0ff', 200, 0.7, 4);
      st.onEnemyDeath(this);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead && this.deathT > 0.01) return;
    ctx.save();
    if (this.spawnT > 0) ctx.globalAlpha = 1 - this.spawnT / 0.4;
    const shake = this.state === 'windup' ? Math.sin(this.t * 60) * 2 : 0;
    const x = this.x + shake, y = this.y;
    if (this.kind === 'crab') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 14, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = this.flash > 0 ? '#fff' : '#d0583c';
      ctx.beginPath(); ctx.ellipse(x, y - 8, 13, 8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#a03a26'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i += 2) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + i * 8, y - 6 + k * 2); ctx.lineTo(x + i * (16 + Math.sin(this.t * 12 + k) * 2), y - 2 + k * 2); ctx.stroke(); }
      ctx.fillStyle = this.flash > 0 ? '#fff' : '#e8704f';
      ctx.beginPath(); ctx.arc(x - 14, y - 16, 5, 0, TAU); ctx.arc(x + 14, y - 16, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7ff'; ctx.fillRect(x - 5, y - 15, 3, 3); ctx.fillRect(x + 2, y - 15, 3, 3);
    } else if (this.kind === 'eel') {
      ctx.strokeStyle = this.flash > 0 ? '#fff' : '#3c6d7a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const px = x - this.lx * i * 6 + Math.sin(this.t * 8 + i) * 4, py = y - 10 - this.ly * i * 6; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
      ctx.fillStyle = '#9ff'; ctx.beginPath(); ctx.arc(x, y - 10, 2, 0, TAU); ctx.fill();
    } else {
      drawEcho(ctx, x, y, this.t, this.kind === 'wisp' ? 0.8 : 1, 1, this.stunT > 0);
      if (this.flash > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y - 18, 22, '255,255,255', 0.8); }
    }
    if (this.state === 'windup') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ff5d5d'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('!', x, y - 44);
    }
    if (this.stunT > 0) {
      ctx.fillStyle = '#ffd166'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('★ ★', x + Math.sin(this.t * 8) * 4, y - 46);
    }
    if (this.hp < this.maxHp && this.hp > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 14, y - 52, 28, 4);
      ctx.fillStyle = '#ff6b6b'; ctx.fillRect(x - 14, y - 52, 28 * (this.hp / this.maxHp), 4);
    }
    ctx.restore();
  }
}

export interface Projectile {
  x: number; y: number; vx: number; vy: number; r: number; dmg: number; color: string; life: number;
  homing?: number; dead?: boolean; rgb?: string;
}
