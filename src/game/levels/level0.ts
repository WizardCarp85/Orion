import { Stage, type Light, type Sprite } from '../stage';
import { R, Rect, dist, rand, mulberry32, TAU, clamp, inRect } from '../util';
import { drawCharacter, drawOrb, drawStars, glow } from '../draw';
import { skyCrack, drawJumper, dogBed } from '../backdrops';
import { block, itemIcon, arrowHint, doorGlow } from './common';

type C = CanvasRenderingContext2D;

// ===================================================================== LAB
export class L0Lab extends Stage {
  name = 'Mountain Lab';
  step = 0; // 0 scan, 1 parts, 2 assemble, 3 exit
  parts = { core: false, ring: false, frame: false };
  replay: { t: number; flashFrame: number; count: number } | null = null;
  replays = 0;
  exitDoor: Rect = R(300, 730, 80, 30);

  setup() {
    this.w = 1280; this.h = 760;
    this.spawn = { x: 360, y: 400 };
    this.darkness = 0.42; this.playerLight = 170;
    const W = this.walls;
    W.push(R(0, 0, 1280, 60), R(0, 0, 20, 760), R(1260, 0, 20, 760), R(0, 740, 300, 20), R(380, 740, 900, 20));
    W.push(R(700, 60, 20, 240), R(700, 380, 20, 360)); // lab | right side
    W.push(R(720, 400, 180, 20), R(980, 400, 280, 20)); // observatory | storage
    // furniture
    W.push(R(60, 80, 200, 50), R(420, 80, 180, 56), R(26, 280, 40, 220), R(80, 600, 90, 50));
    W.push(R(955, 175, 70, 50), R(1150, 90, 80, 40));
    // storage crates
    W.push(R(740, 440, 60, 60), R(820, 440, 50, 60), R(740, 600, 60, 70), R(1040, 450, 70, 60), R(1120, 520, 60, 60), R(950, 620, 70, 60), R(820, 650, 40, 70));
    this.setObjective('Scan the cracked sky with the telescope (observatory, east).');
    const I = this.interacts;
    I.push({ x: 160, y: 150, label: this.replays ? 'Replay security footage' : 'Check security monitor', action: () => this.startReplay() });
    I.push({ x: 290, y: 150, r: 30, label: 'Coffee', action: () => this.say([['Arin', 'Third cup. The coffee keeps trembling... the whole mountain is humming.']]) });
    I.push({ x: 990, y: 250, label: 'Scan the sky', action: () => this.scan() });
    I.push({ x: 125, y: 668, label: 'Take Power Core', enabled: () => !this.parts.core, action: () => this.take('core') });
    I.push({ x: 1190, y: 150, label: 'Take Signal Ring', enabled: () => !this.parts.ring, action: () => this.take('ring') });
    I.push({ x: 1190, y: 690, label: 'Take Frame', enabled: () => !this.parts.frame, action: () => this.take('frame') });
    I.push({ x: 510, y: 160, label: 'Assemble the Universe Jumper', enabled: () => this.step >= 1 && this.step < 3, action: () => this.assemble() });
    I.push({ x: 560, y: 560, label: "Orion's bed", action: () => this.say([['Arin', "Orion's bed. I still haven't moved it."], ['Arin', "Feels like he'll come trotting back any second, demanding dinner."]]) });
    I.push({ x: 46, y: 520, r: 34, label: 'Bookshelf', action: () => this.say([['', '"Alternate Universe Theory — Vol. III." Margins full of Arin\'s scribbles. One reads: "What if every choice makes a world?"']]) });
    I.push({ x: 340, y: 720, r: 50, label: 'Leave for the cave', enabled: () => this.step === 3, action: () => this.complete() });
    this.placePhoto(905, 715);
  }

  onEnter() {
    this.g.hint('WASD / Arrows to move · E or Space to interact · H toggles help');
  }

  startReplay() {
    if (this.replay) return;
    this.replays++;
    this.controlLocked = true;
    const flash = this.replays >= 2 ? this.g.frameCount + 95 : -1;
    this.replay = { t: 0, flashFrame: flash, count: this.replays };
    this.g.sfx('scan');
    const it = this.interacts.find((i) => i.x === 160 && i.y === 150);
    if (it) it.label = 'Replay security footage';
  }

  scan() {
    if (this.step > 0) { this.say([['Arin', 'The crack keeps widening. No time.']]); return; }
    this.g.sfx('scan');
    this.g.audio.setTension(0.3);
    this.say([
      ['Arin', 'Spectral readings... no. The crack isn\'t in the atmosphere. It\'s in space itself.'],
      ['Arin', 'The universe is coming apart at the seams.'],
      ['Arin', 'The Universe Jumper prototype. If I finish it, maybe I can find what\'s pulling everything apart.'],
      ['Arin', 'I need the Power Core, the Signal Ring and the Frame.'],
    ], () => { this.step = 1; this.updateObj(); this.g.hint(null); });
  }

  take(k: 'core' | 'ring' | 'frame') {
    this.parts[k] = true;
    this.g.sfx('pickup');
    const names = { core: 'Power Core', ring: 'Signal Ring', frame: 'Frame' };
    this.g.toast(`Found: ${names[k]}`);
    this.g.particles.burst(this.p.x, this.p.y - 20, 16, '#9fe8ff', 120, 0.6, 3);
    this.updateObj();
  }

  updateObj() {
    const n = Object.values(this.parts).filter(Boolean).length;
    if (this.step === 0) this.setObjective('Scan the cracked sky with the telescope (observatory, east).');
    else if (n < 3) this.setObjective(`Find the Jumper parts: Power Core, Signal Ring, Frame (${n}/3)`);
    else if (this.step < 3) { this.step = 2; this.setObjective('Assemble the Universe Jumper at the workbench.'); }
  }

  assemble() {
    const n = Object.values(this.parts).filter(Boolean).length;
    if (n < 3) { this.say([['Arin', `Still missing parts. (${n}/3)`]]); return; }
    this.g.sfx('success');
    this.g.particles.burst(510, 110, 40, '#9fe8ff', 200, 1, 3);
    this.g.audio.setTension(0.5);
    this.say([
      ['Arin', "It's built. Frame, ring, core... but it needs a power source no generator on Earth could give."],
      ['Arin', '...The glowing rock. In the cave below the observatory.'],
      ['Arin', 'Orion barked at it like it was a monster. I picked it up anyway. I never went back.'],
      ['Arin', 'Time to go back.'],
    ], () => { this.step = 3; this.setObjective('Leave the lab through the south door and head to the cave.'); });
  }

  update(dt: number) {
    if (this.replay) {
      this.replay.t += dt;
      if (this.replay.t > 3.4) {
        const c = this.replay.count;
        this.replay = null;
        this.controlLocked = false;
        if (c === 1) this.say([['Arin', 'Security feed from last night. Just me, talking to myself at 2 AM. Again.']]);
        else this.say([['Arin', '...Wait. Did something just move in the corner?'], ['Arin', "...No. I'm exhausted. Nobody's been in here but me."]]);
      }
    }
    this.g.audio.setTension(0.2 + this.step * 0.1 + Math.sin(this.t * 0.2) * 0.02);
  }

  lights(): Light[] {
    return [
      { x: 160, y: 110, r: 160, rgb: '80,200,255' },
      { x: 510, y: 110, r: 150, rgb: '255,210,140' },
      { x: 990, y: 200, r: 260, rgb: '200,210,255' },
      { x: 1000, y: 560, r: 170, rgb: '255,200,120', a: 0.8 },
      { x: 360, y: 60, r: 200, rgb: '220,230,255', a: 0.5 },
    ];
  }

  drawBg(ctx: C) {
    const t = this.t;
    // floors
    this.tileFloor(ctx, 20, 60, 680, 680, 40, '#1f2638', '#232b40');
    this.tileFloor(ctx, 720, 60, 540, 340, 30, '#1a1f30', '#1d2336');
    this.tileFloor(ctx, 720, 420, 540, 320, 24, '#3a2e24', '#40332a');
    // observatory dome opening
    ctx.save();
    ctx.beginPath(); ctx.arc(990, 200, 120, 0, TAU); ctx.clip();
    ctx.fillStyle = '#060a1e'; ctx.fillRect(860, 70, 260, 260);
    drawStars(ctx, 260, 260, t, 4, 60, 0, 0);
    ctx.translate(860, 70);
    skyCrack(ctx, 260, 120, 1, t, 2);
    ctx.restore();
    ctx.strokeStyle = '#39405a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(990, 200, 120, 0, TAU); ctx.stroke();
    // top wall with windows
    ctx.fillStyle = '#2a3148'; ctx.fillRect(0, 0, 1280, 60);
    for (const wx of [80, 300, 520, 780, 1100]) {
      ctx.save(); ctx.beginPath(); ctx.rect(wx, 8, 140, 40); ctx.clip();
      ctx.fillStyle = '#070b22'; ctx.fillRect(wx, 8, 140, 40);
      drawStars(ctx, 140, 40, t, wx, 20, 0, 0);
      ctx.translate(wx - wx * 0.1, 0);
      skyCrack(ctx, 1280, 28, clamp(0.4 + this.t * 0.01 + this.step * 0.15, 0, 1), t, 1.5);
      ctx.restore();
      ctx.strokeStyle = '#4a5270'; ctx.lineWidth = 3; ctx.strokeRect(wx, 8, 140, 40);
    }
    this.drawWalls(ctx, '#2f3750', '#20263a', this.walls.filter((w) => w.w <= 300 || w.h <= 20 || w.x === 700 || w.x === 0 || w.x === 1260).filter((w) => !(w.y === 0 && w.h === 60)));
    // exit door
    ctx.fillStyle = this.step === 3 ? '#4a6a8a' : '#2a3148'; ctx.fillRect(300, 740, 80, 20);
    if (this.step === 3) { doorGlow(ctx, R(300, 720, 80, 40), t); arrowHint(ctx, 340, 720, t); }
  }

  sprites(): Sprite[] {
    const t = this.t;
    const s: Sprite[] = [];
    s.push({ y: 130, draw: (c) => {
      block(c, 60, 80, 200, 50, '#5a4636', '#3e3026');
      c.fillStyle = '#111'; c.fillRect(120, 60, 70, 40);
      c.fillStyle = this.replay ? '#2a5a3a' : '#0d3a52'; c.fillRect(124, 64, 62, 32);
      c.fillStyle = '#5fe0ff'; for (let i = 0; i < 3; i++) c.fillRect(128, 68 + i * 8, 20 + ((i * 17 + Math.floor(t * 2)) % 30), 2);
      c.fillStyle = '#e8e8f0'; c.fillRect(282, 94, 12, 14);
      c.fillStyle = '#5a3a22'; c.fillRect(284 + Math.sin(t * 40) * 0.8, 96, 8, 3);
    } });
    s.push({ y: 136, draw: (c) => {
      block(c, 420, 80, 180, 56, '#4a5268', '#33394a');
      const n = Object.values(this.parts).filter(Boolean).length;
      if (this.step === 3) drawJumper(c, 510, 120, 0.42, t, 0.3);
      else { c.fillStyle = '#7a86a8'; for (let i = 0; i < n + 2; i++) c.fillRect(440 + i * 28, 92, 20, 10); }
    } });
    s.push({ y: 500, draw: (c) => { block(c, 26, 280, 40, 220, '#3a3050', '#2a2440', 10); const r = mulberry32(2); for (let i = 0; i < 18; i++) { c.fillStyle = ['#6a7fb0', '#b0706a', '#7fb08a'][i % 3]; c.fillRect(32 + r() * 22, 290 + i * 11, 8, 8); } } });
    s.push({ y: 650, draw: (c) => { block(c, 80, 600, 90, 50, '#3a4058', '#2a2f40'); if (!this.parts.core) itemIcon(c, 'core', 125, 640, t); } });
    s.push({ y: 225, draw: (c) => {
      c.fillStyle = '#2a3048'; c.beginPath(); c.arc(990, 205, 34, 0, TAU); c.fill();
      c.save(); c.translate(990, 195); c.rotate(-0.7 + Math.sin(t * 0.3) * 0.1);
      c.fillStyle = '#9aa6c8'; c.fillRect(-8, -50, 16, 60); c.fillStyle = '#c8d2ee'; c.fillRect(-10, -56, 20, 10);
      c.restore();
    } });
    s.push({ y: 130, draw: (c) => { block(c, 1150, 90, 80, 40, '#4a4060', '#332c44'); if (!this.parts.ring) itemIcon(c, 'ring', 1190, 120, t); } });
    s.push({ y: 690, draw: (c) => { if (!this.parts.frame) itemIcon(c, 'frame', 1190, 700, t); } });
    for (const w of this.walls.filter((w) => w.x >= 740 && w.y >= 440)) s.push({ y: w.y + w.h, draw: (c) => { block(c, w.x, w.y, w.w, w.h, '#7a5a3a', '#5a4028', 16); c.strokeStyle = '#4a3020'; c.lineWidth = 2; c.strokeRect(w.x + 4, w.y + 4, w.w - 8, w.h - 22); } });
    s.push({ y: 560, draw: (c) => dogBed(c, 560, 575, 0.9) });
    s.push({ y: 720, draw: (c) => this.drawPhotoPickup(c) });
    // guidance markers
    s.push({ y: 9999, draw: (c) => {
      if (this.step === 0) arrowHint(c, 990, 240, t);
      if (this.step === 2) arrowHint(c, 510, 150, t);
    } });
    return s;
  }

  drawScreen(ctx: C) {
    if (!this.replay) return;
    const r = this.replay;
    const x = 230, y = 110, w = 500, h = 340;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, 960, 600);
    ctx.fillStyle = '#0a120c'; ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // grainy footage: top-down lab
    ctx.fillStyle = '#1a2a1e'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#243a2a'; ctx.fillRect(x + 40, y + 40, 140, 40); ctx.fillRect(x + 280, y + 40, 130, 40);
    ctx.fillStyle = '#2f4a36'; ctx.beginPath(); ctx.ellipse(x + 380, y + 260, 40, 16, 0, 0, TAU); ctx.fill();
    const ax = x + 110 + Math.sin(r.t * 1.4) * 30;
    ctx.globalAlpha = 0.85;
    drawCharacter(ctx, ax, y + 150, { variant: 'arin', facing: 'up', palOverride: { coat: '#9fbfa8', shirt: '#4a6a52', skin: '#a8c8b0', hair: '#2a3a2e' } });
    ctx.globalAlpha = 1;
    // THE ONE-FRAME FLASH (only when replayed)
    if (this.g.frameCount === r.flashFrame) {
      drawCharacter(ctx, x + 430, y + 230, { variant: 'hollow', hood: true, facing: 'left', scale: 1.4, palOverride: { coat: '#050805' } });
    }
    const rr = mulberry32(Math.floor(r.t * 30));
    ctx.fillStyle = 'rgba(200,255,210,0.08)';
    for (let i = 0; i < 300; i++) ctx.fillRect(x + rr() * w, y + rr() * h, 2, 2);
    for (let yy = 0; yy < h; yy += 3) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + yy, w, 1); }
    ctx.restore();
    ctx.strokeStyle = '#3a4a3e'; ctx.lineWidth = 6; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#d0ffd8'; ctx.font = '14px ui-monospace, monospace'; ctx.textAlign = 'left';
    const secs = Math.floor(r.t * 10);
    ctx.fillText(`CAM 02 — LAB   02:1${Math.floor(secs / 10) % 10}:${(secs % 10) * 6} AM   REPLAY #${r.count}`, x + 12, y + 22);
    if (Math.floor(r.t * 2) % 2 === 0) { ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(x + w - 20, y + 18, 5, 0, TAU); ctx.fill(); }
  }
}

// ===================================================================== MOUNTAIN PATH
interface Rock { x: number; y: number; t: number; max: number; landed: number }
export class L0Path extends Stage {
  name = 'Mountain Path';
  rocks: Rock[] = [];
  spawnT = 1;
  done = false;
  rubble: { x: number; y: number; r: number }[] = [];

  setup() {
    this.w = 2600; this.h = 600;
    this.spawn = { x: 80, y: 380 };
    this.walls.push(R(0, 0, 2600, 190), R(0, 560, 2600, 40), R(2580, 0, 20, 600));
    const r = mulberry32(17);
    for (let i = 0; i < 14; i++) {
      const x = 300 + i * 160 + r() * 60, y = 230 + r() * 280, s = 34 + r() * 30;
      this.walls.push(R(x, y, s, s * 0.7));
    }
    this.setObjective('Reach the cave. Watch for falling rocks — press Shift to dodge!');
  }
  onEnter() { this.g.hint('Shadows mark falling rocks. Shift = quick dodge (brief invulnerability).'); }

  update(dt: number) {
    const p = this.p;
    this.g.audio.setTension(0.5 + (p.x / this.w) * 0.5);
    this.spawnT -= dt;
    if (this.spawnT <= 0 && !this.done) {
      this.spawnT = clamp(0.75 - p.x / 6000, 0.35, 0.8);
      const x = clamp(p.x + rand(-60, 320), 20, 2560), y = clamp(p.y + rand(-120, 120), 210, 545);
      this.rocks.push({ x, y, t: 1.1, max: 1.1, landed: 0 });
      if (Math.random() < 0.35) this.rocks.push({ x: p.x + rand(-20, 20), y: p.y + rand(-20, 20), t: 1.0, max: 1.0, landed: 0 });
    }
    for (const rk of this.rocks) {
      if (rk.landed) { rk.landed -= dt; continue; }
      rk.t -= dt;
      if (rk.t <= 0) {
        rk.landed = 0.6;
        this.g.sfx('rumble');
        this.g.shakeScreen(5);
        this.g.particles.burst(rk.x, rk.y, 14, '#8a7a6a', 160, 0.6, 4, false, 200);
        if (dist(p.x, p.y, rk.x, rk.y) < 30) p.hurt(1, rk.x, rk.y, this);
      }
    }
    this.rocks = this.rocks.filter((r) => r.t > 0 || r.landed > 0);
    // falling crack light particles
    if (Math.random() < 0.3) this.g.particles.add({ x: this.g.cam.x + rand(0, 960), y: rand(0, 60), vx: 0, vy: rand(20, 60), life: 2, size: 1.5, color: '#dfefff', glow: true });
    if (!this.done && p.x > 2480 && p.y > 300 && p.y < 440) {
      this.done = true;
      this.controlLocked = true;
      this.g.playCutscene('cave0', () => this.complete());
    }
  }

  drawBg(ctx: C) {
    const t = this.t, cx = this.g.cam.x;
    // sky strip at the top (parallax)
    ctx.fillStyle = '#060a1e'; ctx.fillRect(cx, 0, 960, 120);
    ctx.save(); ctx.translate(cx, 0);
    drawStars(ctx, 960, 120, t, 5, 70, -cx * 0.2, 0);
    skyCrack(ctx, 960, 60, 1, t, 3 + this.p.x / 900);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 480, 60, 300, '200,220,255', 0.1 + this.p.x / 26000); ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // cliff wall
    ctx.fillStyle = '#2a2a36'; ctx.fillRect(0, 110, this.w, 80);
    const r = mulberry32(3);
    for (let i = 0; i < 80; i++) { ctx.fillStyle = r() > 0.5 ? '#32323f' : '#24242e'; ctx.fillRect(r() * this.w, 115 + r() * 70, 20 + r() * 50, 6 + r() * 14); }
    // trail
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(0, 190, this.w, 370);
    ctx.fillStyle = '#44434e';
    for (let i = 0; i < 260; i++) ctx.fillRect(r() * this.w, 190 + r() * 370, 3 + r() * 8, 2 + r() * 4);
    ctx.fillStyle = '#4e4a44'; ctx.fillRect(0, 340, this.w, 70); // dirt path
    // cliff edge
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 560, this.w, 40);
    ctx.fillStyle = '#1a1a22'; for (let x = 0; x < this.w; x += 30) ctx.fillRect(x, 556, 22, 6);
    // cave entrance
    ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(2540, 370, 60, 90, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 2540, 370, 120, '120,220,255', 0.18 + 0.05 * Math.sin(t * 2)); ctx.globalCompositeOperation = 'source-over';
    // rock shadows
    for (const rk of this.rocks) {
      if (rk.landed) continue;
      const k = 1 - rk.t / rk.max;
      ctx.fillStyle = `rgba(0,0,0,${0.2 + k * 0.4})`;
      ctx.beginPath(); ctx.ellipse(rk.x, rk.y, 8 + k * 22, 4 + k * 10, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,90,90,${0.3 + k * 0.5})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(rk.x, rk.y, 30, 14, 0, 0, TAU); ctx.stroke();
    }
  }
  sprites(): Sprite[] {
    const s: Sprite[] = [];
    for (const w of this.walls) if (w.y > 200 && w.y < 560) s.push({ y: w.y + w.h, draw: (c) => block(c, w.x, w.y, w.w, w.h, '#5a5868', '#3e3c4a', 14) });
    for (const rk of this.rocks) {
      if (rk.landed) s.push({ y: rk.y, draw: (c) => { c.fillStyle = '#6a6474'; c.beginPath(); c.ellipse(rk.x, rk.y - 8, 16, 12, 0, 0, TAU); c.fill(); } });
      else { const k = 1 - rk.t / rk.max; s.push({ y: 9000, draw: (c) => { c.fillStyle = '#7a7484'; c.beginPath(); c.arc(rk.x, rk.y - 400 * (1 - k) - 10, 14, 0, TAU); c.fill(); } }); }
    }
    s.push({ y: 9999, draw: (c) => arrowHint(c, 2540, 330, this.t) });
    return s;
  }
}

// ===================================================================== CAVE
export class L0Cave extends Stage {
  name = 'The Cave';
  crystals: { x: number; y: number; c: string }[] = [];
  inserted = false;
  seq = -1;
  shards: { x: number; y: number; vx: number; vy: number }[] = [];

  setup() {
    this.w = 1200; this.h = 800;
    this.spawn = { x: 80, y: 400 };
    this.darkness = 0.9; this.darkRGB = '6,4,4'; this.playerLight = 130;
    const W = this.walls;
    W.push(R(0, 0, 1200, 40), R(0, 760, 1200, 40), R(0, 0, 20, 800), R(1180, 0, 20, 800));
    W.push(R(20, 40, 160, 300), R(20, 470, 160, 290)); // entrance corridor
    W.push(R(300, 40, 60, 420), R(300, 580, 60, 180));
    W.push(R(480, 200, 60, 560));
    W.push(R(660, 40, 60, 460), R(660, 620, 60, 140));
    W.push(R(840, 40, 40, 260), R(840, 500, 40, 260));
    const r = mulberry32(8);
    for (let i = 0; i < 26; i++) this.crystals.push({ x: 200 + r() * 950, y: 60 + r() * 680, c: r() > 0.5 ? '120,220,255' : '190,140,255' });
    this.crystals = this.crystals.filter((c) => !this.walls.some((w) => inRect(c.x, c.y, w)));
    this.setObjective('Find the glowing rock deep in the cave.');
    this.interacts.push({ x: 1060, y: 420, r: 50, label: 'Take the Orb and insert it into the Jumper core', enabled: () => !this.inserted, action: () => this.insert() });
  }
  onEnter() {
    this.say([['Arin', "Haven't been down here since I was a kid. Orion hated this place."]]);
    this.g.hint(null);
  }

  insert() {
    this.inserted = true;
    this.controlLocked = true;
    this.seq = 0;
    this.g.sfx('portal');
    this.g.shakeScreen(10);
  }

  update(dt: number) {
    if (Math.random() < 0.08) this.g.particles.add({ x: rand(200, 1150), y: rand(40, 100), vx: 0, vy: 160, life: 1.2, size: 1.5, color: '#9fd8ff' });
    if (this.seq >= 0) {
      const prev = this.seq;
      this.seq += dt;
      if (prev < 1.2 && this.seq >= 1.2) {
        this.g.flashScreen('rgba(255,255,255,0.9)', 0.6);
        this.g.sfx('crack');
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.6; this.shards.push({ x: 1060, y: 360, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300 }); }
      }
      for (const s of this.shards) { s.x += s.vx * dt; s.y += s.vy * dt; this.g.particles.add({ x: s.x, y: s.y, life: 0.5, size: 4, color: '#bff0ff', glow: true }); }
      if (prev < 3 && this.seq >= 3) {
        this.say([
          ['', 'The orb flares — and splits into five glowing pieces. Four streak away through cracks in the air.'],
          ['', 'The fifth flickers once... somewhere very, very dark.'],
          ['Navigator', 'SIGNALS DETECTED: 4 ALTERNATE UNIVERSES. 1 UNKNOWN.'],
          ['Arin', 'The Navigator is tracking them. Then that\'s where I\'m going.'],
        ], () => this.g.playCutscene('jump0', () => this.complete()));
      }
    }
  }

  lights(): Light[] {
    const L: Light[] = this.crystals.map((c) => ({ x: c.x, y: c.y, r: 70 + Math.sin(this.t * 2 + c.x) * 8, rgb: c.c, a: 0.8 }));
    if (!this.inserted || this.seq < 1.2) L.push({ x: 1060, y: 370, r: 260 + Math.sin(this.t * 3) * 20, rgb: '120,220,255' });
    else L.push({ x: 1060, y: 370, r: 160, rgb: '255,255,255', a: 0.6 });
    return L;
  }

  drawBg(ctx: C) {
    ctx.fillStyle = '#2e2018'; ctx.fillRect(0, 0, this.w, this.h);
    const r = mulberry32(4);
    for (let i = 0; i < 200; i++) { ctx.fillStyle = r() > 0.5 ? '#36261c' : '#281a12'; ctx.fillRect(r() * this.w, r() * this.h, 6 + r() * 20, 4 + r() * 10); }
    for (const w of this.walls) { block(ctx, w.x, w.y, w.w, w.h, '#1a110c', '#120c08', 18); }
    for (const c of this.crystals) {
      ctx.fillStyle = `rgba(${c.c},0.9)`;
      ctx.beginPath(); ctx.moveTo(c.x, c.y - 14); ctx.lineTo(c.x + 5, c.y); ctx.lineTo(c.x - 5, c.y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c.x + 7, c.y - 8); ctx.lineTo(c.x + 10, c.y); ctx.lineTo(c.x + 4, c.y); ctx.fill();
    }
    // pedestal
    block(ctx, 1030, 380, 60, 50, '#5a4838', '#3a2e24', 16);
  }
  sprites(): Sprite[] {
    return [{ y: 430, draw: (c) => { if (this.seq < 1.2) drawOrb(c, 1060, 360 - Math.max(0, this.seq) * 30, 10, this.t); } }];
  }
}
