import { glow, rr } from '../draw';
import type { Rect } from '../util';

type C = CanvasRenderingContext2D;

/** 3/4-view block: top face + front face. */
export function block(ctx: C, x: number, y: number, w: number, h: number, top: string, front: string, height = 14) {
  ctx.fillStyle = front; ctx.fillRect(x, y + h - height, w, height);
  ctx.fillStyle = top; ctx.fillRect(x, y, w, h - height);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, y, w, 2);
}

export function shadowEllipse(ctx: C, x: number, y: number, rx: number, ry: number, a = 0.3) {
  ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

export function itemIcon(ctx: C, kind: string, x: number, y: number, t: number) {
  const bob = Math.sin(t * 3) * 3;
  ctx.save(); ctx.translate(x, y - 16 + bob);
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 30, '150,220,255', 0.4); ctx.globalCompositeOperation = 'source-over';
  switch (kind) {
    case 'core': ctx.fillStyle = '#2a3042'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = `rgba(255,200,90,${0.7 + 0.3 * Math.sin(t * 6)})`; ctx.fillRect(-6, -6, 12, 12); break;
    case 'ring': ctx.strokeStyle = '#7fe0ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke(); break;
    case 'frame': ctx.fillStyle = '#8a96b8'; ctx.fillRect(-10, -10, 4, 20); ctx.fillRect(6, -10, 4, 20); ctx.fillRect(-10, -12, 20, 4); break;
    case 'key': ctx.fillStyle = '#d8dce8'; ctx.beginPath(); ctx.arc(-5, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-1, -2, 14, 4); ctx.fillRect(9, 2, 3, 4); break;
    case 'shell': ctx.fillStyle = '#ffd6e8'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(10, 6); ctx.lineTo(-10, 6); ctx.fill(); break;
    case 'food': ctx.fillStyle = '#8a5a3a'; rr(ctx, -10, -4, 20, 8, 3); ctx.fill(); ctx.fillStyle = '#c98a3e'; ctx.fillRect(-7, -6, 14, 3); break;
    case 'toy': ctx.fillStyle = '#e05a5a'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); break;
    case 'letter': ctx.fillStyle = '#f7f1e3'; ctx.fillRect(-10, -7, 20, 14); ctx.strokeStyle = '#a88'; ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(0, 1); ctx.lineTo(10, -7); ctx.stroke(); break;
    case 'pic': ctx.fillStyle = '#f7f1e3'; ctx.fillRect(-8, -10, 16, 20); ctx.fillStyle = '#8ab'; ctx.fillRect(-6, -8, 12, 12); break;
    default: ctx.fillStyle = '#fff'; ctx.fillRect(-5, -5, 10, 10);
  }
  ctx.restore();
}

export function doorGlow(ctx: C, r: Rect, t: number, rgb = '150,230,255') {
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(${rgb},${0.25 + 0.15 * Math.sin(t * 4)})`;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'source-over';
}

export function arrowHint(ctx: C, x: number, y: number, t: number, color = '#9fe8ff') {
  ctx.fillStyle = color;
  const b = Math.sin(t * 5) * 4;
  ctx.beginPath(); ctx.moveTo(x - 8, y - 18 + b); ctx.lineTo(x + 8, y - 18 + b); ctx.lineTo(x, y - 6 + b); ctx.fill();
}
