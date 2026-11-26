import { Stage, type Sprite, type Light } from '../stage';
import { NPC } from '../entities';
import { R, Rect, TAU, clamp, dist, mulberry32, rand } from '../util';
import { drawCharacter, drawEcho, glow, rr } from '../draw';
import { block, arrowHint, doorGlow, itemIcon } from './common';
import type { MeterView } from '../store';

type C = CanvasRenderingContext2D;

function grass(ctx: C, x: number, y: number, w: number, h: number, seed = 1) {
  ctx.fillStyle = '#9ccf88'; ctx.fillRect(x, y, w, h);
  const r = mulberry32(seed);
  for (let i = 0; i < (w * h) / 900; i++) { ctx.fillStyle = r() > 0.5 ? '#8cc078' : '#acdc98'; ctx.fillRect(x + r() * w, y + r() * h, 3, 5); }
  for (let i = 0; i < (w * h) / 6000; i++) { ctx.fillStyle = ['#f7a8c8', '#fff', '#ffe08a'][i % 3]; const fx = x + r() * w, fy = y + r() * h; ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, TAU); ctx.fill(); }
}
function islandEdge(ctx: C, r: Rect, t: number) {
  // pink cloud void around
  ctx.fillStyle = '#f6c6d6'; ctx.fillRect(r.x - 400, r.y - 400, r.w + 800, r.h + 800);
  for (let i = 0; i < 14; i++) { const cx = r.x - 200 + ((i * 210 + t * 6) % (r.w + 400)), cy = r.y + r.h + 40 + (i % 3) * 30; ctx.fillStyle = 'rgba(255,235,242,0.8)'; ctx.beginPath(); ctx.ellipse(cx, cy, 90, 22, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#b48a9a'; ctx.fillRect(r.x, r.y + r.h, r.w, 24);
}
function house(ctx: C, x: number, y: number, color: string, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha;
  block(ctx, x - 50, y - 60, 100, 60, color, '#8a6a7a', 26);
  ctx.fillStyle = '#c86a7a'; ctx.beginPath(); ctx.moveTo(x - 60, y - 54); ctx.lineTo(x, y - 100); ctx.lineTo(x + 60, y - 54); ctx.fill();
  ctx.fillStyle = '#6a4a3a'; ctx.fillRect(x - 10, y - 24, 20, 24);
  ctx.fillStyle = '#ffe8a8'; ctx.fillRect(x - 38, y - 22, 14, 12); ctx.fillRect(x + 24, y - 22, 14, 12);
  ctx.restore();
}

// ===================================================================== SHELTER
export class L4Shelter extends Stage {
  name = 'The Shelter';
  orion!: NPC; healer!: NPC;
  petted = false;
  food = 0;
  animals = [{ x: 680, y: 330, kind: 'cat', fed: false }, { x: 760, y: 470, kind: 'rabbit', fed: false }, { x: 300, y: 470, kind: 'goat', fed: false }];
  talked = new Set<number>();
  villagers: NPC[] = [];
  done = false;
  island = R(60, 120, 840, 440);

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 420 };
    const i = this.island;
    this.walls.push(R(0, 0, 960, i.y), R(0, i.y + i.h, 960, 600), R(0, 0, i.x, 600), R(i.x + i.w, 0, 960 - i.x - i.w, 600));
    this.walls.push(R(380, 140, 200, 90)); // shelter building
    this.walls.push(R(120, 160, 70, 50)); // food bin / shed
    this.orion = new NPC('dog', 540, 300); this.orion.old = true; this.orion.speed = 70; this.orion.followDist = 50; this.orion.dogPose = 'lie';
    this.healer = new NPC('healer', 600, 260); this.healer.facing = 'down';
    this.npcs.push(this.orion, this.healer);
    const v1 = new NPC('villager', 220, 330), v2 = new NPC('villager', 820, 230);
    v2.facing = 'left';
    this.villagers = [v1, v2];
    this.npcs.push(v1, v2);
    const I = this.interacts;
    I.push({ x: 0, y: 0, r: 40, label: 'Pet Orion', id: 'orion', action: () => this.pet() });
    I.push({ x: 155, y: 225, r: 40, label: 'Take animal food', enabled: () => this.food === 0 && this.animals.some((a) => !a.fed), action: () => { this.food = this.animals.filter((a) => !a.fed).length; this.g.sfx('pickup'); this.g.toast(`Picked up ${this.food} food bowls`); } });
    this.animals.forEach((a) => I.push({ x: a.x, y: a.y, r: 36, label: `Feed the ${a.kind}`, enabled: () => !a.fed, action: () => this.feed(a) }));
    const vl: [string, string][][] = [
      [['Villager', "Doctor Arin saved my goat last spring. He's patient with every creature."], ['Villager', 'The mist has been eating the edges of the island. Houses... people. They just fade.']],
      [['Villager', 'You look like the doctor. Sadder, though.'], ['Villager', 'That old dog sleeps by the window every afternoon. He waits for someone, I think.']],
    ];
    this.villagers.forEach((v, k) => I.push({ x: v.x, y: v.y, r: 40, label: 'Talk', action: () => { this.talked.add(k); this.say(vl[k], () => this.upd()); } }));
    I.push({ x: 600, y: 260, r: 40, label: 'Talk to Healer Arin', action: () => this.talkHealer() });
    this.placePhoto(830, 520);
    this.upd();
  }
  onEnter() { this.g.hint('Take it slow. There is no combat here.'); }

  pet() {
    this.petted = true;
    this.g.sfx('heal');
    this.orion.dogPose = 'sit';
    this.g.particles.burst(this.orion.x, this.orion.y - 20, 10, '#ff9fc0', 60, 1, 3);
    this.say([['', 'Orion leans his whole weight into Arin\'s hand, eyes half closed.'], ['Arin', "...You still like the spot behind your ear. Of course you do."]], () => { this.orion.follow = this.p; this.upd(); });
  }
  feed(a: { kind: string; fed: boolean }) {
    if (this.food <= 0) { this.say([['Arin', 'I need food from the bin by the shed first.']]); return; }
    a.fed = true; this.food--;
    this.g.sfx('heal');
    this.g.toast(`The ${a.kind} munches happily.`);
    this.upd();
  }
  talkHealer() {
    const fed = this.animals.filter((a) => a.fed).length;
    if (this.petted && fed === 3 && this.talked.size === 2) {
      if (this.done) return;
      this.done = true;
      this.say([['Healer Arin', 'Thank you. The animals like you. So does he.'], ['Healer Arin', "The village is fading faster today. Their memories hold it together — photos, toys, letters. Help me find them?"]], () => this.complete());
    } else this.say([['Healer Arin', "Take your time. Say hello to Orion, feed the animals — the bin's by the shed — and meet the neighbours."]]);
  }
  upd() {
    const fed = this.animals.filter((a) => a.fed).length;
    const parts = [`${this.petted ? '✓' : '○'} Pet Orion`, `${fed === 3 ? '✓' : '○'} Feed animals (${fed}/3)`, `${this.talked.size === 2 ? '✓' : '○'} Talk to villagers (${this.talked.size}/2)`];
    if (this.petted && fed === 3 && this.talked.size === 2) parts.push('→ Talk to Healer Arin');
    this.setObjective(parts.join('   '));
  }
  update(dt: number) {
    const it = this.interacts.find((i) => i.id === 'orion')!;
    it.x = this.orion.x; it.y = this.orion.y;
    if (Math.random() < 0.05) this.g.particles.add({ x: rand(0, 960), y: rand(100, 600), vx: rand(10, 30), vy: rand(5, 15), life: 4, size: 2.5, color: '#ffc0d8' });
  }
  drawBg(ctx: C) {
    const t = this.t;
    islandEdge(ctx, this.island, t);
    grass(ctx, this.island.x, this.island.y, this.island.w, this.island.h, 4);
    // shelter
    block(ctx, 380, 140, 200, 90, '#e8c8b0', '#b89a88', 34);
    ctx.fillStyle = '#c86a7a'; ctx.fillRect(370, 120, 220, 30);
    ctx.fillStyle = '#ffe8a8'; ctx.fillRect(410, 196, 30, 20); ctx.fillRect(520, 196, 30, 20);
    this.label(ctx, 'QUIET SKY ANIMAL SHELTER', 480, 140, '#6a3a4a', 10);
    block(ctx, 120, 160, 70, 50, '#a07a5a', '#7a5a40', 18);
    if (this.food === 0 && this.animals.some((a) => !a.fed)) itemIcon(ctx, 'food', 155, 200, t);
    // fence
    ctx.strokeStyle = '#c8a888'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(640, 290); ctx.lineTo(880, 290); ctx.moveTo(640, 290); ctx.lineTo(640, 540); ctx.stroke();
  }
  sprites(): Sprite[] {
    const s: Sprite[] = [];
    for (const a of this.animals) s.push({ y: a.y, draw: (c) => {
      c.save(); c.translate(a.x, a.y);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(0, 0, 12, 4, 0, 0, TAU); c.fill();
      const bob = Math.sin(this.t * 3 + a.x) * 1;
      if (a.kind === 'cat') { c.fillStyle = '#8a8a9a'; c.beginPath(); c.ellipse(0, -8 + bob, 10, 6, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(9, -14 + bob, 5, 0, TAU); c.fill(); c.beginPath(); c.moveTo(6, -18); c.lineTo(8, -23); c.lineTo(10, -18); c.moveTo(10, -18); c.lineTo(13, -22); c.lineTo(13, -16); c.fill(); }
      else if (a.kind === 'rabbit') { c.fillStyle = '#f4ece4'; c.beginPath(); c.ellipse(0, -7 + bob, 8, 6, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(6, -12 + bob, 4, 0, TAU); c.fill(); c.fillRect(5, -22 + bob, 2, 8); c.fillRect(8, -22 + bob, 2, 8); }
      else { c.fillStyle = '#e8e0d0'; c.beginPath(); c.ellipse(0, -12 + bob, 14, 8, 0, 0, TAU); c.fill(); c.fillRect(-10, -6, 3, 6); c.fillRect(7, -6, 3, 6); c.beginPath(); c.arc(13, -18 + bob, 6, 0, TAU); c.fill(); c.strokeStyle = '#8a7a6a'; c.beginPath(); c.arc(12, -24, 4, Math.PI, TAU); c.stroke(); }
      if (a.fed) { c.fillStyle = '#ff7aa8'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('♥', 0, -30 - Math.sin(this.t * 3) * 3); }
      c.restore();
    } });
    s.push({ y: 520, draw: (c) => this.drawPhotoPickup(c) });
    return s;
  }
}

// ===================================================================== FADING VILLAGE
interface Home { x: number; y: number; item: string; name: string; restored: boolean; color: string; res: NPC }
export class L4Village extends Stage {
  name = 'Fading Village';
  homes: Home[] = [];
  items: { x: number; y: number; kind: string; got: boolean; home: number }[] = [];
  carrying: number[] = [];
  orion!: NPC; healer!: NPC;
  done = false;
  island = R(40, 100, 1320, 760);

  setup() {
    this.w = 1400; this.h = 900;
    this.spawn = { x: 700, y: 780 };
    const i = this.island;
    this.walls.push(R(0, 0, 1400, i.y), R(0, i.y + i.h, 1400, 900), R(0, 0, i.x, 900), R(i.x + i.w, 0, 1400 - i.x - i.w, 900));
    const defs: [number, number, string, string, string][] = [
      [220, 260, 'pic', 'the baker', '#f0d0b8'], [560, 240, 'toy', 'a little girl', '#e8d0e8'], [920, 260, 'letter', 'an old sailor', '#d0e0f0'],
      [1200, 380, 'pic', 'the twins', '#e8e8c8'], [300, 620, 'letter', 'the schoolteacher', '#d8f0d8'],
    ];
    defs.forEach(([x, y, item, name, color], k) => {
      const res = new NPC(k === 1 ? 'child' : 'villager', x + 70, y + 20); res.alpha = 0.15;
      this.homes.push({ x, y, item, name, restored: false, color, res });
      this.npcs.push(res);
      this.walls.push(R(x - 50, y - 60, 100, 60));
      this.interacts.push({ x, y: y + 18, r: 46, label: `Return the memory to ${name}`, enabled: () => !this.homes[k].restored, action: () => this.restore(k) });
    });
    const spots: [number, number][] = [[1260, 760], [120, 160], [780, 560], [1000, 700], [600, 420]];
    defs.forEach(([, , kind], k) => { this.items.push({ x: spots[k][0], y: spots[k][1], kind, got: false, home: k }); });
    this.items.forEach((it, k) => this.interacts.push({ x: it.x, y: it.y, r: 34, label: `Pick up a memory (${it.kind === 'pic' ? 'photo' : it.kind})`, enabled: () => !it.got, action: () => { it.got = true; this.carrying.push(k); this.g.sfx('pickup'); this.g.toast(`It belongs to ${this.homes[it.home].name}.`); this.upd(); } }));
    this.orion = new NPC('dog', 660, 800); this.orion.old = true; this.orion.follow = this.p; this.orion.speed = 110; this.orion.followDist = 60;
    this.healer = new NPC('healer', 740, 800); this.healer.follow = this.orion; this.healer.followDist = 50;
    this.npcs.push(this.orion, this.healer);
    this.upd();
  }
  onEnter() { this.say([['Healer Arin', "Each fading house lost a memory. Find it, bring it home, and they'll come back."]]); }

  restore(k: number) {
    const h = this.homes[k];
    const idx = this.carrying.findIndex((c) => this.items[c].home === k);
    if (idx < 0) { this.say([['', `The house of ${h.name} flickers like a candle. Something of theirs is missing.`]]); return; }
    this.carrying.splice(idx, 1);
    h.restored = true;
    this.g.sfx('success');
    this.g.particles.burst(h.x, h.y - 40, 40, '#fff0f8', 160, 1, 4);
    const lines: Record<number, string> = { 0: "My wedding photo... I'd almost forgotten her smile.", 1: 'Mister Bun! I looked everywhere!', 2: "A letter from my brother. I remember now. I remember him.", 3: 'Both of us! At the fair! We look so silly.', 4: 'My first class, writing me goodbye. Oh, my heart.' };
    this.say([[h.res.variant === 'child' ? 'Child' : 'Villager', lines[k]]], () => this.upd());
  }
  upd() {
    const n = this.homes.filter((h) => h.restored).length;
    if (n === this.homes.length && !this.done) {
      this.done = true;
      this.setObjective('The village is whole again.');
      this.say([['Healer Arin', 'You did it. Look at them.'], ['Healer Arin', "The mist still comes from the Memory Maze at the island's heart. Something there is forgetting on purpose."], ['Arin', "Then let's go remember."]], () => this.complete());
      return;
    }
    this.setObjective(`Find lost memories (photos, toys, letters) and return them to the fading homes (${n}/${this.homes.length})` + (this.carrying.length ? ` — carrying ${this.carrying.length}` : ''));
  }
  update(dt: number) {
    for (const h of this.homes) h.res.alpha = h.restored ? Math.min(1, h.res.alpha + dt) : 0.12 + Math.abs(Math.sin(this.t * 2 + h.x)) * 0.25;
    if (Math.random() < 0.05) this.g.particles.add({ x: rand(0, 1400), y: rand(100, 900), vx: rand(10, 30), vy: rand(5, 15), life: 4, size: 2.5, color: '#ffc0d8' });
  }
  drawBg(ctx: C) {
    const t = this.t;
    islandEdge(ctx, this.island, t);
    grass(ctx, this.island.x, this.island.y, this.island.w, this.island.h, 7);
    ctx.fillStyle = '#e8d8c0'; ctx.fillRect(40, 450, 1320, 50); ctx.fillRect(675, 100, 50, 760);
    for (const h of this.homes) {
      const a = h.restored ? 1 : 0.25 + Math.abs(Math.sin(t * 1.7 + h.x)) * 0.3;
      house(ctx, h.x, h.y, h.color, a);
      if (!h.restored) { itemIcon(ctx, h.item, h.x, h.y - 110, t); }
    }
    for (const it of this.items) if (!it.got) itemIcon(ctx, it.kind, it.x, it.y, t);
    // mist at edges
    const g = ctx.createRadialGradient(700, 480, 300, 700, 480, 800);
    g.addColorStop(0, 'rgba(240,230,245,0)'); g.addColorStop(1, `rgba(240,230,245,${0.75 - this.homes.filter((h) => h.restored).length * 0.12})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1400, 900);
  }
}

// ===================================================================== MEMORY MAZE
const MEMORIES: { real: string; fakes: [string, string] }[] = [
  { real: 'The cave: Orion barking at the glowing rock, tugging at your sleeve, trying to stop you.', fakes: ['The cave: Orion asleep at home while you explored alone.', 'The cave: Orion running in first, chasing the light.'] },
  { real: "His first night home: he cried until you slept on the floor beside him.", fakes: ['His first night home: he slept soundly in his brand-new bed.', 'His first night home: he hid under the porch and wouldn\'t come out.'] },
  { real: 'The last walk: too tired to climb the hill, so you carried him up to see the moon.', fakes: ['The last walk: he chased rabbits all the way to the top.', "There was no last walk. You were too busy."] },
];
export class L4Maze extends Stage {
  name = 'Memory Maze';
  room = 0;
  order: number[] = [];
  doors = [{ x: 220 }, { x: 480 }, { x: 740 }];
  swallow = 0;
  orion!: NPC;

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 520 };
    this.walls.push(R(0, 0, 960, 130), R(0, 580, 960, 20), R(0, 0, 40, 600), R(920, 0, 40, 600));
    this.orion = new NPC('dog', 430, 530); this.orion.old = true; this.orion.follow = this.p; this.orion.followDist = 50; this.orion.speed = 110;
    this.npcs.push(this.orion);
    this.doors.forEach((d, k) => this.interacts.push({ x: d.x, y: 175, r: 60, label: 'Step into this memory', action: () => this.choose(k) }));
    this.shuffle();
  }
  onEnter() {
    this.say([['', 'Rooms of memory. Each holds three versions of the past. Only one is true.'], ['Healer Arin', "(from somewhere far away) Trust your heart. The mist feeds on the false ones."]]);
    this.g.hint('Walk close to a doorway to read its memory. Step into the real one.');
  }
  shuffle() {
    const o = [0, 1, 2];
    for (let i = 2; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    this.order = o; // order[k] = 0 means real at door k
    this.setObjective(`Memory room ${this.room + 1}/3 — choose the REAL memory of Arin and Orion.`);
  }
  text(k: number) { const m = MEMORIES[this.room]; const v = this.order[k]; return v === 0 ? m.real : m.fakes[v - 1]; }
  choose(k: number) {
    if (this.swallow > 0) return;
    if (this.order[k] === 0) {
      this.g.sfx('success');
      this.g.flashScreen('rgba(255,240,250,0.7)', 0.5);
      this.room++;
      if (this.room >= 3) {
        this.controlLocked = true;
        this.say([['Arin', 'I remember. All of it. Even the parts that hurt.']], () => this.g.playCutscene('night4', () => this.complete()));
        return;
      }
      this.p.x = 480; this.p.y = 520; this.orion.x = 430; this.orion.y = 530;
      this.shuffle();
    } else {
      this.swallow = 1.5;
      this.g.sfx('fail');
      this.say([['', "That's not how it happened. The mist swirls and swallows the room."]]);
    }
  }
  update(dt: number) {
    if (this.swallow > 0) {
      this.swallow -= dt;
      if (this.swallow <= 0) { this.p.x = 480; this.p.y = 520; this.shuffle(); }
    }
  }
  drawBg(ctx: C) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, '#d8b0d8'); g.addColorStop(1, '#f6d8e6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 600);
    // floating frames
    const r = mulberry32(this.room + 3);
    for (let i = 0; i < 10; i++) { const x = r() * 960, y = 140 + r() * 400; ctx.save(); ctx.translate(x, y + Math.sin(t + i) * 6); ctx.rotate(Math.sin(t * 0.3 + i) * 0.2); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(-14, -10, 28, 20); ctx.restore(); }
    ctx.fillStyle = '#c8a0c8'; ctx.fillRect(0, 0, 960, 130);
    this.label(ctx, `MEMORY ROOM ${this.room + 1}`, 480, 40, '#fff', 14);
    this.doors.forEach((d, k) => {
      ctx.save();
      rr(ctx, d.x - 60, 40, 120, 110, 10); ctx.fillStyle = 'rgba(255,245,250,0.85)'; ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, d.x, 110, 90, '255,220,240', 0.3 + 0.1 * Math.sin(t * 2 + k)); ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // tiny vignette symbol per door
      ctx.fillStyle = '#c98a3e'; ctx.beginPath(); ctx.ellipse(d.x, 110, 14, 7, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(d.x + 12, 102, 5, 0, TAU); ctx.fill();
    });
  }
  drawScreen(ctx: C) {
    // show memory text of nearest door
    const p = this.p;
    const cam = this.g.cam;
    this.doors.forEach((d, k) => {
      if (dist(p.x, p.y, d.x, 175) < 120) {
        const txt = this.text(k);
        const x = d.x - cam.x, y = 220;
        ctx.font = '13px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
        const words = txt.split(' '); const lines: string[] = []; let cur = '';
        for (const w of words) { if ((cur + ' ' + w).length > 30) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
        lines.push(cur);
        ctx.fillStyle = 'rgba(60,30,60,0.75)'; rr(ctx, x - 130, y - 16, 260, lines.length * 18 + 14, 8); ctx.fill();
        ctx.fillStyle = '#fff';
        lines.forEach((l, i) => ctx.fillText(l, x, y + 4 + i * 18));
      }
    });
    if (this.swallow > 0) { ctx.fillStyle = `rgba(245,235,245,${Math.min(1, (1.5 - this.swallow) * 1.5)})`; ctx.fillRect(0, 0, 960, 600); }
  }
}

// ===================================================================== THE MIST
export class L4Mist extends Stage {
  name = 'The Mist';
  radius = 430;
  lamps = [{ x: 200, y: 200 }, { x: 760, y: 200 }, { x: 120, y: 420 }, { x: 840, y: 420 }, { x: 330, y: 540 }, { x: 630, y: 540 }].map((l) => ({ ...l, fuel: 0 }));
  orion!: NPC; healer!: NPC;
  fadeO = 0; fadeH = 0;
  survive = 70;
  callCd = 0;
  done = false;
  wanderT = 0;
  rings: { r: number; a: number }[] = [];

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 480, y: 360 };
    this.walls.push(R(0, 0, 960, 110), R(0, 590, 960, 10), R(0, 0, 20, 600), R(940, 0, 20, 600));
    this.darkness = 0.92; this.darkRGB = '238,228,242'; this.playerLight = 90;
    this.orion = new NPC('dog', 440, 380); this.orion.old = true; this.orion.speed = 50;
    this.healer = new NPC('healer', 520, 380); this.healer.speed = 55;
    this.npcs.push(this.orion, this.healer);
    this.lamps.forEach((l, k) => this.interacts.push({ x: l.x, y: l.y + 10, r: 42, label: 'Light / refill the lamp', action: () => { l.fuel = 15; this.g.sfx('lamp'); this.g.particles.burst(l.x, l.y - 30, 16, '#ffe0a0', 100, 0.6, 3); } }));
    this.setObjective('Keep Orion and Healer Arin out of the mist! Light lamps (E) and press Space to call out to them.');
  }
  onEnter() {
    this.say([['Healer Arin', "Arin — the mist! I can't see! Orion, where are you?"], ['', 'They wander, lost and confused. Light the lamps. Call out to them.']]);
    this.g.hint('E = light/refill lamps · Space (away from lamps) = call out: they walk to you and the mist recoils.');
  }
  inMist(x: number, y: number) {
    if (dist(x, y, 480, 360) < this.radius) return false;
    return !this.lamps.some((l) => l.fuel > 0 && dist(x, y, l.x, l.y) < 110);
  }
  update(dt: number) {
    if (this.done) return;
    const p = this.p;
    this.survive -= dt;
    this.radius = Math.max(110, this.radius - dt * 6.5);
    this.callCd -= dt;
    for (const l of this.lamps) l.fuel = Math.max(0, l.fuel - dt);
    const nearLamp = this.lamps.some((l) => dist(p.x, p.y, l.x, l.y + 10) < 42);
    if (this.g.input.hit('Space') && !nearLamp && this.callCd <= 0) {
      this.callCd = 2.5;
      this.radius = Math.min(430, this.radius + 45);
      this.rings.push({ r: 10, a: 1 });
      this.g.sfx('bell');
      for (const n of [this.orion, this.healer]) if (dist(n.x, n.y, p.x, p.y) < 420) { n.target = { x: p.x + rand(-30, 30), y: p.y + rand(-20, 20) }; }
      this.say([['Arin', ['Orion! Here, boy!', 'Over here! Follow my voice!', "I'm right here — come to me!"][Math.floor(Math.random() * 3)]]]);
    }
    for (const r of this.rings) { r.r += dt * 500; r.a -= dt * 1.2; }
    this.rings = this.rings.filter((r) => r.a > 0);
    // confused wandering toward the mist
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = rand(2, 3.5);
      for (const n of [this.orion, this.healer]) {
        if (!n.target || Math.random() < 0.6) { const a = rand(0, TAU); n.target = { x: clamp(480 + Math.cos(a) * rand(200, 420), 40, 920), y: clamp(360 + Math.sin(a) * rand(120, 240), 130, 580) }; }
      }
    }
    this.fadeO = clamp(this.fadeO + (this.inMist(this.orion.x, this.orion.y) ? dt * 0.16 : -dt * 0.1), 0, 1);
    this.fadeH = clamp(this.fadeH + (this.inMist(this.healer.x, this.healer.y) ? dt * 0.16 : -dt * 0.1), 0, 1);
    this.orion.alpha = 1 - this.fadeO * 0.8; this.healer.alpha = 1 - this.fadeH * 0.8;
    if (this.fadeO >= 1 || this.fadeH >= 1) {
      this.done = true;
      this.say([['', `${this.fadeO >= 1 ? 'Orion' : 'Healer Arin'} fades into the mist...`], ['Arin', 'NO! ...Again. I can do this again.']], () => this.g.restartStage());
      return;
    }
    if (this.survive <= 0) {
      this.done = true;
      this.g.sfx('success');
      this.say([['', 'Dawn breaks through. The mist pulls back, hissing, and dissolves.'], ['Healer Arin', '...You found us. You kept calling.'], ['Healer Arin', "Something is still here, though. Over by the cliff. It isn't attacking. It's... waiting for you."]], () => this.complete());
    }
  }
  lights(): Light[] {
    const L: Light[] = [{ x: 480, y: 360, r: this.radius * 1.15, a: 1 }];
    for (const l of this.lamps) if (l.fuel > 0) L.push({ x: l.x, y: l.y, r: 150 * Math.min(1, l.fuel / 3 + 0.4), rgb: '255,220,150' });
    return L;
  }
  meters(): MeterView[] {
    return [
      { label: 'Until dawn', value: 1 - this.survive / 70, color: '#ffd6a0' },
      { label: 'Orion fading', value: this.fadeO, color: '#f2c94c' },
      { label: 'Healer fading', value: this.fadeH, color: '#8fe0b0' },
    ];
  }
  drawBg(ctx: C) {
    const t = this.t;
    ctx.fillStyle = '#f6c6d6'; ctx.fillRect(0, 0, 960, 600);
    grass(ctx, 20, 110, 920, 480, 11);
    ctx.fillStyle = '#d8a8c0'; ctx.fillRect(0, 0, 960, 110);
    for (const l of this.lamps) {
      ctx.fillStyle = '#5a4a5a'; ctx.fillRect(l.x - 3, l.y - 40, 6, 40);
      ctx.fillStyle = l.fuel > 0 ? '#ffe0a0' : '#7a6a7a'; ctx.fillRect(l.x - 8, l.y - 54, 16, 16);
      if (l.fuel > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, l.x, l.y - 46, 40, '255,220,150', 0.8); ctx.globalCompositeOperation = 'source-over'; }
      if (l.fuel > 0 && l.fuel < 4) this.label(ctx, 'low', l.x, l.y - 60, '#a06a3a', 10);
    }
  }
  drawFg(ctx: C) {
    for (const r of this.rings) { ctx.strokeStyle = `rgba(255,220,180,${r.a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.p.x, this.p.y - 20, r.r, 0, TAU); ctx.stroke(); }
  }
}

// ===================================================================== THE ECHO CHOICE
export class L4Choice extends Stage {
  name = 'The Echo Choice';
  echo = { x: 760, y: 300, fade: 0, mode: '' as '' | 'ignore' | 'answer' | 'fight' };
  orion!: NPC; healer!: NPC;
  done = false;
  island = R(60, 140, 840, 400);

  setup() {
    this.w = 960; this.h = 600;
    this.spawn = { x: 200, y: 360 };
    const i = this.island;
    this.walls.push(R(0, 0, 960, i.y), R(0, i.y + i.h, 960, 600), R(0, 0, i.x, 600), R(i.x + i.w, 0, 960 - i.x - i.w, 600));
    this.orion = new NPC('dog', 150, 380); this.orion.old = true; this.orion.dogPose = 'sit';
    this.healer = new NPC('healer', 140, 320); this.healer.facing = 'right';
    this.npcs.push(this.orion, this.healer);
    this.interacts.push({ x: 760, y: 300, r: 60, label: 'Approach the Echo', enabled: () => !this.done, action: () => this.ask() });
    this.setObjective('A passive Echo sits at the cliff edge. Approach it.');
  }
  ask() {
    this.say([['Echo', '...You again.'], ['Echo', "Why keep going? It all ends anyway."]], () => {
      this.g.choice('How do you respond?', ['Ignore — walk past it.', 'Answer — tell it why.', 'Fight — strike it down.'], (k) => {
        const c = (['ignore', 'answer', 'fight'] as const)[k];
        this.g.save.echoChoice = c;
        this.done = true;
        this.echo.mode = c;
        if (c === 'ignore') this.say([['Arin', '...'], ['', 'Arin walks past without a word. The Echo watches him go, and slowly fades.']], () => this.finish());
        else if (c === 'answer') this.say([['Arin', "Because it mattered while it lasted. Because he mattered."], ['Arin', "Everything ends. That's not a reason to stop loving it. That's the reason TO."], ['Echo', '...He used to believe that.'], ['', 'The Echo softens, almost smiling, and dissolves like breath on glass.']], () => this.finish());
        else { this.g.sfx('hit'); this.g.shakeScreen(8); this.g.particles.burst(this.echo.x, this.echo.y - 20, 40, '#6c6cff', 220, 0.8, 4); this.say([['', 'Arin strikes. The Echo doesn\'t defend itself. It shatters with a thin, tired sound.'], ['Healer Arin', '...Arin. It wasn\'t fighting.']], () => this.finish()); }
      });
    });
  }
  finish() {
    this.controlLocked = true;
    this.g.playCutscene('last4', () => this.complete());
  }
  update(dt: number) {
    if (this.echo.mode) this.echo.fade = Math.min(1, this.echo.fade + dt * (this.echo.mode === 'fight' ? 4 : 0.5));
  }
  drawBg(ctx: C) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, '#6a4a7a'); g.addColorStop(1, '#e8a8b8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 600);
    ctx.fillStyle = '#fff6f0'; ctx.beginPath(); ctx.arc(820, 90, 60, 0, TAU); ctx.fill();
    grass(ctx, this.island.x, this.island.y, this.island.w, this.island.h, 21);
    ctx.fillStyle = '#b48a9a'; ctx.fillRect(this.island.x, this.island.y + this.island.h, this.island.w, 24);
    ctx.fillStyle = 'rgba(40,30,60,0.25)'; ctx.fillRect(0, 0, 960, 600);
    void t;
  }
  sprites(): Sprite[] {
    return [{ y: this.echo.y, draw: (c) => { if (this.echo.fade < 1) { c.save(); c.globalAlpha = 1 - this.echo.fade; drawEcho(c, this.echo.x, this.echo.y, this.t * 0.4, 1); c.restore(); } } }];
  }
}
void drawCharacter; void doorGlow; void arrowHint;
