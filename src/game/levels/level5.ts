import { Stage, type Sprite, type Light, type Platform } from '../stage';
import { Enemy, NPC } from '../entities';
import { R, Rect, TAU, clamp, dist, distToSeg, inRect, lerp, mulberry32, rand } from '../util';
import { drawCharacter, drawGear, drawOrb, drawStars, glow } from '../draw';
import { block, arrowHint, doorGlow, itemIcon } from './common';
import { dogBed, drawJumper } from '../backdrops';
import { allyFight } from './level2';
import type { MeterView } from '../store';

type C = CanvasRenderingContext2D;

function voidFloor(ctx: C, x: number, y: number, w: number, h: number, t: number, seed = 1) {
  ctx.fillStyle = '#040408'; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y);
  drawStars(ctx, w, h, t, seed, Math.floor((w * h) / 4000));
  ctx.restore();
}
function ruinTile(ctx: C, r: Rect, top = '#3a3644', front = '#24212c') { block(ctx, r.x, r.y, r.w, r.h, top, front, 10); }
function spiritNPC(v: 'engineer' | 'warrior' | 'genius' | 'healer', x: number, y: number) {
  const n = new NPC(v, x, y);
  n.spirit = { engineer: '#ffb86b', warrior: '#6fd1c6', genius: '#c9a6ff', healer: '#8fe0b0' }[v];
  n.alpha = 0.75; n.noCollide = true;
  return n;
}

// ===================================================================== THE BROKEN PATH
interface GP extends Platform { motion: (t: number) => [number, number]; ang: number; spin: number }
export class L5Path extends Stage {
  name = 'The Broken Path';
  gears: GP[] = [];
  bridgeA: Platform = { kind: 'rect', x: 1300, y: 270, w: 160, h: 60, r: 0, dx: 0, dy: 0 };
  bridgeB: Platform = { kind: 'rect', x: 1460, y: 270, w: 240, h: 60, r: 0, dx: 0, dy: 0 };
  bridgeState: 'intact' | 'broken' | 'restored' = 'intact';
  crumbleFx = 0;
  doorOpen = false;
  door: Rect = R(1730, 120, 24, 380);
  water: Rect = R(900, 120, 400, 380);
  coral: Rect[] = [R(960, 120, 30, 280), R(1060, 220, 30, 280), R(1160, 120, 30, 280)];
  path: Rect[] = [R(1754, 270, 120, 60), R(1840, 170, 60, 160), R(1840, 160, 200, 60), R(2000, 160, 60, 240), R(2000, 340, 200, 60), R(2160, 220, 60, 180), R(2160, 220, 200, 60), R(2320, 220, 60, 200), R(2320, 360, 200, 60), R(2480, 250, 60, 170), R(2480, 250, 240, 60)];
  memLamps = [{ x: 1810, y: 300 }, { x: 2030, y: 190 }, { x: 2190, y: 250 }, { x: 2350, y: 390 }, { x: 2510, y: 280 }].map((l) => ({ ...l, lit: false }));
  oxygen = 100;
  spirits: NPC[] = [];
  spoken = [false, false, false, false];
  done = false;

  setup() {
    this.w = 2720; this.h = 600;
    this.spawn = { x: 100, y: 300 };
    this.walls.push(R(0, 0, 2720, 120), R(0, 500, 2720, 100), R(0, 0, 10, 600), R(2710, 0, 10, 600));
    this.walls.push(...this.coral);
    this.dynamicWalls = [this.door];
    const mk = (r: number, spin: number, motion: (t: number) => [number, number]): GP => { const [x, y] = motion(0); return { kind: 'circle', x, y, w: 0, h: 0, r, dx: 0, dy: 0, motion, ang: 0, spin, rot: spin }; };
    this.gears = [mk(60, 0.8, () => [255, 300]), mk(50, -1.2, (t) => [385, 300 + Math.sin(t * 1.2) * 110]), mk(56, 1, (t) => [560 + Math.sin(t) * 70, 300]), mk(60, -0.9, () => [710, 300])];
    this.platforms.push(...this.gears, this.bridgeA, this.bridgeB);
    this.isVoid = (x, y) => (x > 200 && x < 760) || (x > 1300 && x < 1700) || (x > 1754 && x < 2700 && !this.path.some((r) => inRect(x, y, r)));
    this.interacts.push({ x: 1705, y: 300, r: 44, tool: 1, label: 'Open the locked panel with the Multi-Tool', enabled: () => !this.doorOpen, action: () => { this.doorOpen = true; this.dynamicWalls = []; this.g.sfx('door'); this.g.toast('Panel opened.'); this.checkpoint = { x: 1790, y: 300 }; } });
    this.memLamps.forEach((l) => this.interacts.push({ x: l.x, y: l.y, r: 40, label: 'Light the memory lamp', enabled: () => !l.lit, action: () => { l.lit = true; this.g.sfx('lamp'); } }));
    this.spirits = [spiritNPC('engineer', 150, 220), spiritNPC('warrior', 840, 220), spiritNPC('genius', 1250, 220), spiritNPC('healer', 1680, 420)];
    this.spirits.forEach((s) => (s.visible = false));
    this.npcs.push(...this.spirits);
    this.placePhoto(2280, 290);
    this.setObjective('Cross the Broken Path — a gauntlet of every world you\'ve seen.');
    this.g.audio.setHollowPhase(0);
  }
  onEnter() {
    this.say([['', 'Silence. Fragments of every universe drift in the dark: gears, drowned towers, books, islands.'], ['', "Orion's Collar is warm in Arin's pocket. It's pointing the way."]]);
  }

  preUpdate(dt: number) {
    for (const g of this.gears) { const [nx, ny] = g.motion(this.t); g.dx = nx - g.x; g.dy = ny - g.y; g.x = nx; g.y = ny; g.ang += g.spin * dt; }
  }
  onTool(n: number): boolean {
    if (n === 3 && this.bridgeState === 'broken' && this.p.x > 1200 && this.p.x < 1760) {
      this.bridgeState = 'restored';
      this.platforms.push(this.bridgeB);
      this.rewindUsed = true;
      this.g.sfx('rewind'); this.g.flashScreen('rgba(255,220,150,0.45)', 0.5);
      this.g.toast('⟲ The Pocket Watch turns the bridge back to how it was.');
      return true;
    }
    return false;
  }

  update(dt: number) {
    const p = this.p;
    const lines: [string, string][][] = [
      [['Engineer Arin', "(a warm, flickering voice) Gears again? Easy. Ride 'em, handsome."]],
      [['Warrior Arin', '(a steady voice) Deep water ahead. Use the Pearl Charm — press 2. Breathe.']],
      [['Genius Arin', "(a gentle voice) That bridge has already fallen... but time is only a pattern. Press 3."]],
      [['Healer Arin', "(a soft voice) It's so dark. Light the memory lamps. And let the collar shine — press 4."]],
    ];
    const triggers = [80, 800, 1200, 1700];
    triggers.forEach((tx, k) => {
      if (!this.spoken[k] && p.x > tx) { this.spoken[k] = true; this.spirits[k].visible = true; this.say(lines[k]); this.g.sfx('heal'); }
    });
    // checkpoints
    if (p.x > 770 && p.x < 900 && this.checkpoint.x < 770) { this.checkpoint = { x: 820, y: 300 }; this.g.toast('Checkpoint'); }
    if (p.x > 1240 && p.x < 1300 && this.checkpoint.x < 1240) { this.checkpoint = { x: 1260, y: 300 }; this.g.toast('Checkpoint'); }
    // water
    const inWater = inRect(p.x, p.y, this.water);
    if (inWater && p.bubbleT <= 0) this.oxygen -= dt * 15;
    else this.oxygen = Math.min(100, this.oxygen + dt * 40);
    if (this.oxygen <= 0) { this.oxygen = 30; p.invuln = 0; p.hurt(1, p.x, p.y + 1, this); this.g.toast('Out of air! (Press 2 for the Pearl Charm bubble.)'); }
    this.speedMul = inWater ? 0.7 : 1;
    if (inWater && Math.random() < 0.2) this.g.particles.add({ x: p.x, y: p.y - 30, vy: -40, life: 1, size: 2, color: 'rgba(200,240,255,0.6)' });
    // bridge collapse
    if (this.bridgeState === 'intact' && p.x > 1390 && p.x < 1460) {
      this.bridgeState = 'broken';
      this.platforms = this.platforms.filter((pl) => pl !== this.bridgeB);
      this.crumbleFx = 1;
      this.g.sfx('crack'); this.g.shakeScreen(8);
      for (let i = 0; i < 30; i++) this.g.particles.add({ x: rand(1460, 1700), y: rand(270, 330), vx: rand(-20, 20), vy: rand(50, 200), life: 1.5, size: 6, color: '#3a3644', shape: 'square' });
      this.g.toast('The bridge crumbles away! (Press 3 — Pocket Watch)');
    }
    this.crumbleFx = Math.max(0, this.crumbleFx - dt);
    // darkness by region
    const k = clamp((p.x - 1650) / 200, 0, 1);
    this.darkness = lerp(0.45, 0.97, k);
    this.playerLight = lerp(170, 70, k);
    if (!this.done && p.x > 2640) {
      this.done = true;
      this.say([['', 'The path ends at a door hanging in the void. Beyond it: a dusty, silent copy of Arin\'s own lab.']], () => this.complete());
    }
  }
  meters(): MeterView[] { return inRect(this.p.x, this.p.y, this.water) || this.oxygen < 100 ? [{ label: 'Oxygen', value: this.oxygen / 100, color: '#7fe8ff' }] : []; }
  lights(): Light[] {
    const L: Light[] = [];
    for (const l of this.memLamps) L.push({ x: l.x, y: l.y - 20, r: l.lit ? 200 : 40, rgb: '255,210,150', a: l.lit ? 1 : 0.6 });
    L.push({ x: 2700, y: 280, r: 140, rgb: '200,200,255' });
    for (const s of this.spirits) if (s.visible) L.push({ x: s.x, y: s.y - 20, r: 100, rgb: '200,255,230', a: 0.7 });
    return L;
  }
  drawBg(ctx: C) {
    const t = this.t;
    voidFloor(ctx, 0, 0, this.w, this.h, t, 5);
    ruinTile(ctx, R(0, 120, 200, 380));
    ruinTile(ctx, R(760, 120, 140, 380), '#4a3a28', '#2a2018');
    ctx.fillStyle = '#123a4e'; ctx.fillRect(this.water.x, this.water.y, this.water.w, this.water.h);
    ctx.strokeStyle = 'rgba(180,240,255,0.25)'; for (let y = 130; y < 500; y += 24) { ctx.beginPath(); for (let x = 900; x <= 1300; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + t * 2) * 3); ctx.stroke(); }
    for (const c of this.coral) block(ctx, c.x, c.y, c.w, c.h, '#2a5a5e', '#1a3a3e', 12);
    ruinTile(ctx, R(1700, 120, 54, 380), '#3a2a3a', '#241824');
    ruinTile(ctx, R(2700, 120, 20, 380));
    for (const g of this.gears) drawGear(ctx, g.x, g.y, g.r, 12, g.ang, '#8a6a4a', '#3a2a1a');
    ruinTile(ctx, this.bridgeA, '#5a3a5a', '#3a243a');
    if (this.bridgeState !== 'broken') ruinTile(ctx, this.bridgeB, this.bridgeState === 'restored' ? '#7a6a4a' : '#5a3a5a', '#3a243a');
    else { ctx.strokeStyle = 'rgba(255,220,150,0.25)'; ctx.setLineDash([6, 6]); ctx.strokeRect(this.bridgeB.x, this.bridgeB.y, this.bridgeB.w, this.bridgeB.h); ctx.setLineDash([]); }
    for (const r of this.path) ruinTile(ctx, r, '#4a4058', '#2a2434');
    if (!this.doorOpen) { block(ctx, this.door.x, this.door.y, this.door.w, this.door.h, '#6a6a7a', '#4a4a5a', 8); ctx.fillStyle = '#ffb86b'; ctx.fillRect(this.door.x - 30, 290, 14, 20); }
    for (const l of this.memLamps) { ctx.fillStyle = '#5a4a5a'; ctx.fillRect(l.x - 3, l.y - 34, 6, 34); ctx.fillStyle = l.lit ? '#ffe0a0' : '#4a3a4a'; ctx.beginPath(); ctx.arc(l.x, l.y - 38, 7, 0, TAU); ctx.fill(); }
    doorGlow(ctx, R(2690, 230, 20, 100), t, '200,200,255');
  }
  sprites(): Sprite[] { return [{ y: 290, draw: (c) => this.drawPhotoPickup(c) }]; }
}

// ===================================================================== ECHO SWARM
export class L5Swarm extends Stage {
  name = 'Echo Swarm';
  wave = 0;
  toSpawn = 0;
  spawnT = 0;
  between = 0;
  spirits: NPC[] = [];
  wcd = { cd: 0 };
  engT = 4; genT = 6; healT = 8;
  bursts: { x: number; y: number; t: number }[] = [];
  freeze = 0;
  done = false;

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 360 };
    this.combat = true;
    this.walls.push(R(0, 0, 960, 110), R(0, 570, 960, 30), R(0, 0, 40, 600), R(920, 0, 40, 600));
    this.walls.push(R(220, 230, 60, 40), R(680, 230, 60, 40), R(450, 450, 60, 40));
    this.setObjective('Survive the Echo Swarm. You are not alone.');
  }
  onEnter() {
    this.say([['', 'The dark boils. Dozens of Echoes peel away from the shadows.'], ['Arin', "...I can't fight all of them."], ['Warrior Arin', '(a voice beside him) You never had to fight alone.']], () => this.nextWave());
  }
  nextWave() {
    this.wave++;
    const sp: ('warrior' | 'engineer' | 'genius' | 'healer')[] = ['warrior', 'engineer', 'genius', 'healer'];
    const v = sp[this.wave - 1];
    const s = spiritNPC(v, this.p.x + 40, this.p.y);
    s.follow = this.p; s.followDist = 60; s.speed = 200;
    this.spirits.push(s); this.allies.push(s);
    this.g.sfx('heal');
    const msg: Record<string, string> = { warrior: 'Warrior Arin fights at your side.', engineer: "Engineer Arin's gear bursts shred nearby Echoes.", genius: 'Genius Arin freezes time around the Echoes.', healer: 'Healer Arin mends your wounds and shields you.' };
    this.g.toast(`Spirit joins: ${msg[v]}`);
    this.toSpawn = [4, 6, 8, 10][this.wave - 1];
    this.setObjective(`Echo Swarm — wave ${this.wave}/4`);
  }
  update(dt: number) {
    if (this.done) return;
    const p = this.p;
    this.freeze = Math.max(0, this.freeze - dt);
    if (this.toSpawn > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 0.6; this.toSpawn--;
        const a = rand(0, TAU);
        const e = new Enemy(Math.random() < 0.5 ? 'wisp' : 'echo', clamp(480 + Math.cos(a) * 380, 60, 900), clamp(340 + Math.sin(a) * 220, 130, 550), Math.random() < 0.5 ? 2 : 3);
        e.speed += this.wave * 6;
        this.enemies.push(e);
      }
    } else if (this.enemies.length === 0) {
      this.between += dt;
      if (this.between > 1.5) {
        this.between = 0;
        if (this.wave >= 4) {
          this.done = true;
          this.say([['', 'The last Echo dissolves. The four spirits stand around Arin, glowing softly.'], ['Healer Arin', 'Go to him. We\'ll be right here.']], () => this.complete());
          return;
        }
        this.nextWave();
      }
    }
    if (this.freeze > 0) for (const e of this.enemies) e.stunT = Math.max(e.stunT, 0.05);
    const war = this.spirits.find((s) => s.variant === 'warrior');
    if (war) allyFight(war, this, dt, this.wcd, 34, 1);
    if (this.spirits.some((s) => s.variant === 'engineer')) {
      this.engT -= dt;
      if (this.engT <= 0) {
        this.engT = 4;
        const tgt = this.enemies.find((e) => !e.dead);
        if (tgt) { this.bursts.push({ x: tgt.x, y: tgt.y, t: 0 }); this.g.sfx('gear'); for (const e of this.enemies) if (dist(e.x, e.y, tgt.x, tgt.y) < 70) e.hurt(2, tgt.x, tgt.y, this); }
      }
    }
    if (this.spirits.some((s) => s.variant === 'genius')) {
      this.genT -= dt;
      if (this.genT <= 0 && this.enemies.length) { this.genT = 8; this.freeze = 2; this.g.sfx('rewind'); this.g.toast('Genius Arin: "Pause."'); }
    }
    if (this.spirits.some((s) => s.variant === 'healer')) {
      this.healT -= dt;
      if (this.healT <= 0 || (p.hp <= 1 && this.healT < 6)) { this.healT = 10; p.hp = Math.min(p.maxHp, p.hp + 1); p.shieldT = 3; this.g.sfx('shield'); this.g.floatText(p.x, p.y - 50, '+1 ♥  SHIELD', '#8fe0b0'); }
    }
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter((b) => b.t < 0.6);
  }
  drawBg(ctx: C) {
    const t = this.t;
    voidFloor(ctx, 0, 0, 960, 600, t, 8);
    ruinTile(ctx, R(40, 110, 880, 460), '#2a2632', '#1a1620');
    const r = mulberry32(3);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(40 + r() * 880, 110 + r() * 440, 30, 2); }
    for (const w of this.walls.slice(4)) block(ctx, w.x, w.y, w.w, w.h, '#4a4058', '#2a2434', 14);
    if (this.freeze > 0) { ctx.fillStyle = 'rgba(200,170,255,0.12)'; ctx.fillRect(0, 0, 960, 600); }
  }
  drawFg(ctx: C) {
    for (const b of this.bursts) { ctx.save(); ctx.globalAlpha = 1 - b.t / 0.6; drawGear(ctx, b.x, b.y - 10, 30 + b.t * 80, 10, b.t * 10, '#ffb86b'); ctx.restore(); }
  }
}

// ===================================================================== THE HOLLOW LAB
export class L5Lab extends Stage {
  name = 'The Hollow Lab';
  seen = new Set<string>();
  done = false;

  setup() {
    this.w = 1280; this.h = 760;
    this.spawn = { x: 340, y: 680 };
    this.darkness = 0.7; this.darkRGB = '6,6,10'; this.playerLight = 140;
    const W = this.walls;
    W.push(R(0, 0, 1280, 60), R(0, 0, 20, 760), R(1260, 0, 20, 760), R(0, 740, 1280, 20));
    W.push(R(700, 60, 20, 240), R(700, 380, 20, 360));
    W.push(R(60, 80, 200, 50), R(420, 80, 180, 56), R(26, 280, 40, 220));
    const I = this.interacts;
    const add = (id: string, x: number, y: number, label: string, lines: [string, string][]) => I.push({ x, y, r: 44, label, action: () => { this.seen.add(id); this.say(lines, () => this.upd()); } });
    add('monitor', 160, 150, 'Read the dusty monitor', [['', 'LOG — DAY 1: The house is so quiet. I keep turning around to tell him things.'], ['', 'LOG — DAY 212: Every universe has an Orion. That means every universe has a goodbye.'], ['', 'LOG — DAY 413: If nothing exists, nothing can be lost. I can end all the goodbyes.']]);
    add('bed', 560, 560, "Orion's empty bed", [['', "The bed is grey with dust. The ball is still there, exactly where he left it."], ['', "Orion's Collar burns warm against Arin's chest. Warmer than it's ever been."], ['Arin', "...He never moved it either."]]);
    add('jumper', 510, 160, 'The broken Jumper', [['', 'A Universe Jumper, just like his — but scorched, rebuilt, and rebuilt again.'], ['Arin', 'He jumped further than I ever did. Looking for a world where it didn\'t happen.']]);
    add('notes', 46, 520, 'Wall of notes', [['', 'Hundreds of notes pinned over each other. The newest says only: "ERASE = PEACE?"'], ['', 'Underneath, older, in shakier handwriting: "Good boy. Good boy. Good boy."']]);
    add('window', 980, 80, 'The window', [['', 'There is nothing outside. No stars, no crack. Just dark.']]);
    I.push({ x: 1180, y: 560, r: 60, label: 'Step through the door into the void', enabled: () => this.seen.has('bed') && this.seen.size >= 3, action: () => { if (!this.done) { this.done = true; this.complete(); } } });
    this.placePhoto(1180, 120);
    this.upd();
    this.g.audio.setHollowPhase(1);
  }
  onEnter() { this.say([['', "A perfect copy of Arin's lab. Every surface thick with years of dust. Somewhere, very softly, the old piano melody plays — slower now."]]); }
  upd() {
    const ok = this.seen.has('bed') && this.seen.size >= 3;
    this.setObjective(ok ? 'The far door (east) is open. He is waiting.' : `Explore the Hollow Lab quietly. (${this.seen.size} things examined — find Orion\'s bed)`);
  }
  meters(): MeterView[] { return [{ label: "Collar warmth", value: clamp(1 - dist(this.p.x, this.p.y, 1180, 560) / 1300, 0, 1), color: '#ffd166' }]; }
  lights(): Light[] { return [{ x: 160, y: 110, r: 120, rgb: '120,140,160', a: 0.6 }, { x: 560, y: 560, r: 120, rgb: '255,210,150', a: 0.7 }, { x: 1180, y: 560, r: 160, rgb: '200,200,255' }]; }
  drawBg(ctx: C) {
    const t = this.t;
    this.tileFloor(ctx, 20, 60, 680, 680, 40, '#26242a', '#2a282e');
    this.tileFloor(ctx, 720, 60, 540, 680, 40, '#222026', '#262428');
    ctx.fillStyle = '#1e1c22'; ctx.fillRect(0, 0, 1280, 60);
    ctx.fillStyle = '#000'; ctx.fillRect(900, 10, 160, 40); ctx.strokeStyle = '#3a3840'; ctx.lineWidth = 3; ctx.strokeRect(900, 10, 160, 40);
    this.drawWalls(ctx, '#3a3840', '#26242a', this.walls.filter((w) => !(w.y === 0 && w.h === 60)));
    block(ctx, 60, 80, 200, 50, '#4a4440', '#34302c');
    ctx.fillStyle = '#111'; ctx.fillRect(120, 60, 70, 40); ctx.fillStyle = '#1a2a2e'; ctx.fillRect(124, 64, 62, 32);
    block(ctx, 420, 80, 180, 56, '#3e3e44', '#2c2c30');
    drawJumper(ctx, 510, 128, 0.42, t, 0.05);
    block(ctx, 26, 280, 40, 220, '#3a3640', '#2a2630', 10);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(240,235,220,0.5)'; ctx.fillRect(30 + (i % 2) * 14, 290 + i * 14, 12, 10); }
    dogBed(ctx, 560, 575, 0.9, true);
    // dust motes
    const r = mulberry32(4);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(220,210,190,0.25)'; ctx.fillRect(20 + r() * 1240, (60 + r() * 680 + t * 5 * (0.5 + r())) % 760, 2, 2); }
    doorGlow(ctx, R(1240, 520, 20, 80), t, '200,200,255');
    if (this.seen.has('bed') && this.seen.size >= 3) arrowHint(ctx, 1180, 520, t);
  }
  sprites(): Sprite[] { return [{ y: 120, draw: (c) => this.drawPhotoPickup(c) }]; }
}

// ===================================================================== FINAL BATTLE
interface Rift { x1: number; y1: number; x2: number; y2: number; t: number }
export class L5Battle extends Stage {
  name = 'The Hollow Arin';
  boss = { x: 480, y: 230, hp: 18, max: 18, state: 'idle' as 'idle' | 'cast' | 'exposed' | 'stunned', t: 1.5, attack: '' as '' | 'orbs' | 'rifts' | 'well', blink: 0 };
  rifts: Rift[] = [];
  well: { x: number; y: number; t: number } | null = null;
  phase = 0; // 0 intro, 1 fight, 2 choice
  collarUsed = false;
  toolCd = { mt: 0, collar: 0 };
  lastAttack = '';

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 480 };
    this.combat = true;
    this.walls.push(R(0, 0, 960, 100), R(0, 580, 960, 20), R(0, 0, 30, 600), R(930, 0, 30, 600));
    this.setObjective('Survive Hollow Arin\'s space-bending attacks. Strike when he is exposed. Use all your tools!');
    this.controlLocked = true;
  }
  onEnter() {
    this.g.playCutscene('hood5', () => {
      this.say([['Hollow Arin', "Every universe is a wound, Arin. I'm going to close all of them."], ['Arin', "Not while I'm still standing."]], () => {
        this.phase = 1; this.controlLocked = false;
        this.g.audio.setHollowPhase(2);
        this.g.setBoss('Hollow Arin', 1);
        this.g.hint('Hit him only when he glows (exposed). 1 = overload his rift (while casting) · 2 = bubble · 3 = rewind · 4 = show the collar');
      });
    });
  }
  onFatal(): boolean {
    if (this.g.save.items.collar && !this.collarUsed) {
      this.collarUsed = true;
      this.g.sfx('shield'); this.g.flashScreen('rgba(255,220,140,0.6)', 0.6);
      this.g.toast("Orion's Collar flares — it absorbs the fatal blow!");
      return true;
    }
    return false;
  }
  onTool(n: number): boolean {
    const b = this.boss, p = this.p;
    if (this.phase !== 1) return true;
    if (n === 1) {
      if (this.toolCd.mt > 0) { this.g.toast('Multi-Tool recharging...'); return true; }
      if (b.state === 'cast' && dist(p.x, p.y, b.x, b.y) < 200) {
        this.toolCd.mt = 8; b.state = 'stunned'; b.t = 3; this.rifts = []; this.well = null;
        this.g.sfx('gear'); this.g.shakeScreen(6); this.g.particles.burst(b.x, b.y - 30, 30, '#ffb86b', 200, 0.6, 3);
        this.g.toast('Multi-Tool overloads his rift device — he\'s stunned!');
      } else this.g.toast('Get close while he is casting to overload his rift device.');
      return true;
    }
    if (n === 4) {
      if (this.toolCd.collar > 0) { this.g.toast("The collar's glow is gathering again..."); return true; }
      this.toolCd.collar = 14; p.glowT = 3;
      this.g.sfx('lamp');
      if (b.state !== 'stunned') { b.state = 'stunned'; b.t = 2.4; this.rifts = []; this.well = null; }
      this.say([['Hollow Arin', '...That collar. Where did you— ']]);
      return true;
    }
    return false;
  }
  onAttack(x: number, y: number): boolean {
    const b = this.boss;
    if (this.phase !== 1) return false;
    if (dist(x, y, b.x, b.y - 20) > 56) return false;
    if (b.state === 'exposed' || b.state === 'stunned') {
      this.hitBoss(b.state === 'stunned' ? 2 : 1);
    } else {
      this.g.floatText(b.x, b.y - 60, 'space bends around him', '#aab');
      this.g.sfx('block');
    }
    return true;
  }
  hitBoss(n: number) {
    const b = this.boss;
    b.hp -= n; this.g.sfx('hit');
    this.g.particles.burst(b.x, b.y - 24, 16, '#c7cbd6', 200, 0.5, 3);
    this.g.setBoss('Hollow Arin', Math.max(0, b.hp / b.max));
    if (b.hp <= 0) this.toPhase2();
  }
  toPhase2() {
    this.phase = 2;
    this.projectiles = []; this.rifts = []; this.well = null;
    this.controlLocked = true;
    this.g.setBoss(null);
    this.g.hint(null);
    this.g.sfx('rumble'); this.g.shakeScreen(12);
    this.say([['', 'Hollow Arin drops to one knee. Combat stops. Around them, the floating worlds begin to break apart.'], ['Hollow Arin', "...Do you want to know? What it was like?"]], () => {
      this.g.playCutscene('orion5', () => this.g.playCutscene('words5', () => this.finalChoice()));
    });
  }
  finalChoice() {
    this.setObjective('The worlds are breaking apart. Choose.');
    this.g.choice('The worlds are breaking apart. What do you do?', ["Speak — and hold up Orion's Collar. (Mercy)", 'Focus only on stopping the Orb. (Duty)', 'Attack him. (Anger)'], (k) => {
      const s = this.g.save;
      if (k === 0) {
        if (s.echoChoice === 'fight') {
          this.say([['Hollow Arin', "You struck down my Echo in the Quiet Sky. It never raised a hand. Why should I believe you now?"]], () => {
            this.g.choice('He doesn\'t trust you.', ['Keep holding the collar out. Say his name.', 'Lower the collar.'], (j) => {
              if (j === 0) this.mercy(); else this.duty();
            });
          });
        } else this.mercy();
      } else if (k === 1) this.duty();
      else this.anger();
    });
  }
  mercy() {
    const s = this.g.save; s.finalChoice = 'mercy'; s.pieces[4] = true;
    this.say([['Arin', 'Orion. His name is Orion. And he loved you every single day — even the last one.']], () => this.g.playCutscene('every5', () => this.g.playCutscene('letgo5', () => this.g.playEnding('good'))));
  }
  duty() { const s = this.g.save; s.finalChoice = 'duty'; s.pieces[4] = true; this.say([['Arin', "I'm sorry. I don't have time to save you. Only them."]], () => this.g.playEnding('neutral')); }
  anger() { const s = this.g.save; s.finalChoice = 'anger'; this.say([['Arin', "You did this. ALL of this!"]], () => this.g.playEnding('dark')); }

  update(dt: number) {
    if (this.phase !== 1) return;
    const b = this.boss, p = this.p;
    this.toolCd.mt = Math.max(0, this.toolCd.mt - dt);
    this.toolCd.collar = Math.max(0, this.toolCd.collar - dt);
    b.t -= dt;
    b.blink = Math.max(0, b.blink - dt);
    const rage = 1 - b.hp / b.max;
    switch (b.state) {
      case 'idle':
        if (b.t <= 0) {
          const opts = (['orbs', 'rifts', 'well'] as const).filter((a) => a !== this.lastAttack);
          b.attack = opts[Math.floor(Math.random() * opts.length)];
          this.lastAttack = b.attack;
          b.state = 'cast'; b.t = b.attack === 'well' ? 3.2 : 2.4;
          this.startAttack(b.attack, rage);
        }
        break;
      case 'cast':
        if (b.attack === 'orbs' && Math.floor((b.t + dt) * 2) !== Math.floor(b.t * 2) && b.t > 0.3) {
          const a = Math.atan2(p.y - 16 - (b.y - 30), p.x - b.x);
          this.projectiles.push({ x: b.x, y: b.y - 30, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: 8, dmg: 1, color: '#d0d4e0', rgb: '180,180,255', life: 5, homing: 1.4 });
        }
        if (b.t <= 0) { b.state = 'exposed'; b.t = 2.4; this.g.sfx('select'); }
        break;
      case 'exposed': case 'stunned':
        if (b.t <= 0) {
          b.state = 'idle'; b.t = Math.max(0.6, 1.3 - rage);
          b.blink = 0.4; this.g.sfx('whoosh');
          b.x = clamp(p.x + rand(-300, 300), 120, 840); b.y = clamp(rand(170, 320), 160, 340);
          if (dist(b.x, b.y, p.x, p.y) < 140) b.y = p.y > 300 ? 170 : 480;
        }
        break;
    }
    // rifts
    for (const r of this.rifts) {
      r.t += dt;
      if (r.t > 1.2 && r.t < 1.6 && distToSeg(p.x, p.y - 12, r.x1, r.y1, r.x2, r.y2) < 16) p.hurt(1, (r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2, this);
    }
    this.rifts = this.rifts.filter((r) => r.t < 1.7);
    if (this.well) {
      const w = this.well; w.t += dt;
      const dx = w.x - p.x, dy = w.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (w.t > 0.6 && d > 4) { p.x += (dx / d) * 75 * dt; p.y += (dy / d) * 75 * dt; }
      if (w.t > 0.6 && d < 30) p.hurt(1, w.x, w.y - 1, this);
      if (w.t > 3) this.well = null;
    }
    if (Math.random() < 0.2) this.g.particles.add({ x: rand(30, 930), y: rand(100, 580), vx: rand(-20, 20), vy: -rand(10, 40), life: 2, size: 2, color: 'rgba(200,200,255,0.4)', glow: true });
  }
  startAttack(a: string, rage: number) {
    const b = this.boss, p = this.p;
    this.g.sfx('echo');
    if (a === 'orbs') {
      const n = 12 + Math.floor(rage * 8);
      for (let i = 0; i < n; i++) { const ang = (i / n) * TAU; this.projectiles.push({ x: b.x, y: b.y - 30, vx: Math.cos(ang) * 130, vy: Math.sin(ang) * 130, r: 7, dmg: 1, color: '#c7cbd6', rgb: '160,160,255', life: 6 }); }
    } else if (a === 'rifts') {
      const n = 3 + Math.floor(rage * 3);
      for (let i = 0; i < n; i++) {
        const horiz = i % 2 === 0;
        if (horiz) { const y = i === 0 ? p.y - 12 : rand(120, 570); this.rifts.push({ x1: 30, y1: y, x2: 930, y2: y + rand(-60, 60), t: -i * 0.25 }); }
        else { const x = i === 1 ? p.x : rand(60, 900); this.rifts.push({ x1: x, y1: 100, x2: x + rand(-80, 80), y2: 580, t: -i * 0.25 }); }
      }
    } else {
      this.well = { x: p.x, y: p.y, t: 0 };
    }
  }
  meters(): MeterView[] {
    const d = dist(this.p.x, this.p.y, this.boss.x, this.boss.y);
    return [{ label: this.collarUsed ? 'Collar (spent)' : "Collar warmth", value: clamp(1 - d / 700, 0.05, 1), color: this.collarUsed ? '#7a6a4a' : '#ffd166' }];
  }
  drawBg(ctx: C) {
    const t = this.t;
    voidFloor(ctx, 0, 0, 960, 600, t, 12);
    // floating ruins of every world in the background
    drawGear(ctx, 120, 60, 40, 10, t * 0.2, '#4a3a28', '#2a2018');
    block(ctx, 820, 20, 40, 70, '#25343f', '#1a2630', 16);
    ctx.fillStyle = '#5a3a6a'; ctx.fillRect(600, 40, 24, 16);
    ruinTile(ctx, R(30, 100, 900, 480), '#24222c', '#16141c');
    const r = mulberry32(7);
    for (let i = 0; i < 30; i++) { ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); const x = 30 + r() * 900, y = 100 + r() * 480; ctx.moveTo(x, y); ctx.lineTo(x + 30, y + 10); ctx.stroke(); }
    if (this.phase === 2) { for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r() * 960, 100); ctx.lineTo(r() * 960, 580); ctx.stroke(); } }
    // rifts
    for (const rf of this.rifts) {
      if (rf.t < 0) continue;
      if (rf.t < 1.2) { ctx.strokeStyle = `rgba(200,120,255,${0.2 + rf.t * 0.5})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(rf.x1, rf.y1); ctx.lineTo(rf.x2, rf.y2); ctx.stroke(); ctx.setLineDash([]); }
      else { ctx.strokeStyle = 'rgba(240,220,255,0.95)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(rf.x1, rf.y1); ctx.lineTo(rf.x2, rf.y2); ctx.stroke(); ctx.strokeStyle = 'rgba(180,100,255,0.6)'; ctx.lineWidth = 22; ctx.stroke(); }
    }
    if (this.well) {
      const w = this.well;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, w.x, w.y, 120, '140,80,255', 0.35);
      ctx.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 4; k++) { ctx.strokeStyle = `rgba(180,140,255,${0.5 - k * 0.1})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.x, w.y, ((t * 80 + k * 30) % 120), 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(w.x, w.y, 22, 0, TAU); ctx.fill();
    }
  }
  sprites(): Sprite[] {
    const b = this.boss;
    if (this.phase === 0) return [];
    return [{ y: b.y, draw: (c) => {
      if (b.blink > 0) c.globalAlpha = 1 - b.blink / 0.4;
      if (b.state === 'cast') { c.globalCompositeOperation = 'lighter'; glow(c, b.x, b.y - 30, 60, '140,100,255', 0.5); c.globalCompositeOperation = 'source-over'; }
      if (b.state === 'exposed' || b.state === 'stunned') { c.globalCompositeOperation = 'lighter'; glow(c, b.x, b.y - 20, 50 + Math.sin(this.t * 10) * 5, b.state === 'stunned' ? '255,210,120' : '255,255,255', 0.5); c.globalCompositeOperation = 'source-over'; }
      drawCharacter(c, b.x, b.y, { variant: 'hollow', facing: this.p.x < b.x ? 'left' : 'right', scale: 1.35, pose: b.state === 'exposed' || this.phase === 2 ? 'kneel' : b.state === 'cast' ? 'reach' : 'stand' });
      if (b.state === 'exposed') this.label(c, 'EXPOSED', b.x, b.y - 70, '#ffffff', 11);
      if (b.state === 'stunned') this.label(c, 'STUNNED', b.x, b.y - 70, '#ffd166', 11);
    } }];
  }
  drawFg(ctx: C) {
    if (this.g.save.items.collar && !this.collarUsed) {
      const d = dist(this.p.x, this.p.y, this.boss.x, this.boss.y);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.p.x + 8, this.p.y - 22, 12 + (1 - Math.min(1, d / 600)) * 18, '255,210,120', 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
void itemIcon; void drawOrb;
