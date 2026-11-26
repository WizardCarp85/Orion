import { useEffect, useRef, useState } from 'react';
import { Game } from './game/game';
import { useUI } from './game/store';
import { LEVELS } from './game/levels';
import { Hud, DialogueBox, ChoiceBox, Toast, Legend } from './ui/Hud';
import { TitleScreen, LevelSelect, PauseMenu, RewardScreen, EndingScreen } from './ui/Screens';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [scale, setScale] = useState(1);
  const [, force] = useState(0);
  const ui = useUI();

  useEffect(() => {
    if (!canvasRef.current || gameRef.current) return;
    gameRef.current = new Game(canvasRef.current);
    if (import.meta.env.DEV) (window as unknown as { __orion?: Game }).__orion = gameRef.current;
    force((n) => n + 1);
    return () => { gameRef.current?.destroy(); gameRef.current = null; };
  }, []);

  useEffect(() => {
    const fit = () => setScale(Math.max(0.3, Math.min(window.innerWidth / 960, window.innerHeight / 600)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const g = gameRef.current;
  const inGame = ui.screen === 'game';

  return (
    <div className="w-full h-full flex items-center justify-center bg-black" onMouseDown={() => g?.unlockAudio()}>
      <div className="relative overflow-hidden" style={{ width: 960, height: 600, transform: `scale(${scale})`, transformOrigin: 'center center', flex: 'none' }}>
        <canvas ref={canvasRef} width={960} height={600} className="absolute inset-0 block" />
        {g && (
          <>
            {inGame && !ui.inCutscene && !ui.paused && <Hud ui={ui} />}
            {inGame && !ui.inCutscene && !ui.paused && ui.showLegend && <Legend levelIndex={ui.levelIndex} />}
            {ui.inCutscene && ui.cutsceneTitle && (
              <>
                <div className="absolute top-3 left-5 text-[13px] tracking-[0.25em] uppercase text-sky-200/80 font-mono fade-in">{ui.cutsceneTitle}</div>
                <div className="absolute bottom-3 right-5 text-[11px] text-white/40 font-mono">X — skip cutscene</div>
              </>
            )}
            {ui.dialogue && <DialogueBox d={ui.dialogue} onAdvance={() => g.input.pressed.add('KeyE')} />}
            {ui.choice && <ChoiceBox c={ui.choice} onPick={(i) => g.selectChoice(i)} onHover={(i) => g.hoverChoice(i)} />}
            {ui.toast && <Toast key={ui.toast.id} text={ui.toast.text} />}
            {ui.screen === 'title' && !ui.inCutscene && <TitleScreen g={g} ui={ui} />}
            {ui.screen === 'levelselect' && !ui.inCutscene && <LevelSelect g={g} />}
            {inGame && ui.paused && <PauseMenu g={g} ui={ui} />}
            {ui.reward && <RewardScreen reward={ui.reward} onContinue={() => g.confirmReward()} next={LEVELS[ui.levelIndex + 1]?.name} />}
            {ui.screen === 'ending' && ui.ending && <EndingScreen kind={ui.ending} g={g} />}
          </>
        )}
      </div>
    </div>
  );
}
