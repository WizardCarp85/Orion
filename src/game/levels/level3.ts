import { Stage, type Sprite, type Light } from '../stage';
import { NPC } from '../entities';
import { R, Rect, TAU, clamp, dist, distToSeg, inRect, mulberry32, rand } from '../util';
import { drawEcho, drawOrb, glow, drawGear } from '../draw';
import { block, arrowHint, doorGlow, itemIcon } from './common';

type C = CanvasRenderingContext2D;
const LOOP_SECONDS = 120;

interface Patrol { pts: [number, number][]; i: number; x: number; y: number; ang: number; speed: number; wait: number }

function shelf(ctx: C, r: Rect, seed: number) {
  block(ctx, r.x, r.y, r.w, r.h, '#4a2c30', '#2e1a1e', Math.min(18, r.h * 0.5));
  const rr = mulberry32(seed);
  const horiz = r.w >= r.h;
  const n = Math.floor((horiz ? r.w : r.h) / 9);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = ['#7a3a3a', '#3a5a7a', '#6a6a3a', '#5a3a6a', '#3a6a5a'][Math.floor(rr() * 5)];
    if (horiz) ctx.fillRect(r.x + 2 + i * 9, r.y + 2, 7, Math.max(4, r.h - 20));
    else ctx.fillRect(r.x + 2, r.y + 2 + i * 9, Math.max(4, r.w - 4), 7);
  }
}

// ===================================================================== LIBRARY (looping)
export class L3Library extends Stage {
  name = 'The Looping Library';
  loop = 1;
  timeLeft = LOOP_SECONDS;
  hour = 12; minute = 0;
  clockSolved = false; // this loop
  everSolved = false;
  hasKey = false;
  clues = { hour: false, minute: false };
  patrols: Patrol[] = [];
  genius!: NPC;
  resetting = 0;
  spotted = 0;
  shelves: Rect[] = [];
  aisleShelves: Rect[] = [];
  northDoor: Rect = R(760, 260, 80, 40);
  done = false;
  changed: { room: string; x: number; y: number; kind: 'hour' | 'minute' | 'key' } = { room: 'A', x: 0, y: 0, kind: 'hour' };

  setup() {
    this.w = 1600; this.h = 1100;
    this.spawn = { x: 800, y: 900 };
    this.darkness = 0.4; this.darkRGB = '20,6,16'; this.playerLight = 170;
    const W = this.walls;
    W.push(R(0, 0, 1600, 30), R(0, 1070, 1600, 30), R(0, 0, 30, 1100), R(1570, 0, 30, 1100));
    // horizontal divider between aisle and rooms (y 260-300) with gap for north door
    W.push(R(30, 260, 730, 40), R(840, 260, 730, 40));
    // divider between upper rooms and lower rooms (y 620-660), gaps for doors
    W.push(R(30, 620, 200, 40), R(320, 620, 450, 40), R(830, 620, 740, 40));
    // vertical walls
    W.push(R(520, 300, 40, 320), R(1040, 300, 40, 320)); // upper: C | clock | (east store)
    W.push(R(520, 660, 40, 120), R(520, 860, 40, 210)); // lower: A | hall door gap 780-860
    W.push(R(1040, 660, 40, 120), R(1040, 860, 40, 210)); // hall | B
    // reading room shelves
    this.shelves = [R(80, 700, 160, 30), R(300, 700, 160, 30), R(80, 980, 160, 30), R(1120, 700, 160, 30), R(1340, 700, 160, 30), R(1340, 980, 160, 30), R(80, 340, 30, 220), R(400, 340, 30, 140), R(1120, 340, 400, 30)];
    W.push(...this.shelves);
    // shadow aisle shelves
    this.aisleShelves = [R(160, 60, 40, 120), R(320, 140, 40, 120), R(480, 60, 40, 110), R(640, 130, 40, 130), R(900, 60, 40, 120), R(1060, 140, 40, 120), R(1220, 60, 40, 120), R(1380, 140, 40, 120)];
    W.push(...this.aisleShelves);
    this.dynamicWalls = [this.northDoor];
    this.genius = new NPC('genius', 860, 860); this.genius.facing = 'left';
    this.npcs.push(this.genius);
    const I = this.interacts;
    I.push({ x: 860, y: 860, r: 44, label: 'Talk to Genius Arin', action: () => this.talkGenius() });
    I.push({ x: 800, y: 1040, r: 40, label: 'Touch the backwards clock (end this loop now)', action: () => this.g.choice('Let the loop end and start over?', ['Yes — reset the loop', 'No'], (i) => { if (i === 0) this.resetLoop('You let go. Time folds back on itself.'); }) });
    I.push({ x: 700, y: 520, r: 36, label: 'Turn the HOUR lever', enabled: () => !this.clockSolved, action: () => { this.hour = this.hour % 12 + 1; this.g.sfx('gear'); this.checkClock(); } });
    I.push({ x: 900, y: 520, r: 36, label: 'Turn the MINUTE lever', enabled: () => !this.clockSolved, action: () => { this.minute = (this.minute + 5) % 60; this.g.sfx('gear'); this.checkClock(); } });
    I.push({ x: 0, y: 0, r: 34, label: 'Examine what changed', id: 'clue', action: () => this.takeClue() });
    I.push({ x: 1500, y: 100, r: 50, label: 'Unlock the Time Keeper door', action: () => this.keeperDoor() });
    I.push({ x: 160, y: 960, r: 34, label: 'Read a book', action: () => this.say([['', '"A Field Guide to Stars." Every page has been read so often it\'s nearly transparent.']]) });
    I.push({ x: 1420, y: 960, r: 34, label: 'Read a book', action: () => this.say([['', '"On Loops, by A. Vale." The last chapter is blank, except for one line: "Someone new will come."']]) });
    this.placePhoto(1530, 1040);
    this.setupLoop();
  }

  onEnter() {
    this.g.hint('A 2-minute loop resets the library. You keep your knowledge and key items. Look for what changes each loop.');
  }

  setupLoop() {
    this.timeLeft = LOOP_SECONDS;
    this.hour = 12; this.minute = 0;
    this.clockSolved = false;
    this.dynamicWalls = [this.northDoor];
    this.patrols = [
      { pts: [[100, 220], [600, 220], [600, 60], [100, 60]], i: 0, x: 100, y: 220, ang: 0, speed: 70, wait: 0 },
      { pts: [[780, 80], [780, 230], [1150, 230], [1150, 80]], i: 0, x: 780, y: 80, ang: 0, speed: 80, wait: 0 },
      { pts: [[1300, 220], [1480, 220], [1480, 60], [1300, 60]], i: 0, x: 1300, y: 220, ang: 0, speed: 60, wait: 0 },
    ];
    const k = ((this.loop - 1) % 3);
    if (k === 0) this.changed = { room: 'A', x: 380, y: 880, kind: 'hour' };
    else if (k === 1) this.changed = { room: 'B', x: 1200, y: 880, kind: 'minute' };
    else this.changed = { room: 'C', x: 300, y: 450, kind: 'key' };
    const it = this.interacts.find((i) => i.id === 'clue')!;
    it.x = this.changed.x; it.y = this.changed.y;
    it.enabled = () => !(this.changed.kind === 'key' ? this.hasKey : this.clues[this.changed.kind]);
    this.g.audio.restartLoop(this.loop - 1);
    this.updObj();
  }

  resetLoop(msg: string) {
    if (this.resetting > 0) return;
    this.resetting = 1.2;
    this.controlLocked = true;
    this.g.sfx('rewind');
    this.g.flashScreen('rgba(255,210,150,0.6)', 0.8);
    this.g.toast(msg);
  }

  updObj() {
    const parts: string[] = [];
    if (!this.clues.hour || !this.clues.minute) parts.push(`Find what changed in the reading rooms (clues: ${+this.clues.hour + +this.clues.minute}/2)`);
    if (!this.clockSolved) parts.push('set the giant clock');
    if (!this.hasKey) parts.push('find the Library Key');
    if (this.clockSolved) parts.push('sneak through the Shadow Aisle (north)');
    this.setObjective(parts.length ? parts.join(' · ') : 'Sneak through the Shadow Aisle to the Time Keeper door (north-east).');
  }

  takeClue() {
    this.g.sfx('pickup');
    if (this.changed.kind === 'hour') { this.clues.hour = true; this.g.save.clues.push('hour'); this.say([['', 'A book lies open on the floor that wasn\'t there last loop. A line is underlined:'], ['', '"When the owl sleeps, the HOUR is THREE."']]); }
    else if (this.changed.kind === 'minute') { this.clues.minute = true; this.g.save.clues.push('minute'); this.say([['', 'The candle in this room is lit for the first time. Wax drips onto a note:'], ['', '"Forty winks before the Keeper wakes. MINUTE: FORTY."']]); }
    else { this.hasKey = true; this.say([['', 'A silver key hangs from the shelf where yesterday there was only dust.'], ['', 'Library Key obtained. It will stay with you through every loop.']]); }
    this.updObj();
  }

  checkClock() {
    if (this.hour === 3 && this.minute === 40) {
      this.clockSolved = true;
      this.dynamicWalls = [];
      this.g.sfx('bell'); this.g.sfx('door');
      this.g.toast('The giant clock chimes. The north door to the Shadow Aisle opens.');
      if (!this.everSolved) {
        this.everSolved = true;
        this.g.playCutscene('sky3', () => this.say([['Genius Arin', 'The Shadow Aisle is past that door. Echoes patrol it. If they see you, the loop snaps back.'], ['Genius Arin', "Watch their routes. Stay behind the shelves. You'll learn them — that's the gift of a loop."]]));
      }
      this.updObj();
    }
  }

  keeperDoor() {
    if (!this.hasKey) { this.say([['Arin', 'Locked. The keyhole is silver... there must be a key somewhere in the library.']]); return; }
    if (this.done) return;
    this.done = true;
    this.g.sfx('door');
    this.say([['Genius Arin', "The Keeper's chamber. Time doesn't move in there — the loop can't reach you."], ['Genius Arin', "I'm coming with you. I've waited long enough."]], () => this.complete());
  }

  talkGenius() {
    const lines: [string, string][] = [];
    if (this.loop === 1 && !this.clues.hour) lines.push(['Genius Arin', 'Each loop, exactly one thing in the reading rooms is different. I\'ve memorised the rest. Find the change.'], ['Genius Arin', 'The giant clock to the north... it wants a time. I could never find it alone.']);
    else if (!this.clues.hour || !this.clues.minute) lines.push(['Genius Arin', `Loop ${this.loop}. Check the rooms again — west, east, and the north-west study. Something changed.`]);
    else if (!this.clockSolved) lines.push(['Genius Arin', 'Three... and forty. Set the clock to 3:40. Quickly, before the loop folds.']);
    else if (!this.hasKey) lines.push(['Genius Arin', 'The Keeper door needs a silver key. Keep watching the study — loops shuffle their gifts.']);
    else lines.push(['Genius Arin', 'Go. Through the aisle. I\'ll be right behind you.']);
    this.say(lines);
  }

  canSee(pt: Patrol): boolean {
    const p = this.p;
    if (p.y > 300) return false;
    const dx = p.x - pt.x, dy = p.y - pt.y, d = Math.hypot(dx, dy);
    if (d > 170) return false;
    let da = Math.atan2(dy, dx) - pt.ang;
    while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    if (Math.abs(da) > 0.55) return false;
    // line of sight vs shelves
    for (let s = 0; s <= 1; s += 0.05) {
      const x = pt.x + dx * s, y = pt.y + dy * s;
      if (this.aisleShelves.some((r) => inRect(x, y, r))) return false;
    }
    return true;
  }

  update(dt: number) {
    if (this.resetting > 0) {
      this.resetting -= dt;
      if (this.resetting <= 0) {
        this.loop++;
        this.p.x = 800; this.p.y = 900; this.p.hp = this.p.maxHp;
        this.controlLocked = false;
        this.spotted = 0;
        this.setupLoop();
        this.g.toast(`Loop ${this.loop} — the library resets. You remember everything.`);
      }
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.resetLoop('The clocks strike. The loop folds back...'); return; }
    const m = Math.floor(this.timeLeft / 60), s = Math.floor(this.timeLeft % 60);
    this.g.setTimer(`${m}:${s.toString().padStart(2, '0')} · Loop ${this.loop}`);
    for (const pt of this.patrols) {
      if (pt.wait > 0) { pt.wait -= dt; pt.ang += dt * 1.2; continue; }
      const [tx, ty] = pt.pts[(pt.i + 1) % pt.pts.length];
      const dx = tx - pt.x, dy = ty - pt.y, d = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      let da = want - pt.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      pt.ang += clamp(da, -dt * 4, dt * 4);
      if (d < 3) { pt.i = (pt.i + 1) % pt.pts.length; pt.wait = 0.8; }
      else { pt.x += (dx / d) * pt.speed * dt; pt.y += (dy / d) * pt.speed * dt; }
      if (this.canSee(pt)) {
        this.spotted += dt * 3;
        if (this.spotted > 1) { this.g.sfx('echo'); this.resetLoop('An Echo saw you! The loop snaps back.'); return; }
      }
    }
    this.spotted = Math.max(0, this.spotted - dt * 0.8);
    if (Math.random() < 0.06) this.g.particles.add({ x: rand(30, 1570), y: rand(300, 1070), vy: -10, vx: rand(-5, 5), life: 3, size: 1.5, color: 'rgba(255,220,180,0.5)', glow: true });
  }

  lights(): Light[] {
    const L: Light[] = [
      { x: 800, y: 980, r: 220, rgb: '255,210,150' }, { x: 280, y: 860, r: 180, rgb: '255,200,140' }, { x: 1300, y: 860, r: 180, rgb: '255,200,140' },
      { x: 300, y: 460, r: 170, rgb: '255,200,140' }, { x: 800, y: 440, r: 220, rgb: '255,230,180' }, { x: 1300, y: 460, r: 120, rgb: '255,200,140', a: 0.6 },
    ];
    for (const pt of this.patrols) L.push({ x: pt.x + Math.cos(pt.ang) * 60, y: pt.y + Math.sin(pt.ang) * 60, r: 90, rgb: '140,120,255', a: 0.5 });
    const it = this.interacts.find((i) => i.id === 'clue')!;
    if (!it.enabled || it.enabled()) L.push({ x: it.x, y: it.y - 10, r: 80, rgb: '255,240,160' });
    return L;
  }

  drawBg(ctx: C) {
    const t = this.t;
    ctx.fillStyle = '#1a0e14'; ctx.fillRect(0, 0, this.w, this.h);
    this.tileFloor(ctx, 30, 300, 1540, 770, 40, '#3a2228', '#40262c');
    this.tileFloor(ctx, 30, 30, 1540, 230, 30, '#20141c', '#24161e');
    // rugs
    ctx.fillStyle = '#5a2a3a'; ctx.fillRect(640, 760, 320, 260); ctx.fillStyle = '#6a3444'; ctx.fillRect(660, 780, 280, 220);
    this.drawWalls(ctx, '#4a2c34', '#2e1a20', this.walls.filter((w) => !this.shelves.includes(w) && !this.aisleShelves.includes(w)));
    this.shelves.forEach((s, i) => shelf(ctx, s, i + 1));
    this.aisleShelves.forEach((s, i) => shelf(ctx, s, i + 30));
    // room labels
    this.label(ctx, 'READING ROOM A', 280, 760, '#e8c8a0', 11);
    this.label(ctx, 'READING ROOM B', 1300, 760, '#e8c8a0', 11);
    this.label(ctx, 'NORTH-WEST STUDY', 300, 330, '#e8c8a0', 11);
    this.label(ctx, 'THE SHADOW AISLE', 800, 50, '#a89ad8', 12);
    // giant clock
    const cx = 800, cy = 420;
    ctx.fillStyle = '#2a1a1a'; ctx.beginPath(); ctx.arc(cx, cy, 92, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8d8b8'; ctx.beginPath(); ctx.arc(cx, cy, 82, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a2a'; ctx.font = '12px serif'; ctx.textAlign = 'center';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * TAU - Math.PI / 2; ctx.fillText(`${i}`, cx + Math.cos(a) * 68, cy + Math.sin(a) * 68 + 4); }
    const ha = ((this.hour % 12) / 12 + this.minute / 720) * TAU - Math.PI / 2, ma = (this.minute / 60) * TAU - Math.PI / 2;
    ctx.strokeStyle = '#2a1a1a'; ctx.lineCap = 'round';
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * 40, cy + Math.sin(ha) * 40); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * 62, cy + Math.sin(ma) * 62); ctx.stroke();
    if (this.clockSolved) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, cx, cy, 130, '255,220,140', 0.3); ctx.globalCompositeOperation = 'source-over'; }
    // levers
    for (const [x, lbl] of [[700, 'HOUR'], [900, 'MIN']] as [number, string][]) { block(ctx, x - 16, 490, 32, 26, '#5a4a3a', '#3a2e24', 10); this.label(ctx, lbl, x, 530, '#ffd58a', 10); }
    // north door
    if (!this.clockSolved) block(ctx, this.northDoor.x, this.northDoor.y, this.northDoor.w, this.northDoor.h, '#6a5a7a', '#4a3a5a', 14);
    else doorGlow(ctx, this.northDoor, t, '200,170,255');
    // keeper door
    ctx.fillStyle = '#5a4a6a'; ctx.fillRect(1480, 30, 70, 50);
    ctx.fillStyle = this.hasKey ? '#e8e8ff' : '#2a2a3a'; ctx.beginPath(); ctx.arc(1515, 60, 6, 0, TAU); ctx.fill();
    // backwards clock in hall
    ctx.fillStyle = '#e8d8b8'; ctx.beginPath(); ctx.arc(800, 1046, 18, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(800, 1046); ctx.lineTo(800 + Math.cos(-t * 3) * 14, 1046 + Math.sin(-t * 3) * 14); ctx.stroke();
    // "changed" thing
    const it = this.interacts.find((i) => i.id === 'clue')!;
    if (!it.enabled || it.enabled()) itemIcon(ctx, this.changed.kind === 'key' ? 'key' : this.changed.kind === 'hour' ? 'pic' : 'letter', it.x, it.y, t);
    // patrol vision cones
    for (const pt of this.patrols) {
      ctx.fillStyle = `rgba(150,120,255,${0.12 + this.spotted * 0.2})`;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y);
      for (let a = -0.55; a <= 0.551; a += 0.1) {
        let len = 170;
        for (let s = 0.05; s <= 1; s += 0.05) { const x = pt.x + Math.cos(pt.ang + a) * 170 * s, y = pt.y + Math.sin(pt.ang + a) * 170 * s; if (this.aisleShelves.some((r) => inRect(x, y, r))) { len = 170 * s; break; } }
        ctx.lineTo(pt.x + Math.cos(pt.ang + a) * len, pt.y + Math.sin(pt.ang + a) * len);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  sprites(): Sprite[] {
    const s: Sprite[] = this.patrols.map((pt) => ({ y: pt.y, draw: (c: C) => drawEcho(c, pt.x, pt.y, this.t) }));
    s.push({ y: 1040, draw: (c) => this.drawPhotoPickup(c) });
    if (this.clockSolved && this.p.y > 300) s.push({ y: 9999, draw: (c) => arrowHint(c, 800, 290, this.t, '#c9a6ff') });
    return s;
  }
  drawScreen(ctx: C) {
    if (this.spotted > 0.05) { ctx.fillStyle = `rgba(120,80,255,${this.spotted * 0.3})`; ctx.fillRect(0, 0, 960, 600); this.label(ctx, 'SPOTTED!', 480, 120, '#d8c8ff', 18); }
    if (this.timeLeft < 15 && this.resetting <= 0) { ctx.fillStyle = `rgba(255,200,120,${(0.5 + 0.5 * Math.sin(this.t * 8)) * 0.12})`; ctx.fillRect(0, 0, 960, 600); }
    if (this.resetting > 0) { ctx.fillStyle = `rgba(255,220,170,${Math.min(1, (1.2 - this.resetting) * 1.5)})`; ctx.fillRect(0, 0, 960, 600); }
  }
}

// ===================================================================== TIME KEEPER
export class L3Keeper extends Stage {
  name = 'The Time Keeper';
  ang = 0;
  speeds = [0.9, -0.6];
  breakT = 0; // >0 during pattern break
  nextBreak = 5;
  jams = [{ a: -Math.PI / 2, done: false }, { a: Math.PI / 6, done: false }, { a: (5 * Math.PI) / 6, done: false }];
  handAng = [0, Math.PI];
  phase: 'fight' | 'snatch' | 'escaped' | 'caught' = 'fight';
  echo = { x: 480, y: 300, alive: false, stunned: false };
  echoHist: { x: number; y: number }[] = [];
  genius!: NPC;
  doorClosed = false;

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 540 };
    this.walls.push(R(0, 0, 960, 40), R(0, 580, 960, 20), R(0, 0, 30, 600), R(930, 0, 30, 600));
    this.walls.push(R(440, 270, 80, 50)); // gear axle
    this.genius = new NPC('genius', 120, 520); this.genius.facing = 'right';
    this.npcs.push(this.genius);
    this.jams.forEach((j, i) => this.interacts.push({ x: 0, y: 0, r: 40, tool: 1, label: 'Jam the gear with the Multi-Tool', enabled: () => this.phase === 'fight' && !j.done, action: () => this.jam(i) }));
    this.interacts.push({ x: 0, y: 0, r: 50, label: 'Grab the Echo!', id: 'grab', enabled: () => this.phase === 'escaped' && this.echo.stunned, action: () => this.catchEcho() });
    this.setObjective('Wait for Genius Arin\'s pattern break, then press 1 (Multi-Tool) at a glowing jam point. (0/3)');
    this.g.setTimer('∞ · Time stands still');
  }
  onEnter() {
    this.say([['Genius Arin', "The Keeper's gear. Every hand moves in a pattern — and every pattern has a flaw."], ['Genius Arin', "When I call it, the hands stutter. That's your moment. Jam the teeth with your tool."]]);
    this.g.hint('Avoid the sweeping clock hands. Press 1 at a glowing jam point during the pattern break.');
  }
  jamPos(i: number) { const a = this.jams[i].a + this.ang; return { x: 480 + Math.cos(a) * 130, y: 300 + Math.sin(a) * 100 }; }

  jam(i: number) {
    if (this.breakT <= 0) { this.g.toast('Too fast! The gear is spinning — wait for the pattern break.'); this.g.sfx('fail'); return; }
    this.jams[i].done = true;
    this.g.sfx('gear'); this.g.shakeScreen(6);
    const n = this.jams.filter((j) => j.done).length;
    this.g.particles.burst(this.jamPos(i).x, this.jamPos(i).y, 30, '#ffd166', 200, 0.6, 3);
    this.setObjective(`Jam the gear at the glowing points during the pattern break (${n}/3)`);
    if (n === 3) {
      this.phase = 'snatch';
      this.g.sfx('bell');
      this.echo = { x: 480, y: 300, alive: true, stunned: false };
      this.say([['', 'The Keeper\'s gear grinds to a halt. The third orb piece drops from its heart—'], ['', '—and an Echo snatches it, racing for the door!'], ['Genius Arin', 'NO! Here — take my Pocket Watch! It turns back five seconds. RUN IT BACK!']], () => {
        this.g.save.items.watch = true;
        this.rewindUsed = false;
        this.echoHist = [];
        this.setObjective('Press 3 to use the Pocket Watch and rewind 5 seconds — catch the Echo!');
        this.g.hint('Pocket Watch: press 3 to rewind 5 seconds (once per area).');
      });
    }
  }

  onRewind() {
    if (this.phase === 'escaped' || this.phase === 'snatch') {
      const h = this.echoHist[0];
      if (h) { this.echo.x = h.x; this.echo.y = h.y; }
      this.echo.stunned = true;
      this.phase = 'escaped';
      this.doorClosed = false;
      this.p.x = this.echo.x - 40; this.p.y = this.echo.y + 30;
      this.setObjective('The Echo is frozen in rewound time — grab it!');
    }
  }
  onTool(n: number): boolean {
    if (n === 3 && this.phase === 'snatch' && !this.g.save.items.watch) return true;
    return false;
  }

  catchEcho() {
    this.phase = 'caught';
    this.g.sfx('pickup');
    this.g.playCutscene('echo3', () => this.say([['Genius Arin', 'You did it. The clocks... they\'re ticking forward.'], ['Genius Arin', "Keep the watch. I've had enough of going backwards. Go — and look at the stars for me."]], () => this.complete()));
  }

  update(dt: number) {
    const p = this.p;
    const it = this.interacts.find((i) => i.id === 'grab')!;
    it.x = this.echo.x; it.y = this.echo.y;
    this.jams.forEach((_, i) => { const jp = this.jamPos(i); this.interacts[i].x = jp.x; this.interacts[i].y = jp.y + 20; });
    if (this.phase === 'fight') {
      this.nextBreak -= dt;
      if (this.breakT > 0) this.breakT -= dt;
      else if (this.nextBreak <= 0) {
        this.nextBreak = 6.5; this.breakT = 2.4;
        this.say([['Genius Arin', 'NOW! The pattern breaks!']]);
        this.g.sfx('select');
      }
      const mul = this.breakT > 0 ? 0.04 : 1;
      this.ang += dt * 0.3 * mul;
      this.handAng[0] += dt * this.speeds[0] * mul * (1 + this.jams.filter((j) => j.done).length * 0.25);
      this.handAng[1] += dt * this.speeds[1] * mul * (1 + this.jams.filter((j) => j.done).length * 0.25);
      for (let k = 0; k < 2; k++) {
        const len = k === 0 ? 300 : 230;
        const ex = 480 + Math.cos(this.handAng[k]) * len, ey = 300 + Math.sin(this.handAng[k]) * len * 0.8;
        if (distToSeg(p.x, p.y - 10, 480, 300, ex, ey) < 14) p.hurt(1, 480, 300, this);
      }
    } else if (this.phase === 'snatch') {
      // echo flees to east door
      this.echoHist.push({ x: this.echo.x, y: this.echo.y });
      if (this.echoHist.length > 300) this.echoHist.shift();
      if (!this.g.dialogueState) {
        const dx = 900 - this.echo.x, dy = 300 - this.echo.y, d = Math.hypot(dx, dy);
        if (d > 4) { this.echo.x += (dx / d) * 120 * dt; this.echo.y += (dy / d) * 120 * dt; }
        else if (!this.doorClosed) { this.doorClosed = true; this.g.sfx('door'); this.g.toast('The Echo slipped through! Rewind time (3)!'); }
      }
    }
    if (Math.random() < 0.1) this.g.particles.add({ x: rand(30, 930), y: rand(40, 580), vy: -8, life: 2, size: 1.5, color: 'rgba(255,220,160,0.5)', glow: true });
  }

  drawBg(ctx: C) {
    const t = this.t;
    ctx.fillStyle = '#140a14'; ctx.fillRect(0, 0, 960, 600);
    this.tileFloor(ctx, 30, 40, 900, 540, 40, '#2a1824', '#2e1a28');
    // big gear
    ctx.save(); ctx.translate(480, 300); ctx.scale(1, 0.78);
    drawGear(ctx, 0, 0, 160, 24, this.ang, '#7a5a3a', '#3a2a1a');
    ctx.restore();
    // jam points
    this.jams.forEach((j, i) => {
      const jp = this.jamPos(i);
      ctx.fillStyle = j.done ? '#c9963e' : this.breakT > 0 ? '#ffd166' : '#5a4a3a';
      ctx.beginPath(); ctx.arc(jp.x, jp.y, 12, 0, TAU); ctx.fill();
      if (!j.done && this.breakT > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, jp.x, jp.y, 46, '255,210,100', 0.6); ctx.globalCompositeOperation = 'source-over'; }
      if (j.done) { ctx.fillStyle = '#9aa3b8'; ctx.fillRect(jp.x - 3, jp.y - 16, 6, 18); }
    });
    // east door
    ctx.fillStyle = this.doorClosed ? '#5a4a6a' : '#1a1020'; ctx.fillRect(915, 250, 15, 100);
  }
  drawFg(ctx: C) {
    if (this.phase === 'fight') {
      for (let k = 0; k < 2; k++) {
        const len = k === 0 ? 300 : 230;
        const ex = 480 + Math.cos(this.handAng[k]) * len, ey = 300 + Math.sin(this.handAng[k]) * len * 0.8;
        ctx.strokeStyle = this.breakT > 0 ? 'rgba(255,220,150,0.5)' : '#d8c8a8'; ctx.lineWidth = k === 0 ? 10 : 14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(480, 300); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,80,80,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.fillStyle = '#c9963e'; ctx.beginPath(); ctx.arc(480, 300, 18, 0, TAU); ctx.fill();
    if (this.echo.alive && this.phase !== 'caught') {
      ctx.save();
      if (this.doorClosed && !this.echo.stunned) ctx.globalAlpha = 0.25;
      drawEcho(ctx, this.echo.x, this.echo.y, this.t, 1, 1, this.echo.stunned);
      drawOrb(ctx, this.echo.x, this.echo.y - 48, 6, this.t, '200,160,255');
      ctx.restore();
    }
  }
}
void dist; void doorGlow;
