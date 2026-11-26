// Shared cinematic backdrops for cutscenes (side-view, 960x600).
import { drawStars, drawGear, glow, drawOrb, rr } from './draw';
import { TAU, mulberry32, smooth } from './util';

type C = CanvasRenderingContext2D;
export const GROUND = 470;

export function skyGrad(ctx: C, W: number, H: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/** jagged white crack across the sky. progress 0..1 */
export function skyCrack(ctx: C, W: number, y: number, progress: number, t: number, width = 3) {
  if (progress <= 0) return;
  const r = mulberry32(42);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) pts.push([(i / 24) * W, y + (r() - 0.5) * 60]);
  const n = Math.floor(progress * 24);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [lw, a] of [[width * 6, 0.08], [width * 3, 0.2], [width, 0.95]] as [number, number][]) {
    ctx.strokeStyle = `rgba(235,245,255,${a + Math.sin(t * 6) * 0.03})`; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (n < 24) { const f = progress * 24 - n; ctx.lineTo(pts[n][0] + (pts[n + 1][0] - pts[n][0]) * f, pts[n][1] + (pts[n + 1][1] - pts[n][1]) * f); }
    ctx.stroke();
  }
  ctx.restore();
}

export function mountains(ctx: C, W: number, base: number, color: string, amp = 120, seed = 1) {
  const r = mulberry32(seed);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 600);
  let y = base - r() * amp;
  for (let x = 0; x <= W + 40; x += 40) { y = base - amp * (0.3 + 0.7 * Math.abs(Math.sin(x * 0.004 + seed))) - r() * 20; ctx.lineTo(x, y); }
  ctx.lineTo(W, 600); ctx.fill();
}

export function nightSky(ctx: C, t: number, W: number, H: number, crack = 0) {
  skyGrad(ctx, W, H, [[0, '#02030c'], [0.55, '#0b1438'], [1, '#1f2350']]);
  drawStars(ctx, W, H * 0.8, t, 3, 220);
  skyCrack(ctx, W, 170, crack, t);
  if (crack > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, W / 2, 170, 400 * crack, '180,200,255', 0.08); ctx.globalCompositeOperation = 'source-over'; }
}

export function drawJumper(ctx: C, x: number, y: number, s: number, t: number, power = 0, lever = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // base
  ctx.fillStyle = '#3a4258'; rr(ctx, -50, -14, 100, 14, 4); ctx.fill();
  // pillars (frame)
  ctx.fillStyle = '#5a6684'; ctx.fillRect(-46, -110, 10, 96); ctx.fillRect(36, -110, 10, 96);
  ctx.fillStyle = '#6e7ca0'; ctx.fillRect(-46, -116, 92, 10);
  // signal ring
  ctx.strokeStyle = `rgba(120,220,255,${0.5 + power * 0.5})`; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, -62, 30, 0, TAU); ctx.stroke();
  if (power > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -62, 60 + power * 80, '150,230,255', 0.5 * power);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -62, 30, t * 4, t * 4 + 2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // core
  ctx.fillStyle = '#2a3042'; ctx.fillRect(-12, -30, 24, 16);
  ctx.fillStyle = `rgba(255,200,90,${0.6 + 0.4 * Math.sin(t * 5)})`; ctx.fillRect(-8, -27, 16, 10);
  // lever
  ctx.fillStyle = '#444b60'; ctx.fillRect(56, -40, 10, 40);
  ctx.save(); ctx.translate(61, -36); ctx.rotate(-0.7 + lever * 1.4);
  ctx.fillStyle = '#9aa3b8'; ctx.fillRect(-2, -26, 4, 26); ctx.fillStyle = '#d94f4f'; ctx.beginPath(); ctx.arc(0, -28, 5, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function dogBed(ctx: C, x: number, y: number, s: number, dusty = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = dusty ? '#4a4440' : '#7a4a3a';
  ctx.beginPath(); ctx.ellipse(0, -6, 34, 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = dusty ? '#5c5650' : '#a8705a';
  ctx.beginPath(); ctx.ellipse(0, -9, 26, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = dusty ? '#77706a' : '#d84a4a';
  ctx.beginPath(); ctx.arc(22, -16, 5, 0, TAU); ctx.fill(); // ball
  if (dusty) { ctx.fillStyle = 'rgba(180,170,160,0.25)'; ctx.fillRect(-30, -16, 60, 6); }
  ctx.restore();
}

export interface LabOpts { crack?: number; dusty?: boolean; dark?: boolean; morning?: boolean; jumper?: number; lever?: number; bed?: boolean; screen?: boolean; shake?: number }
export function lab(ctx: C, t: number, W: number, H: number, o: LabOpts = {}) {
  const wall = o.dusty ? '#1a1a1e' : o.dark ? '#0b0e18' : '#1b2233';
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
  // window
  ctx.save();
  ctx.beginPath(); ctx.rect(560, 80, 300, 220); ctx.clip();
  if (o.morning) skyGrad(ctx, W, 400, [[0, '#f6c78a'], [0.6, '#f3a77a'], [1, '#d98a7a']]);
  else { nightSky(ctx, t, W, 400, o.crack ?? 0); }
  if (o.dusty) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  ctx.strokeStyle = '#39405a'; ctx.lineWidth = 8; ctx.strokeRect(560, 80, 300, 220);
  ctx.beginPath(); ctx.moveTo(710, 80); ctx.lineTo(710, 300); ctx.moveTo(560, 190); ctx.lineTo(860, 190); ctx.stroke();
  // shelves
  ctx.fillStyle = o.dusty ? '#2a2724' : '#2b3349';
  ctx.fillRect(60, 110, 200, 8); ctx.fillRect(60, 180, 200, 8);
  const r = mulberry32(5);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = ['#6a7fb0', '#b0706a', '#7fb08a', '#c9b06a'][i % 4]; if (o.dusty) ctx.fillStyle = '#4a4540'; ctx.fillRect(66 + i * 15, 110 - 20 - r() * 14, 11, 20 + r() * 14 - (i % 3)); }
  ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.arc(200, 166, 10, 0, TAU); ctx.fill(); // globe
  // floor
  ctx.fillStyle = o.dusty ? '#242120' : '#252a38'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < W; x += 80) ctx.fillRect(x, GROUND, 2, H - GROUND);
  // desk
  const sh = o.shake ? Math.sin(t * 50) * o.shake : 0;
  ctx.fillStyle = o.dusty ? '#3a332c' : '#4a3a2c'; ctx.fillRect(70, 360, 280, 16); ctx.fillRect(80, 376, 12, 94); ctx.fillRect(328, 376, 12, 94);
  // monitor
  ctx.fillStyle = '#111'; ctx.fillRect(120, 270, 120, 86); ctx.fillRect(170, 356, 20, 6);
  const scr = o.screen === false ? '#0a0a0a' : o.dusty ? '#1a1f22' : '#0d3a52';
  ctx.fillStyle = scr; ctx.fillRect(126, 276, 108, 72);
  if (o.screen !== false && !o.dusty) {
    ctx.fillStyle = '#5fe0ff';
    for (let i = 0; i < 6; i++) ctx.fillRect(132, 284 + i * 10, 30 + ((i * 37 + Math.floor(t * 3)) % 60), 3);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 180, 312, 120, '80,200,255', o.dark ? 0.4 : 0.15); ctx.globalCompositeOperation = 'source-over';
  }
  // coffee mug
  ctx.save(); ctx.translate(290 + sh, 360);
  ctx.fillStyle = '#e8e8f0'; ctx.fillRect(-10, -22, 20, 22);
  ctx.strokeStyle = '#e8e8f0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(12, -12, 6, -1.4, 1.4); ctx.stroke();
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(-8, -20 + Math.abs(sh) * 0.4, 16, 3);
  if (!o.dusty) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-3 + i * 6, -26); ctx.quadraticCurveTo(-8 + i * 6 + Math.sin(t * 2 + i) * 4, -36, -2 + i * 6, -46); ctx.stroke(); } }
  ctx.restore();
  if (o.jumper !== undefined) drawJumper(ctx, 470, GROUND, 1.5, t, o.jumper, o.lever ?? 0);
  if (o.bed) dogBed(ctx, 800, GROUND + 30, 1.6, o.dusty);
  if (o.dusty) {
    const rr2 = mulberry32(9);
    ctx.fillStyle = 'rgba(200,190,170,0.25)';
    for (let i = 0; i < 40; i++) { const x = rr2() * W, y = (rr2() * H + t * 6 * (0.5 + rr2())) % H; ctx.fillRect(x, y, 1.5, 1.5); }
  }
  if (o.dark) { ctx.fillStyle = 'rgba(0,0,10,0.45)'; ctx.fillRect(0, 0, W, H); }
}

export function cave(ctx: C, t: number, W: number, H: number, glowAmt = 1) {
  skyGrad(ctx, W, H, [[0, '#120c0a'], [1, '#2a1c14']]);
  const r = mulberry32(13);
  ctx.fillStyle = '#1c130e';
  for (let i = 0; i < 18; i++) { const x = r() * W, h = 40 + r() * 120; ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x, h); ctx.lineTo(x + 20, 0); ctx.fill(); }
  ctx.fillStyle = '#2e2018'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#3b2a1e';
  for (let i = 0; i < 10; i++) { const x = r() * W; ctx.beginPath(); ctx.ellipse(x, GROUND + 10, 40 + r() * 40, 14, 0, 0, TAU); ctx.fill(); }
  // pedestal
  ctx.fillStyle = '#4a3a2e'; ctx.fillRect(560, GROUND - 60, 70, 60);
  ctx.fillStyle = '#5a4838'; ctx.fillRect(552, GROUND - 66, 86, 10);
  if (glowAmt > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 595, GROUND - 82, 260 * glowAmt, '120,220,255', 0.35);
    ctx.globalCompositeOperation = 'source-over';
  }
}

export function gearCity(ctx: C, t: number, W: number, H: number) {
  skyGrad(ctx, W, H, [[0, '#3a2412'], [0.5, '#a0602a'], [1, '#d99a4a']]);
  ctx.fillStyle = '#5a3418';
  for (let i = 0; i < 9; i++) { const x = i * 120 - 20, h = 180 + ((i * 53) % 120); ctx.fillRect(x, GROUND - h, 80, h); ctx.fillRect(x + 30, GROUND - h - 40, 20, 40); }
  drawGear(ctx, 160, 160, 90, 14, t * 0.3, '#7a4a20', '#4a2a10');
  drawGear(ctx, 290, 110, 50, 10, -t * 0.54, '#8a5a28', '#4a2a10');
  drawGear(ctx, 820, 200, 120, 18, -t * 0.2, '#6a3e1a', '#3a2010');
  // clock tower
  ctx.fillStyle = '#4a2a14'; ctx.fillRect(560, 60, 90, GROUND - 60);
  ctx.fillStyle = '#e8d6a8'; ctx.beginPath(); ctx.arc(605, 120, 32, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(605, 120); ctx.lineTo(605 + Math.cos(t) * 22, 120 + Math.sin(t) * 22); ctx.moveTo(605, 120); ctx.lineTo(605 + Math.cos(t / 12) * 14, 120 + Math.sin(t / 12) * 14); ctx.stroke();
  // steam
  for (let i = 0; i < 6; i++) { const y = (t * 30 + i * 40) % 200; ctx.fillStyle = `rgba(240,230,220,${0.25 * (1 - y / 200)})`; ctx.beginPath(); ctx.arc(420 + Math.sin(i + t) * 10, 260 - y, 14 + y * 0.1, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#3a2614'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#4a3220';
  for (let x = 0; x < W; x += 40) for (let y = GROUND; y < H; y += 20) ctx.fillRect(x + ((y / 20) % 2) * 20, y, 36, 16);
}

export function shore(ctx: C, t: number, W: number, H: number) {
  skyGrad(ctx, W, H, [[0, '#1a2a38'], [0.5, '#3b5568'], [1, '#6a8a98']]);
  // ruined skyscrapers
  ctx.fillStyle = '#25343f';
  [[80, 200, 60], [180, 140, 50], [700, 220, 70], [820, 170, 60], [620, 120, 40]].forEach(([x, h, w]) => { ctx.save(); ctx.translate(x, 330); ctx.rotate((x % 7) * 0.02 - 0.06); ctx.fillRect(0, -h, w, h); ctx.fillStyle = '#3a4f5c'; for (let y = -h + 10; y < -10; y += 18) for (let xx = 6; xx < w - 6; xx += 14) ctx.fillRect(xx, y, 6, 8); ctx.fillStyle = '#25343f'; ctx.restore(); });
  // sea
  ctx.fillStyle = '#1f4a5e'; ctx.fillRect(0, 320, W, 120);
  ctx.strokeStyle = 'rgba(200,240,255,0.3)'; ctx.lineWidth = 2;
  for (let row = 0; row < 5; row++) { ctx.beginPath(); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, 330 + row * 22 + Math.sin(x * 0.03 + t * 2 + row) * 3); ctx.stroke(); }
  // sand
  ctx.fillStyle = '#b8a27a'; ctx.beginPath(); ctx.moveTo(0, 430); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 430 + Math.sin(x * 0.01) * 8); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
}

export function brokenBoat(ctx: C, x: number, y: number, s: number, flip = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
  ctx.fillStyle = '#6a4a32'; ctx.beginPath(); ctx.moveTo(-60, -30); ctx.lineTo(60, -38); ctx.lineTo(44, 0); ctx.lineTo(-48, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a3222'; ctx.fillRect(-50, -34, 100, 5);
  ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(10, -36); ctx.lineTo(30, -36); ctx.lineTo(20, -12); ctx.fill();
  ctx.restore();
}

export function temple(ctx: C, t: number, W: number, H: number, carvingGlow = 0) {
  skyGrad(ctx, W, H, [[0, '#062636'], [1, '#021018']]);
  // stone wall
  ctx.fillStyle = '#3a4a4e'; ctx.fillRect(120, 60, 720, 420);
  ctx.strokeStyle = '#2a3638'; ctx.lineWidth = 2;
  for (let y = 60; y < 480; y += 40) { ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(840, y); ctx.stroke(); for (let x = 120 + ((y / 40) % 2) * 50; x < 840; x += 100) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 40); ctx.stroke(); } }
  carving(ctx, 480, 300, 1.6, carvingGlow, t);
  // light rays
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(120,220,255,${0.04 + 0.02 * Math.sin(t + i)})`; ctx.beginPath(); ctx.moveTo(200 + i * 150, 0); ctx.lineTo(260 + i * 150, 0); ctx.lineTo(320 + i * 150 - 100, H); ctx.lineTo(220 + i * 150 - 120, H); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  // bubbles
  const r = mulberry32(3);
  for (let i = 0; i < 30; i++) { const x = r() * W, y = (H - ((t * 30 * (0.5 + r())) + r() * H) % H); ctx.strokeStyle = 'rgba(200,240,255,0.4)'; ctx.beginPath(); ctx.arc(x, y, 2 + r() * 3, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#1a2a2e'; ctx.fillRect(0, GROUND, W, H - GROUND);
}

/** the carving: person holding orb with a dog beside him */
export function carving(ctx: C, x: number, y: number, s: number, glowAmt: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = `rgba(${150 + glowAmt * 100},${200 + glowAmt * 55},255,${0.5 + glowAmt * 0.5})`;
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // frame
  ctx.strokeRect(-120, -110, 240, 200);
  // person
  ctx.beginPath(); ctx.arc(-30, -60, 14, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-30, -46); ctx.lineTo(-30, 10); ctx.moveTo(-30, 10); ctx.lineTo(-46, 60); ctx.moveTo(-30, 10); ctx.lineTo(-14, 60);
  ctx.moveTo(-30, -30); ctx.lineTo(0, -50); ctx.moveTo(-30, -30); ctx.lineTo(-54, -6); ctx.stroke();
  // orb
  ctx.beginPath(); ctx.arc(8, -62, 12, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(8 + Math.cos(a) * 16, -62 + Math.sin(a) * 16); ctx.lineTo(8 + Math.cos(a) * 22, -62 + Math.sin(a) * 22); ctx.stroke(); }
  // dog
  ctx.beginPath(); ctx.ellipse(40, 40, 26, 12, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(68, 22, 10, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 50); ctx.lineTo(20, 64); ctx.moveTo(34, 52); ctx.lineTo(34, 64); ctx.moveTo(48, 52); ctx.lineTo(48, 64); ctx.moveTo(58, 50); ctx.lineTo(60, 64); ctx.moveTo(15, 36); ctx.quadraticCurveTo(0, 20, 4, 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(62, 16); ctx.lineTo(58, 32); ctx.stroke();
  if (glowAmt > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 8, -62, 50 + Math.sin(t * 3) * 6, '150,230,255', 0.5 * glowAmt); }
  ctx.restore();
}

export function library(ctx: C, t: number, W: number, H: number, loopTint = 0) {
  skyGrad(ctx, W, H, [[0, '#1a1024'], [1, '#2c1a2e']]);
  for (let layer = 0; layer < 3; layer++) {
    const sc = 0.5 + layer * 0.25, y0 = 80 + layer * 20;
    for (let i = 0; i < 12; i++) {
      const x = i * 100 * sc * 1.6 - 40 + layer * 30;
      ctx.fillStyle = ['#2a1a20', '#3a2228', '#4a2c30'][layer]; ctx.fillRect(x, y0, 70 * sc * 1.6, GROUND - y0);
      const r = mulberry32(i * 7 + layer);
      for (let sh = 0; sh < 6; sh++) for (let b = 0; b < 8; b++) {
        ctx.fillStyle = ['#7a3a3a', '#3a5a7a', '#6a6a3a', '#5a3a6a', '#3a6a5a'][Math.floor(r() * 5)];
        ctx.globalAlpha = 0.4 + layer * 0.25;
        ctx.fillRect(x + 4 + b * 13 * sc, y0 + 10 + sh * 50 * sc, 10 * sc, 40 * sc);
      }
      ctx.globalAlpha = 1;
    }
  }
  // floating books
  const r = mulberry32(77);
  for (let i = 0; i < 12; i++) {
    const x = r() * W, y = 80 + r() * 300 + Math.sin(t + i) * 10;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.5 + i) * 0.4);
    ctx.fillStyle = ['#c9a6ff', '#ffd166', '#7fd8ff'][i % 3]; ctx.fillRect(-12, -8, 24, 16);
    ctx.fillStyle = '#f4ecd8'; ctx.fillRect(-10, -6, 20, 12);
    ctx.restore();
  }
  // backwards clock
  ctx.fillStyle = '#e8d8b8'; ctx.beginPath(); ctx.arc(W / 2, 110, 46, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W / 2, 110); ctx.lineTo(W / 2 + Math.cos(-t * 2) * 36, 110 + Math.sin(-t * 2) * 36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2, 110); ctx.lineTo(W / 2 + Math.cos(-t / 6) * 24, 110 + Math.sin(-t / 6) * 24); ctx.stroke();
  ctx.fillStyle = '#3a2228'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#4a2c30'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, GROUND, 30, H - GROUND);
  if (loopTint) { ctx.fillStyle = `rgba(255,200,120,${loopTint})`; ctx.fillRect(0, 0, W, H); }
}

export function quietSky(ctx: C, t: number, W: number, H: number, mist = 0, night = false) {
  if (night) skyGrad(ctx, W, H, [[0, '#1a1438'], [0.6, '#4a2a5a'], [1, '#7a4a6a']]);
  else skyGrad(ctx, W, H, [[0, '#f3b8d0'], [0.5, '#f7d0d8'], [1, '#fbe6d8']]);
  // moon
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 700, 170, 260, '255,240,230', night ? 0.35 : 0.25);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = night ? '#f8f0e8' : '#fff6f0'; ctx.beginPath(); ctx.arc(700, 170, 110, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(220,200,210,0.5)'; ctx.beginPath(); ctx.arc(660, 140, 18, 0, TAU); ctx.arc(740, 200, 26, 0, TAU); ctx.arc(720, 120, 10, 0, TAU); ctx.fill();
  if (night) drawStars(ctx, W, 300, t, 21, 100);
  // floating islands far
  const isl = (x: number, y: number, s: number, c: string) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 60 * s, 14 * s, 0, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 50 * s, y); ctx.lineTo(x, y + 60 * s); ctx.lineTo(x + 50 * s, y); ctx.fill();
    ctx.fillStyle = '#9ad08a'; ctx.beginPath(); ctx.ellipse(x, y, 60 * s, 10 * s, 0, Math.PI, TAU); ctx.fill();
  };
  isl(150, 230 + Math.sin(t * 0.6) * 6, 0.8, '#b48a9a');
  isl(420, 300 + Math.sin(t * 0.5 + 1) * 6, 0.5, '#b48a9a');
  isl(880, 330 + Math.sin(t * 0.4 + 2) * 6, 0.6, '#b48a9a');
  // clouds
  for (let i = 0; i < 6; i++) { const x = ((i * 190 + t * 8) % (W + 200)) - 100, y = 380 + (i % 3) * 30; ctx.fillStyle = 'rgba(255,230,240,0.7)'; ctx.beginPath(); ctx.ellipse(x, y, 80, 18, 0, 0, TAU); ctx.ellipse(x + 40, y - 10, 50, 16, 0, 0, TAU); ctx.fill(); }
  // ground island
  ctx.fillStyle = '#8fc47e'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#7ab06a'; for (let x = 0; x < W; x += 14) ctx.fillRect(x, GROUND, 6, 4 + (x % 5));
  if (mist > 0) {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, `rgba(230,220,240,${mist})`); g.addColorStop(0.5, `rgba(230,220,240,${mist * 0.2})`); g.addColorStop(1, `rgba(230,220,240,${mist})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

export function voidBg(ctx: C, t: number, W: number, H: number, intensity = 1) {
  skyGrad(ctx, W, H, [[0, '#020205'], [1, '#0a0812']]);
  drawStars(ctx, W, H, t, 99, 60);
  const r = mulberry32(31);
  ctx.globalAlpha = 0.55 * intensity;
  for (let i = 0; i < 8; i++) {
    const x = r() * W, y = r() * H * 0.7, k = i % 4, bob = Math.sin(t * 0.4 + i) * 10;
    ctx.save(); ctx.translate(x, y + bob); ctx.rotate(Math.sin(t * 0.1 + i) * 0.2);
    if (k === 0) drawGear(ctx, 0, 0, 30, 10, t * 0.2, '#5a3a20', '#2a1a10');
    else if (k === 1) { ctx.fillStyle = '#25343f'; ctx.fillRect(-14, -40, 28, 60); }
    else if (k === 2) { ctx.fillStyle = '#5a3a6a'; ctx.fillRect(-12, -8, 24, 16); ctx.fillStyle = '#ddd'; ctx.fillRect(-10, -6, 20, 12); }
    else { ctx.fillStyle = '#7a6a7a'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 10, 0, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#5a7a5a'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 6, 0, Math.PI, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function fireScene(ctx: C, t: number, W: number, H: number) {
  quietSky(ctx, t, W, H, 0, true);
  ctx.fillStyle = 'rgba(10,6,20,0.35)'; ctx.fillRect(0, 0, W, H);
  // fire
  const fx = 480, fy = GROUND + 20;
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, fx, fy - 20, 260 + Math.sin(t * 9) * 12, '255,150,60', 0.35);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#4a2a1a'; ctx.fillRect(fx - 30, fy - 6, 60, 8);
  for (let i = 0; i < 5; i++) {
    const h = 30 + Math.sin(t * 10 + i * 2) * 10;
    ctx.fillStyle = i % 2 ? '#ffb347' : '#ff7a2f';
    ctx.beginPath(); ctx.moveTo(fx - 18 + i * 8, fy - 4); ctx.quadraticCurveTo(fx - 22 + i * 9, fy - h * 0.6, fx - 14 + i * 7 + Math.sin(t * 8 + i) * 3, fy - h); ctx.quadraticCurveTo(fx - 8 + i * 8, fy - h * 0.5, fx - 10 + i * 8, fy - 4); ctx.fill();
  }
  const r = mulberry32(8);
  for (let i = 0; i < 14; i++) { const y = (t * 40 * (0.6 + r()) + r() * 200) % 200; ctx.fillStyle = `rgba(255,200,120,${1 - y / 200})`; ctx.fillRect(fx - 20 + r() * 40 + Math.sin(t + i) * 8, fy - 20 - y, 2, 2); }
}

export function homeMorning(ctx: C, t: number, W: number, H: number) {
  ctx.fillStyle = '#3a3040'; ctx.fillRect(0, 0, W, H);
  // window with morning
  ctx.save(); ctx.beginPath(); ctx.rect(540, 70, 320, 240); ctx.clip();
  skyGrad(ctx, W, 400, [[0, '#9fd0f0'], [0.6, '#f6d6a8'], [1, '#f3b98a']]);
  mountains(ctx, W, 300, '#7a8aa8', 60, 4);
  ctx.restore();
  ctx.strokeStyle = '#5a4a50'; ctx.lineWidth = 8; ctx.strokeRect(540, 70, 320, 240);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,220,160,0.12)'; ctx.beginPath(); ctx.moveTo(540, 70); ctx.lineTo(860, 70); ctx.lineTo(700, 600); ctx.lineTo(260, 600); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#5a4a44'; ctx.fillRect(0, GROUND, W, H - GROUND);
  // bed/couch
  ctx.fillStyle = '#6a5a8a'; rr(ctx, 60, GROUND - 70, 300, 70, 14); ctx.fill();
  ctx.fillStyle = '#8a7aaa'; rr(ctx, 70, GROUND - 100, 90, 40, 12); ctx.fill();
}

export function whiteout(ctx: C, W: number, H: number, a: number) {
  ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, a))})`; ctx.fillRect(0, 0, W, H);
}

export function sepia(ctx: C, W: number, H: number, t: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(200,160,110,0.85)'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const r = mulberry32(Math.floor(t * 12));
  ctx.fillStyle = 'rgba(255,240,210,0.06)';
  for (let i = 0; i < 80; i++) ctx.fillRect(r() * W, r() * H, 2, 2);
  ctx.restore();
  const g = ctx.createRadialGradient(W / 2, H / 2, 150, W / 2, H / 2, 600);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,15,0,0.8)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

export function orbAt(ctx: C, x: number, y: number, r: number, t: number, rgb?: string) { drawOrb(ctx, x, y, r, t, rgb); }
export { smooth };
