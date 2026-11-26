import { useState } from 'react';
import type { Game } from '../game/game';
import { ui as uiStore, type UIState } from '../game/store';
import { LEVELS } from '../game/levels';

function Btn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`w-[260px] px-4 py-2.5 rounded-md border text-[14px] tracking-wider transition
        ${disabled ? 'opacity-30 cursor-not-allowed border-white/10 bg-white/5 text-white/60'
          : primary ? 'bg-sky-400/20 border-sky-300/60 text-white hover:bg-sky-400/35 shadow-[0_0_20px_rgba(125,211,252,0.25)]'
            : 'bg-white/5 border-white/15 text-white/85 hover:bg-white/15 hover:border-white/40'}`}>
      {children}
    </button>
  );
}

export function TitleScreen({ g, ui }: { g: Game; ui: UIState }) {
  const [confirm, setConfirm] = useState(false);
  void ui.saveVersion; // re-render on save changes
  const s = g.save;
  const photos = s.photos.filter(Boolean).length;
  const canContinue = s.started && !!s.checkpoint;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white" onMouseDown={() => g.unlockAudio()}>
      <div className="text-[11px] tracking-[0.6em] text-sky-200/60 mb-2 fade-in">A STORY ACROSS FIVE UNIVERSES</div>
      <h1 className="text-[86px] font-extralight tracking-[0.35em] pl-[0.35em] glow-text leading-none fade-in">ORION</h1>
      <div className="text-[13px] italic text-white/55 mt-3 mb-8 max-w-[560px] text-center fade-in">"Pain is the proof that we loved. Love is the reason we keep going."</div>
      {!confirm ? (
        <div className="flex flex-col gap-2 items-center fade-in">
          {canContinue && <Btn primary onClick={() => g.continueGame()}>Continue — {LEVELS[s.checkpoint!.level]?.name}</Btn>}
          <Btn primary={!canContinue} onClick={() => (s.started ? setConfirm(true) : g.newGame())}>New Game</Btn>
          <Btn onClick={() => { g.unlockAudio(); uiStore.set({ screen: 'levelselect' }); }}>Level Select</Btn>
          {photos >= 6 && <Btn onClick={() => g.playEpilogue()}>★ Bonus Epilogue</Btn>}
        </div>
      ) : (
        <div className="flex flex-col gap-2 items-center fade-in">
          <div className="text-sm text-white/80 mb-1">Start over? Story progress will be reset (photos & endings are kept).</div>
          <Btn primary onClick={() => { setConfirm(false); g.newGame(); }}>Yes, start a new journey</Btn>
          <Btn onClick={() => setConfirm(false)}>Cancel</Btn>
        </div>
      )}
      <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6 text-[11px] text-white/40 font-mono">
        <span>Photos of Orion: {photos}/6{photos < 6 ? ' — find all 6 to unlock the epilogue' : ''}</span>
        <span>Endings seen: {['good', 'neutral', 'dark'].map((e) => (s.endings.includes(e) ? '●' : '○')).join(' ')}</span>
        <span>{ui.audioReady ? '♪ audio on' : 'click or press a key to enable audio'}</span>
      </div>
    </div>
  );
}

export function LevelSelect({ g }: { g: Game }) {
  const s = g.save;
  const back = () => uiStore.set({ screen: 'title' });
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white fade-in">
      <h2 className="text-2xl font-light tracking-[0.4em] mb-1">LEVEL SELECT</h2>
      <div className="text-[11px] text-white/50 mb-5">Levels unlock as you complete them.</div>
      <div className="grid grid-cols-3 gap-3 w-[860px]">
        {LEVELS.map((L, i) => {
          const open = i <= s.unlocked;
          return (
            <button key={i} disabled={!open} onClick={() => g.startLevel(i)}
              className={`relative text-left h-[132px] rounded-lg border p-3 overflow-hidden transition bg-gradient-to-br ${L.color}
              ${open ? 'border-white/25 hover:border-sky-200/80 hover:scale-[1.02]' : 'border-white/5 grayscale opacity-40 cursor-not-allowed'}`}>
              <div className="text-[10px] font-mono text-white/60">LEVEL {i}</div>
              <div className="text-[17px] font-semibold leading-tight">{open ? L.name : '???'}</div>
              <div className="text-[11px] text-white/70 mt-0.5">{open ? L.subtitle : 'Locked'}</div>
              {open && L.helper !== '—' && <div className="text-[11px] text-white/60 mt-1">With {L.helper}</div>}
              <div className="absolute bottom-2 left-3 right-3 flex justify-between text-[11px] text-white/80">
                <span>{s.photos[i] ? '◉ photo found' : open ? '○ photo' : ''}</span>
                <span>{i >= 1 && i <= 4 && s.pieces[i - 1] ? '◆ piece' : ''}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-6"><Btn onClick={back}>Back</Btn></div>
    </div>
  );
}

export function PauseMenu({ g, ui }: { g: Game; ui: UIState }) {
  const [confirm, setConfirm] = useState<'title' | 'load' | null>(null);
  const s = g.save;
  void ui.saveVersion;
  const items: [keyof typeof s.items, string][] = [['jumper', 'Universe Jumper'], ['navigator', 'Orb Navigator'], ['multitool', 'Multi-Tool [1]'], ['pearl', 'Pearl Charm [2]'], ['watch', 'Pocket Watch [3]'], ['collar', "Orion's Collar [4]"]];
  return (
    <div className="absolute inset-0 bg-black/75 flex items-center justify-center text-white fade-in">
      <div className="flex gap-8">
        <div className="flex flex-col gap-2 items-center">
          <h2 className="text-3xl font-light tracking-[0.4em] mb-3">PAUSED</h2>
          {!confirm ? (
            <>
              <Btn primary onClick={() => g.pause(false)}>Resume</Btn>
              <Btn onClick={() => g.manualSave()}>Save Progress</Btn>
              <Btn onClick={() => setConfirm('load')}>Load Last Save</Btn>
              <Btn onClick={() => { g.pause(false); g.restartStage(); }}>Restart Area</Btn>
              <Btn onClick={() => setConfirm('title')}>Quit to Title</Btn>
            </>
          ) : (
            <>
              <div className="text-sm text-white/80 w-[260px] text-center">{confirm === 'title' ? 'Return to title? Your checkpoint at the start of this area is kept.' : 'Reload your last saved checkpoint?'}</div>
              <Btn primary onClick={() => { const c = confirm; setConfirm(null); if (c === 'title') { g.pause(false); g.toTitle(); } else g.loadGame(); }}>Yes</Btn>
              <Btn onClick={() => setConfirm(null)}>Cancel</Btn>
            </>
          )}
          <div className="text-[11px] text-white/40 mt-2 font-mono">Esc / P to resume</div>
        </div>
        <div className="w-[300px] bg-white/5 border border-white/10 rounded-lg p-4 text-[12px]">
          <div className="text-[10px] uppercase tracking-[0.25em] text-sky-300/80 mb-2">Journey</div>
          <div className="mb-2">{ui.levelName} — <span className="text-white/60">{ui.stageName}</span></div>
          <div className="mb-1 text-white/70">Orb pieces: {s.pieces.map((p, i) => <span key={i} className={p ? 'text-sky-300' : 'text-white/20'}>◆</span>)}</div>
          <div className="mb-2 text-white/70">Photos of Orion: {s.photos.filter(Boolean).length}/6</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-sky-300/80 mb-1">Items</div>
          {items.map(([k, n]) => <div key={k} className={s.items[k] ? 'text-white/90' : 'text-white/25'}>{s.items[k] ? '✓' : '·'} {n}</div>)}
          {s.echoChoice && <div className="mt-2 text-white/60">Quiet Sky choice: <b className="text-white/85">{s.echoChoice}</b></div>}
        </div>
      </div>
    </div>
  );
}

export function RewardScreen({ reward, onContinue, next }: { reward: { title: string; items: string[] }; onContinue: () => void; next?: string }) {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white fade-in">
      <div className="text-[11px] tracking-[0.5em] text-amber-200/70 mb-2">LEVEL COMPLETE</div>
      <h2 className="text-3xl font-light mb-6 glow-text">{reward.title}</h2>
      <div className="flex gap-3 mb-8">
        {reward.items.map((it) => (
          <div key={it} className="floaty px-5 py-4 rounded-lg border border-amber-200/40 bg-amber-200/10 text-amber-50 text-[15px] shadow-[0_0_24px_rgba(255,210,140,0.2)]">✦ {it}</div>
        ))}
      </div>
      <Btn primary onClick={onContinue}>{next ? `Continue to ${next}` : 'Continue'}</Btn>
      <div className="text-[11px] text-white/40 mt-2 font-mono">Progress saved · E / Space to continue</div>
    </div>
  );
}

const ENDINGS = {
  good: { title: 'Ending — Mercy', sub: 'Two Arins became one. Every universe is whole again.', color: 'text-amber-100' },
  neutral: { title: 'Ending — Duty', sub: 'The worlds were saved. One of you was not.', color: 'text-sky-100' },
  dark: { title: 'Ending — Anger', sub: 'The Orb shattered. The jumping never stops.', color: 'text-rose-200' },
};

export function EndingScreen({ kind, g }: { kind: 'good' | 'neutral' | 'dark'; g: Game }) {
  const e = ENDINGS[kind];
  const s = g.save;
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white fade-in">
      <h2 className={`text-4xl font-extralight tracking-[0.2em] mb-2 ${e.color}`}>{e.title}</h2>
      <div className="text-white/70 mb-6">{e.sub}</div>
      <div className="italic text-white/80 text-[15px] mb-8 max-w-[600px] text-center">"Pain is the proof that we loved. Love is the reason we keep going."</div>
      <div className="text-[12px] text-white/50 mb-6 font-mono text-center">
        Endings seen: {(['good', 'neutral', 'dark'] as const).map((k) => (s.endings.includes(k) ? ENDINGS[k].title.replace('Ending — ', '') : '???')).join(' · ')}
        <br />Photos of Orion: {s.photos.filter(Boolean).length}/6{s.photos.every(Boolean) ? ' — Bonus epilogue unlocked!' : ''}
        {kind !== 'good' && <><br />Hint: mercy begins long before the final choice — in the Quiet Sky.</>}
      </div>
      <div className="flex gap-3">
        <Btn onClick={() => g.startLevel(5)}>Replay the Hollow Universe</Btn>
        <Btn primary onClick={() => g.toTitle()}>Return to Title</Btn>
      </div>
    </div>
  );
}
