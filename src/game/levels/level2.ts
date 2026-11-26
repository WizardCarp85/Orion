import { Stage, type Sprite, type Light } from '../stage';
import { Enemy, NPC } from '../entities';
import { R, Rect, TAU, clamp, dist, inRect, mulberry32, rand, rectsOverlap } from '../util';
import { drawCharacter, drawOrb, glow, drawEcho } from '../draw';
import { block, arrowHint, doorGlow, itemIcon } from './common';
import type { MeterView } from '../store';

type C = CanvasRenderingContext2D;

/** Simple ally combat AI: move to nearest enemy and strike. */
export function allyFight(n: NPC, st: Stage, dt: number, cdKey: { cd: number }, range = 34, dmg = 1) {
  cdKey.cd -= dt;
  let best: Enemy | null = null, bd = 1e9;
  for (const e of st.enemies) { if (e.dead || e.spawnT > 0) continue; const d = dist(n.x, n.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
  if (best) {
    n.target = { x: best.x - Math.sign(best.x - n.x) * 20, y: best.y };
    n.follow = null;
    if (bd < range + best.r && cdKey.cd <= 0) {
      cdKey.cd = 0.9;
      best.hurt(dmg, n.x, n.y, st);
      st.g.particles.burst(best.x, best.y - 12, 6, '#bff', 120, 0.3, 2);
    }
  } else { n.target = null; n.follow = st.p; }
}

function water(ctx: C, x: number, y: number, w: number, h: number, t: number, deep = '#174a5e', light = '#1f5a70') {
  ctx.fillStyle = deep; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(190,240,255,0.18)'; ctx.lineWidth = 2;
  for (let yy = y + 10; yy < y + h; yy += 26) {
    ctx.beginPath();
    for (let xx = x; xx <= x + w; xx += 16) ctx.lineTo(xx, yy + Math.sin(xx * 0.05 + t * 2 + yy) * 3);
    ctx.stroke();
  }
  void light;
}

// ===================================================================== ISLAND DEFENSE
export class L2Island extends Stage {
  name = 'Island Defense';
  warrior!: NPC;
  wcd = { cd: 0 };
  phase = 0;
  waveDelay = 0;
  done = false;
  island: Rect = R(140, 140, 680, 400);

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 400 };
    this.combat = true;
    const i = this.island;
    this.walls.push(R(0, 0, 960, i.y), R(0, i.y + i.h, 960, 600 - i.y - i.h), R(0, 0, i.x, 600), R(i.x + i.w, 0, 960 - i.x - i.w, 600));
    this.walls.push(R(230, 180, 90, 40)); // boat wreck
    this.warrior = new NPC('warrior', 540, 360); this.warrior.speed = 170;
    this.allies.push(this.warrior);
    this.setObjective('Defend the island. Learn to dodge (Shift), block (hold Q) and counter.');
  }
  onEnter() {
    this.say([['Warrior Arin', "Here they come. Sea crawlers. Watch for the red mark — that's when they lunge."], ['Warrior Arin', 'Shift to dodge through them. E or Space to strike.']], () => this.spawnWave());
    this.g.hint('Attack: E / Space · Dodge: Shift · Block: hold Q (block right as they hit = COUNTER)');
  }

  spawnWave() {
    this.phase++;
    const n = [0, 2, 3, 5][this.phase] ?? 0;
    for (let k = 0; k < n; k++) {
      const side = k % 4;
      const x = side === 0 ? 160 : side === 1 ? 800 : rand(200, 760), y = side < 2 ? rand(180, 500) : side === 2 ? 160 : 520;
      const e = new Enemy(this.phase === 3 && k === 4 ? 'eel' : 'crab', x, y, this.phase === 3 ? 3 : 2);
      e.speed = 60 + this.phase * 8;
      this.enemies.push(e);
    }
    if (this.phase === 2) this.say([['Warrior Arin', "Now hold Q to block. Time it right as they hit and you'll counter — stuns them and hits hard."]]);
    if (this.phase === 3) this.say([['Warrior Arin', "Big wave. Stay close. Nobody gets past us."]]);
  }

  update(dt: number) {
    allyFight(this.warrior, this, dt, this.wcd);
    if (this.done) return;
    if (this.enemies.filter((e) => !e.dead).length === 0 && this.phase > 0) {
      this.waveDelay += dt;
      if (this.waveDelay > 1.2) {
        this.waveDelay = 0;
        if (this.phase >= 3) {
          this.done = true;
          this.say([['Warrior Arin', "...You fight like me. Sloppier."], ['Warrior Arin', "Your piece of light sank past the old city. We take the boat through the storm. Hold on."]], () => this.complete());
        } else this.spawnWave();
      }
    }
  }

  drawBg(ctx: C) {
    const t = this.t;
    water(ctx, 0, 0, 960, 600, t);
    const i = this.island;
    ctx.fillStyle = '#c8b088'; ctx.beginPath(); ctx.ellipse(i.x + i.w / 2, i.y + i.h / 2, i.w / 2 + 30, i.h / 2 + 30, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8c09a'; ctx.fillRect(i.x, i.y, i.w, i.h);
    const r = mulberry32(5);
    for (let k = 0; k < 80; k++) { ctx.fillStyle = 'rgba(150,120,80,0.3)'; ctx.fillRect(i.x + r() * i.w, i.y + r() * i.h, 3, 2); }
    block(ctx, 230, 180, 90, 40, '#6a4a32', '#4a3222', 14);
    // children peeking
    drawCharacter(ctx, 260, 182, { variant: 'child', facing: 'down', scale: 0.8 });
    drawCharacter(ctx, 290, 182, { variant: 'child', facing: 'down', scale: 0.75 });
    // ruined skyscraper tops in water
    for (const [x, y] of [[60, 80], [880, 120], [70, 500], [900, 480]]) block(ctx, x - 30, y - 30, 60, 60, '#3a4f5c', '#25343f', 18);
  }
}

// ===================================================================== BOAT RUN
interface Wreck { x: number; y: number; w: number; h: number; kind: number }
export class L2Boat extends Stage {
  name = 'Boat Run';
  wrecks: Wreck[] = [];
  spawnT = 0.5;
  progress = 0;
  flares: { x: number; y: number; t: number }[] = [];
  flareT = 1;
  lightning = 0;
  done = false;
  scroll = 0;

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 480 };
    this.darkness = 0.88; this.darkRGB = '2,8,14'; this.playerLight = 110;
    this.walls.push(R(0, 0, 130, 600), R(830, 0, 130, 600), R(0, 0, 960, 200), R(0, 585, 960, 15));
    this.setObjective('Steer through the storm wreckage! (Warrior Arin fires flares to light the way.)');
    this.p.visible = false;
  }
  onEnter() {
    this.p.visible = false;
    this.say([['Warrior Arin', "I'll light the way. You steer. Don't hit anything — this boat's held together with prayer."]]);
    this.g.hint('Steer with WASD / Arrows. Shift = sharp swerve.');
  }

  update(dt: number) {
    if (this.done) return;
    const speed = 240 + this.progress * 1.6;
    this.scroll += speed * dt;
    this.progress = Math.min(100, this.progress + dt * 1.9);
    this.p.visible = false;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = clamp(0.75 - this.progress * 0.004, 0.38, 0.8);
      const w = rand(50, 150), kind = Math.floor(rand(0, 3));
      this.wrecks.push({ x: rand(130, 830 - w), y: -80, w, h: kind === 1 ? 40 : rand(40, 90), kind });
    }
    for (const wr of this.wrecks) wr.y += speed * dt;
    this.wrecks = this.wrecks.filter((w) => w.y < 700);
    const box = R(this.p.x - 16, this.p.y - 50, 32, 56);
    for (const wr of this.wrecks) {
      if (rectsOverlap(box, wr)) {
        if (this.p.hurt(1, wr.x + wr.w / 2, wr.y + wr.h / 2, this) === 'hit') { this.g.sfx('splash'); this.g.particles.burst(this.p.x, this.p.y - 30, 16, '#a8d8e8', 160, 0.5, 3, false); }
      }
    }
    this.flareT -= dt;
    if (this.flareT <= 0) {
      this.flareT = rand(2.2, 3.2);
      this.flares.push({ x: clamp(this.p.x + rand(-160, 160), 160, 800), y: this.p.y - 60, t: 0 });
      this.g.sfx('lamp');
    }
    for (const f of this.flares) { f.t += dt; f.y -= dt * (f.t < 0.6 ? 500 : 40); }
    this.flares = this.flares.filter((f) => f.t < 3.2);
    this.lightning = Math.max(0, this.lightning - dt);
    if (Math.random() < 0.004) { this.lightning = 0.25; this.g.sfx('rumble'); }
    if (Math.random() < 0.6) this.g.particles.add({ x: rand(0, 960), y: rand(-10, 600), vx: -60, vy: 600, life: 0.3, size: 1, color: 'rgba(180,210,230,0.5)', shape: 'line' });
    if (this.progress >= 100) {
      this.done = true; this.wrecks = [];
      this.say([['Warrior Arin', "We're through. The signal's coming from below — the old city."], ['Warrior Arin', "Take a breath. A big one. You'll find air pockets down there if you're lucky."]], () => { this.p.visible = true; this.complete(); });
    }
  }

  lights(): Light[] {
    const L: Light[] = this.flares.map((f) => ({ x: f.x, y: f.y, r: f.t < 0.6 ? 80 : 300 * Math.min(1, (3.2 - f.t) / 1), rgb: '255,120,90' }));
    if (this.lightning > 0) L.push({ x: 480, y: 300, r: 900, a: 0.9 });
    return L;
  }
  meters(): MeterView[] { return [{ label: 'Storm passage', value: this.progress / 100, color: '#6fd1c6' }]; }

  drawBg(ctx: C) {
    const t = this.t;
    ctx.fillStyle = '#0c2a38'; ctx.fillRect(0, 0, 960, 600);
    ctx.strokeStyle = 'rgba(160,220,240,0.2)'; ctx.lineWidth = 2;
    for (let y = -40; y < 640; y += 40) {
      const yy = (y + this.scroll) % 640 - 40;
      ctx.beginPath(); for (let x = 0; x <= 960; x += 20) ctx.lineTo(x, yy + Math.sin(x * 0.04 + t * 3) * 6); ctx.stroke();
    }
    // ruined towers on the sides
    for (let k = 0; k < 8; k++) {
      const y = ((k * 160 + this.scroll * 0.9) % 1280) - 200;
      block(ctx, 20, y, 100, 120, '#2a3a46', '#1a2630', 20);
      block(ctx, 840, y + 80, 100, 120, '#2a3a46', '#1a2630', 20);
    }
    for (const wr of this.wrecks) {
      if (wr.kind === 0) { block(ctx, wr.x, wr.y, wr.w, wr.h, '#5a4a3a', '#3a2e22', 12); ctx.strokeStyle = '#2a2018'; ctx.strokeRect(wr.x + 4, wr.y + 4, wr.w - 8, wr.h - 16); }
      else if (wr.kind === 1) { block(ctx, wr.x, wr.y, wr.w, wr.h, '#7a3a3a', '#4a2222', 10); ctx.fillStyle = '#9ad'; ctx.fillRect(wr.x + 8, wr.y + 6, wr.w * 0.3, 10); }
      else { block(ctx, wr.x, wr.y, wr.w, wr.h, '#3a4f5c', '#25343f', 16); for (let yy = wr.y + 6; yy < wr.y + wr.h - 16; yy += 14) for (let xx = wr.x + 6; xx < wr.x + wr.w - 8; xx += 14) { ctx.fillStyle = '#4a6a7a'; ctx.fillRect(xx, yy, 6, 6); } }
      ctx.strokeStyle = 'rgba(220,250,255,0.4)'; ctx.beginPath(); ctx.moveTo(wr.x - 4, wr.y + wr.h); ctx.lineTo(wr.x + wr.w + 4, wr.y + wr.h); ctx.stroke();
    }
  }
  sprites(): Sprite[] {
    const p = this.p;
    return [{ y: p.y, draw: (c) => {
      if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) c.globalAlpha = 0.5;
      c.fillStyle = 'rgba(220,250,255,0.4)'; c.beginPath(); c.moveTo(p.x - 18, p.y + 6); c.lineTo(p.x - 30, p.y + 40); c.lineTo(p.x + 30, p.y + 40); c.lineTo(p.x + 18, p.y + 6); c.fill();
      c.fillStyle = '#6a4a32'; c.beginPath(); c.moveTo(p.x, p.y - 56); c.lineTo(p.x + 20, p.y - 30); c.lineTo(p.x + 18, p.y + 8); c.lineTo(p.x - 18, p.y + 8); c.lineTo(p.x - 20, p.y - 30); c.closePath(); c.fill();
      c.fillStyle = '#8a6a4a'; c.fillRect(p.x - 14, p.y - 30, 28, 32);
      drawCharacter(c, p.x, p.y - 2, { variant: 'arin', facing: 'up', scale: 0.7 });
      drawCharacter(c, p.x, p.y - 26, { variant: 'warrior', facing: 'up', scale: 0.7 });
    } }];
  }
  drawFg(ctx: C) {
    for (const f of this.flares) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y, 24, '255,140,100', 0.9); ctx.globalCompositeOperation = 'source-over'; }
  }
  drawScreen(ctx: C) { if (this.lightning > 0) { ctx.fillStyle = `rgba(220,240,255,${this.lightning})`; ctx.fillRect(0, 0, 960, 600); } }
}

// ===================================================================== UNDERWATER DIVE
export class L2Dive extends Stage {
  name = 'Underwater Dive';
  oxygen = 100;
  vents = [{ x: 380, y: 300 }, { x: 900, y: 760 }, { x: 1300, y: 300 }, { x: 600, y: 1000 }];
  clams = [{ x: 200, y: 900, cd: 0 }, { x: 1200, y: 1000, cd: 0 }, { x: 1450, y: 600, cd: 0 }];
  bubbles: { x: number; y: number; vy: number }[] = [];
  glyphs = [{ x: 1500, y: 160, got: false }, { x: 140, y: 1100, got: false }, { x: 1050, y: 560, got: false }];
  door = { x: 800, y: 1150 };
  warrior!: NPC;
  suffocT = 0;
  done = false;
  kelp: { x: number; y: number; h: number }[] = [];

  setup() {
    this.w = 1600; this.h = 1200;
    this.spawn = { x: 120, y: 120 };
    this.combat = true;
    this.speedMul = 0.85;
    this.darkness = 0.72; this.darkRGB = '0,10,24'; this.playerLight = 150;
    this.walls.push(R(0, 0, 1600, 20), R(0, 1180, 1600, 20), R(0, 0, 20, 1200), R(1580, 0, 20, 1200));
    // sunken buildings
    this.walls.push(R(260, 120, 80, 420), R(480, 20, 90, 300), R(700, 250, 300, 80), R(1150, 120, 70, 380), R(300, 680, 380, 70), R(820, 450, 80, 420), R(1050, 760, 300, 70), R(1350, 300, 80, 260), R(450, 900, 70, 280));
    const r = mulberry32(9);
    for (let i = 0; i < 40; i++) this.kelp.push({ x: r() * 1600, y: r() * 1200, h: 30 + r() * 50 });
    this.kelp = this.kelp.filter((k) => !this.walls.some((w) => inRect(k.x, k.y, w)));
    for (const c of this.clams) this.interacts.push({ x: c.x, y: c.y, r: 40, label: 'Breathe from the pearl pocket', enabled: () => c.cd <= 0, action: () => { this.oxygen = 100; c.cd = 8; this.g.sfx('bubble'); this.g.toast('Oxygen refilled'); } });
    for (const gl of this.glyphs) this.interacts.push({ x: gl.x, y: gl.y, r: 36, label: 'Take temple glyph stone', enabled: () => !gl.got, action: () => { gl.got = true; this.g.sfx('pickup'); this.updateObj(); } });
    this.interacts.push({ x: this.door.x, y: this.door.y, r: 60, label: 'Enter the Sunken Temple', enabled: () => this.glyphs.every((g) => g.got), action: () => { if (!this.done) { this.done = true; this.complete(); } } });
    for (let i = 0; i < 3; i++) { const e = new Enemy('eel', 600 + i * 300, 600 + (i % 2) * 300, 2); e.speed = 60; this.enemies.push(e); }
    this.warrior = new NPC('warrior', 90, 140); this.warrior.follow = this.p; this.warrior.speed = 140;
    this.allies.push(this.warrior);
    this.placePhoto(1530, 1130);
    this.updateObj();
  }
  onEnter() {
    this.g.hint('Oxygen drains underwater. Touch bubble streams or breathe at glowing pearl clams.');
  }
  updateObj() {
    const n = this.glyphs.filter((g) => g.got).length;
    this.setObjective(n < 3 ? `Find the 3 temple glyph stones in the drowned city (${n}/3). Watch your oxygen!` : 'All glyphs found! Swim to the Sunken Temple gate (south).');
  }

  update(dt: number) {
    const p = this.p;
    if (p.bubbleT <= 0) this.oxygen -= dt * 4.2;
    this.oxygen = clamp(this.oxygen, 0, 100);
    for (const c of this.clams) c.cd -= dt;
    for (const v of this.vents) {
      if (Math.random() < dt * 6) this.bubbles.push({ x: v.x + rand(-8, 8), y: v.y, vy: -rand(40, 80) });
      if (dist(p.x, p.y - 10, v.x, v.y - 30) < 40 && this.oxygen < 100) { this.oxygen = Math.min(100, this.oxygen + dt * 60); if (Math.random() < 0.1) this.g.sfx('bubble'); }
    }
    for (const b of this.bubbles) b.y += b.vy * dt;
    this.bubbles = this.bubbles.filter((b) => b.y > 0 && this.vents.some((v) => v.y - b.y < 160));
    if (this.oxygen <= 0) {
      this.suffocT += dt;
      if (this.suffocT > 1.6) { this.suffocT = 0; p.invuln = 0; p.hurt(1, p.x, p.y + 1, this); this.g.toast('Out of air!'); }
    }
    if (Math.random() < 0.15) this.g.particles.add({ x: p.x + rand(-6, 6), y: p.y - 34, vx: rand(-5, 5), vy: -40, life: 1.2, size: 2, color: 'rgba(200,240,255,0.6)' });
    // eels respawn slowly
    if (this.enemies.length < 2 && Math.random() < 0.002) { const e = new Enemy('eel', rand(200, 1400), rand(200, 1000), 2); e.speed = 60; if (!this.walls.some((w) => inRect(e.x, e.y, w))) this.enemies.push(e); }
    this.warrior.follow = p;
  }
  meters(): MeterView[] { return [{ label: 'Oxygen', value: this.oxygen / 100, color: this.oxygen < 25 ? '#ff6b6b' : '#7fe8ff' }]; }
  lights(): Light[] {
    const L: Light[] = [];
    for (const c of this.clams) L.push({ x: c.x, y: c.y - 10, r: c.cd > 0 ? 50 : 110, rgb: '255,220,240' });
    for (const g of this.glyphs) if (!g.got) L.push({ x: g.x, y: g.y - 16, r: 90, rgb: '120,255,220' });
    for (const k of this.kelp) if (k.h > 65) L.push({ x: k.x, y: k.y - k.h, r: 50, rgb: '80,255,180', a: 0.6 });
    L.push({ x: this.door.x, y: this.door.y - 30, r: 180, rgb: '120,220,255' });
    for (const v of this.vents) L.push({ x: v.x, y: v.y - 40, r: 70, rgb: '180,240,255', a: 0.6 });
    return L;
  }

  drawBg(ctx: C) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, '#0e4a66'); g.addColorStop(1, '#03182a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    const r = mulberry32(2);
    for (let i = 0; i < 160; i++) { ctx.fillStyle = 'rgba(200,220,180,0.08)'; ctx.fillRect(r() * this.w, r() * this.h, 4 + r() * 10, 2 + r() * 4); }
    for (const w of this.walls) { block(ctx, w.x, w.y, w.w, w.h, '#2c4450', '#1a2c36', 16); if (w.w > 30 && w.h > 60) { for (let yy = w.y + 10; yy < w.y + w.h - 20; yy += 24) for (let xx = w.x + 8; xx < w.x + w.w - 10; xx += 20) { ctx.fillStyle = 'rgba(80,140,160,0.35)'; ctx.fillRect(xx, yy, 8, 10); } } }
    for (const k of this.kelp) {
      ctx.strokeStyle = '#2a7a5a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(k.x, k.y);
      for (let s = 1; s <= 6; s++) ctx.lineTo(k.x + Math.sin(t * 1.5 + s + k.x) * s * 1.6, k.y - (k.h * s) / 6);
      ctx.stroke();
    }
    for (const v of this.vents) { ctx.fillStyle = '#3a4a50'; ctx.beginPath(); ctx.ellipse(v.x, v.y, 18, 8, 0, 0, TAU); ctx.fill(); }
    for (const b of this.bubbles) { ctx.strokeStyle = 'rgba(220,250,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x + Math.sin(b.y * 0.05) * 4, b.y, 4, 0, TAU); ctx.stroke(); }
    for (const c of this.clams) {
      ctx.fillStyle = '#7a5a8a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 26, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9a7aaa'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 8, 24, 10, 0, Math.PI, TAU); ctx.fill();
      if (c.cd <= 0) { ctx.fillStyle = '#fff4fa'; ctx.beginPath(); ctx.arc(c.x, c.y - 4, 6, 0, TAU); ctx.fill(); }
    }
    for (const gl of this.glyphs) if (!gl.got) { ctx.fillStyle = '#4a7a7a'; ctx.fillRect(gl.x - 10, gl.y - 26, 20, 24); ctx.strokeStyle = '#8fffe0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gl.x, gl.y - 14, 6, 0, TAU); ctx.stroke(); }
    // temple gate
    block(ctx, this.door.x - 70, this.door.y - 90, 140, 70, '#4a5a5e', '#2a3638', 20);
    ctx.fillStyle = '#0a1a22'; ctx.fillRect(this.door.x - 26, this.door.y - 56, 52, 36);
    if (this.glyphs.every((g) => g.got)) { doorGlow(ctx, R(this.door.x - 26, this.door.y - 56, 52, 36), t); arrowHint(ctx, this.door.x, this.door.y - 70, t); }
  }
  sprites(): Sprite[] { return [{ y: 1130, draw: (c) => this.drawPhotoPickup(c) }]; }
}

// ===================================================================== SUNKEN TEMPLE
export class L2Temple extends Stage {
  name = 'Sunken Temple';
  level = 0;
  shown = 0; // animated level
  seals = [false, false];
  carvingSeen = false;
  doorA: Rect = R(250, 300, 20, 100);   // west, opens at level 2
  doorB: Rect = R(690, 300, 20, 100);   // east, opens at level 0
  doorC: Rect = R(430, 120, 100, 20);   // north, opens at level 1 with both seals
  pit: Rect = R(60, 250, 120, 200);      // west pit: swim at level 2
  channel: Rect = R(760, 300, 100, 100); // east channel: walk at level 0
  done = false;

  setup() {
    this.w = 960; this.h = 700;
    this.spawn = { x: 480, y: 560 };
    this.walls.push(R(0, 0, 960, 20), R(0, 660, 960, 40), R(0, 0, 20, 700), R(940, 0, 20, 700));
    this.walls.push(R(250, 20, 20, 280), R(250, 400, 20, 260)); // west wall w/ door gap
    this.walls.push(R(690, 20, 20, 280), R(690, 400, 20, 260)); // east wall
    this.walls.push(R(270, 120, 160, 20), R(530, 120, 160, 20)); // north wall w/ door gap
    this.interacts.push({ x: 480, y: 420, r: 46, label: 'Turn the water wheel', action: () => this.turnWheel() });
    this.interacts.push({ x: 60, y: 120, r: 40, label: 'Take the Moon Seal', enabled: () => !this.seals[0], action: () => { this.seals[0] = true; this.g.sfx('pickup'); this.g.toast('Moon Seal (1/2)'); this.updObj(); } });
    this.interacts.push({ x: 900, y: 350, r: 40, label: 'Take the Tide Seal', enabled: () => !this.seals[1], action: () => { this.seals[1] = true; this.g.sfx('pickup'); this.g.toast('Tide Seal (2/2)'); this.updObj(); } });
    this.interacts.push({ x: 480, y: 70, r: 50, label: 'Inspect the wall carving', enabled: () => this.doorCOpen(), action: () => this.inspect() });
    this.isVoid = (x, y) => inRect(x, y, this.pit) && this.level < 2;
    this.updateDoors();
    this.updObj();
    this.checkpoint = { x: 480, y: 560 };
  }
  onEnter() {
    this.say([['Warrior Arin', "Temple's half-drowned. That wheel moves the water. Doors here only open at the right tide."]]);
    this.g.hint('Water level gauges: ≈ marks over each door show the level it needs.');
  }
  doorCOpen() { return this.level === 1 && this.seals[0] && this.seals[1]; }
  updObj() {
    const n = this.seals.filter(Boolean).length;
    if (n < 2) this.setObjective(`Use the water wheel to open the side doors and recover both seals (${n}/2).`);
    else this.setObjective('Both seals placed. Set the water to the half-moon level (≈) to open the north door.');
  }
  turnWheel() {
    this.level = (this.level + 1) % 3;
    this.g.sfx('splash'); this.g.sfx('gear');
    this.g.toast(`Water level: ${['Low', 'Middle (≈)', 'High (≈≈)'][this.level]}`);
    this.updateDoors();
    if (this.doorCOpen()) this.g.sfx('door');
  }
  updateDoors() {
    this.dynamicWalls = [];
    if (this.level !== 2) this.dynamicWalls.push(this.doorA);
    if (this.level !== 0) this.dynamicWalls.push(this.doorB, this.channel);
    if (!this.doorCOpen()) this.dynamicWalls.push(this.doorC);
    // don't trap the player inside a closing door
    const p = this.p;
    for (const d of this.dynamicWalls) if (p.x > d.x - 10 && p.x < d.x + d.w + 10 && p.y > d.y - 4 && p.y < d.y + d.h + 8) { p.x = 480; p.y = 500; }
  }
  inspect() {
    if (this.carvingSeen) return;
    this.carvingSeen = true;
    this.g.playCutscene('carving2', () => {
      this.say([['Warrior Arin', "The old priests said a man once broke the sky with a stone of light. A dog walked with him."], ['Warrior Arin', "...Come on. The thing that guards the piece is waking up."]], () => this.complete());
    });
  }
  update(dt: number) {
    this.shown += (this.level - this.shown) * Math.min(1, dt * 2);
    this.speedMul = this.level === 2 ? 0.75 : 1;
    if (Math.random() < 0.05) this.g.particles.add({ x: rand(20, 940), y: rand(20, 680), vy: -20, life: 2, size: 2, color: 'rgba(200,240,255,0.4)' });
  }
  drawBg(ctx: C) {
    const t = this.t;
    this.tileFloor(ctx, 0, 0, 960, 700, 40, '#4a5a5e', '#526468');
    // pit
    ctx.fillStyle = '#0a1418'; ctx.fillRect(this.pit.x, this.pit.y, this.pit.w, this.pit.h);
    // channel
    ctx.fillStyle = this.level === 0 ? '#3a4a4e' : '#103848'; ctx.fillRect(this.channel.x, this.channel.y, this.channel.w, this.channel.h);
    if (this.level > 0) { ctx.strokeStyle = 'rgba(200,250,255,0.5)'; for (let k = 0; k < 6; k++) { const x = this.channel.x + ((t * 120 + k * 30) % this.channel.w); ctx.beginPath(); ctx.moveTo(x, 310); ctx.lineTo(x - 10, 390); ctx.stroke(); } }
    this.drawWalls(ctx, '#5a6e72', '#34444a');
    const dr = (d: Rect, open: boolean, marks: string) => {
      if (!open) block(ctx, d.x, d.y, d.w, d.h, '#7a8a6a', '#5a6a4a', 8);
      else doorGlow(ctx, d, t, '120,230,255');
      this.label(ctx, marks, d.x + d.w / 2, d.y - 6, '#9fefff', 12);
    };
    dr(this.doorA, this.level === 2, '≈≈');
    dr(this.doorB, this.level === 0, '—');
    dr(this.doorC, this.doorCOpen(), '≈ + 2 seals');
    // wheel
    block(ctx, 450, 380, 60, 40, '#5a5040', '#3a3428', 12);
    ctx.save(); ctx.translate(480, 380); ctx.rotate(this.shown * 2);
    ctx.strokeStyle = '#c9a060'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU);
    for (let k = 0; k < 6; k++) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k) * 24, Math.sin(k) * 24); }
    ctx.stroke(); ctx.restore();
    // seals
    if (!this.seals[0]) itemIcon(ctx, 'shell', 60, 120, t);
    if (!this.seals[1]) itemIcon(ctx, 'shell', 900, 350, t);
    // seal sockets on north door
    for (let k = 0; k < 2; k++) { ctx.fillStyle = this.seals[k] ? '#9fffe8' : '#2a3a3a'; ctx.beginPath(); ctx.arc(455 + k * 50, 150, 7, 0, TAU); ctx.fill(); }
    // carving glimpse
    ctx.fillStyle = '#3a4a4e'; ctx.fillRect(380, 20, 200, 100);
    ctx.strokeStyle = 'rgba(160,220,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(450, 50, 7, 0, TAU); ctx.moveTo(450, 57); ctx.lineTo(450, 90); ctx.stroke();
    ctx.beginPath(); ctx.arc(475, 48, 6, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(510, 85, 16, 7, 0, 0, TAU); ctx.stroke();
  }
  drawFg(ctx: C) {
    // water overlay
    const lv = this.shown;
    if (lv > 0.02) {
      ctx.fillStyle = `rgba(30,120,160,${0.12 + lv * 0.14})`; ctx.fillRect(0, 0, 960, 700);
      ctx.strokeStyle = `rgba(200,250,255,${0.1 + lv * 0.1})`; ctx.lineWidth = 2;
      for (let y = 20; y < 700; y += 40) { ctx.beginPath(); for (let x = 0; x <= 960; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + this.t * 2 + y) * 4); ctx.stroke(); }
    }
    this.label(ctx, `WATER LEVEL: ${['LOW', 'MIDDLE ≈', 'HIGH ≈≈'][this.level]}`, 480, 690, '#bff', 12);
  }
}

// ===================================================================== LEVIATHAN
interface Tentacle { x: number; state: 'warn' | 'down' | 'up'; t: number; hp: number; len: number }
export class L2Leviathan extends Stage {
  name = 'The Leviathan';
  hp = 14; maxHp = 14;
  tentacles: Tentacle[] = [];
  atkT = 2;
  distractT = 9;
  headDown = 0;
  headY = 90;
  warrior!: NPC;
  wcd = { cd: 0 };
  done = false;
  deathT = 0;
  spitT = 5;

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 520 };
    this.combat = true;
    this.walls.push(R(0, 0, 960, 200), R(0, 585, 960, 15), R(0, 0, 40, 600), R(920, 0, 40, 600));
    this.warrior = new NPC('warrior', 200, 400); this.warrior.speed = 160;
    this.allies.push(this.warrior);
    this.setObjective('Strike the glowing weak spots on the tentacles. When Warrior Arin draws its attention, hit its gills!');
  }
  onEnter() {
    this.say([['Warrior Arin', "Leviathan. It's guarding your light. When its arms hit the dock, they glow — cut there."], ['Warrior Arin', "I'll get its attention. When its head comes down, go for the gills."]]);
    this.g.setBoss('The Leviathan', 1);
  }

  onAttack(x: number, y: number): boolean {
    let hit = false;
    for (const tn of this.tentacles) {
      if (tn.state !== 'down') continue;
      const tipY = 200 + tn.len;
      if (Math.abs(x - tn.x) < 34 && Math.abs(y - tipY) < 50) { this.damage(1); tn.hp--; hit = true; this.g.particles.burst(tn.x, tipY, 14, '#7fffd0', 180, 0.5, 3); if (tn.hp <= 0) { tn.state = 'up'; tn.t = 0; } }
    }
    if (this.headDown > 0 && Math.abs(x - 480) < 90 && y < 300) { this.damage(2); hit = true; this.g.particles.burst(x, y, 20, '#ff9fd0', 200, 0.6, 4); }
    return hit;
  }
  damage(n: number) {
    if (this.done) return;
    this.hp -= n; this.g.sfx('hit');
    this.g.setBoss('The Leviathan', Math.max(0, this.hp / this.maxHp));
    if (this.hp <= 0) {
      this.done = true; this.tentacles = []; this.projectiles = [];
      this.g.sfx('rumble'); this.g.shakeScreen(14);
      this.say([['', 'The Leviathan lets out a long, deep groan and sinks into the dark water.'], ['Warrior Arin', "It's done. Your light washed up on the dock... wait. Who's that?"]], () => { this.g.setBoss(null, 0); this.complete(); });
    }
  }

  update(dt: number) {
    if (this.done) { this.deathT += dt; return; }
    const p = this.p;
    this.atkT -= dt;
    if (this.atkT <= 0) {
      this.atkT = Math.max(1.2, 2.4 - (1 - this.hp / this.maxHp) * 1.2);
      this.tentacles.push({ x: clamp(p.x + rand(-40, 40), 80, 880), state: 'warn', t: 0, hp: 3, len: clamp(p.y - 200, 120, 370) });
    }
    for (const tn of this.tentacles) {
      tn.t += dt;
      if (tn.state === 'warn' && tn.t > 1.0) {
        tn.state = 'down'; tn.t = 0; this.g.sfx('splash'); this.g.shakeScreen(6);
        if (Math.abs(p.x - tn.x) < 30 && p.y > 200 && p.y < 200 + tn.len + 20) p.hurt(1, tn.x, p.y - 10, this);
      } else if (tn.state === 'down' && tn.t > 2.6) { tn.state = 'up'; tn.t = 0; }
    }
    this.tentacles = this.tentacles.filter((tn) => !(tn.state === 'up' && tn.t > 0.5));
    this.spitT -= dt;
    if (this.spitT <= 0) {
      this.spitT = 4.5;
      for (let k = -2; k <= 2; k++) { const a = Math.atan2(p.y - 150, p.x - 480) + k * 0.22; this.projectiles.push({ x: 480, y: 150, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 7, dmg: 1, color: '#bff', rgb: '120,220,255', life: 4 }); }
      this.g.sfx('splash');
    }
    this.distractT -= dt;
    if (this.distractT <= 0 && this.headDown <= 0) {
      this.distractT = 11;
      this.headDown = 3.8;
      this.say([['Warrior Arin', 'HEY! OVER HERE, YOU OVERGROWN EEL!']]);
      this.g.toast('The Leviathan lunges at Warrior Arin — its gills are exposed!');
    }
    if (this.headDown > 0) { this.headDown -= dt; this.warrior.target = { x: 160, y: 260 }; }
    else allyFight(this.warrior, this, dt, this.wcd);
    if (!this.warrior.target && this.headDown <= 0) this.warrior.target = { x: 160 + Math.sin(this.t) * 40, y: 450 };
    const ty = this.headDown > 0 ? 230 : 90;
    this.headY += (ty - this.headY) * Math.min(1, dt * 5);
  }

  drawBg(ctx: C) {
    const t = this.t;
    water(ctx, 0, 0, 960, 210, t, '#0c3448');
    // dock
    ctx.fillStyle = '#5a4030'; ctx.fillRect(40, 200, 880, 385);
    ctx.fillStyle = '#4a3424'; for (let y = 200; y < 585; y += 22) ctx.fillRect(40, y, 880, 2);
    for (let x = 40; x < 920; x += 110) { ctx.fillStyle = '#3a2618'; ctx.fillRect(x, 200, 6, 385); }
    water(ctx, 0, 0, 40, 600, t, '#0c3448'); water(ctx, 920, 0, 40, 600, t, '#0c3448');
    // leviathan body
    const sink = this.done ? this.deathT * 80 : 0;
    ctx.save(); ctx.translate(0, sink); ctx.globalAlpha = this.done ? Math.max(0, 1 - this.deathT / 2) : 1;
    ctx.fillStyle = '#1e3a4a';
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(200 + k * 120, 60 + Math.sin(t * 1.5 + k) * 10, 70, 30, 0, 0, TAU); ctx.fill(); }
    const hy = this.headY;
    ctx.fillStyle = '#2a4e60'; ctx.beginPath(); ctx.ellipse(480, hy, 110, 70, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffde7a'; ctx.beginPath(); ctx.arc(430, hy - 10, 10, 0, TAU); ctx.arc(530, hy - 10, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(428, hy - 18, 4, 16); ctx.fillRect(528, hy - 18, 4, 16);
    ctx.fillStyle = '#0a1a22'; ctx.beginPath(); ctx.ellipse(480, hy + 30, 50, 12, 0, 0, Math.PI); ctx.fill();
    const gillGlow = this.headDown > 0 ? 0.9 : 0.25;
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(255,140,200,${gillGlow})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(480 + sx * (70 + k * 8), hy + 10, 14, sx > 0 ? -1 : 2.1, sx > 0 ? 1 : 4.2); ctx.stroke(); }
    if (this.headDown > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 480, hy + 10, 140, '255,120,200', 0.3); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
    // tentacles
    for (const tn of this.tentacles) {
      if (tn.state === 'warn') {
        const k = tn.t / 1.0;
        ctx.fillStyle = `rgba(255,60,60,${0.15 + k * 0.25})`; ctx.fillRect(tn.x - 28, 200, 56, tn.len + 20);
        ctx.strokeStyle = `rgba(255,80,80,${0.5 + k * 0.5})`; ctx.strokeRect(tn.x - 28, 200, 56, tn.len + 20);
      } else {
        const ext = tn.state === 'down' ? 1 : Math.max(0, 1 - tn.t / 0.5);
        const len = tn.len * ext;
        ctx.strokeStyle = '#2a5a6a'; ctx.lineWidth = 30; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tn.x, 170); ctx.quadraticCurveTo(tn.x + Math.sin(this.t * 3) * 10, 200 + len * 0.5, tn.x, 200 + len); ctx.stroke();
        ctx.strokeStyle = '#3a7a8a'; ctx.lineWidth = 10; ctx.stroke();
        if (tn.state === 'down') { ctx.globalCompositeOperation = 'lighter'; glow(ctx, tn.x, 200 + len, 34 + Math.sin(this.t * 10) * 4, '120,255,200', 0.8); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
  }
}

// ===================================================================== ECHO IMPOSTOR
export class L2Impostor extends Stage {
  name = 'The Impostor';
  a!: NPC; b!: NPC;
  realIsA = Math.random() < 0.5;
  spawnT = 2.5;
  rcd = { cd: 0 };
  done = false;
  tries = 0;

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 330 };
    this.combat = true;
    this.walls.push(R(0, 0, 960, 140), R(0, 560, 960, 40), R(0, 0, 60, 600), R(900, 0, 60, 600));
    this.a = new NPC('warrior', 360, 260); this.b = new NPC('warrior', 600, 260);
    this.a.speed = this.b.speed = 230;
    this.npcs.push(this.a, this.b);
    for (const [n, isA] of [[this.a, true], [this.b, false]] as [NPC, boolean][]) {
      this.interacts.push({ x: 0, y: 0, r: 40, label: 'Talk to Warrior Arin', action: () => this.talk(isA) });
    }
    this.setObjective('Two Warrior Arins! One is an Echo. Watch closely — identify the real one and talk to him.');
  }
  onEnter() {
    this.say([['Warrior Arin', "Get away from him. I'm the real one."], ['Warrior Arin?', "Don't listen to him. I'm the real one."], ['Arin', "...Great. Just great."]]);
    this.g.hint('Observe how each one behaves when danger comes. Talk to one to choose.');
  }

  talk(isA: boolean) {
    if (this.done) return;
    const lines: [string, string][] = [['Warrior Arin', pickLine(isA === this.realIsA, this.tries)]];
    this.say(lines, () => this.g.choice('Is this the real Warrior Arin?', ["Yes — you're the real one.", 'Not sure yet.'], (i) => {
      if (i !== 0) return;
      if (isA === this.realIsA) this.reveal();
      else this.wrong();
    }));
  }
  wrong() {
    this.tries++;
    const fake = this.realIsA ? this.b : this.a;
    this.g.sfx('echo');
    this.say([['Warrior Arin?', 'Heh. Wrong.']], () => {
      this.p.hurt(1, fake.x, fake.y, this);
      this.g.particles.burst(240 + 240, 260, 40, '#555577', 200, 0.8, 6, false);
      // shuffle
      this.realIsA = Math.random() < 0.5;
      this.a.x = 360; this.b.x = 600; this.a.y = this.b.y = 260;
      this.g.toast('They blur together in a puff of shadow and swap places...');
    });
  }
  reveal() {
    this.done = true;
    this.enemies = [];
    this.g.playCutscene('fake2', () => {
      this.say([['Warrior Arin', "You noticed. Good. Out here, the real ones protect without being asked."], ['Warrior Arin', 'Take your light. And take this — a pearl charm. Lets you breathe where others drown.'], ['Warrior Arin', "Whoever's behind those shadows... make him answer for it."]], () => this.complete());
    });
  }

  update(dt: number) {
    const real = this.realIsA ? this.a : this.b, fake = this.realIsA ? this.b : this.a;
    this.interacts[0].x = this.a.x; this.interacts[0].y = this.a.y;
    this.interacts[1].x = this.b.x; this.interacts[1].y = this.b.y;
    if (this.done) return;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.enemies.length < 2) {
      this.spawnT = 3.2;
      const side = Math.random() < 0.5;
      const e = new Enemy('crab', side ? 90 : 870, rand(200, 520), 1);
      e.speed = 55; e.windup = 0.9;
      this.enemies.push(e);
    }
    // real warrior intercepts threats to Arin; fake idles
    const threat = this.enemies.find((e) => !e.dead);
    if (threat) {
      real.target = { x: (threat.x + this.p.x) / 2, y: (threat.y + this.p.y) / 2 };
      this.rcd.cd -= dt;
      if (dist(real.x, real.y, threat.x, threat.y) < 46 && this.rcd.cd <= 0) { this.rcd.cd = 0.5; threat.hurt(2, real.x, real.y, this); }
    } else {
      real.target = { x: this.p.x + (real === this.a ? -50 : 50), y: this.p.y - 30 };
    }
    fake.target = null;
    fake.facing = 'down';
    if (Math.random() < 0.01) fake.target = { x: clamp(fake.x + rand(-40, 40), 100, 860), y: clamp(fake.y + rand(-20, 20), 180, 520) };
  }

  drawBg(ctx: C) {
    const t = this.t;
    water(ctx, 0, 0, 960, 600, t);
    ctx.fillStyle = '#5a4030'; ctx.fillRect(60, 140, 840, 420);
    ctx.fillStyle = '#4a3424'; for (let y = 140; y < 560; y += 22) ctx.fillRect(60, y, 840, 2);
    drawOrb(ctx, 480, 180, 9, t, '120,255,220');
    // drifting mist
    for (let k = 0; k < 5; k++) { ctx.fillStyle = 'rgba(200,220,230,0.06)'; ctx.beginPath(); ctx.ellipse((k * 230 + t * 20) % 1100 - 70, 300 + k * 40, 160, 40, 0, 0, TAU); ctx.fill(); }
  }
}

function pickLine(real: boolean, tries: number): string {
  const realLines = ["Stay behind me. I mean it.", "Keep your eyes open. Those things go for the weakest first.", "I don't need you to trust me. I need you alive."];
  const fakeLines = ["Of course I'm real. Who else would I be?", "Trust me. I'd never let anything happen to you.", "Why would I lie? We're the same, you and I."];
  return (real ? realLines : fakeLines)[tries % 3];
}

void drawEcho;
