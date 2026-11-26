// Fully procedural Web Audio engine: per-level music moods + sound effects. No assets.
export type Mood =
  | 'silent' | 'title' | 'main' | 'gear' | 'ocean' | 'library' | 'sky' | 'hollow'
  | 'good' | 'neutral' | 'dark';

export type Sfx =
  | 'pickup' | 'hit' | 'hurt' | 'dodge' | 'interact' | 'door' | 'blip' | 'whoosh' | 'crack' | 'rumble'
  | 'splash' | 'bark' | 'gear' | 'steam' | 'success' | 'fail' | 'portal' | 'shield' | 'rewind' | 'lamp'
  | 'echo' | 'select' | 'swing' | 'block' | 'bell' | 'scan' | 'photo' | 'heal' | 'bubble';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
type N = number | null;

// Main theme (A minor) — 32 steps
const THEME: N[] = [69, null, 72, null, 76, null, 74, 72, 71, null, 69, null, 64, null, null, null,
  65, null, 69, null, 72, null, 71, 69, 67, null, 64, null, null, null, null, null];
const THEME_BASS = [45, 41, 48, 43];
const THEME_CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
// Major version for the good ending
const THEME_MAJ: N[] = [69, null, 73, null, 76, null, 78, 76, 73, null, 71, null, 69, null, null, null,
  66, null, 69, null, 73, null, 71, 69, 68, null, 71, null, 69, null, null, null];
const MAJ_BASS = [45, 42, 50, 52];
const MAJ_CHORDS = [[57, 61, 64], [54, 57, 61], [57, 62, 66], [56, 59, 64]];
const MUSICBOX = [76, 79, 83, 81, 79, 76, 74, 76, 72, 74, 76, 79, 81, 83, 84, 83, 81, 79, 76, 74, 72, 71];

interface Cont { stop: () => void }

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private reverbIn!: GainNode;
  private cont: Cont[] = [];
  private humGain: GainNode | null = null;
  private nextT = 0;
  private step = 0;
  private iv: number | null = null;
  private lastBlip = 0;
  mood: Mood = 'silent';
  tension = 0;
  loopNotes = 5;
  hollowPhase = 0;
  musicVolume = 0.55;
  sfxVolume = 0.8;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
      return;
    }
    const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.85; this.master.connect(comp);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVolume; this.music.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVolume; this.sfxBus.connect(this.master);
    // Reverb
    const len = Math.floor(ctx.sampleRate * 3);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    this.reverbIn = ctx.createGain(); this.reverbIn.gain.value = 0.5;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.reverbIn.connect(conv); conv.connect(wet); wet.connect(this.master);
    this.music.connect(this.reverbIn);
    // Noise
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.nextT = ctx.currentTime + 0.1;
    this.iv = window.setInterval(() => this.tick(), 40);
    const m = this.mood; this.mood = 'silent'; this.setMood(m);
  }

  destroy() {
    if (this.iv) window.clearInterval(this.iv);
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music; this.sfxVolume = sfx;
    if (this.ctx) { this.music.gain.value = music; this.sfxBus.gain.value = sfx; }
  }

  setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    if (!this.ctx) return;
    this.cont.forEach((c) => c.stop());
    this.cont = [];
    this.humGain = null;
    this.step = 0;
    this.nextT = Math.max(this.nextT, this.ctx.currentTime + 0.05);
    const ctx = this.ctx;
    if (m === 'main' || m === 'title') {
      const g = this.drone([55, 110.4], 'sine', m === 'main' ? 0.05 : 0.025, 400);
      this.humGain = g.gain;
      this.cont.push(g);
    } else if (m === 'ocean') {
      this.cont.push(this.waves(0.22));
      this.cont.push(this.drone([36.7], 'sine', 0.05, 200));
    } else if (m === 'hollow') {
      this.cont.push(this.drone([41.2, 41.6], 'sine', 0.04, 160));
    } else if (m === 'dark') {
      this.cont.push(this.drone([38.9, 41.2, 55.5], 'sawtooth', 0.025, 300));
    } else if (m === 'sky') {
      this.cont.push(this.drone([130.8 / 2], 'sine', 0.02, 300));
    } else if (m === 'gear') {
      this.cont.push(this.drone([49], 'triangle', 0.025, 220));
    } else if (m === 'library') {
      this.cont.push(this.drone([65.4, 98], 'sine', 0.018, 300));
    }
    void ctx;
  }

  setTension(t: number) {
    this.tension = Math.max(0, Math.min(1, t));
    if (this.humGain && this.ctx) this.humGain.gain.setTargetAtTime(0.05 + this.tension * 0.14, this.ctx.currentTime, 0.5);
  }
  restartLoop(loopIndex: number) {
    this.loopNotes = 5 + loopIndex;
    this.step = 0;
  }
  setHollowPhase(p: number) { this.hollowPhase = p; this.step = 0; }

  // ---------- scheduler ----------
  private stepDur(): number {
    switch (this.mood) {
      case 'main': return 0.34 - this.tension * 0.06;
      case 'title': return 0.42;
      case 'gear': return 0.14;
      case 'ocean': return 0.5;
      case 'library': return 0.3;
      case 'sky': return 0.36;
      case 'hollow': return this.hollowPhase === 0 ? 0.5 : this.hollowPhase === 1 ? 0.62 : 0.4;
      case 'good': return 0.38;
      case 'neutral': return 0.55;
      case 'dark': return 0.5;
      default: return 0.5;
    }
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.nextT < ctx.currentTime - 0.3) this.nextT = ctx.currentTime + 0.05;
    let guard = 0;
    while (this.nextT < ctx.currentTime + 0.25 && guard++ < 16) {
      const d = this.stepDur();
      try { this.playStep(this.step, this.nextT, d); } catch { /* ignore scheduling glitch */ }
      this.nextT += d;
      this.step++;
    }
  }

  private playStep(s: number, t: number, d: number) {
    switch (this.mood) {
      case 'title': case 'main': {
        const i = s % 32;
        const n = THEME[i];
        const vol = this.mood === 'title' ? 0.12 : 0.15;
        if (n) this.piano(mtof(n), t, 1.6, vol);
        if (i % 8 === 0) {
          const bar = Math.floor(i / 8);
          this.piano(mtof(THEME_BASS[bar]), t, 2.6, vol * 0.9);
          this.pad(THEME_CHORDS[bar].map(mtof), t, d * 8, 0.025, 'triangle', 900);
        }
        if (this.mood === 'main' && this.tension > 0.45) {
          if (s % 2 === 0) this.tick2(t, 0.02 + this.tension * 0.03, 2400);
          if (i % 16 === 8) this.pad([mtof(46), mtof(47)], t, d * 6, 0.03 * this.tension, 'sawtooth', 500);
        }
        break;
      }
      case 'gear': {
        const i = s % 16;
        this.tick2(t, i % 4 === 0 ? 0.09 : 0.04, i % 2 ? 3200 : 2100);
        if (i % 4 === 2) this.tick2(t, 0.05, 900);
        const bar = Math.floor(s / 16) % 4;
        const roots = [50, 46, 48, 45];
        if (i === 0) this.brass([roots[bar], roots[bar] + 7, roots[bar] + 12, roots[bar] + 15 + (bar === 2 ? 1 : 0)].map(mtof), t, d * 6, 0.05);
        if (i % 8 === 0 || i === 11) this.pluck(mtof(roots[bar] - 12), t, 0.12, 400);
        const mel: N[] = [62, null, 65, null, 69, 67, 65, null, 64, null, 62, null, 60, null, 62, null];
        const mn = mel[i];
        if (mn && bar % 2 === 1) this.brass([mtof(mn + (bar === 3 ? -2 : 0))], t, d * 1.6, 0.03);
        break;
      }
      case 'ocean': {
        const i = s % 32;
        const chords = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64]];
        const bar = Math.floor(i / 8);
        if (i % 8 === 0) {
          this.pad(chords[bar].map(mtof), t, d * 8.4, 0.045, 'sawtooth', 700);
          this.pad([mtof(chords[bar][0] - 12)], t, d * 8, 0.06, 'sawtooth', 300);
        }
        if (i % 8 === 4 && Math.random() < 0.6) this.pad([mtof(chords[bar][3] + 12)], t, d * 4, 0.018, 'triangle', 2000);
        break;
      }
      case 'library': {
        const L = Math.min(this.loopNotes, MUSICBOX.length);
        const len = L + 3;
        const i = s % len;
        if (i < L) this.musicBox(mtof(MUSICBOX[i]), t, 0.11);
        if (s % 2 === 0) this.revTick(t, 0.025);
        if (i === 0) this.pad([mtof(52), mtof(59)], t, d * len, 0.02, 'triangle', 600);
        break;
      }
      case 'sky': {
        const i = s % 32;
        const chords = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
        const bar = Math.floor(i / 8);
        const pat = [0, 1, 2, 3, 2, 1, 0, 2];
        this.pluck(mtof(chords[bar][pat[i % 8]]), t, 0.1, 2200);
        if (i % 8 === 0) {
          this.pluck(mtof(chords[bar][0] - 24), t, 0.12, 600);
          this.choir(chords[bar].slice(0, 3).map((n) => mtof(n)), t, d * 8.2, 0.04);
        }
        break;
      }
      case 'hollow': {
        if (this.hollowPhase === 0) {
          if (s % 24 === 0) this.piano(mtof(57), t, 3, 0.04);
          if (s % 24 === 12) this.musicBox(mtof(88), t, 0.02);
        } else {
          const i = s % 32;
          const n = THEME[i];
          if (n) this.piano(mtof(n - 12), t, 2.4, this.hollowPhase === 2 ? 0.12 : 0.1);
          if (i % 8 === 0) {
            const bar = Math.floor(i / 8);
            this.piano(mtof(THEME_BASS[bar] - 12), t, 3, 0.09);
            if (this.hollowPhase === 2) this.pad(THEME_CHORDS[bar].map((x) => mtof(x - 12)), t, d * 8, 0.04, 'sawtooth', 500);
          }
          if (this.hollowPhase === 2 && s % 2 === 0) this.pluck(mtof(33), t, 0.07, 200);
        }
        break;
      }
      case 'good': {
        const i = s % 32;
        const n = THEME_MAJ[i];
        if (n) this.piano(mtof(n), t, 1.8, 0.14);
        if (i % 8 === 0) {
          const bar = Math.floor(i / 8);
          this.piano(mtof(MAJ_BASS[bar]), t, 2.8, 0.12);
          this.choir(MAJ_CHORDS[bar].map(mtof), t, d * 8.2, 0.035);
        }
        if (i % 2 === 1) this.pluck(mtof(MAJ_CHORDS[Math.floor(i / 8)][(i >> 1) % 3] + 12), t, 0.04, 2500);
        break;
      }
      case 'neutral': {
        const i = s % 32;
        const n = THEME[i];
        if (n && i % 4 === 0) this.piano(mtof(n), t, 2.4, 0.12);
        if (i % 16 === 0) this.pad(THEME_CHORDS[(i / 8) | 0].map(mtof), t, d * 16, 0.03, 'triangle', 700);
        break;
      }
      case 'dark': {
        if (s % 8 === 0) this.pad([mtof(40), mtof(41), mtof(47)], t, d * 8, 0.04, 'sawtooth', 400);
        if (s % 6 === 3) this.revTick(t, 0.04);
        if (s % 16 === 0) this.piano(mtof(THEME[(s / 2) % 32] ?? 57) - 0, t, 3, 0.05);
        break;
      }
    }
  }

  // ---------- instruments ----------
  private env(g: GainNode, t: number, a: number, peak: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  private piano(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(5000, f * 6);
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.001;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.music);
    this.env(g, t, 0.006, vol, dur);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  private pad(fs: number[], t: number, dur: number, vol: number, type: OscillatorType, cutoff: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    lp.connect(g); g.connect(this.music);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    fs.forEach((f) => {
      [-4, 4].forEach((det) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
      });
    });
  }
  private choir(fs: number[], t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 750; bp.Q.value = 1.2;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 1150; bp2.Q.value = 2;
    bp.connect(g); bp2.connect(g); g.connect(this.music);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5;
    const lg = ctx.createGain(); lg.gain.value = 4; lfo.connect(lg);
    fs.forEach((f) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      lg.connect(o.detune);
      o.connect(bp); o.connect(bp2); o.start(t); o.stop(t + dur + 0.05);
    });
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  private pluck(f: number, t: number, vol: number, cutoff: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff * 2, t); lp.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.3), t + 0.5);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f * 1.003;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.music);
    this.env(g, t, 0.004, vol, 1.1);
    o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 1.2);
  }
  private musicBox(f: number, t: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain(); g.connect(this.music);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4.07;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    o.connect(g); o2.connect(g2); g2.connect(g);
    this.env(g, t, 0.003, vol, 1.4);
    o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
  }
  private brass(fs: number[], t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1800, t + 0.08); lp.frequency.linearRampToValueAtTime(900, t + dur);
    lp.connect(g); g.connect(this.music);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    fs.forEach((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); });
  }
  private noiseHit(t: number, vol: number, freq: number, dur: number, type: BiquadFilterType = 'bandpass', bus?: GainNode, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(bus || this.music);
    this.env(g, t, 0.002, vol, dur);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  private tick2(t: number, vol: number, freq: number) { this.noiseHit(t, vol, freq, 0.04, 'bandpass', undefined, 6); }
  private revTick(t: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 5;
    const g = ctx.createGain(); src.connect(f); f.connect(g); g.connect(this.music);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.12); g.gain.setValueAtTime(0.0001, t + 0.125);
    src.start(t); src.stop(t + 0.15);
  }
  private drone(fs: number[], type: OscillatorType, vol: number, cutoff: number): Cont & { gain: GainNode } {
    const ctx = this.ctx!;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.setTargetAtTime(vol, ctx.currentTime, 1.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    lp.connect(g); g.connect(this.music);
    const oscs = fs.map((f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(lp); o.start(); return o; });
    return {
      gain: g,
      stop: () => {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0.0001, now, 0.4);
        oscs.forEach((o) => { try { o.stop(now + 2); } catch { /* */ } });
      },
    };
  }
  private waves(vol: number): Cont {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = ctx.createGain(); g.gain.value = vol * 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ctx.createGain(); lg.gain.value = vol * 0.5;
    lfo.connect(lg); lg.connect(g.gain);
    const master = ctx.createGain(); master.gain.value = 0.0001; master.gain.setTargetAtTime(1, ctx.currentTime, 1);
    src.connect(lp); lp.connect(g); g.connect(master); master.connect(this.music);
    src.start(); lfo.start();
    return {
      stop: () => {
        const now = ctx.currentTime;
        master.gain.setTargetAtTime(0.0001, now, 0.4);
        try { src.stop(now + 2); lfo.stop(now + 2); } catch { /* */ }
      },
    };
  }

  // ---------- SFX ----------
  private tone(f: number, t: number, dur: number, vol: number, type: OscillatorType = 'sine', slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); o.connect(g); g.connect(this.sfxBus);
    this.env(g, t, 0.005, vol, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name: Sfx) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.005;
    const S = this.sfxBus;
    switch (name) {
      case 'blip': {
        if (t - this.lastBlip < 0.045) return;
        this.lastBlip = t;
        this.tone(520 + Math.random() * 160, t, 0.03, 0.03, 'square');
        break;
      }
      case 'select': this.tone(660, t, 0.06, 0.06, 'triangle'); this.tone(990, t + 0.05, 0.08, 0.05, 'triangle'); break;
      case 'interact': this.tone(440, t, 0.08, 0.08, 'triangle'); this.tone(660, t + 0.06, 0.1, 0.06, 'triangle'); break;
      case 'pickup': [0, 4, 7, 12].forEach((n, i) => this.tone(mtof(76 + n), t + i * 0.06, 0.25, 0.07, 'triangle')); break;
      case 'photo': [0, 7, 12, 16, 19].forEach((n, i) => this.tone(mtof(72 + n), t + i * 0.08, 0.5, 0.06, 'sine')); this.noiseHit(t, 0.08, 4000, 0.1, 'highpass', S); break;
      case 'success': [0, 4, 7, 12, 16].forEach((n, i) => this.tone(mtof(67 + n), t + i * 0.09, 0.5, 0.07, 'triangle')); break;
      case 'fail': this.tone(300, t, 0.3, 0.08, 'sawtooth', 120); break;
      case 'hit': this.noiseHit(t, 0.25, 1400, 0.1, 'bandpass', S, 1); this.tone(180, t, 0.1, 0.12, 'square', 60); break;
      case 'swing': this.noiseHit(t, 0.08, 2400, 0.12, 'bandpass', S, 2); break;
      case 'hurt': this.tone(240, t, 0.25, 0.14, 'sawtooth', 70); this.noiseHit(t, 0.15, 600, 0.15, 'lowpass', S); break;
      case 'block': this.tone(1200, t, 0.15, 0.08, 'square', 900); this.noiseHit(t, 0.12, 3000, 0.06, 'highpass', S); break;
      case 'dodge': this.noiseHit(t, 0.1, 900, 0.18, 'bandpass', S, 0.7); break;
      case 'door': this.tone(110, t, 0.5, 0.12, 'sawtooth', 70); this.noiseHit(t, 0.1, 300, 0.4, 'lowpass', S); break;
      case 'whoosh': {
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.6);
        const g = ctx.createGain(); src.connect(f); f.connect(g); g.connect(S);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + 0.8);
        src.start(t); src.stop(t + 0.9);
        break;
      }
      case 'crack': this.noiseHit(t, 0.3, 5000, 0.5, 'highpass', S); this.tone(1800, t, 1.2, 0.04, 'sine', 4000); break;
      case 'rumble': this.noiseHit(t, 0.4, 120, 1.2, 'lowpass', S); break;
      case 'splash': this.noiseHit(t, 0.2, 1200, 0.4, 'lowpass', S); break;
      case 'bubble': this.tone(400 + Math.random() * 300, t, 0.08, 0.05, 'sine', 1200); break;
      case 'bark': this.tone(520, t, 0.09, 0.14, 'sawtooth', 300); this.noiseHit(t, 0.12, 900, 0.08, 'bandpass', S, 2); this.tone(480, t + 0.13, 0.08, 0.1, 'sawtooth', 280); break;
      case 'gear': this.tone(90, t, 0.25, 0.12, 'square', 60); this.noiseHit(t, 0.1, 2000, 0.05, 'bandpass', S, 4); break;
      case 'steam': this.noiseHit(t, 0.25, 3500, 0.7, 'highpass', S); break;
      case 'portal': [0, 7, 12, 19, 24].forEach((n, i) => this.tone(mtof(60 + n), t + i * 0.05, 1.2, 0.05, 'sine')); this.noiseHit(t, 0.1, 800, 1, 'bandpass', S, 0.5); break;
      case 'shield': this.tone(800, t, 0.4, 0.07, 'sine', 1600); this.tone(1200, t, 0.4, 0.05, 'triangle', 2400); break;
      case 'rewind': this.tone(1500, t, 0.6, 0.08, 'triangle', 200); this.tone(1000, t + 0.1, 0.5, 0.05, 'sine', 150); break;
      case 'lamp': this.tone(mtof(84), t, 0.6, 0.06, 'sine'); this.tone(mtof(91), t + 0.05, 0.6, 0.04, 'sine'); break;
      case 'echo': this.tone(140, t, 0.8, 0.08, 'sawtooth', 70); this.tone(147, t, 0.8, 0.06, 'sawtooth', 73); break;
      case 'bell': [0, 12, 19, 24].forEach((n, i) => this.tone(mtof(48 + n), t, 3 - i * 0.4, 0.09, 'sine')); break;
      case 'scan': this.tone(300, t, 0.6, 0.05, 'sine', 1800); break;
      case 'heal': [0, 4, 7].forEach((n, i) => this.tone(mtof(72 + n), t + i * 0.04, 0.4, 0.05, 'sine')); break;
    }
  }
}
