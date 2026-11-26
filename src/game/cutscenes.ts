import type { Game } from './game';
import type { Mood, Sfx } from './audio';
import { drawCharacter, drawOrion, drawEcho, drawOrb, glow, drawGear, drawStars, rr, drawLightning, vignette } from './draw';
import {
  GROUND, nightSky, mountains, lab, cave, gearCity, shore, brokenBoat, temple, library, quietSky, voidBg, fireScene,
  homeMorning, whiteout, sepia, skyGrad, drawJumper, dogBed, carving,
} from './backdrops';
import { TAU, clamp, smooth, mulberry32, lerp } from './util';

type C = CanvasRenderingContext2D;
export interface Shot {
  dur?: number; lines?: [string, string][]; lineDelay?: number; tail?: number;
  draw: (ctx: C, t: number, W: number, H: number, g: Game) => void;
  sfx?: Sfx; onStart?: (g: Game) => void;
}
export interface CutsceneDef { title: string; mood?: Mood; shots: Shot[] }

const G = GROUND + 40;

function zoom(ctx: C, W: number, H: number, s: number, cx = W / 2, cy = H / 2) {
  ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
}
function caption(ctx: C, W: number, text: string, y = 80, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.font = '16px ui-monospace, monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,230,255,0.85)'; ctx.fillText(text, W / 2, y); ctx.restore();
}

// ---------------------------------------------------------------- LEVEL 0
const intro0: CutsceneDef = {
  title: '0A — The First Crack', mood: 'main',
  shots: [
    {
      dur: 7, sfx: 'rumble',
      draw: (ctx, t, W, H) => {
        ctx.save(); zoom(ctx, W, H, 1 + t * 0.035, W / 2, 200);
        nightSky(ctx, t, W, H, smooth((t - 2) / 3.5));
        mountains(ctx, W, 470, '#0b0f20', 130, 3);
        mountains(ctx, W, 520, '#070912', 90, 8);
        // observatory on peak
        ctx.fillStyle = '#141a2c'; ctx.fillRect(610, 330, 90, 60);
        ctx.fillStyle = '#1e2640'; ctx.beginPath(); ctx.arc(655, 330, 45, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = '#ffd58a'; ctx.fillRect(624, 350, 12, 10); ctx.fillRect(670, 350, 12, 10);
        ctx.restore();
        if (t > 2 && t < 2.3) whiteout(ctx, W, H, 0.3);
        caption(ctx, W, 'Mount Calder Observatory — 2:14 AM', 80, clamp(t / 1.5, 0, 1) * clamp((5 - t), 0, 1));
      },
      onStart: (g) => { window.setTimeout(() => g.audio.play('crack'), 2000); },
    },
    {
      dur: 4, lines: [['Arin', "That's not possible."]], lineDelay: 2,
      draw: (ctx, t, W, H) => {
        lab(ctx, t, W, H, { crack: 1, shake: 1.5 + Math.sin(t * 3), dark: true });
        drawCharacter(ctx, 640, G, { variant: 'arin', facing: 'up', scale: 3.2 });
      },
    },
  ],
};

const cave0: CutsceneDef = {
  title: '0B — The Memory', mood: 'main',
  shots: [
    {
      dur: 2, lines: [['Young Arin', "Look, Orion! It's glowing!"], ['Orion', 'Woof! Woof! WOOF!']],
      draw: (ctx, t, W, H) => {
        cave(ctx, t, W, H);
        drawOrb(ctx, 595, GROUND - 84, 12, t);
        drawCharacter(ctx, 380 + Math.min(t, 3) * 30, G, { variant: 'young', facing: 'right', scale: 3, walk: t < 3 ? t * 10 : 0 });
        drawOrion(ctx, 470 + Math.min(t, 3) * 10, G, { scale: 2.6, dir: 1, pose: 'bark', t, puppy: false });
        sepia(ctx, W, H, t);
      },
      onStart: (g) => { g.audio.play('bark'); window.setTimeout(() => g.audio.play('bark'), 700); },
    },
    {
      dur: 2, lines: [['', 'Orion tugged at his sleeve, barking at the glowing rock, trying to stop him.'], ['Young Arin', "It's okay, boy. It's just a rock."]],
      draw: (ctx, t, W, H) => {
        cave(ctx, t, W, H);
        drawOrb(ctx, 595, GROUND - 84, 12, t);
        drawCharacter(ctx, 520, G, { variant: 'young', facing: 'right', scale: 3, pose: 'reach' });
        drawOrion(ctx, 440, G, { scale: 2.6, dir: 1, pose: 'bark', t });
        sepia(ctx, W, H, t);
      },
      onStart: (g) => g.audio.play('bark'),
    },
    {
      dur: 4, lines: [['', 'He picked it up anyway.']], lineDelay: 2.2,
      draw: (ctx, t, W, H) => {
        cave(ctx, t, W, H, 1 + smooth(t / 2) * 1.5);
        const lift = smooth(t / 1.6) * 60;
        drawCharacter(ctx, 540, G, { variant: 'young', facing: 'right', scale: 3, pose: 'reach' });
        drawOrb(ctx, 595 - smooth(t / 1.6) * 20, GROUND - 84 - lift, 12 + lift * 0.05, t);
        drawOrion(ctx, 430, G, { scale: 2.6, dir: 1, pose: 'sit', t });
        sepia(ctx, W, H, t);
        whiteout(ctx, W, H, (t - 1.4) * 0.5 - 0.2);
      },
    },
  ],
};

const jump0: CutsceneDef = {
  title: '0C — The Jump', mood: 'main',
  shots: [
    {
      dur: 3, lines: [['Arin', "Five pieces, scattered across four other universes... I'll bring them back."], ['Arin', "...I wish you were here, boy."]],
      draw: (ctx, t, W, H) => {
        lab(ctx, t, W, H, { crack: 1, jumper: 0.4, bed: true });
        drawCharacter(ctx, 700, G, { variant: 'arin', facing: 'right', scale: 3.2 });
      },
    },
    {
      dur: 5.5, sfx: 'portal',
      draw: (ctx, t, W, H) => {
        const lev = smooth((t - 0.8) / 0.6);
        lab(ctx, t, W, H, { crack: 1, jumper: 0.4 + lev * 0.6, lever: lev, bed: true, shake: lev * 2 });
        drawCharacter(ctx, 540, G, { variant: 'arin', facing: 'right', scale: 3.2, pose: 'reach', alpha: 1 - smooth((t - 2.6) / 1.2) });
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, 470, GROUND - 90, smooth((t - 1.4) / 2) * 900, '255,255,255', 0.9);
        ctx.globalCompositeOperation = 'source-over';
        whiteout(ctx, W, H, (t - 2.5) * 0.6);
      },
    },
  ],
};

// ---------------------------------------------------------------- LEVEL 1
const intro1: CutsceneDef = {
  title: '1A — Same Face', mood: 'gear',
  shots: [
    {
      dur: 2, lines: [['Engineer Arin', 'You look terrible.'], ['Arin', 'You look exactly like me.'],
        ['Engineer Arin', "Name's Arin. Chief engineer of Gearfall, and apparently, you. Your shiny rock fell into our city's Heart Engine — and now everything's stopping."],
        ['Engineer Arin', "Rooftops, the Clock Tower, the Underworks, then the Heart. Try to keep up, handsome."]],
      draw: (ctx, t, W, H) => {
        gearCity(ctx, t, W, H);
        whiteout(ctx, W, H, 1 - t * 1.2);
        drawCharacter(ctx, 380, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        drawCharacter(ctx, 580, G, { variant: 'engineer', facing: 'left', scale: 3.2 });
        drawGear(ctx, 80, 560, 120, 16, t * 0.5, '#5a3418', '#2a1a10');
      },
    },
  ],
};

const heart1: CutsceneDef = {
  title: '1B — The Heart Starts', mood: 'gear',
  shots: [
    {
      dur: 6.5, sfx: 'bell',
      draw: (ctx, t, W, H) => {
        skyGrad(ctx, W, H, [[0, '#1a0e06'], [1, '#3a2010']]);
        // pipes network with racing light
        const pipes: [number, number, number, number][] = [[0, 150, 960, 150], [0, 300, 960, 300], [0, 450, 960, 450], [200, 0, 200, 600], [480, 0, 480, 600], [760, 0, 760, 600]];
        ctx.lineCap = 'round';
        for (const [x1, y1, x2, y2] of pipes) { ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
        const prog = smooth(t / 3);
        ctx.globalCompositeOperation = 'lighter';
        pipes.forEach(([x1, y1, x2, y2], i) => {
          const p = clamp(prog * 1.4 - i * 0.07, 0, 1);
          ctx.strokeStyle = 'rgba(255,200,90,0.9)'; ctx.lineWidth = 6;
          const cx = 480, cy = 300;
          // light spreads outward from center
          const ax = lerp(cx, x1, p), ay = lerp(cy, y1, p), bx = lerp(cx, x2, p), by = lerp(cy, y2, p);
          if (x1 === x2) { ctx.beginPath(); ctx.moveTo(x1, lerp(cy, y1, p)); ctx.lineTo(x1, lerp(cy, y2, p)); ctx.stroke(); }
          else { ctx.beginPath(); ctx.moveTo(lerp(cx, x1, p), y1); ctx.lineTo(lerp(cx, x2, p), y1); ctx.stroke(); }
          void ax; void ay; void bx; void by;
        });
        glow(ctx, 480, 300, 120 + prog * 300, '255,190,90', 0.6);
        // bell ring waves
        for (let i = 0; i < 4; i++) { const r = ((t * 200 + i * 150) % 600); ctx.strokeStyle = `rgba(255,220,150,${0.4 * (1 - r / 600)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(480, 300, r, 0, TAU); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over';
        drawGear(ctx, 480, 300, 80, 14, t * 2 * prog, '#c9963e', '#5a3a1e');
        caption(ctx, W, 'The engine wakes. Light races through the pipes. The whole city rings like a giant bell.', 520, clamp(t - 1.5, 0, 1));
      },
      onStart: (g) => { window.setTimeout(() => g.audio.play('bell'), 1800); g.shakeScreen(8); },
    },
  ],
};

const bye1: CutsceneDef = {
  title: '1C — Goodbye, Gears', mood: 'gear',
  shots: [
    {
      dur: 2, lines: [['Engineer Arin', "You'll need this. You always do."], ['Arin', "...Thanks. For everything."], ['Engineer Arin', 'Go save the universe, handsome. Ours owes you one.']],
      draw: (ctx, t, W, H) => {
        gearCity(ctx, t, W, H);
        drawCharacter(ctx, 400, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        drawCharacter(ctx, 560, G, { variant: 'engineer', facing: 'left', scale: 3.2, pose: 'reach' });
        // multi-tool
        ctx.save(); ctx.translate(500, G - 92); ctx.rotate(Math.sin(t * 2) * 0.1);
        ctx.fillStyle = '#c9963e'; ctx.fillRect(-20, -4, 40, 8); ctx.fillStyle = '#9aa3b8'; ctx.fillRect(14, -10, 6, 20); ctx.fillRect(-26, -6, 8, 12);
        ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 40, '255,210,120', 0.5); ctx.restore();
      },
    },
    {
      dur: 2.5, lines: [['Echo', '...Hurry.']], lineDelay: 1.6,
      draw: (ctx, t, W, H) => {
        gearCity(ctx, t, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
        const melt = smooth(t / 2.5);
        ctx.save(); ctx.translate(480, G); ctx.scale(1 + melt * 0.6, 1 - melt * 0.85);
        drawEcho(ctx, 0, 0, t, 3);
        ctx.restore();
        ctx.fillStyle = 'rgba(10,8,20,0.7)'; ctx.beginPath(); ctx.ellipse(480, G, 40 + melt * 80, 10 + melt * 6, 0, 0, TAU); ctx.fill();
      },
      onStart: (g) => g.audio.play('echo'),
    },
  ],
};

// ---------------------------------------------------------------- LEVEL 2
const intro2: CutsceneDef = {
  title: '2A — The Shore of Survivors', mood: 'ocean',
  shots: [
    {
      dur: 2, lines: [['', 'Arin lands hard on wet sand. Small faces peek from the broken boats.']],
      draw: (ctx, t, W, H) => {
        shore(ctx, t, W, H);
        brokenBoat(ctx, 200, GROUND + 20, 1.6);
        brokenBoat(ctx, 760, GROUND + 30, 1.8, true);
        // children peeking
        const peek = smooth(t / 2) * 16;
        for (const [x, y] of [[180, GROUND - 30], [230, GROUND - 32], [740, GROUND - 40]]) {
          ctx.save(); ctx.beginPath(); ctx.rect(x - 30, y - 60, 60, 60); ctx.clip();
          drawCharacter(ctx, x, y + 40 - peek, { variant: 'child', facing: 'down', scale: 1.8 });
          ctx.restore();
        }
        brokenBoat(ctx, 200, GROUND + 20, 1.6);
        drawCharacter(ctx, 480, G, { variant: 'arin', facing: 'down', scale: 3, pose: 'kneel' });
      },
    },
    {
      dur: 2, lines: [['Warrior Arin', 'Another one of you. Every time one of you shows up, the shadows follow.'], ['Arin', "I'm not with them. I'm trying to stop them. I need your help."], ['Warrior Arin', "If you're lying, I'll know."]],
      draw: (ctx, t, W, H, g) => {
        shore(ctx, t, W, H);
        brokenBoat(ctx, 200, GROUND + 20, 1.6);
        const lowered = g.dialogueState && g.dialogueState.i >= 2;
        drawCharacter(ctx, 360, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        drawCharacter(ctx, 600, G, { variant: 'warrior', facing: 'left', scale: 3.2 });
        ctx.save(); ctx.translate(560, G - 70); ctx.rotate(lowered ? 1.2 : -0.2);
        ctx.fillStyle = '#c8d0d8'; ctx.fillRect(-4, -90, 8, 90); ctx.fillStyle = '#7a5a2a'; ctx.fillRect(-12, -4, 24, 8);
        ctx.restore();
      },
    },
  ],
};

const carving2: CutsceneDef = {
  title: '2B — The Carving', mood: 'ocean',
  shots: [
    {
      dur: 4, lines: [['', 'The temple wall shows a person holding an orb. A dog sits beside him.'], ['Arin', '...'], ['Arin', "It's just a carving. It doesn't mean anything. ...Does it?"]], lineDelay: 2,
      draw: (ctx, t, W, H) => {
        ctx.save(); zoom(ctx, W, H, 1 + smooth(t / 4) * 0.2, 480, 280);
        temple(ctx, t, W, H, smooth(t / 3));
        ctx.restore();
        drawCharacter(ctx, 480, H + 60, { variant: 'arin', facing: 'up', scale: 4 });
      },
    },
  ],
};

const fake2: CutsceneDef = {
  title: '2C — The Fake Friend', mood: 'ocean',
  shots: [
    {
      dur: 3, lines: [['Warrior Arin?', 'Heh. Close enough.'], ['', 'The impostor\'s face ripples into shadow. It snatches the orb piece!']],
      draw: (ctx, t, W, H) => {
        shore(ctx, t, W, H);
        drawCharacter(ctx, 360, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        const rip = smooth((t - 1) / 1.5);
        drawCharacter(ctx, 560, G, { variant: 'warrior', facing: 'left', scale: 3.2, alpha: 1 - rip });
        ctx.globalAlpha = rip; drawEcho(ctx, 560, G, t, 3.2); ctx.globalAlpha = 1;
        drawOrb(ctx, 520 + rip * 40, G - 100, 10, t, '120,255,220');
      },
      onStart: (g) => g.audio.play('echo'),
    },
    {
      dur: 2.5, lines: [['Warrior Arin', 'Nobody wears my face.']], sfx: 'hit',
      draw: (ctx, t, W, H) => {
        shore(ctx, t, W, H);
        const cut = smooth(t / 0.4);
        drawEcho(ctx, 540, G, t, 3.2, 1 - smooth((t - 0.5) / 1.5));
        drawCharacter(ctx, 700 - cut * 120, G, { variant: 'warrior', facing: 'left', scale: 3.2, attack: 1 });
        if (t < 0.8) { ctx.strokeStyle = `rgba(255,255,255,${1 - t})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(460, G - 200); ctx.lineTo(640, G - 20); ctx.stroke(); }
        drawCharacter(ctx, 330, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        drawOrb(ctx, 540, G - 60 - t * 10, 10, t, '120,255,220');
      },
      onStart: (g) => g.shakeScreen(10),
    },
  ],
};

// ---------------------------------------------------------------- LEVEL 3
const intro3: CutsceneDef = {
  title: '3A — The Man Who Waited', mood: 'library',
  shots: [
    {
      dur: 2, lines: [['Genius Arin', '...Wait. Wait. You\'re not in the pattern.'], ['Genius Arin', "You're new. Nobody is ever new."],
        ['Genius Arin', "Every ten minutes this library resets. Same books, same dust, same me. For years."], ['Genius Arin', "But you remember, don't you? The loop forgets — you won't. Look for what changes."]],
      draw: (ctx, t, W, H, g) => {
        library(ctx, t, W, H);
        const crying = g.dialogueState ? g.dialogueState.i === 1 : false;
        drawCharacter(ctx, 380, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        drawCharacter(ctx, 580, G, { variant: 'genius', facing: 'left', scale: 3.2, pose: crying ? 'cry' : 'stand' });
      },
    },
  ],
};

const sky3: CutsceneDef = {
  title: '3B — The Sky He Never Saw', mood: 'library',
  shots: [
    {
      dur: 2, lines: [['Arin', 'Here. I took this from my lab window. Before everything started breaking.'], ['', 'Genius Arin touches the photo gently, as if it might disappear.'], ['Genius Arin', "They're real."], ['Genius Arin', 'All those years reading about stars... and they\'re real.']],
      draw: (ctx, t, W, H) => {
        library(ctx, t, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H);
        // photo close-up
        ctx.save(); ctx.translate(480, 280); ctx.rotate(-0.04);
        ctx.fillStyle = '#f7f1e3'; ctx.fillRect(-170, -120, 340, 240);
        ctx.save(); ctx.beginPath(); ctx.rect(-155, -105, 310, 190); ctx.clip();
        skyGrad(ctx, 960, 600, [[0, '#02030c'], [1, '#0b1438']]);
        ctx.translate(-155, -105); drawStars(ctx, 310, 190, t, 17, 140);
        ctx.fillStyle = 'rgba(160,140,255,0.12)'; ctx.beginPath(); ctx.ellipse(160, 90, 180, 30, -0.4, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.restore();
        // hand reaching
        const reach = smooth(t / 3);
        ctx.fillStyle = '#f2d2b0'; ctx.fillRect(560, 470 - reach * 120, 26, 140); ctx.fillStyle = '#5b3f8c'; ctx.fillRect(552, 540 - reach * 120, 42, 120);
      },
    },
  ],
};

const echo3: CutsceneDef = {
  title: '3C — The Echo Wins', mood: 'library',
  shots: [
    {
      dur: 3, lines: [['', 'Caught. The Echo stops struggling... and for the first time, it speaks in full.'], ['Echo', 'He will never forgive you for what you\'re about to do.'], ['Arin', "Who? Who won't forgive me?"], ['', 'The Echo only smiles, and dissolves into ink.']],
      draw: (ctx, t, W, H) => {
        library(ctx, t, W, H);
        ctx.fillStyle = 'rgba(10,0,20,0.5)'; ctx.fillRect(0, 0, W, H);
        drawEcho(ctx, 520, G, t, 4);
        drawCharacter(ctx, 340, G, { variant: 'arin', facing: 'right', scale: 3.2, pose: 'reach' });
        drawOrb(ctx, 420, G - 110, 10, t, '200,160,255');
      },
      onStart: (g) => g.audio.play('echo'),
    },
  ],
};

// ---------------------------------------------------------------- LEVEL 4
const intro4: CutsceneDef = {
  title: '4A — The Dog by the Window', mood: 'sky',
  shots: [
    {
      dur: 5, lines: [['', 'An old golden-brown dog gets up from the window, slow and stiff. He walks over.']], lineDelay: 0.5,
      draw: (ctx, t, W, H) => {
        quietSky(ctx, t, W, H);
        // shelter interior window frame
        ctx.fillStyle = 'rgba(120,80,70,0.85)'; ctx.fillRect(0, 0, W, 60); ctx.fillRect(0, 0, 80, H); ctx.fillRect(W - 80, 0, 80, H);
        const walk = smooth(t / 5);
        drawOrion(ctx, 760 - walk * 280, G, { scale: 3, dir: -1, pose: walk < 1 ? 'walk' : 'stand', t: t * 0.6, old: true });
        drawCharacter(ctx, 340, G, { variant: 'arin', facing: 'right', scale: 3.2 });
      },
    },
    {
      dur: 2, lines: [['', "Orion licks Arin's shaking hand."], ['Arin', '...Hey, boy. Hey. You got old.'], ['Healer Arin', "He's yours too, isn't he?"]],
      draw: (ctx, t, W, H) => {
        quietSky(ctx, t, W, H);
        ctx.fillStyle = 'rgba(120,80,70,0.85)'; ctx.fillRect(0, 0, W, 60); ctx.fillRect(0, 0, 80, H); ctx.fillRect(W - 80, 0, 80, H);
        drawCharacter(ctx, 400, G, { variant: 'arin', facing: 'right', scale: 3.2, pose: 'kneel' });
        drawOrion(ctx, 500, G, { scale: 3, dir: -1, pose: 'stand', t, old: true });
        drawCharacter(ctx, 700, G, { variant: 'healer', facing: 'left', scale: 3.2 });
        // shaking hand
        ctx.fillStyle = '#f0c8a0'; ctx.fillRect(432 + Math.sin(t * 40) * 1.5, G - 50, 14, 10);
      },
    },
  ],
};

const night4: CutsceneDef = {
  title: '4B — The Night Talk', mood: 'sky',
  shots: [
    {
      dur: 2, lines: [['Arin', 'The carving. The Echoes. The way they know me...'], ['Arin', 'I think I know who is doing this.'], ['Healer Arin', "Then don't hate him. Save him."]],
      draw: (ctx, t, W, H) => {
        fireScene(ctx, t, W, H);
        drawCharacter(ctx, 340, G, { variant: 'arin', facing: 'right', scale: 3, pose: 'kneel' });
        drawCharacter(ctx, 620, G, { variant: 'healer', facing: 'left', scale: 3, pose: 'kneel' });
        drawOrion(ctx, 560, G + 10, { scale: 2.6, dir: -1, pose: 'sleep', t, old: true });
      },
    },
  ],
};

const last4: CutsceneDef = {
  title: '4C — The Last Piece', mood: 'sky',
  shots: [
    {
      dur: 2, lines: [['', "Orion's collar glows. Arin sees the scratch on its tag — the same scratch from that day in the cave."], ['Arin', "...It's the same collar."]],
      draw: (ctx, t, W, H) => {
        quietSky(ctx, t, W, H);
        ctx.save(); zoom(ctx, W, H, 2.2, 480, G - 60);
        drawOrion(ctx, 470, G, { scale: 3, dir: 1, pose: 'sit', t, old: true, collarGlow: 0.5 + 0.5 * Math.sin(t * 3) });
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(560, 300); ctx.lineTo(574, 310); ctx.stroke();
      },
    },
    {
      dur: 6, sfx: 'portal',
      draw: (ctx, t, W, H) => {
        quietSky(ctx, t, W, H, smooth((t - 2) / 3) * 0.9);
        const fade = 1 - smooth((t - 3) / 2.5) * 0.85;
        ctx.globalAlpha = fade;
        drawOrion(ctx, 470, G, { scale: 3, dir: 1, pose: 'sit', t, old: true, collarGlow: 1 });
        drawCharacter(ctx, 640, G, { variant: 'healer', facing: 'left', scale: 3.2 });
        ctx.globalAlpha = 1;
        drawCharacter(ctx, 300, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        const rise = smooth(t / 2.5);
        drawOrb(ctx, 520, G - 70 - rise * 150, 12, t, '255,210,140');
        // portal
        const pr = smooth((t - 3.5) / 2) * 120;
        if (pr > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 160, G - 110, pr * 1.6, '200,170,255', 0.6); ctx.strokeStyle = 'rgba(230,210,255,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(160, G - 110, pr * 0.5, pr, 0, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
        caption(ctx, W, 'Orion barks once, softly, as the island fades.', 520, clamp(t - 2, 0, 1));
      },
      onStart: (g) => { window.setTimeout(() => g.audio.play('bark'), 2200); },
    },
  ],
};

// ---------------------------------------------------------------- FINAL
const hood5: CutsceneDef = {
  title: '5A — The Hood Comes Off', mood: 'hollow',
  shots: [
    {
      dur: 2, lines: [['', 'A figure waits among the floating ruins of every world. Orion\'s collar burns warm in Arin\'s hand.'], ['Hollow Arin', 'You came all this way.'], ['Hollow Arin', "Did you think I'd be a monster?"]],
      draw: (ctx, t, W, H, g) => {
        voidBg(ctx, t, W, H);
        const off = g.dialogueState ? g.dialogueState.i >= 1 : t > 4;
        drawCharacter(ctx, 300, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        drawCharacter(ctx, 640, G, { variant: 'hollow', facing: 'left', scale: 3.4, hood: !off });
        ctx.globalCompositeOperation = 'lighter'; glow(ctx, 330, G - 60, 40 + Math.sin(t * 4) * 6, '255,210,120', 0.6); ctx.globalCompositeOperation = 'source-over';
      },
    },
  ],
};

const orion5: CutsceneDef = {
  title: '5B — What Happened to Orion', mood: 'hollow',
  shots: [0, 1, 2].map((k) => ({
    dur: k === 2 ? 6 : 5,
    draw: (ctx: C, t: number, W: number, H: number) => {
      lab(ctx, t, W, H, { dark: k < 2, morning: k === 2, screen: true, bed: false });
      const clock = ['11:48 PM', '3:12 AM', '6:40 AM'][k];
      ctx.fillStyle = '#ff5050'; ctx.font = '18px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.fillText(clock, 140, 260);
      const turn = k === 2 && t > 3;
      drawCharacter(ctx, 200, G - 20, { variant: 'arin', facing: turn ? 'right' : 'up', scale: 3 });
      const breathing = k === 0;
      drawOrion(ctx, 620, G + 10, { scale: 2.6, dir: -1, pose: 'lie', t: breathing ? t : 0, old: true });
      if (k === 2 && t > 4) { ctx.fillStyle = `rgba(0,0,0,${smooth((t - 4) / 2)})`; ctx.fillRect(0, 0, W, H); }
      vignette(ctx, W, H, 0.8);
    },
  })),
};

const words5: CutsceneDef = {
  title: '5C — The Words', mood: 'hollow',
  shots: [
    {
      dur: 2, lines: [],
      draw: (ctx, t, W, H) => {
        voidBg(ctx, t, W, H, 0.6);
        drawCharacter(ctx, 340, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        drawCharacter(ctx, 620, G, { variant: 'hollow', facing: 'left', scale: 3.4 });
      },
      onStart: (g) => {
        const shot = CUTSCENES.words5.shots[0];
        const extra: [string, string][] = g.save.echoChoice === 'answer'
          ? [['Arin', "Your Echo asked me why I keep going, when it all ends anyway. I told it the truth."], ['Arin', "Because it mattered. Because HE mattered."]]
          : g.save.echoChoice === 'fight' ? [['Hollow Arin', "I felt you strike my Echo in the Quiet Sky. Don't pretend you're better than me."]] : [];
        shot.lines = [['Hollow Arin', "I turned away for one night. One. And he was gone, and I wasn't even looking."], ['Hollow Arin', "You'd become me too, if you lost everything."], ...extra, ['Arin', 'Maybe. But pain is the proof that we loved.']];
      },
    },
  ],
};

const every5: CutsceneDef = {
  title: '5D — Every Orion', mood: 'hollow',
  shots: [
    {
      dur: 2, lines: [['Arin', 'Look. Look at him.'], ['', "The Navigator blooms with light — Orion, alive, in every universe."], ['Arin', "He's still here. Everywhere. You don't get to erase that."]],
      draw: (ctx, t, W, H) => {
        voidBg(ctx, t, W, H, 0.4);
        const panels: [string, (c: C, x: number, y: number) => void][] = [
          ['#7a4a20', (c, x, y) => { c.fillStyle = '#c9963e'; c.fillRect(x - 70, y - 40, 30, 50); c.globalCompositeOperation = 'lighter'; glow(c, x - 55, y - 10, 50, '255,140,60', 0.6); c.globalCompositeOperation = 'source-over'; drawOrion(c, x + 10, y + 20, { scale: 1.6, pose: 'sleep', t, dir: -1 }); }],
          ['#1f4a5e', (c, x, y) => { brokenBoat(c, x, y + 30, 0.9); drawOrion(c, x - 10, y - 6, { scale: 1.6, pose: 'bark', t, dir: 1 }); }],
          ['#3a2228', (c, x, y) => { c.fillStyle = '#5a3a2a'; c.fillRect(x - 70, y - 30, 140, 10); c.fillRect(x - 64, y - 20, 8, 50); c.fillRect(x + 56, y - 20, 8, 50); drawOrion(c, x, y + 28, { scale: 1.5, pose: 'sleep', t, dir: 1 }); }],
          ['#f3b8d0', (c, x, y) => { c.fillStyle = '#8fc47e'; c.fillRect(x - 90, y + 26, 180, 30); drawOrion(c, x, y + 26, { scale: 1.7, pose: 'stand', t: t * 1.5, dir: 1, old: true }); }],
        ];
        panels.forEach(([bg, fn], i) => {
          const a = smooth((t - i * 0.6) / 0.8);
          const x = 140 + i * 227, y = 230;
          ctx.save(); ctx.globalAlpha = a;
          ctx.translate(0, (1 - a) * 30);
          rr(ctx, x - 100, y - 100, 200, 180, 12); ctx.fillStyle = bg; ctx.fill();
          ctx.save(); rr(ctx, x - 100, y - 100, 200, 180, 12); ctx.clip(); fn(ctx, x, y); ctx.restore();
          ctx.strokeStyle = 'rgba(160,230,255,0.9)'; ctx.lineWidth = 3; rr(ctx, x - 100, y - 100, 200, 180, 12); ctx.stroke();
          ctx.restore();
        });
        drawCharacter(ctx, 300, G + 40, { variant: 'arin', facing: 'right', scale: 2.6, pose: 'reach' });
        const kneel = t > 3;
        drawCharacter(ctx, 660, G + 40, { variant: 'hollow', facing: 'left', scale: 2.8, pose: kneel ? 'kneel' : 'stand' });
      },
    },
  ],
};

const letgo5: CutsceneDef = {
  title: '5E — Let Go', mood: 'hollow',
  shots: [
    {
      dur: 2, lines: [['Hollow Arin', '...I just wanted it to stop hurting.'], ['', 'He holds out the last piece of the orb.'], ['Hollow Arin', "I'm sorry, boy."]],
      draw: (ctx, t, W, H) => {
        voidBg(ctx, t, W, H, 0.3);
        drawCharacter(ctx, 380, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        drawCharacter(ctx, 580, G, { variant: 'hollow', facing: 'left', scale: 3.3, pose: 'reach' });
        drawOrb(ctx, 480, G - 90, 14, t);
      },
    },
    {
      dur: 5, sfx: 'portal',
      draw: (ctx, t, W, H) => {
        voidBg(ctx, t, W, H, 0.3 * (1 - t / 5));
        const k = smooth(t / 3.5);
        drawCharacter(ctx, 400, G, { variant: 'arin', facing: 'right', scale: 3.2 });
        ctx.globalAlpha = 1 - k;
        drawCharacter(ctx, lerp(580, 420, k), G, { variant: 'hollow', facing: 'left', scale: 3.3, spirit: '#ffffff' });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, lerp(580, 410, k), G - 70, 80 + k * 200, '255,255,255', 0.6 * k + 0.2);
        ctx.globalCompositeOperation = 'source-over';
        whiteout(ctx, W, H, (t - 3.5) / 1.5);
      },
    },
  ],
};

// ---------------------------------------------------------------- ENDINGS
const end_good: CutsceneDef = {
  title: 'Ending — Home', mood: 'good',
  shots: [
    {
      dur: 3, lines: [['', 'Morning. Birds. The sky outside the window is whole again.']],
      draw: (ctx, t, W, H) => {
        homeMorning(ctx, t, W, H);
        drawCharacter(ctx, 210, GROUND - 40, { variant: 'arin', facing: 'down', scale: 2.6, pose: t > 2 ? 'kneel' : 'stand', alpha: 1 });
        whiteout(ctx, W, H, 1 - t / 1.5);
      },
    },
    {
      dur: 2, lines: [['', 'Something small and warm bumps against his leg.'], ['Arin', '...Hey. Hey there. Where did you come from?'], ['', 'A golden-brown puppy. Tail going like a metronome.'], ['Arin', "...How do you feel about the name Orion?"]],
      draw: (ctx, t, W, H) => {
        homeMorning(ctx, t, W, H);
        drawCharacter(ctx, 440, G, { variant: 'arin', facing: 'right', scale: 3.2, pose: 'kneel' });
        const bump = Math.max(0, Math.sin(t * 3)) * 6;
        drawOrion(ctx, 540 - bump, G, { scale: 3, dir: -1, pose: 'stand', puppy: true, t: t * 1.3 });
      },
      onStart: (g) => window.setTimeout(() => g.audio.play('bark'), 1500),
    },
  ],
};

const end_neutral: CutsceneDef = {
  title: 'Ending — Duty', mood: 'neutral',
  shots: [
    {
      dur: 3, lines: [['', 'Arin seals the orb. The breaking stops. The universes hold.'], ['Hollow Arin', "...So that's it. You saved everyone. Everyone but me."], ['', 'Hollow Arin fades into the dark — alone.']],
      draw: (ctx, t, W, H) => {
        voidBg(ctx, t, W, H, 0.5);
        drawOrb(ctx, 300, G - 120, 16, t);
        drawCharacter(ctx, 300, G, { variant: 'arin', facing: 'right', scale: 3 });
        drawCharacter(ctx, 660, G, { variant: 'hollow', facing: 'left', scale: 3.2, alpha: clamp(1 - (t - 2) / 6, 0.05, 1) });
      },
    },
    {
      dur: 4, lines: [['', 'Arin wakes up in his lab. The sky is whole.'], ['', "In his hand, he's holding only Orion's collar."]],
      draw: (ctx, t, W, H) => {
        lab(ctx, t, W, H, { morning: true, bed: true });
        drawCharacter(ctx, 600, G, { variant: 'arin', facing: 'right', scale: 3.2, pose: 'kneel' });
        ctx.fillStyle = '#b8323a'; ctx.fillRect(640, G - 56, 16, 6);
        ctx.globalCompositeOperation = 'lighter'; glow(ctx, 650, G - 52, 30, '255,210,120', 0.4); ctx.globalCompositeOperation = 'source-over';
      },
    },
  ],
};

const end_dark: CutsceneDef = {
  title: 'Ending — Anger', mood: 'dark',
  shots: [
    {
      dur: 3, sfx: 'crack', lines: [['', 'Arin strikes. The orb cracks between them — and shatters.'], ['Hollow Arin', '...Then we were always the same.']],
      draw: (ctx, t, W, H) => {
        voidBg(ctx, t, W, H, 1);
        for (let i = 0; i < 5; i++) drawLightning(ctx, 480, 260, 480 + Math.cos(i * 1.3 + t) * 500, 260 + Math.sin(i * 1.3 + t) * 400, i + Math.floor(t * 10), 2, 'rgba(255,255,255,0.7)');
        drawOrb(ctx, 480, 260, 18, t, '255,120,120', true);
        drawCharacter(ctx, 330, G, { variant: 'arin', facing: 'right', scale: 3.2, attack: 1 });
        drawCharacter(ctx, 630, G, { variant: 'hollow', facing: 'left', scale: 3.2 });
      },
      onStart: (g) => g.shakeScreen(12),
    },
    {
      dur: 2, lines: [['', 'The universes split apart, forever.'], ['', 'Arin jumps. And jumps. And jumps. Never home. Never still.']],
      draw: (ctx, t, W, H) => {
        const k = Math.floor(t * 2.2) % 5;
        const fns = [gearCity, shore, library, (c: C, tt: number, w: number, h: number) => quietSky(c, tt, w, h, 0.6), voidBg];
        fns[k](ctx, t, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
        drawCharacter(ctx, 480, G, { variant: 'arin', facing: 'down', scale: 3.2, alpha: 0.6 + 0.4 * Math.sin(t * 14) });
        whiteout(ctx, W, H, (t * 2.2 % 1) < 0.08 ? 0.6 : 0);
      },
    },
  ],
};

const epilogue: CutsceneDef = {
  title: 'Bonus Epilogue — Every Home', mood: 'good',
  shots: [
    {
      dur: 2, lines: [['Engineer Arin', 'Heater\'s fixed. Dog\'s happy. Universe runs. That\'s the job.']],
      draw: (ctx, t, W, H) => { gearCity(ctx, t, W, H); drawCharacter(ctx, 380, G, { variant: 'engineer', facing: 'right', scale: 3 }); ctx.fillStyle = '#c9963e'; ctx.fillRect(560, G - 90, 50, 90); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 585, G - 40, 90, '255,140,60', 0.5); ctx.globalCompositeOperation = 'source-over'; drawOrion(ctx, 520, G + 10, { scale: 2.4, pose: 'sleep', t, dir: 1 }); },
    },
    {
      dur: 2, lines: [['Warrior Arin', 'The kids learned to fish today. The sea\'s calm. ...I sleep now. Mostly.']],
      draw: (ctx, t, W, H) => { shore(ctx, t, W, H); drawCharacter(ctx, 400, G, { variant: 'warrior', facing: 'right', scale: 3 }); drawCharacter(ctx, 520, G, { variant: 'child', facing: 'left', scale: 3 }); drawOrion(ctx, 620, G, { scale: 2.4, pose: 'bark', t, dir: -1 }); },
    },
    {
      dur: 2, lines: [['Genius Arin', 'Clocks tick forward now. I opened a window. Tonight I counted four thousand stars.']],
      draw: (ctx, t, W, H) => { nightSky(ctx, t, W, H); mountains(ctx, W, 520, '#0b0f20', 80, 2); drawCharacter(ctx, 480, G, { variant: 'genius', facing: 'up', scale: 3 }); drawOrion(ctx, 560, G, { scale: 2.2, pose: 'sleep', t, dir: -1 }); },
    },
    {
      dur: 2, lines: [['Healer Arin', 'He sleeps by the window every afternoon. Every single day is a gift.']],
      draw: (ctx, t, W, H) => { quietSky(ctx, t, W, H); drawCharacter(ctx, 400, G, { variant: 'healer', facing: 'right', scale: 3, pose: 'kneel' }); drawOrion(ctx, 500, G, { scale: 2.6, pose: 'lie', t, dir: -1, old: true }); },
    },
    {
      dur: 4, lines: [['Arin', 'See those, buddy? Every one of them is a universe where someone loves a dog like you.'], ['', 'The puppy yawns, and falls asleep on his shoe.']],
      draw: (ctx, t, W, H) => {
        nightSky(ctx, t, W, H);
        mountains(ctx, W, 520, '#0b0f20', 90, 3);
        ctx.fillStyle = '#141a2c'; ctx.fillRect(300, 440, 360, 160);
        drawCharacter(ctx, 440, 470, { variant: 'arin', facing: 'up', scale: 2.6, pose: 'kneel' });
        drawOrion(ctx, 510, 474, { scale: 2.4, pose: 'sleep', puppy: true, t, dir: -1 });
      },
    },
  ],
};

export const CUTSCENES: Record<string, CutsceneDef> = {
  intro0, cave0, jump0, intro1, heart1, bye1, intro2, carving2, fake2, intro3, sky3, echo3,
  intro4, night4, last4, hood5, orion5, words5, every5, letgo5, end_good, end_neutral, end_dark, epilogue,
};

// silence unused import warnings for helpers used conditionally
void drawJumper; void dogBed; void carving; void mulberry32; void temple;
