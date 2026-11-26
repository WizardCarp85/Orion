import { AudioEngine, type Sfx } from './audio';
import { Input } from './input';
import { Particles } from './particles';
import { Player } from './entities';
import type { Stage, Sprite } from './stage';
import { ui } from './store';
import { loadSave, writeSave, freshSave, type SaveData } from './save';
import { LEVELS } from './levels';
import { CUTSCENES, type CutsceneDef } from './cutscenes';
import { drawStars, drawOrb, glow, vignette } from './draw';
import { clamp, rand } from './util';

export const W = 960, H = 600;

export const SPEAKER_COLORS: Record<string, string> = {
  'Arin': '#9fd8ff', 'Young Arin': '#9fd8ff', 'Engineer Arin': '#f0a35e', 'Warrior Arin': '#6fd1c6', 'Genius Arin': '#c9a6ff',
  'Healer Arin': '#8fe0b0', 'Hollow Arin': '#c7cbd6', 'Echo': '#8f95c8', 'Orion': '#f2c94c', 'Navigator': '#7fe8ff',
  '': '#d7dbe6', 'Villager': '#e7b3d1', 'Child': '#cfd8df', '???': '#8f95c8', 'Warrior Arin?': '#6fd1c6',
};

type Line = [string, string];

interface DialogueState { lines: Line[]; i: number; shown: number; cb?: () => void }
interface ChoiceState { prompt: string; options: string[]; sel: number; cb: (i: number) => void }
interface FloatText { x: number; y: number; text: string; color: string; life: number }

class CutscenePlayer {
  shot = 0; t = 0; total = 0; linesStarted = false; linesDone = false;
  constructor(public def: CutsceneDef, public g: Game, public onDone: () => void) { this.enterShot(); }
  enterShot() {
    this.t = 0; this.linesStarted = false; this.linesDone = false;
    const s = this.def.shots[this.shot];
    if (s.sfx) this.g.audio.play(s.sfx);
    s.onStart?.(this.g);
  }
  update(dt: number) {
    this.t += dt; this.total += dt;
    const s = this.def.shots[this.shot];
    if (this.g.dialogueState) return;
    if (s.lines && s.lines.length && !this.linesStarted && this.t > (s.lineDelay ?? 0.8)) {
      this.linesStarted = true;
      this.g.dialogue(s.lines, () => { this.linesDone = true; this.t = Math.max(this.t, (s.dur ?? 0) - (s.tail ?? 0.6)); });
      return;
    }
    const done = s.lines && s.lines.length ? this.linesDone && this.t >= (s.dur ?? 0) : this.t >= (s.dur ?? 3);
    const skipShot = !s.lines && this.t > 0.8 && this.g.input.interact;
    if (done || skipShot) this.next();
  }
  next() {
    this.shot++;
    if (this.shot >= this.def.shots.length) { this.onDone(); return; }
    this.enterShot();
  }
  draw(ctx: CanvasRenderingContext2D) {
    const s = this.def.shots[this.shot];
    if (!s) return;
    ctx.save();
    s.draw(ctx, this.t, W, H, this.g);
    ctx.restore();
    // letterbox
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, 44); ctx.fillRect(0, H - 44, W, 44);
    // fade in each shot
    const fin = clamp(1 - this.t / 0.5, 0, 1);
    if (fin > 0) { ctx.fillStyle = `rgba(0,0,0,${fin})`; ctx.fillRect(0, 0, W, H); }
  }
}

export class Game {
  ctx: CanvasRenderingContext2D;
  input = new Input();
  audio = new AudioEngine();
  particles = new Particles();
  player: Player;
  save: SaveData = loadSave();
  mode: 'title' | 'play' | 'ending' = 'title';
  paused = false;
  levelIndex = 0;
  stageIndex = 0;
  stage: Stage | null = null;
  cam = { x: 0, y: 0 };
  time = 0;
  dialogueState: DialogueState | null = null;
  choiceState: ChoiceState | null = null;
  cutscene: CutscenePlayer | null = null;
  rewardCb: (() => void) | null = null;
  private fade = { a: 0, dir: 0, cb: null as null | (() => void) };
  private shake = 0;
  private flash: { color: string; t: number } | null = null;
  private raf = 0;
  private last = 0;
  private toastId = 0;
  private floats: FloatText[] = [];
  private history: { x: number; y: number; hp: number }[] = [];
  private toolCd = [0, 0, 0, 0];
  private darkCanvas: HTMLCanvasElement;
  private dyingT = 0;
  showLegend = true;
  frameCount = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.player = new Player(this);
    this.darkCanvas = document.createElement('canvas');
    this.darkCanvas.width = W; this.darkCanvas.height = H;
    this.input.anyKey = () => this.unlockAudio();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.audio.setMood('title');
    this.syncHud();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.audio.destroy();
  }

  unlockAudio() {
    this.audio.init();
    if (!ui.get().audioReady && this.audio.ctx) ui.set({ audioReady: true });
  }

  // ------------------------------------------------------------ flow
  get level() { return LEVELS[this.levelIndex]; }

  newGame() {
    this.save = freshSave(this.save);
    this.save.started = true;
    writeSave(this.save);
    this.startLevel(0);
  }

  continueGame() {
    const cp = this.save.checkpoint;
    if (!cp) { this.newGame(); return; }
    this.startLevel(cp.level, cp.stage);
  }

  startLevel(i: number, stageIdx = 0) {
    this.unlockAudio();
    this.fadeTo(() => {
      this.mode = 'play';
      this.paused = false;
      this.levelIndex = i;
      this.save.started = true;
      if (stageIdx === 0) this.save.clues = [];
      ui.set({ screen: 'game', ending: null, paused: false, reward: null });
      this.audio.setMood(this.level.mood);
      this.audio.setTension(0);
      if (i === 5) this.audio.setHollowPhase(0);
      const def = this.level;
      if (stageIdx === 0 && def.intro) {
        this.stage = null;
        this.playCutscene(def.intro, () => this.loadStage(0));
      } else this.loadStage(stageIdx);
    });
  }

  loadStage(idx: number) {
    this.stageIndex = idx;
    const Ctor = this.level.stages[idx];
    const st = new Ctor(this);
    this.particles.clear();
    this.floats = [];
    this.history = [];
    this.dyingT = 0;
    this.stage = st;
    this.player.reset(st.spawn.x, st.spawn.y);
    st.setup();
    this.player.x = st.spawn.x; this.player.y = st.spawn.y;
    st.checkpoint = { ...st.spawn };
    this.snapCamera();
    this.save.checkpoint = { level: this.levelIndex, stage: idx };
    writeSave(this.save);
    ui.set({ levelIndex: this.levelIndex, levelName: this.level.name, stageName: st.name, objective: st.objective, timer: null, boss: null, activeChar: null, hint: null });
    st.onEnter();
  }

  restartStage() { this.loadStage(this.stageIndex); }

  completeStage() {
    if (!this.stage) return;
    const next = this.stageIndex + 1;
    if (next < this.level.stages.length) {
      this.fadeTo(() => this.loadStage(next));
    } else this.completeLevel();
  }

  completeLevel() {
    const def = this.level;
    const nextLevel = this.levelIndex + 1;
    if (def.reward) def.reward.apply(this.save);
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(nextLevel, LEVELS.length - 1));
    this.save.checkpoint = nextLevel < LEVELS.length ? { level: nextLevel, stage: 0 } : null;
    writeSave(this.save);
    this.audio.play('success');
    const go = () => { if (nextLevel < LEVELS.length) this.startLevel(nextLevel); else this.toTitle(); };
    if (def.reward) {
      ui.set({ reward: { title: def.reward.title, items: def.reward.items } });
      this.rewardCb = () => { ui.set({ reward: null }); go(); };
    } else go();
  }

  confirmReward() { const cb = this.rewardCb; this.rewardCb = null; cb?.(); }

  toTitle() {
    this.fadeTo(() => {
      this.mode = 'title';
      this.stage = null;
      this.cutscene = null;
      this.dialogueState = null;
      this.choiceState = null;
      this.paused = false;
      this.audio.setMood('title');
      ui.set({ screen: 'title', paused: false, dialogue: null, choice: null, cutsceneTitle: null, inCutscene: false, ending: null, reward: null, timer: null, boss: null, meters: [] });
    });
  }

  playEnding(kind: 'good' | 'neutral' | 'dark') {
    if (!this.save.endings.includes(kind)) this.save.endings.push(kind);
    this.save.checkpoint = null;
    this.save.unlocked = LEVELS.length - 1;
    writeSave(this.save);
    this.audio.setMood(kind);
    this.stage = null;
    this.playCutscene('end_' + kind, () => {
      this.mode = 'ending';
      ui.set({ screen: 'ending', ending: kind });
    });
  }

  playEpilogue() {
    this.unlockAudio();
    this.fadeTo(() => {
      this.mode = 'play';
      this.stage = null;
      this.audio.setMood('good');
      ui.set({ screen: 'epilogue' });
      this.playCutscene('epilogue', () => this.toTitle());
    });
  }

  onPlayerDeath() {
    this.dyingT = 1.4;
    this.audio.play('fail');
  }

  // ------------------------------------------------------------ overlays
  dialogue(lines: Line[], cb?: () => void) {
    this.dialogueState = { lines, i: 0, shown: 0, cb };
    this.syncDialogue();
  }
  choice(prompt: string, options: string[], cb: (i: number) => void) {
    this.choiceState = { prompt, options, sel: 0, cb };
    ui.set({ choice: { prompt, options, selected: 0 } });
  }
  selectChoice(i: number) {
    const c = this.choiceState;
    if (!c) return;
    this.choiceState = null;
    ui.set({ choice: null });
    this.audio.play('select');
    c.cb(i);
  }
  hoverChoice(i: number) {
    if (!this.choiceState) return;
    this.choiceState.sel = i;
    ui.set({ choice: { prompt: this.choiceState.prompt, options: this.choiceState.options, selected: i } });
  }
  playCutscene(id: string, cb: () => void) {
    const def = CUTSCENES[id];
    if (!def) { cb(); return; }
    if (def.mood) this.audio.setMood(def.mood);
    this.audio.play('whoosh');
    this.cutscene = new CutscenePlayer(def, this, () => {
      this.cutscene = null;
      this.dialogueState = null;
      ui.set({ cutsceneTitle: null, inCutscene: false, dialogue: null });
      if (def.mood && this.mode === 'play' && this.levelIndex >= 0 && ui.get().screen === 'game') this.audio.setMood(this.level.mood);
      cb();
    });
    ui.set({ cutsceneTitle: def.title, inCutscene: true });
  }
  skipCutscene() {
    if (!this.cutscene) return;
    this.dialogueState = null;
    ui.set({ dialogue: null });
    this.cutscene.onDone();
  }
  toast(text: string) {
    ui.set({ toast: { text, id: ++this.toastId } });
  }
  hint(text: string | null) { ui.set({ hint: text }); }
  floatText(x: number, y: number, text: string, color = '#fff') { this.floats.push({ x, y, text, color, life: 1 }); }
  shakeScreen(a: number) { this.shake = Math.max(this.shake, a); }
  flashScreen(color: string, t = 0.2) { this.flash = { color, t }; }
  sfx(n: Sfx) { this.audio.play(n); }

  fadeTo(cb: () => void) {
    if (this.fade.dir === 1) { const prev = this.fade.cb; this.fade.cb = () => { prev?.(); cb(); }; return; }
    this.fade.dir = 1; this.fade.cb = cb;
  }

  collectPhoto(idx: number) {
    this.save.photos[idx] = true;
    writeSave(this.save);
    this.audio.play('photo');
    const n = this.save.photos.filter(Boolean).length;
    this.toast(`Photo of Orion found (${n}/6)` + (n === 6 ? ' — Bonus epilogue unlocked on the title screen!' : ''));
    this.flashScreen('rgba(255,230,180,0.35)', 0.3);
    const captions = [
      'A puppy asleep on a stack of star charts. Written on the back: "Day one. He chose me."',
      'Orion with a wrench in his mouth, very proud of himself.',
      'Orion soaked after leaping into a lake, grinning.',
      'Orion asleep under a desk, one paw on Arin\'s shoe.',
      'Old Orion and Arin on a hill, watching the moon.',
      'A blurry photo: Arin laughing, Orion licking the camera.',
    ];
    this.dialogue([['', captions[idx] ?? 'A photo of Orion.']]);
  }

  pause(v: boolean) {
    if (this.mode !== 'play' || ui.get().screen !== 'game') return;
    if (v && (this.cutscene || this.rewardCb)) return;
    this.paused = v;
    ui.set({ paused: v });
    this.audio.play('select');
  }

  manualSave() {
    if (this.stage) this.save.checkpoint = { level: this.levelIndex, stage: this.stageIndex };
    writeSave(this.save);
    this.toast('Progress saved — checkpoint: ' + (this.stage?.name ?? this.level.name));
    ui.set({ saveVersion: ui.get().saveVersion + 1 });
  }

  loadGame() {
    this.save = loadSave();
    this.paused = false;
    ui.set({ paused: false });
    this.dialogueState = null; this.choiceState = null; this.cutscene = null;
    ui.set({ dialogue: null, choice: null, cutsceneTitle: null, inCutscene: false });
    this.continueGame();
  }

  resetAll() {
    this.save = freshSave();
    try { localStorage.removeItem('orion.save.v1'); } catch { /* */ }
    ui.set({ saveVersion: ui.get().saveVersion + 1 });
  }

  setBoss(name: string | null, value = 1) { ui.set({ boss: name ? { name, value } : null }); }
  setTimer(text: string | null) { ui.set({ timer: text }); }

  setActiveChar(name: string | null) { ui.set({ activeChar: name }); }

  syncObjective() { ui.set({ objective: this.stage?.objective ?? '' }); }

  // ------------------------------------------------------------ tools
  useTool(n: number) {
    const st = this.stage;
    if (!st) return;
    const keys = ['multitool', 'pearl', 'watch', 'collar'] as const;
    const names = ['Multi-Tool', 'Pearl Charm', 'Pocket Watch', "Orion's Collar"];
    if (!this.save.items[keys[n - 1]]) { this.toast(`You don't have the ${names[n - 1]} yet.`); return; }
    // tool-specific interactables
    const pl = this.player;
    const target = st.interacts.find((it) => it.tool === n && (!it.enabled || it.enabled()) && Math.hypot(it.x - pl.x, it.y - pl.y) < (it.r ?? 40) + 10);
    if (target) { this.audio.play('interact'); target.action(); return; }
    if (st.onTool(n)) return;
    if (this.toolCd[n - 1] > 0) { this.toast(`${names[n - 1]} is recharging...`); return; }
    switch (n) {
      case 1: this.toast('Multi-Tool: nothing to open or fix here.'); break;
      case 2:
        pl.bubbleT = 6; this.toolCd[1] = 12; this.audio.play('bubble');
        this.toast('Pearl Charm: a protective bubble forms (blocks projectiles, lets you breathe).');
        break;
      case 3: this.rewind(); break;
      case 4:
        pl.glowT = 5; this.toolCd[3] = 8; this.audio.play('lamp');
        this.toast("Orion's Collar glows warmly.");
        break;
    }
  }

  rewind(): boolean {
    const st = this.stage;
    if (!st) return false;
    if (st.rewindUsed) { this.toast('Pocket Watch already used in this area.'); return false; }
    if (this.history.length < 10) { this.toast('Nothing to rewind yet.'); return false; }
    const h = this.history[0];
    st.rewindUsed = true;
    this.player.x = h.x; this.player.y = h.y; this.player.hp = Math.max(this.player.hp, h.hp);
    this.player.falling = 0; this.player.dead = false; this.dyingT = 0;
    this.history = [];
    this.audio.play('rewind');
    this.flashScreen('rgba(255,220,150,0.45)', 0.5);
    this.particles.burst(this.player.x, this.player.y - 16, 30, '#ffe6a8', 200, 0.8, 3);
    st.onRewind();
    this.toast('⟲ Rewound 5 seconds');
    return true;
  }

  // ------------------------------------------------------------ loop
  private loop = (ts: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 1 / 30);
    this.frameCount++;
    try {
      this.update(dt);
      this.render();
    } catch (err) {
      // Keep the loop alive; surface once in dev tools as a warning.
      if (this.frameCount % 600 === 1) console.warn('[ORION] frame error', err);
    }
    this.input.endFrame();
  };

  private update(dt: number) {
    this.time += dt;
    const inp = this.input;
    // fade
    if (this.fade.dir !== 0) {
      this.fade.a += this.fade.dir * dt * 3;
      if (this.fade.dir === 1 && this.fade.a >= 1) {
        this.fade.a = 1; this.fade.dir = -1;
        const cb = this.fade.cb; this.fade.cb = null; cb?.();
      } else if (this.fade.dir === -1 && this.fade.a <= 0) { this.fade.a = 0; this.fade.dir = 0; }
    }
    if (inp.hit('KeyH')) { this.showLegend = !this.showLegend; ui.set({ showLegend: this.showLegend }); }
    if (this.mode === 'play' && ui.get().screen === 'game' && inp.hit('Escape', 'KeyP')) {
      if (!this.choiceState && !this.dialogueState || this.paused) this.pause(!this.paused);
    }
    if (this.paused) return;
    if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
    this.shake = Math.max(0, this.shake - dt * 20);
    for (const f of this.floats) { f.life -= dt; f.y -= dt * 30; }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (let i = 0; i < 4; i++) this.toolCd[i] = Math.max(0, this.toolCd[i] - dt);

    if (this.rewardCb) {
      if (inp.interact && this.fade.dir === 0) this.confirmReward();
      return;
    }
    if (this.choiceState) {
      const c = this.choiceState;
      let sel = c.sel;
      if (inp.hit('KeyW', 'ArrowUp')) sel = (sel + c.options.length - 1) % c.options.length;
      if (inp.hit('KeyS', 'ArrowDown')) sel = (sel + 1) % c.options.length;
      for (let i = 0; i < c.options.length; i++) if (inp.hit('Digit' + (i + 1))) { this.selectChoice(i); return; }
      if (sel !== c.sel) { c.sel = sel; this.audio.play('blip'); ui.set({ choice: { prompt: c.prompt, options: c.options, selected: sel } }); }
      if (inp.interact) { this.selectChoice(c.sel); return; }
      if (this.cutscene) this.cutscene.t += 0; // frozen
      return;
    }
    if (this.dialogueState) {
      const d = this.dialogueState;
      const line = d.lines[d.i];
      const len = line[1].length;
      if (d.shown < len) {
        const before = Math.floor(d.shown);
        d.shown = Math.min(len, d.shown + dt * 46);
        if (Math.floor(d.shown) !== before && line[1][before] !== ' ') this.audio.play('blip');
      }
      if (inp.interact) {
        if (d.shown < len) d.shown = len;
        else {
          d.i++; d.shown = 0;
          if (d.i >= d.lines.length) {
            this.dialogueState = null;
            ui.set({ dialogue: null });
            d.cb?.();
            inp.consume('KeyE', 'Space', 'Enter');
          }
        }
      }
      this.syncDialogue();
      if (this.cutscene) this.cutscene.t += dt;
      return;
    }
    if (this.cutscene) {
      if (inp.hit('KeyX')) { this.skipCutscene(); return; }
      this.cutscene.update(dt);
      return;
    }
    if (this.mode !== 'play' || !this.stage) {
      this.particles.update(dt);
      return;
    }
    const st = this.stage;
    if (this.fade.dir !== 0) return;
    if (this.dyingT > 0) {
      this.dyingT -= dt;
      this.particles.update(dt);
      if (this.dyingT <= 0) {
        this.toast('Arin collapses... returning to the last checkpoint.');
        this.fadeTo(() => this.restartStage());
      }
      return;
    }
    st.t += dt;
    st.preUpdate(dt);
    this.player.update(dt, st);
    st.updateCommon(dt);
    // interact
    const near = this.nearestInteract();
    if (inp.interact && !this.dialogueState) {
      if (near && !near.tool) { this.audio.play('interact'); near.action(); }
      else if (st.combat) this.player.attack(st);
    }
    for (let n = 1; n <= 4; n++) if (inp.hit('Digit' + n, 'Numpad' + n)) this.useTool(n);
    st.update(dt);
    this.particles.update(dt);
    // rewind history
    this.history.push({ x: this.player.x, y: this.player.y, hp: this.player.hp });
    if (this.history.length > 300) this.history.shift();
    this.updateCamera(dt);
    this.syncHud(near ? (near.tool ? `[${near.tool}] ${near.label}` : `[E] ${near.label}`) : null);
  }

  private nearestInteract() {
    const st = this.stage;
    if (!st || this.player.dead || this.player.falling > 0) return null;
    let best = null as Stage['interacts'][number] | null, bd = 1e9;
    for (const it of st.interacts) {
      if (it.enabled && !it.enabled()) continue;
      const d = Math.hypot(it.x - this.player.x, it.y - this.player.y);
      if (d < (it.r ?? 40) && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  private snapCamera() {
    const st = this.stage!;
    this.cam.x = st.w <= W ? (st.w - W) / 2 : clamp(this.player.x - W / 2, 0, st.w - W);
    this.cam.y = st.h <= H ? (st.h - H) / 2 : clamp(this.player.y - H / 2, 0, st.h - H);
  }
  private updateCamera(dt: number) {
    const st = this.stage!;
    const tx = st.w <= W ? (st.w - W) / 2 : clamp(this.player.x - W / 2, 0, st.w - W);
    const ty = st.h <= H ? (st.h - H) / 2 : clamp(this.player.y - H / 2, 0, st.h - H);
    const k = 1 - Math.pow(0.0005, dt);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
  }

  private syncDialogue() {
    const d = this.dialogueState;
    if (!d) return;
    const [speaker, text] = d.lines[d.i];
    ui.set({ dialogue: { speaker, text, shown: Math.floor(d.shown), color: SPEAKER_COLORS[speaker] ?? '#ddd', done: d.shown >= text.length } });
  }

  syncHud(prompt: string | null = null) {
    const s = this.save;
    const st = this.stage;
    const ready = [0, 1, 2, 3].map((i) => this.toolCd[i] <= 0 && !(i === 2 && st?.rewindUsed));
    ui.set({
      hp: this.player.hp, maxHp: this.player.maxHp, prompt,
      tools: { owned: [s.items.multitool, s.items.pearl, s.items.watch, s.items.collar], ready },
      pieces: s.pieces.filter(Boolean).length, photos: s.photos.filter(Boolean).length,
      meters: st ? st.meters() : [],
    });
  }

  // ------------------------------------------------------------ render
  private render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.cutscene) {
      this.cutscene.draw(ctx);
    } else if (this.mode === 'play' && this.stage) {
      this.renderWorld(ctx, this.stage);
    } else if (this.mode === 'title' || this.mode === 'ending') {
      this.renderTitleBg(ctx);
    }
    if (this.flash) { ctx.fillStyle = this.flash.color; ctx.globalAlpha = clamp(this.flash.t / 0.2, 0, 1); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.dyingT > 0) { ctx.fillStyle = `rgba(40,0,0,${0.5 * (1 - this.dyingT / 1.4)})`; ctx.fillRect(0, 0, W, H); }
    if (this.fade.a > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fade.a})`; ctx.fillRect(0, 0, W, H); }
  }

  private renderWorld(ctx: CanvasRenderingContext2D, st: Stage) {
    const sx = this.shake ? rand(-this.shake, this.shake) : 0, sy = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(Math.round(-this.cam.x + sx), Math.round(-this.cam.y + sy));
    st.drawBg(ctx);
    const sprites: Sprite[] = st.sprites();
    sprites.push({ y: this.player.y, draw: (c) => this.player.draw(c) });
    for (const n of st.npcs) sprites.push({ y: n.y, draw: (c) => n.draw(c) });
    for (const n of st.allies) sprites.push({ y: n.y, draw: (c) => n.draw(c) });
    for (const e of st.enemies) sprites.push({ y: e.y, draw: (c) => e.draw(c) });
    sprites.sort((a, b) => a.y - b.y);
    for (const s of sprites) { ctx.save(); s.draw(ctx); ctx.restore(); }
    st.drawProjectiles(ctx);
    this.particles.draw(ctx);
    st.drawFg(ctx);
    for (const f of this.floats) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.font = 'bold 13px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // darkness
    if (st.darkness > 0) {
      const dc = this.darkCanvas.getContext('2d')!;
      dc.globalCompositeOperation = 'source-over';
      dc.clearRect(0, 0, W, H);
      dc.fillStyle = `rgba(${st.darkRGB},${st.darkness})`;
      dc.fillRect(0, 0, W, H);
      dc.globalCompositeOperation = 'destination-out';
      const lights = st.lights();
      if (st.playerLight > 0) lights.push({ x: this.player.x, y: this.player.y - 16, r: st.playerLight + (this.player.glowT > 0 ? 120 : 0) });
      for (const l of lights) {
        const x = l.x - this.cam.x, y = l.y - this.cam.y;
        if (x < -l.r || y < -l.r || x > W + l.r || y > H + l.r) continue;
        const g = dc.createRadialGradient(x, y, 0, x, y, l.r);
        g.addColorStop(0, `rgba(0,0,0,${l.a ?? 1})`); g.addColorStop(0.55, `rgba(0,0,0,${(l.a ?? 1) * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        dc.fillStyle = g; dc.beginPath(); dc.arc(x, y, l.r, 0, Math.PI * 2); dc.fill();
      }
      ctx.drawImage(this.darkCanvas, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) if (l.rgb) glow(ctx, l.x - this.cam.x, l.y - this.cam.y, l.r * 0.6, l.rgb, 0.18);
      ctx.globalCompositeOperation = 'source-over';
    }
    st.drawScreen(ctx);
  }

  private renderTitleBg(ctx: CanvasRenderingContext2D) {
    const t = this.time;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#02030a'); g.addColorStop(0.6, '#0a1030'); g.addColorStop(1, '#1a1440');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawStars(ctx, W, H, t, 11, 220, t * 4, 0);
    // crack
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(t * 2)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 120);
    const pts = [[160, 140], [260, 110], [380, 170], [470, 150], [590, 200], [700, 160], [820, 210], [960, 190]];
    pts.forEach(([x, y]) => ctx.lineTo(x, y + Math.sin(t + x) * 2));
    ctx.stroke();
    glow(ctx, 480, 160, 300, '180,200,255', 0.08);
    ctx.restore();
    // mountains
    ctx.fillStyle = '#060814';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 470 - Math.abs(Math.sin(x * 0.006) * 120) - Math.sin(x * 0.03) * 14);
    ctx.lineTo(W, H); ctx.fill();
    drawOrb(ctx, 480, 330 + Math.sin(t * 1.3) * 8, 22, t);
    vignette(ctx, W, H, 0.7);
  }

  /** Utility for stages: sprites list for npcs etc. */
  get W() { return W; }
  get H() { return H; }
}
