import { TAU, mulberry32 } from './util';

export type Variant = 'arin' | 'engineer' | 'warrior' | 'genius' | 'healer' | 'hollow' | 'young' | 'villager' | 'child';
export type Facing = 'down' | 'up' | 'left' | 'right';

interface Pal { coat: string; shirt: string; pants: string; skin: string; hair: string; shoe: string }
const PALS: Record<Variant, Pal> = {
  arin: { coat: '#e9eef5', shirt: '#3b6ea8', pants: '#2b3445', skin: '#f0c8a0', hair: '#4a3426', shoe: '#1d1f26' },
  engineer: { coat: '#c8742c', shirt: '#6b4a32', pants: '#3a2f28', skin: '#e8bb92', hair: '#4a3426', shoe: '#2a1d14' },
  warrior: { coat: '#2f6f73', shirt: '#1c3f45', pants: '#25303a', skin: '#d6a47a', hair: '#3a2a20', shoe: '#14181c' },
  genius: { coat: '#5b3f8c', shirt: '#3e2a63', pants: '#3e2a63', skin: '#f2d2b0', hair: '#7a6a5e', shoe: '#20182c' },
  healer: { coat: '#5fae8a', shirt: '#4d9677', pants: '#4d9677', skin: '#f0c8a0', hair: '#4a3426', shoe: '#e8e8e8' },
  hollow: { coat: '#16161f', shirt: '#0d0d14', pants: '#101018', skin: '#b9bec8', hair: '#26262e', shoe: '#050508' },
  young: { coat: '#c0392b', shirt: '#c0392b', pants: '#34495e', skin: '#f0c8a0', hair: '#4a3426', shoe: '#1d1f26' },
  villager: { coat: '#d7a6c4', shirt: '#a77fb0', pants: '#6b5a80', skin: '#efc6a6', hair: '#2e2433', shoe: '#2e2433' },
  child: { coat: '#8aa0b0', shirt: '#6f8797', pants: '#4b5a66', skin: '#e2b48e', hair: '#2b221c', shoe: '#222' },
};

export interface CharOpts {
  variant?: Variant; facing?: Facing; walk?: number; scale?: number; alpha?: number; hood?: boolean;
  tint?: string; spirit?: string; blocking?: boolean; attack?: number; pose?: 'stand' | 'kneel' | 'reach' | 'cry';
  palOverride?: Partial<Pal>;
}

/** Draws a stylised character with the feet at (x, y). Base height ≈ 40px * scale. */
export function drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, o: CharOpts = {}) {
  const v = o.variant ?? 'arin';
  const p = { ...PALS[v], ...(o.palOverride || {}) };
  const f = o.facing ?? 'down';
  const sc = (o.scale ?? 1) * (v === 'young' || v === 'child' ? 0.74 : 1);
  const w = o.walk ?? 0;
  const sw = Math.sin(w) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.globalAlpha *= o.alpha ?? 1;
  if (o.spirit) {
    ctx.shadowColor = o.spirit; ctx.shadowBlur = 16;
  }
  const kneel = o.pose === 'kneel';
  if (kneel) ctx.translate(0, 8);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 4, 0, 0, TAU); ctx.fill();
  const side = f === 'left' ? -1 : f === 'right' ? 1 : 0;
  // legs
  ctx.fillStyle = p.pants;
  if (kneel) {
    ctx.fillRect(-7, -8, 14, 6);
  } else if (side) {
    ctx.fillRect(-3 + sw * 0.6, -11, 5, 10); ctx.fillRect(-2 - sw * 0.6, -11, 5, 10);
    ctx.fillStyle = p.shoe; ctx.fillRect(-3 + sw * 0.6 + (side > 0 ? 1 : -1), -2, 6, 3); ctx.fillRect(-2 - sw * 0.6 + (side > 0 ? 1 : -1), -2, 6, 3);
  } else {
    ctx.fillRect(-6, -11 - Math.max(0, sw) * 0.4, 5, 10); ctx.fillRect(1, -11 - Math.max(0, -sw) * 0.4, 5, 10);
    ctx.fillStyle = p.shoe; ctx.fillRect(-6, -2, 5, 3); ctx.fillRect(1, -2, 5, 3);
  }
  // body
  const robe = v === 'genius' || v === 'hollow';
  ctx.fillStyle = p.shirt;
  rr(ctx, -8, -26, 16, 16, 4); ctx.fill();
  ctx.fillStyle = p.coat;
  if (v === 'arin') {
    // lab coat panels
    ctx.fillRect(-9, -25, 5, 19); ctx.fillRect(4, -25, 5, 19);
    if (f === 'up') ctx.fillRect(-9, -25, 18, 19);
  } else if (robe) {
    ctx.beginPath(); ctx.moveTo(-9, -25); ctx.lineTo(9, -25); ctx.lineTo(11, -3); ctx.lineTo(-11, -3); ctx.closePath(); ctx.fill();
    if (v === 'genius') { ctx.fillStyle = '#d4af37'; ctx.fillRect(-1, -25, 2, 21); }
  } else if (v === 'warrior') {
    rr(ctx, -9, -26, 18, 10, 3); ctx.fill();
    ctx.fillStyle = '#9fb7b9'; ctx.fillRect(-9, -18, 18, 3);
  } else if (v === 'engineer') {
    ctx.fillRect(-8, -24, 16, 13);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-8, -14, 16, 3);
    ctx.fillStyle = '#d9c27a'; ctx.fillRect(-2, -14, 4, 3);
  } else {
    rr(ctx, -8, -26, 16, 16, 4); ctx.fill();
  }
  if (v === 'healer') { ctx.strokeStyle = '#ccd'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -22, 5, 0.2, Math.PI - 0.2); ctx.stroke(); }
  // arms
  ctx.fillStyle = p.coat === '#e9eef5' ? '#dfe6ee' : p.coat;
  const armSw = side ? 0 : sw;
  const atk = o.attack ?? 0;
  if (o.blocking) {
    ctx.fillRect(-11, -24, 4, 8); ctx.fillRect(7, -24, 4, 8);
  } else if (o.pose === 'reach') {
    ctx.fillRect(-12, -24, 4, 11); ctx.save(); ctx.translate(8, -24); ctx.rotate(-1.2); ctx.fillRect(0, 0, 4, 13); ctx.restore();
  } else if (o.pose === 'cry') {
    ctx.fillRect(-7, -30, 4, 10); ctx.fillRect(3, -30, 4, 10);
  } else {
    ctx.fillRect(-12, -24 + armSw * 0.5, 4, 12); ctx.fillRect(8, -24 - armSw * 0.5 - atk * 6, 4, 12);
  }
  ctx.fillStyle = p.skin;
  if (!o.blocking && o.pose !== 'cry' && o.pose !== 'reach') { ctx.fillRect(-12, -13 + armSw * 0.5, 4, 3); ctx.fillRect(8, -13 - armSw * 0.5 - atk * 6, 4, 3); }
  // head
  const hy = -34;
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(0, hy, 8.5, 0, TAU); ctx.fill();
  // hair
  ctx.fillStyle = p.hair;
  if (o.hood) {
    ctx.fillStyle = p.coat;
    ctx.beginPath(); ctx.arc(0, hy - 1, 11, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(10, hy + 8); ctx.lineTo(-10, hy + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#05050a';
    ctx.beginPath(); ctx.ellipse(side * 2, hy + 1, 6.5, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,220,255,0.9)';
    if (f !== 'up') { ctx.fillRect(-3 + side * 2, hy, 2, 1.5); ctx.fillRect(2 + side * 2, hy, 2, 1.5); }
  } else {
    if (f === 'up') {
      ctx.beginPath(); ctx.arc(0, hy, 9, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, hy - 2, 9, Math.PI, TAU); ctx.fill();
      // messy spikes
      ctx.beginPath(); ctx.moveTo(-9, hy - 3); ctx.lineTo(-6, hy - 12); ctx.lineTo(-2, hy - 8); ctx.lineTo(1, hy - 13); ctx.lineTo(4, hy - 8); ctx.lineTo(8, hy - 11); ctx.lineTo(9, hy - 3); ctx.fill();
      if (side) { ctx.fillRect(side > 0 ? -9 : 4, hy - 4, 5, 6); }
      if (v === 'genius') { ctx.fillRect(-9, hy - 3, 3, 12); ctx.fillRect(6, hy - 3, 3, 12); ctx.fillStyle = '#bbb'; ctx.fillRect(-9, hy - 2, 2, 6); }
      if (v === 'villager') { ctx.fillRect(-10, hy - 3, 4, 14); ctx.fillRect(6, hy - 3, 4, 14); }
    }
    // face
    if (f !== 'up') {
      const ex = side * 3;
      ctx.fillStyle = v === 'hollow' ? '#0a0a12' : '#222';
      if (side) { ctx.fillRect(ex + side * 1.5, hy - 1, 2, 2.4); }
      else { ctx.fillRect(-4, hy - 1, 2, 2.4); ctx.fillRect(2, hy - 1, 2, 2.4); }
      if (o.pose === 'cry') { ctx.fillStyle = '#8fd3ff'; ctx.fillRect(-4, hy + 2, 1.5, 4); ctx.fillRect(2.5, hy + 2, 1.5, 4); }
      if (v === 'genius') { ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(-3 + ex, hy, 2.6, 0, TAU); ctx.arc(3 + ex, hy, 2.6, 0, TAU); ctx.stroke(); }
      if (v === 'engineer') { ctx.fillStyle = '#6d5c3b'; ctx.fillRect(-8, hy - 8, 16, 3); ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(-3.5, hy - 6.5, 2.3, 0, TAU); ctx.arc(3.5, hy - 6.5, 2.3, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(30,20,10,0.35)'; ctx.fillRect(2, hy + 2, 4, 2); }
      if (v === 'warrior') { ctx.strokeStyle = '#a04848'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-5 + ex, hy - 5); ctx.lineTo(-1 + ex, hy + 4); ctx.stroke(); }
      if (v === 'arin' || v === 'healer') { ctx.fillStyle = 'rgba(80,50,30,0.25)'; ctx.fillRect(-3 + ex, hy + 4, 6, 1.2); }
    }
  }
  if (v === 'warrior') {
    ctx.strokeStyle = '#aab'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -32); ctx.stroke();
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(-10, -9, 4, 3);
  }
  ctx.restore();
}

export interface DogOpts { scale?: number; dir?: 1 | -1; pose?: 'stand' | 'sit' | 'lie' | 'walk' | 'bark' | 'sleep'; t?: number; old?: boolean; puppy?: boolean; alpha?: number; collarGlow?: number; spirit?: string }
/** Orion — golden-brown dog, side view, feet at (x,y). */
export function drawOrion(ctx: CanvasRenderingContext2D, x: number, y: number, o: DogOpts = {}) {
  const sc = (o.scale ?? 1) * (o.puppy ? 0.6 : 1);
  const d = o.dir ?? 1;
  const t = o.t ?? 0;
  const pose = o.pose ?? 'stand';
  const body = '#c98a3e', light = '#e8b56e', dark = '#8a5a26';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc * d, sc);
  ctx.globalAlpha *= o.alpha ?? 1;
  if (o.spirit) { ctx.shadowColor = o.spirit; ctx.shadowBlur = 14; }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 4, 0, 0, TAU); ctx.fill();
  const lying = pose === 'lie' || pose === 'sleep';
  const by = lying ? -6 : pose === 'sit' ? -12 : -13;
  const breathe = Math.sin(t * (o.old ? 2 : 3)) * (lying ? 0.8 : 0.4);
  // tail
  const wag = pose === 'sleep' ? 0.2 : Math.sin(t * (o.old ? 6 : 12)) * 0.5;
  ctx.strokeStyle = body; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-13, by - 2);
  ctx.quadraticCurveTo(-20, by - 6 - wag * 6, -23 + wag * 2, by - 12 - wag * 4); ctx.stroke();
  // legs
  ctx.fillStyle = dark;
  if (!lying) {
    const lw = pose === 'walk' ? Math.sin(t * 10) * 3 : 0;
    if (pose === 'sit') { ctx.fillRect(-12, by + 2, 9, 10); ctx.fillRect(7, by + 1, 4, 11); ctx.fillRect(10, by + 1, 3, 11); }
    else { ctx.fillRect(-11 + lw, by + 3, 4, 10); ctx.fillRect(-7 - lw, by + 3, 4, 10); ctx.fillRect(7 - lw, by + 3, 4, 10); ctx.fillRect(11 + lw, by + 3, 4, 10); }
  } else {
    ctx.fillRect(8, by + 3, 12, 3); ctx.fillRect(-12, by + 3, 10, 3);
  }
  // body
  ctx.fillStyle = body;
  ctx.beginPath();
  if (pose === 'sit') { ctx.ellipse(-1, by - 2, 12, 9 + breathe, -0.5, 0, TAU); }
  else ctx.ellipse(0, by, 15, 7.5 + breathe, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.ellipse(2, by + 3, 9, 3, 0, 0, TAU); ctx.fill();
  // head
  const hx = lying ? 17 : 15, hy = lying ? by - 3 : pose === 'sit' ? by - 14 : by - 8;
  const bob = pose === 'bark' ? Math.abs(Math.sin(t * 14)) * -2 : 0;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(hx, hy + bob, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = o.old ? '#e9d8bf' : light;
  ctx.beginPath(); ctx.ellipse(hx + 6, hy + 2 + bob, 5, 3.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath(); ctx.arc(hx + 10.5, hy + 1 + bob, 1.8, 0, TAU); ctx.fill();
  if (pose === 'sleep') { ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + 1, hy - 1); ctx.lineTo(hx + 4, hy - 1); ctx.stroke(); }
  else { ctx.fillRect(hx + 2, hy - 2 + bob, 2, 2); }
  if (pose === 'bark' && Math.sin(t * 14) > 0) { ctx.fillStyle = '#7a2d2d'; ctx.fillRect(hx + 6, hy + 4 + bob, 4, 2); }
  // ear
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(hx - 3, hy + 2 + bob, 3, 6, 0.3, 0, TAU); ctx.fill();
  // collar
  ctx.fillStyle = '#b8323a';
  const cx = lying ? hx - 6 : hx - 5, cy = lying ? hy + 3 : hy + 5;
  ctx.fillRect(cx - 1, cy - 3 + bob * 0.5, 4, 8);
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath(); ctx.arc(cx + 1, cy + 6, 1.8, 0, TAU); ctx.fill();
  if (o.collarGlow) {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, cx + 1, cy + 4, 14 + o.collarGlow * 10, '255,210,120', 0.5 * o.collarGlow);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (pose === 'sleep') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '8px monospace';
    ctx.save(); ctx.scale(d, 1); ctx.fillText('z', (hx + 4) * d, hy - 10 - (t * 6) % 8); ctx.restore();
  }
  ctx.restore();
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a = 1) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.4, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawGear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, ang: number, color: string, hub = '#3b2a1a') {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  const tw = (Math.PI / teeth) * 0.9;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    ctx.lineTo(Math.cos(a - tw) * r * 0.86, Math.sin(a - tw) * r * 0.86);
    ctx.lineTo(Math.cos(a - tw * 0.6) * r, Math.sin(a - tw * 0.6) * r);
    ctx.lineTo(Math.cos(a + tw * 0.6) * r, Math.sin(a + tw * 0.6) * r);
    ctx.lineTo(Math.cos(a + tw) * r * 0.86, Math.sin(a + tw) * r * 0.86);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = hub;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, r * 0.12, 0, TAU); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, rgb = '170,235,255', cracked = false) {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r * 4 + Math.sin(t * 3) * r * 0.4, rgb, 0.55);
  ctx.globalCompositeOperation = prev;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, `rgb(${rgb})`); g.addColorStop(1, 'rgba(40,90,160,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (cracked) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath(); ctx.moveTo(x - r * 0.8, y - r * 0.2); ctx.lineTo(x - r * 0.2, y + r * 0.1); ctx.lineTo(x + r * 0.1, y - r * 0.5); ctx.lineTo(x + r * 0.7, y + r * 0.3); ctx.stroke();
  }
}

export function drawEcho(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, scale = 1, alpha = 1, stunned = false) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 4, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = t * 2 + i;
    ctx.fillStyle = `rgba(${10 + i * 3},${8 + i * 2},${22 + i * 4},${0.55})`;
    ctx.beginPath();
    ctx.ellipse(Math.sin(a) * 4, -18 - i * 3 + Math.cos(a * 1.3) * 2, 11 - i * 0.8, 12 - i, 0, 0, TAU);
    ctx.fill();
  }
  // wisps
  ctx.strokeStyle = 'rgba(20,16,40,0.6)'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(-6 + i * 6, -6);
    ctx.quadraticCurveTo(-8 + i * 6 + Math.sin(t * 4 + i) * 5, 2, -4 + i * 6 + Math.sin(t * 3 + i) * 7, 6);
    ctx.stroke();
  }
  ctx.fillStyle = stunned ? '#ffd166' : '#e8f4ff';
  ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = 8;
  const blink = Math.sin(t * 1.7) > 0.97 ? 0.3 : 2.4;
  ctx.fillRect(-5, -36, 3, blink); ctx.fillRect(2, -36, 3, blink);
  ctx.restore();
}

/** Static starfield seeded so it doesn't flicker */
export function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, seed = 7, count = 160, ox = 0, oy = 0) {
  const r = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = (r() * w + ox) % w, y = (r() * h + oy) % h, s = r() * 1.6 + 0.3, tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.65})`;
    ctx.fillRect(x, y, s, s);
  }
}

export function drawPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 3) * 2); ctx.rotate(Math.sin(t) * 0.1); ctx.scale(scale, scale);
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, 0, 26, '255,220,150', 0.45);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f7f1e3'; ctx.fillRect(-9, -11, 18, 21);
  ctx.fillStyle = '#7fb2d9'; ctx.fillRect(-7, -9, 14, 12);
  ctx.fillStyle = '#c98a3e'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(4, -2, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawLightning(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number, width = 2, color = 'rgba(255,255,255,0.95)') {
  const r = mulberry32(seed);
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1);
  const n = 12;
  for (let i = 1; i <= n; i++) {
    const tt = i / n;
    ctx.lineTo(x1 + (x2 - x1) * tt + (i < n ? (r() - 0.5) * 30 : 0), y1 + (y2 - y1) * tt + (i < n ? (r() - 0.5) * 18 : 0));
  }
  ctx.stroke();
}

export function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, a = 0.6) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
