import { Stage, type Platform, type Sprite, type Light } from '../stage';
import { NPC } from '../entities';
import { R, Rect, TAU, clamp, dist, inRect, mulberry32, rand } from '../util';
import { drawGear, drawEcho, drawOrb, glow, drawCharacter } from '../draw';
import { block, arrowHint, doorGlow, itemIcon } from './common';

type C = CanvasRenderingContext2D;

function cityAbyss(ctx: C, x: number, y: number, w: number, h: number, t: number) {
  ctx.fillStyle = '#140a04'; ctx.fillRect(x, y, w, h);
  const r = mulberry32(12);
  for (let i = 0; i < (w * h) / 3000; i++) {
    const px = x + r() * w, py = y + r() * h;
    ctx.fillStyle = r() > 0.5 ? '#2a160a' : '#1e1008'; ctx.fillRect(px, py, 20 + r() * 40, 20 + r() * 40);
    if (r() > 0.6) { ctx.fillStyle = `rgba(255,190,90,${0.3 + 0.3 * Math.sin(t * 2 + i)})`; ctx.fillRect(px + 4, py + 4, 3, 3); }
  }
  for (let i = 0; i < 8; i++) {
    const yy = (t * 20 + i * 70) % h;
    ctx.fillStyle = `rgba(220,200,180,${0.08})`; ctx.beginPath(); ctx.arc(x + (i * 233) % w, y + h - yy, 30, 0, TAU); ctx.fill();
  }
}

function brassFloor(ctx: C, r: Rect) {
  ctx.fillStyle = '#5a3a1e'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#6a4626';
  for (let x = r.x; x < r.x + r.w; x += 32) for (let y = r.y; y < r.y + r.h; y += 32) { ctx.fillRect(x + 1, y + 1, 30, 30); ctx.fillStyle = '#4a2e16'; ctx.fillRect(x + 3, y + 3, 2, 2); ctx.fillRect(x + 27, y + 27, 2, 2); ctx.fillStyle = '#6a4626'; }
}

// ===================================================================== ROOFTOPS
interface GearPlat extends Platform { ang: number; spin: number; motion: (t: number) => [number, number]; teeth: number }
export class L1Rooftops extends Stage {
  name = 'Rooftops';
  gears: GearPlat[] = [];
  beams: Rect[] = [R(470, 255, 150, 90), R(1250, 250, 350, 100)];
  eng!: NPC;
  done = false;

  setup() {
    this.w = 1800; this.h = 600;
    this.spawn = { x: 100, y: 300 };
    this.walls.push(R(0, 0, 1800, 110), R(0, 500, 1800, 100), R(0, 0, 10, 600), R(1790, 0, 10, 600));
    const mk = (r: number, spin: number, teeth: number, motion: (t: number) => [number, number]): GearPlat => {
      const [x, y] = motion(0);
      return { kind: 'circle', x, y, w: 0, h: 0, r, dx: 0, dy: 0, ang: 0, spin, motion, teeth, rot: spin };
    };
    this.gears.push(
      mk(62, 0.7, 14, () => [265, 300]),
      mk(52, -1.1, 12, (t) => [395, 300 + Math.sin(t * 1.1) * 120]),
      mk(56, 0.9, 12, (t) => [720 + Math.sin(t * 0.9) * 70, 300]),
      mk(72, -1.4, 16, () => [900, 300]),
      mk(44, 1.6, 10, (t) => [1060 + Math.cos(t * 1.0) * 70, 300 + Math.sin(t * 1.0) * 110]),
      mk(48, -0.8, 10, (t) => [1180, 300 + Math.sin(t * 1.0 + Math.PI) * 120]),
    );
    this.platforms.push(...this.gears);
    for (const b of this.beams) this.platforms.push({ kind: 'rect', ...b, r: 0, dx: 0, dy: 0 });
    this.isVoid = (x) => x > 210 && x < 1600;
    this.eng = new NPC('engineer', 1680, 300); this.eng.facing = 'left';
    this.npcs.push(this.eng);
    this.setObjective('Cross the rooftops on the moving gears. Shift-dash to leap short gaps.');
  }
  onEnter() { this.g.hint('Stand on gears to ride them. Shift = dash across short gaps. Falling costs 1 heart.'); }

  preUpdate(dt: number) {
    for (const g of this.gears) {
      const [nx, ny] = g.motion(this.t);
      g.dx = nx - g.x; g.dy = ny - g.y; g.x = nx; g.y = ny;
      g.ang += g.spin * dt;
    }
  }

  update(dt: number) {
    const p = this.p;
    if (inRect(p.x, p.y, this.beams[0]) && this.checkpoint.x < 500) { this.checkpoint = { x: 545, y: 300 }; this.g.toast('Checkpoint'); }
    if (inRect(p.x, p.y, this.beams[1]) && this.checkpoint.x < 1250) { this.checkpoint = { x: 1320, y: 300 }; this.g.toast('Checkpoint'); }
    if (Math.random() < 0.1) this.g.particles.add({ x: rand(300, 1500), y: 520, vx: rand(-10, 10), vy: -rand(20, 50), life: 3, size: 10, color: 'rgba(230,220,210,0.08)' });
    if (!this.done && p.x > 1610) {
      this.done = true;
      this.say([['Engineer Arin', 'Not bad for a scientist. You only screamed twice.'], ['Engineer Arin', "Clock Tower's next. Gears are jammed — it'll take both of us."]], () => this.complete());
    }
  }

  drawBg(ctx: C) {
    const t = this.t;
    cityAbyss(ctx, 0, 0, this.w, this.h, t);
    brassFloor(ctx, R(0, 110, 210, 390));
    brassFloor(ctx, R(1600, 110, 200, 390));
    // walls (roof edges)
    ctx.fillStyle = '#3a2210'; ctx.fillRect(0, 60, 1800, 50); ctx.fillRect(0, 500, 1800, 40);
    ctx.fillStyle = '#7a4a20'; for (let x = 0; x < 1800; x += 60) { ctx.fillRect(x, 96, 40, 14); ctx.fillRect(x + 20, 500, 40, 10); }
    // tracks for moving gears
    ctx.strokeStyle = 'rgba(200,150,80,0.35)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(395, 180); ctx.lineTo(395, 420); ctx.moveTo(650, 300); ctx.lineTo(790, 300); ctx.moveTo(1180, 180); ctx.lineTo(1180, 420); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(1060, 300, 70, 110, 0, 0, TAU); ctx.stroke();
    for (const b of this.beams) { block(ctx, b.x, b.y, b.w, b.h, '#8a5a2a', '#5a3818', 12); ctx.fillStyle = '#4a2e16'; for (let x = b.x + 8; x < b.x + b.w; x += 20) ctx.fillRect(x, b.y + 6, 3, 3); }
    for (const g of this.gears) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(g.x + 6, g.y + 10, g.r, g.r * 0.9, 0, 0, TAU); ctx.fill();
      drawGear(ctx, g.x, g.y, g.r, g.teeth, g.ang, '#b07a36', '#5a3a1e');
    }
    ctx.fillStyle = 'rgba(255,220,150,0.8)'; ctx.font = '12px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('GEARFALL — ROOFTOP DISTRICT', 105, 140);
    arrowHint(ctx, 1680, 260, t);
  }
}

// ===================================================================== CLOCK TOWER
export class L1ClockTower extends Stage {
  name = 'Clock Tower';
  bridges = [true, false, false]; // true = vertical (blocked)
  bridgeAng = [Math.PI / 2, 0, 0];
  gateOpen = false;
  eng!: NPC;
  controlling: 'arin' | 'engineer' = 'arin';
  done = false;
  crankSpin = [0, 0, 0];
  gate: Rect = R(620, 60, 20, 190);

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 140, y: 440 };
    const W = this.walls;
    W.push(R(0, 0, 960, 60), R(0, 580, 960, 20), R(0, 0, 20, 600), R(940, 0, 20, 600));
    W.push(R(20, 250, 920, 20)); // railing between balcony and floor
    W.push(R(300, 270, 480, 70)); // machinery above chasm
    W.push(R(20, 60, 160, 190)); // balcony left block
    this.dynamicWalls = [this.gate];
    this.bridges = [true, false, false];
    this.bridgeAng = [Math.PI / 2, 0, 0];
    this.platforms = [0, 1, 2].map((i) => ({ kind: 'rect' as const, x: 0, y: 0, w: 0, h: 0, r: 0, dx: 0, dy: 0 }));
    this.layoutBridges();
    this.isVoid = (x, y) => x > 300 && x < 780 && y > 340;
    this.eng = new NPC('engineer', 260, 160); this.eng.facing = 'down';
    this.npcs.push(this.eng);
    const I = this.interacts;
    const cranks = [[330, 150], [520, 150], [790, 150]];
    const toggles = [[0, 1], [1, 2], [2]];
    cranks.forEach(([x, y], i) => I.push({ x, y, label: `Turn gear crank ${'ABC'[i]}`, enabled: () => this.controlling === 'engineer', action: () => this.crank(i, toggles[i]) }));
    I.push({ x: 120, y: 300, label: 'Pull balcony gate lever', enabled: () => this.controlling === 'arin' && !this.gateOpen, action: () => { this.gateOpen = true; this.dynamicWalls = []; this.g.sfx('door'); this.g.toast('The balcony gate grinds open.'); } });
    I.push({ x: 120, y: 300, label: 'Lever (gate open)', enabled: () => this.controlling === 'engineer', action: () => this.say([['Engineer Arin', "That's your lever, not mine. Tab back to yourself."]]) });
    this.setObjective('Press Tab to switch to Engineer Arin. Turn the cranks until all three bridges line up, then cross as Arin.');
  }
  onEnter() {
    this.g.hint('Tab = switch between Arin and Engineer Arin');
    this.say([['Engineer Arin', "I'll work the cranks up here. Each crank spins more than one bridge — think before you crank."], ['Engineer Arin', "Oh, and crank C is behind that gate. There's a lever down on your side."]]);
  }

  layoutBridges() {
    for (let i = 0; i < 3; i++) {
      const cx = 380 + i * 160, cy = 455;
      const vertical = this.bridges[i];
      const pl = this.platforms[i];
      if (!vertical) { pl.x = cx - 82; pl.y = cy - 28; pl.w = 164; pl.h = 56; }
      else { pl.x = cx - 26; pl.y = cy - 82; pl.w = 52; pl.h = 164; }
    }
  }

  crank(i: number, toggles: number[]) {
    this.g.sfx('gear');
    this.crankSpin[i] = 1;
    for (const k of toggles) this.bridges[k] = !this.bridges[k];
    this.layoutBridges();
    this.g.shakeScreen(3);
    if (this.bridges.every((b) => !b)) { this.g.sfx('success'); this.setObjective('All bridges aligned! Tab back to Arin and cross to the tower door (east).'); }
  }

  update(dt: number) {
    const inp = this.g.input;
    if (inp.hit('Tab')) {
      const p = this.p;
      const ex = this.eng.x, ey = this.eng.y;
      this.eng.x = p.x; this.eng.y = p.y;
      this.eng.variant = this.controlling === 'arin' ? 'arin' : 'engineer';
      p.x = ex; p.y = ey;
      this.controlling = this.controlling === 'arin' ? 'engineer' : 'arin';
      p.variant = this.controlling === 'arin' ? 'arin' : 'engineer';
      this.g.sfx('select');
      this.checkpoint = this.controlling === 'arin' ? { x: 140, y: 440 } : { x: 260, y: 160 };
    }
    this.g.setActiveChar(this.controlling === 'arin' ? 'Arin' : 'Engineer Arin');
    for (let i = 0; i < 3; i++) {
      const target = this.bridges[i] ? Math.PI / 2 : 0;
      this.bridgeAng[i] += (target - this.bridgeAng[i]) * Math.min(1, dt * 8);
      this.crankSpin[i] = Math.max(0, this.crankSpin[i] - dt);
    }
    const p = this.p;
    if (!this.done && this.controlling === 'arin' && p.x > 800 && p.y > 380) {
      this.done = true;
      this.say([['Engineer Arin', "Ha! Teamwork. Who knew we'd work so well with ourselves."], ['Engineer Arin', "Underworks next. Mind the steam — it doesn't care who you are."]], () => this.complete());
    }
  }

  drawBg(ctx: C) {
    const t = this.t;
    ctx.fillStyle = '#2a1608'; ctx.fillRect(0, 0, 960, 600);
    brassFloor(ctx, R(20, 60, 920, 190));
    brassFloor(ctx, R(20, 270, 280, 310));
    brassFloor(ctx, R(780, 270, 160, 310));
    cityAbyss(ctx, 300, 340, 480, 240, t);
    // giant clock face on the back wall
    ctx.fillStyle = '#3a2210'; ctx.fillRect(0, 0, 960, 60);
    ctx.fillStyle = '#e8d6a8'; ctx.beginPath(); ctx.arc(480, 30, 50, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(480, 30); ctx.lineTo(480 + Math.cos(t * 0.5) * 40, 30 + Math.abs(Math.sin(t * 0.5)) * 40); ctx.stroke();
    this.drawWalls(ctx, '#7a4a20', '#4a2a10', [this.walls[4], this.walls[6]]);
    block(ctx, 300, 270, 480, 70, '#5a3418', '#3a200c', 20);
    drawGear(ctx, 420, 300, 30, 10, t * (this.crankSpin[0] + this.crankSpin[1]) * 3, '#a0702e');
    drawGear(ctx, 560, 300, 26, 9, -t * (this.crankSpin[1] + this.crankSpin[2]) * 3, '#a0702e');
    drawGear(ctx, 700, 300, 30, 10, t * this.crankSpin[2] * 3, '#a0702e');
    if (!this.gateOpen) { block(ctx, this.gate.x, this.gate.y, this.gate.w, this.gate.h, '#8a8a9a', '#5a5a6a', 8); for (let y = 70; y < 240; y += 16) { ctx.fillStyle = '#3a3a48'; ctx.fillRect(this.gate.x + 4, y, 12, 3); } }
    // bridges
    for (let i = 0; i < 3; i++) {
      const cx = 380 + i * 160, cy = 455;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.bridgeAng[i]);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-82, -20, 164, 56);
      block(ctx, -82, -28, 164, 56, this.bridges[i] ? '#7a5a3a' : '#a0743a', '#5a3818', 10);
      ctx.fillStyle = '#4a2e16'; for (let k = -74; k < 80; k += 18) ctx.fillRect(k, -24, 3, 40);
      ctx.restore();
      drawGear(ctx, cx, cy, 14, 8, this.bridgeAng[i] * 2, '#d0a050');
    }
    // cranks
    [[330, 150], [520, 150], [790, 150]].forEach(([x, y], i) => {
      block(ctx, x - 20, y - 30, 40, 30, '#6a4a2a', '#4a3018', 10);
      drawGear(ctx, x, y - 40, 18, 8, this.crankSpin[i] * 8 + i, '#c9963e');
      this.label(ctx, 'ABC'[i], x, y + 16, '#ffd58a', 12);
    });
    // lever
    block(ctx, 105, 285, 30, 20, '#5a5a6a', '#3a3a48', 8);
    ctx.save(); ctx.translate(120, 290); ctx.rotate(this.gateOpen ? 0.7 : -0.7); ctx.fillStyle = '#aab'; ctx.fillRect(-2, -22, 4, 22); ctx.fillStyle = '#d94f4f'; ctx.beginPath(); ctx.arc(0, -24, 5, 0, TAU); ctx.fill(); ctx.restore();
    // exit door
    ctx.fillStyle = '#3a2210'; ctx.fillRect(900, 420, 40, 80);
    if (this.bridges.every((b) => !b)) doorGlow(ctx, R(900, 420, 40, 80), t);
  }
}

// ===================================================================== UNDERWORKS
interface Vent { x: number; color: number; phase: number }
const VALVE_COLORS = ['#e05a4a', '#4a8ae0', '#5ac06a', '#e0c04a'];
const VALVE_NAMES = ['Red', 'Blue', 'Green', 'Yellow'];
export class L1Underworks extends Stage {
  name = 'Underworks';
  valves = [
    { x: 650, color: 0, psi: 90 },
    { x: 300, color: 1, psi: 40 },
    { x: 1300, color: 2, psi: 70 },
    { x: 1000, color: 3, psi: 20 },
  ];
  order = [0, 2, 1, 3]; // red 90, green 70, blue 40, yellow 20
  closed: number[] = [];
  vents: Vent[] = [];
  burstFx = 0;
  done = false;

  setup() {
    this.w = 1650; this.h = 600;
    this.spawn = { x: 70, y: 340 };
    this.darkness = 0.35; this.darkRGB = '20,8,0';
    this.walls.push(R(0, 0, 1650, 200), R(0, 480, 1650, 120), R(0, 0, 20, 600), R(1630, 0, 20, 600));
    this.walls.splice(0, 1, R(0, 0, 1060, 200), R(1060, 0, 120, 110), R(1180, 0, 470, 200));
    this.vents = [
      { x: 200, color: 1, phase: 0 }, { x: 450, color: 0, phase: 1.1 }, { x: 560, color: 2, phase: 2.0 }, { x: 800, color: 3, phase: 0.5 },
      { x: 900, color: 0, phase: 1.6 }, { x: 1180, color: 2, phase: 0.2 }, { x: 1240, color: 1, phase: 1.3 }, { x: 1450, color: 3, phase: 2.4 },
    ];
    for (const v of this.valves) {
      this.interacts.push({ x: v.x, y: 225, r: 44, label: `Close ${VALVE_NAMES[v.color]} valve (${v.psi} PSI)`, enabled: () => !this.closed.includes(v.color), action: () => this.closeValve(v.color) });
    }
    this.interacts.push({ x: 1590, y: 340, r: 50, label: 'Enter the Heart Engine chamber', enabled: () => this.closed.length === 4, action: () => { if (!this.done) { this.done = true; this.complete(); } } });
    this.placePhoto(1120, 150);
    this.setObjective('Close the four steam valves in the right order. (Clue: read the pressure gauges.)');
  }
  onEnter() {
    this.say([['Engineer Arin', "Underworks. Four valves feed the steam line. Close the highest pressure first, down to the lowest."], ['Engineer Arin', 'Get the order wrong and the line backs up. Right into your face.']]);
    this.g.hint('Time your moves between steam bursts. Gauges above each valve show its pressure.');
  }

  ventState(v: Vent): 'off' | 'warn' | 'burst' {
    if (this.closed.includes(v.color)) return 'off';
    const c = (this.t + v.phase) % 3.2;
    if (c < 1.0) return 'burst';
    if (c > 2.5) return 'warn';
    return 'off';
  }

  closeValve(color: number) {
    const expected = this.order[this.closed.length];
    if (color === expected) {
      this.closed.push(color);
      this.g.sfx('gear');
      this.g.toast(`${VALVE_NAMES[color]} valve closed (${this.closed.length}/4)`);
      if (this.closed.length === 4) { this.g.sfx('success'); this.setObjective('Steam is off! Head east to the Heart Engine chamber.'); }
    } else {
      this.closed = [];
      this.g.sfx('steam');
      this.burstFx = 1;
      this.g.shakeScreen(8);
      this.p.hurt(1, this.p.x, this.p.y - 30, this);
      this.g.particles.burst(this.p.x, this.p.y - 30, 30, 'rgba(240,240,240,0.7)', 260, 0.8, 8, false);
      this.g.toast('Wrong order! The line backs up and every valve bursts open again.');
    }
  }

  update(dt: number) {
    this.burstFx = Math.max(0, this.burstFx - dt);
    const p = this.p;
    for (const v of this.vents) {
      const s = this.ventState(v);
      if (s === 'burst') {
        if (Math.random() < 0.7) this.g.particles.add({ x: v.x + rand(-18, 18), y: rand(210, 480), vx: rand(-30, 30), vy: rand(-40, 40), life: 0.6, size: rand(8, 16), color: 'rgba(235,235,235,0.35)' });
        if (Math.abs(p.x - v.x) < 22 && p.hurt(1, v.x, p.y, this) === 'hit') this.g.sfx('steam');
      }
    }
  }

  lights(): Light[] {
    return this.valves.map((v) => ({ x: v.x, y: 230, r: 120, rgb: '255,170,80', a: 0.7 }) as Light).concat([{ x: 1590, y: 340, r: 120, rgb: '255,200,120' }]);
  }

  drawBg(ctx: C) {
    const t = this.t;
    ctx.fillStyle = '#24140a'; ctx.fillRect(0, 0, this.w, this.h);
    brassFloor(ctx, R(0, 200, this.w, 280));
    brassFloor(ctx, R(1060, 110, 120, 90));
    // pipes on walls
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = VALVE_COLORS[i]; ctx.globalAlpha = 0.55;
      ctx.fillRect(0, 140 + i * 12, 1060, 8); ctx.fillRect(1180, 140 + i * 12, 470, 8);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#3a2210'; ctx.fillRect(0, 480, this.w, 120);
    ctx.fillStyle = '#4a2e16'; for (let x = 0; x < this.w; x += 50) ctx.fillRect(x, 480, 40, 12);
    // vents
    for (const v of this.vents) {
      const s = this.ventState(v);
      ctx.fillStyle = '#1a0e06'; ctx.fillRect(v.x - 22, 200, 44, 280);
      ctx.fillStyle = VALVE_COLORS[v.color]; ctx.fillRect(v.x - 22, 200, 44, 4); ctx.fillRect(v.x - 22, 476, 44, 4);
      for (let y = 210; y < 476; y += 14) { ctx.fillStyle = '#3a2416'; ctx.fillRect(v.x - 18, y, 36, 6); }
      if (s === 'warn') { ctx.fillStyle = `rgba(255,90,60,${0.2 + 0.2 * Math.sin(t * 30)})`; ctx.fillRect(v.x - 22, 200, 44, 280); }
      if (s === 'burst') { ctx.fillStyle = 'rgba(240,240,240,0.35)'; ctx.fillRect(v.x - 22, 200, 44, 280); }
      if (s === 'off') { ctx.fillStyle = 'rgba(80,200,120,0.12)'; ctx.fillRect(v.x - 22, 200, 44, 280); }
    }
    // valves + gauges
    for (const v of this.valves) {
      const closed = this.closed.includes(v.color);
      ctx.fillStyle = '#2a1a0e'; ctx.fillRect(v.x - 30, 150, 60, 50);
      // gauge
      ctx.fillStyle = '#efe4c8'; ctx.beginPath(); ctx.arc(v.x, 160, 16, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 2;
      const a = Math.PI * 0.8 + (closed ? 0 : (v.psi / 100) * Math.PI * 1.4) + Math.sin(t * 8) * 0.03;
      ctx.beginPath(); ctx.moveTo(v.x, 160); ctx.lineTo(v.x + Math.cos(a) * 12, 160 + Math.sin(a) * 12); ctx.stroke();
      this.label(ctx, closed ? '0' : `${v.psi}`, v.x, 190, '#ffd58a', 11);
      // wheel
      ctx.strokeStyle = VALVE_COLORS[v.color]; ctx.lineWidth = 4;
      ctx.save(); ctx.translate(v.x, 214); ctx.rotate(closed ? 2 : 0);
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke();
      ctx.restore();
    }
    // exit
    ctx.fillStyle = '#3a2210'; ctx.fillRect(1610, 290, 20, 100);
    if (this.closed.length === 4) { doorGlow(ctx, R(1590, 290, 40, 100), t); arrowHint(ctx, 1590, 290, t); }
  }
  sprites(): Sprite[] { return [{ y: 140, draw: (c) => this.drawPhotoPickup(c) }]; }
  drawScreen(ctx: C) {
    if (this.burstFx > 0) { ctx.fillStyle = `rgba(240,240,240,${this.burstFx * 0.5})`; ctx.fillRect(0, 0, 960, 600); }
  }
}

// ===================================================================== HEART ENGINE
interface Slam { x: number; y: number; t: number; max: number; hit: boolean }
export class L1Heart extends Stage {
  name = 'The Heart Engine';
  cores = [{ x: 150, y: 260 }, { x: 810, y: 260 }, { x: 150, y: 500 }, { x: 810, y: 500 }];
  colors = ['#e05a4a', '#4a8ae0', '#5ac06a', '#e0c04a'];
  names = ['Red', 'Blue', 'Green', 'Yellow'];
  seq = [1, 3, 0, 2];
  progress = 0;
  slams: Slam[] = [];
  slamT = 2.5;
  armAng = 0;
  done = false;
  showT = 0;

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 520 };
    this.walls.push(R(0, 0, 960, 180), R(0, 580, 960, 20), R(0, 0, 20, 600), R(940, 0, 20, 600));
    this.cores.forEach((c, i) => {
      this.walls.push(R(c.x - 24, c.y - 30, 48, 30));
      this.interacts.push({ x: c.x, y: c.y + 14, r: 46, label: `Restart ${this.names[i]} core`, enabled: () => !this.done, action: () => this.activate(i) });
    });
    this.setObjective('Restart the 4 cores in the order the Heart flashes. Dodge the hammer arm!');
  }
  onEnter() {
    this.say([['Engineer Arin', "The Heart. Watch the lights on its face — that's the restart order."], ['Engineer Arin', "And the hammer arm's still on autopilot. Don't be where it lands."]]);
    this.g.hint('Red circles = hammer slam incoming. Keep moving and dodge with Shift.');
  }

  activate(i: number) {
    if (i === this.seq[this.progress]) {
      this.progress++;
      this.g.sfx('success');
      this.g.particles.burst(this.cores[i].x, this.cores[i].y - 20, 30, this.colors[i], 200, 0.8, 4);
      this.g.toast(`${this.names[i]} core online (${this.progress}/4)`);
      if (this.progress === 4) {
        this.done = true; this.slams = [];
        this.controlLocked = true;
        this.g.playCutscene('heart1', () => this.complete());
      }
    } else if (this.progress > 0 && i === this.seq[this.progress - 1]) {
      this.g.toast('That core is already running.');
    } else {
      this.progress = 0;
      this.g.sfx('fail');
      this.g.toast('Wrong core! The engine sputters and resets.');
      this.slamT = 0.2;
    }
  }

  update(dt: number) {
    if (this.done) return;
    this.showT += dt;
    this.slamT -= dt;
    if (this.slamT <= 0) {
      this.slamT = Math.max(1.0, 2.2 - this.progress * 0.3);
      this.slams.push({ x: this.p.x, y: this.p.y, t: 1.0, max: 1.0, hit: false });
      if (this.progress >= 2) this.slams.push({ x: clamp(this.p.x + rand(-140, 140), 40, 920), y: clamp(this.p.y + rand(-100, 100), 200, 570), t: 1.2, max: 1.2, hit: false });
    }
    for (const s of this.slams) {
      s.t -= dt;
      if (s.t <= 0 && !s.hit) {
        s.hit = true;
        this.g.sfx('rumble'); this.g.shakeScreen(9);
        this.g.particles.burst(s.x, s.y, 20, '#c9963e', 220, 0.6, 4, false);
        if (dist(this.p.x, this.p.y, s.x, s.y) < 52) this.p.hurt(1, s.x, s.y, this);
      }
    }
    this.slams = this.slams.filter((s) => s.t > -0.4);
    const target = this.slams.length ? Math.atan2(this.slams[0].y - 120, this.slams[0].x - 480) : Math.PI / 2;
    this.armAng += (target - this.armAng) * Math.min(1, dt * 4);
  }

  drawBg(ctx: C) {
    const t = this.t;
    ctx.fillStyle = '#1a0c04'; ctx.fillRect(0, 0, 960, 600);
    brassFloor(ctx, R(20, 180, 920, 400));
    // engine
    ctx.fillStyle = '#3a200c'; ctx.fillRect(0, 0, 960, 180);
    drawGear(ctx, 200, 90, 70, 14, t * (0.2 + this.progress * 0.3), '#7a4a20');
    drawGear(ctx, 760, 90, 70, 14, -t * (0.2 + this.progress * 0.3), '#7a4a20');
    ctx.fillStyle = '#5a3418'; ctx.beginPath(); ctx.arc(480, 100, 90, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1408'; ctx.beginPath(); ctx.arc(480, 100, 70, 0, TAU); ctx.fill();
    // sequence lights (flash order)
    const cycle = this.showT % 5;
    for (let k = 0; k < 4; k++) {
      const ci = this.seq[k];
      const lit = k < this.progress || (cycle > k * 0.8 && cycle < k * 0.8 + 0.6);
      ctx.fillStyle = lit ? this.colors[ci] : '#3a2a1e';
      ctx.beginPath(); ctx.arc(420 + k * 40, 100, 13, 0, TAU); ctx.fill();
      if (lit) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 420 + k * 40, 100, 30, '255,220,160', 0.5); ctx.globalCompositeOperation = 'source-over'; }
      this.label(ctx, `${k + 1}`, 420 + k * 40, 135, '#c9a070', 10);
    }
    // cores
    this.cores.forEach((c, i) => {
      const on = this.seq.slice(0, this.progress).includes(i);
      block(ctx, c.x - 24, c.y - 30, 48, 30, '#4a3a2a', '#2a1e14', 10);
      ctx.fillStyle = on ? this.colors[i] : '#2a2a2a'; ctx.beginPath(); ctx.arc(c.x, c.y - 30, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = this.colors[i]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y - 30, 18, 0, TAU); ctx.stroke();
      if (on) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, c.x, c.y - 30, 60, '255,220,150', 0.5); ctx.globalCompositeOperation = 'source-over'; }
    });
    // slam telegraphs
    for (const s of this.slams) {
      if (s.t > 0) {
        const k = 1 - s.t / s.max;
        ctx.strokeStyle = `rgba(255,70,50,${0.4 + k * 0.6})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, 52, 28, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,70,50,${k * 0.3})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 52 * k, 28 * k, 0, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(60,40,20,0.5)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 52, 28, 0, 0, TAU); ctx.fill();
      }
    }
  }
  drawFg(ctx: C) {
    // hammer arm
    const s = this.slams.find((x) => x.t > 0) ?? this.slams[0];
    let hx = 480 + Math.cos(this.armAng) * 200, hy = 120 + Math.sin(this.armAng) * 200, lift = 0;
    if (s) { hx = s.x; hy = s.y; lift = s.t > 0 ? 60 + (s.t / s.max) * 60 : 0; }
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(480, 120); ctx.lineTo(hx, hy - lift - 30); ctx.stroke();
    ctx.strokeStyle = '#a0702e'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(480, 120); ctx.lineTo(hx, hy - lift - 30); ctx.stroke();
    block(ctx, hx - 40, hy - lift - 50, 80, 50, '#8a8a9a', '#5a5a6a', 18);
  }
}

// ===================================================================== ECHO CHASE
export class L1Chase extends Stage {
  name = 'Echo Chase';
  pads = [{ x: 140, y: 250, phase: 0 }, { x: 820, y: 250, phase: 1.6 }, { x: 140, y: 520, phase: 3.2 }, { x: 820, y: 520, phase: 4.8 }];
  echo = { x: 480, y: 380, vx: 0, vy: 0, t: 0, trapped: 0, dash: 0 };
  ang = [0, 0, 0, 0];
  shootT = 3;
  done = false;
  eng!: NPC;

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 540 };
    this.walls.push(R(0, 0, 960, 170), R(0, 585, 960, 15), R(0, 0, 15, 600), R(945, 0, 15, 600));
    this.walls.push(R(420, 330, 120, 40));
    this.eng = new NPC('engineer', 60, 400); this.eng.facing = 'right';
    this.npcs.push(this.eng);
    this.setObjective('The Echo stole the Orb Piece! Herd it onto a gear pad while the gear is spinning.');
  }
  onEnter() {
    this.say([['Engineer Arin', "There! That shadow's got your piece!"], ['Engineer Arin', "It runs from you. Chase it onto a gear pad when the gear's spinning — that'll pin it."]]);
    this.g.hint('The Echo flees from you. Gear pads spin in turns — watch for the glow.');
  }

  spinning(i: number) { return (this.t + this.pads[i].phase) % 6.4 < 3.0; }

  update(dt: number) {
    const e = this.echo;
    e.t += dt;
    for (let i = 0; i < 4; i++) this.ang[i] += (this.spinning(i) ? 5 : 0.2) * dt;
    if (this.done) {
      if (e.trapped > 0) { e.trapped += dt; }
      return;
    }
    const p = this.p;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    let ax = 0, ay = 0;
    if (d < 260) { ax += (dx / d) * (260 - d) * 2.4; ay += (dy / d) * (260 - d) * 2.4; }
    ax += Math.sin(e.t * 1.3) * 60; ay += Math.cos(e.t * 1.7) * 60;
    // avoid spinning pads unless panicking
    this.pads.forEach((pd, i) => {
      if (!this.spinning(i)) return;
      const ex = e.x - pd.x, ey = e.y - pd.y, ed = Math.hypot(ex, ey) || 1;
      if (ed < 140 && d > 110) { ax += (ex / ed) * 300; ay += (ey / ed) * 300; }
    });
    // walls repel lightly (keeps away from edges unless cornered)
    ax += (e.x < 80 ? 120 : 0) - (e.x > 880 ? 120 : 0);
    ay += (e.y < 230 ? 120 : 0) - (e.y > 540 ? 120 : 0);
    e.vx += ax * dt * 3; e.vy += ay * dt * 3;
    const sp = Math.hypot(e.vx, e.vy), max = e.dash > 0 ? 330 : 175;
    if (sp > max) { e.vx = (e.vx / sp) * max; e.vy = (e.vy / sp) * max; }
    e.vx *= 0.97; e.vy *= 0.97;
    e.dash = Math.max(0, e.dash - dt);
    if (d < 60 && e.dash <= 0 && Math.random() < 0.02) { e.dash = 0.5; e.vx = -dx * 3; e.vy = -dy * 3; }
    e.x = clamp(e.x + e.vx * dt, 30, 930); e.y = clamp(e.y + e.vy * dt, 200, 575);
    if (e.x > 400 && e.x < 560 && e.y > 320 && e.y < 380) e.y = e.y < 350 ? 320 : 380;
    this.shootT -= dt;
    if (this.shootT <= 0) {
      this.shootT = 2.6;
      const a = Math.atan2(p.y - 16 - (e.y - 20), p.x - e.x);
      this.projectiles.push({ x: e.x, y: e.y - 20, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 7, dmg: 1, color: '#1a1030', rgb: '120,100,255', life: 4 });
      this.g.sfx('echo');
    }
    this.pads.forEach((pd, i) => {
      if (this.spinning(i) && dist(e.x, e.y, pd.x, pd.y) < 62 && !this.done) {
        this.done = true; e.trapped = 0.01;
        this.projectiles = [];
        this.g.sfx('gear'); this.g.shakeScreen(8);
        this.g.toast('Trapped!');
        e.x = pd.x; e.y = pd.y;
        window.setTimeout(() => {
          this.g.sfx('pickup');
          this.say([['', 'The gear pins the Echo. It shrieks, and the Orb Piece clatters free.'], ['Arin', 'Got it. Piece one.']], () => this.g.playCutscene('bye1', () => this.complete()));
        }, 1200);
      }
    });
  }

  drawBg(ctx: C) {
    const t = this.t;
    ctx.fillStyle = '#1a0c04'; ctx.fillRect(0, 0, 960, 600);
    brassFloor(ctx, R(15, 170, 930, 415));
    ctx.fillStyle = '#3a200c'; ctx.fillRect(0, 0, 960, 170);
    drawGear(ctx, 480, 60, 120, 20, t * 0.1, '#5a3418');
    this.pads.forEach((pd, i) => {
      const sp = this.spinning(i);
      if (sp) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, pd.x, pd.y, 110, '255,180,80', 0.3); ctx.globalCompositeOperation = 'source-over'; }
      drawGear(ctx, pd.x, pd.y, 70, 14, this.ang[i], sp ? '#d0903a' : '#7a5228', '#3a2210');
      const left = sp ? 3.0 - ((this.t + pd.phase) % 6.4) : 6.4 - ((this.t + pd.phase) % 6.4);
      this.label(ctx, sp ? 'SPINNING' : `spins in ${left.toFixed(1)}`, pd.x, pd.y - 80, sp ? '#ffcf7a' : '#aa8866', 10);
    });
    block(ctx, 420, 330, 120, 40, '#6a4a2a', '#4a3018', 14);
  }
  sprites(): Sprite[] {
    const e = this.echo;
    return [{ y: e.y, draw: (c) => {
      if (e.trapped > 0) { c.save(); c.translate(e.x, e.y); c.rotate(e.t * 10); c.translate(-e.x, -e.y); drawEcho(c, e.x, e.y, e.t, 1, Math.max(0, 1 - e.trapped)); c.restore(); }
      else drawEcho(c, e.x, e.y, e.t);
      if (e.trapped < 1) drawOrb(c, e.x, e.y - 48 - Math.sin(e.t * 4) * 3, 6, e.t, '255,210,140');
    } }];
  }
}

void itemIcon; void drawCharacter;
