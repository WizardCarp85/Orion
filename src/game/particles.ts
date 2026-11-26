import { TAU } from './util';

export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number;
  color: string; g?: number; drag?: number; glow?: boolean; shape?: 'circle' | 'square' | 'line';
}

export class Particles {
  list: Particle[] = [];
  add(p: Partial<Particle> & { x: number; y: number }) {
    if (this.list.length > 1400) this.list.shift();
    const life = p.life ?? 1;
    this.list.push({ vx: 0, vy: 0, size: 3, color: '#fff', max: life, life, ...p } as Particle);
  }
  burst(x: number, y: number, n: number, color: string, speed = 120, life = 0.6, size = 3, glow = true, g = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), size: size * (0.5 + Math.random()), color, glow, g, drag: 2 });
    }
  }
  clear() { this.list = []; }
  update(dt: number) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += (p.g ?? 0) * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  draw(ctx: CanvasRenderingContext2D) {
    const prev = ctx.globalCompositeOperation;
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * a);
      if (p.shape === 'square') ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      else if (p.shape === 'line') { ctx.strokeStyle = p.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }
}
