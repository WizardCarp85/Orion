import type { UIState, DialogueView, ChoiceView } from '../game/store';

const TOOL_NAMES = ['Multi-Tool', 'Pearl Charm', 'Pocket Watch', "Orion's Collar"];
const TOOL_ICONS = [
  // wrench
  <svg key="0" viewBox="0 0 24 24" className="w-5 h-5"><path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.3-6.3a4 4 0 0 1-5-5L13 5z M4 20l5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>,
  // pearl
  <svg key="1" viewBox="0 0 24 24" className="w-5 h-5"><circle cx="12" cy="13" r="6" fill="currentColor" opacity="0.85" /><circle cx="10" cy="11" r="1.6" fill="#fff" /><path d="M12 3v4" stroke="currentColor" strokeWidth="2" /></svg>,
  // watch
  <svg key="2" viewBox="0 0 24 24" className="w-5 h-5"><circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M12 13V9M12 13l3 2M10 3h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  // collar
  <svg key="3" viewBox="0 0 24 24" className="w-5 h-5"><ellipse cx="12" cy="10" rx="8" ry="5" stroke="currentColor" strokeWidth="2.5" fill="none" /><circle cx="12" cy="17" r="3" fill="currentColor" /></svg>,
];

function Heart({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow">
      <path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2.1 0 3.5 1.2 5.5 3.3C14 6.2 15.4 5 17.5 5 21 5 23 8.6 21.6 11.8 19.5 16.4 12 21 12 21z" fill={full ? '#ff6b81' : 'rgba(255,255,255,0.12)'} stroke={full ? '#ffb3c0' : 'rgba(255,255,255,0.3)'} strokeWidth="1.2" />
    </svg>
  );
}

export function Hud({ ui }: { ui: UIState }) {
  return (
    <div className="absolute inset-0 pointer-events-none text-white font-sans">
      {/* top-left: hp, pieces, photos */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
        <div className="flex gap-0.5">{Array.from({ length: ui.maxHp }, (_, i) => <Heart key={i} full={i < ui.hp} />)}</div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-white/80 bg-black/40 rounded px-2 py-1">
          <span className="flex items-center gap-1" title="Orb pieces">
            {Array.from({ length: 5 }, (_, i) => <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full ${i < ui.pieces ? 'bg-sky-300 shadow-[0_0_6px_#7dd3fc]' : 'bg-white/15'}`} />)}
          </span>
          <span title="Photos of Orion" className="flex items-center gap-1"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline -mt-0.5"><rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="13.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 7l2-3h4l2 3" fill="none" stroke="currentColor" strokeWidth="2" /></svg> {ui.photos}/6</span>
        </div>
        {ui.activeChar && <div className="text-[11px] font-mono bg-amber-500/25 border border-amber-300/40 rounded px-2 py-0.5 text-amber-100">Controlling: <b>{ui.activeChar}</b> · Tab to switch</div>}
      </div>

      {/* top-center: level / boss / timer */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 w-[420px]">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">{ui.levelName} · {ui.stageName}</div>
        {ui.timer && <div className="font-mono text-lg text-amber-200 bg-black/50 px-3 rounded border border-amber-200/30">{ui.timer}</div>}
        {ui.boss && (
          <div className="w-full">
            <div className="text-[11px] text-center text-red-100 tracking-widest uppercase">{ui.boss.name}</div>
            <div className="h-2.5 bg-black/60 rounded-full border border-white/20 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-600 to-orange-400 transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(1, ui.boss.value)) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* top-right: objective */}
      <div className="absolute top-3 right-3 w-[270px] bg-black/45 border border-white/10 rounded-md px-3 py-2 backdrop-blur-[1px]">
        <div className="text-[9px] uppercase tracking-[0.25em] text-sky-300/80 mb-0.5">Objective</div>
        <div className="text-[12px] leading-snug text-white/90">{ui.objective}</div>
        {ui.meters.map((m) => (
          <div key={m.label} className="mt-1.5">
            <div className="flex justify-between text-[10px] text-white/70"><span>{m.label}</span><span>{Math.round(Math.max(0, Math.min(1, m.value)) * 100)}%</span></div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, m.value)) * 100}%`, background: m.color }} /></div>
          </div>
        ))}
      </div>

      {/* bottom-center: prompt / hint */}
      <div className="absolute bottom-[74px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        {ui.hint && !ui.dialogue && <div className="text-[11px] text-sky-100/90 bg-sky-900/60 border border-sky-300/30 rounded px-3 py-1 max-w-[470px] text-center">{ui.hint}</div>}
        {ui.prompt && !ui.dialogue && !ui.choice && <div className="text-[13px] bg-black/70 border border-white/25 rounded px-3 py-1 fade-in">{ui.prompt}</div>}
      </div>

      {/* bottom-left: tools */}
      {ui.tools.owned.some(Boolean) && (
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          {ui.tools.owned.map((o, i) => (
            <div key={i} title={TOOL_NAMES[i]} className={`relative w-11 h-11 rounded-md border flex items-center justify-center ${o ? (ui.tools.ready[i] ? 'bg-slate-800/80 border-sky-300/50 text-sky-100' : 'bg-slate-900/80 border-white/10 text-white/30') : 'bg-black/30 border-white/5 text-white/10'}`}>
              {o ? TOOL_ICONS[i] : <span className="text-xs">?</span>}
              <span className="absolute top-0 left-1 text-[9px] font-mono text-white/60">{i + 1}</span>
            </div>
          ))}
        </div>
      )}
      <div className="absolute bottom-3 right-3 text-[10px] text-white/35 font-mono">Esc pause · H controls</div>
    </div>
  );
}

export function Legend({ levelIndex }: { levelIndex: number }) {
  const rows: [string, string][] = [
    ['WASD / Arrows', 'Move'],
    ['E / Space', 'Interact · advance · attack'],
    ['Shift', 'Dodge'],
    ['Q', 'Block (tap just before a hit to counter)'],
    ['1-4', 'Tools'],
  ];
  if (levelIndex === 1) rows.push(['Tab', 'Switch Arins']);
  rows.push(['Esc / P', 'Pause · save'], ['H', 'Hide this panel']);
  return (
    <div className="absolute right-3 bottom-8 bg-black/45 border border-white/10 rounded-md px-3 py-2 text-[10.5px] text-white/80 pointer-events-none">
      <div className="text-[9px] uppercase tracking-[0.25em] text-sky-300/80 mb-1">Controls</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2"><span className="font-mono text-amber-200/90 w-[92px]">{k}</span><span>{v}</span></div>
      ))}
    </div>
  );
}

export function DialogueBox({ d, onAdvance }: { d: DialogueView; onAdvance: () => void }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-[820px] cursor-pointer" onClick={onAdvance}>
      <div className="bg-gradient-to-b from-slate-950/90 to-black/95 border border-white/15 rounded-lg px-5 py-3 shadow-2xl min-h-[92px]">
        {d.speaker && <div className="text-[12px] font-bold tracking-widest uppercase mb-1" style={{ color: d.color }}>{d.speaker}</div>}
        <div className={`text-[15.5px] leading-relaxed ${d.speaker ? 'text-white/95' : 'text-white/80 italic'}`}>
          {d.text.slice(0, d.shown)}
          <span className="opacity-0">{d.text.slice(d.shown)}</span>
        </div>
        <div className="text-right text-[10px] text-white/40 font-mono -mt-1">{d.done ? <span className="blink">▼ E / Space</span> : ' '}</div>
      </div>
    </div>
  );
}

export function ChoiceBox({ c, onPick, onHover }: { c: ChoiceView; onPick: (i: number) => void; onHover: (i: number) => void }) {
  return (
    <div className="absolute inset-0 flex items-end justify-center pb-6 bg-black/30">
      <div className="w-[700px] bg-slate-950/95 border border-sky-200/25 rounded-lg p-4 shadow-2xl fade-in">
        <div className="text-[15px] text-white/95 mb-3">{c.prompt}</div>
        <div className="flex flex-col gap-1.5">
          {c.options.map((o, i) => (
            <button key={i} onMouseEnter={() => onHover(i)} onClick={() => onPick(i)}
              className={`text-left px-3 py-2 rounded border text-[14px] transition ${i === c.selected ? 'bg-sky-500/25 border-sky-300/70 text-white' : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'}`}>
              <span className="font-mono text-sky-300/80 mr-2">{i + 1}.</span>{o}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-white/40 mt-2 font-mono">W/S or ↑/↓ to choose · E / Space to confirm · or press the number</div>
      </div>
    </div>
  );
}

export function Toast({ text }: { text: string }) {
  return (
    <div className="absolute top-[86px] left-1/2 -translate-x-1/2 pointer-events-none toast-anim">
      <div className="bg-black/75 border border-amber-200/40 text-amber-50 text-[13px] rounded-md px-4 py-1.5 shadow-lg max-w-[640px] text-center">{text}</div>
    </div>
  );
}
