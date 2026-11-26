import { useSyncExternalStore } from 'react';

export interface DialogueView { speaker: string; text: string; shown: number; color: string; done: boolean; portrait?: string }
export interface ChoiceView { prompt: string; options: string[]; selected: number }
export interface MeterView { label: string; value: number; color: string }
export type Screen = 'title' | 'levelselect' | 'game' | 'ending' | 'epilogue';

export interface UIState {
  screen: Screen;
  levelIndex: number;
  levelName: string;
  stageName: string;
  objective: string;
  hp: number;
  maxHp: number;
  prompt: string | null;
  dialogue: DialogueView | null;
  choice: ChoiceView | null;
  cutsceneTitle: string | null;
  inCutscene: boolean;
  paused: boolean;
  toast: { text: string; id: number } | null;
  tools: { owned: boolean[]; ready: boolean[] };
  pieces: number;
  photos: number;
  meters: MeterView[];
  timer: string | null;
  boss: { name: string; value: number } | null;
  reward: { title: string; items: string[] } | null;
  ending: 'good' | 'neutral' | 'dark' | null;
  showLegend: boolean;
  activeChar: string | null;
  hint: string | null;
  audioReady: boolean;
  saveVersion: number;
}

const initial: UIState = {
  screen: 'title', levelIndex: 0, levelName: '', stageName: '', objective: '', hp: 5, maxHp: 5,
  prompt: null, dialogue: null, choice: null, cutsceneTitle: null, inCutscene: false, paused: false, toast: null,
  tools: { owned: [false, false, false, false], ready: [true, true, true, true] }, pieces: 0, photos: 0,
  meters: [], timer: null, boss: null, reward: null, ending: null, showLegend: true, activeChar: null, hint: null,
  audioReady: false, saveVersion: 0,
};

let state: UIState = initial;
const listeners = new Set<() => void>();

function shallowEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = (a as Record<string, unknown>)[k], vb = (b as Record<string, unknown>)[k];
    if (va !== vb) {
      if (Array.isArray(va) && Array.isArray(vb)) {
        if (va.length !== vb.length) return false;
        for (let i = 0; i < va.length; i++) if (!shallowEq(va[i], vb[i])) return false;
      } else if (typeof va === 'object' && typeof vb === 'object') {
        if (!shallowEq(va, vb)) return false;
      } else return false;
    }
  }
  return true;
}

export const ui = {
  get: () => state,
  set(patch: Partial<UIState>) {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof UIState)[]) {
      if (!shallowEq(state[k], patch[k])) { changed = true; break; }
    }
    if (!changed) return;
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useUI(): UIState {
  return useSyncExternalStore(ui.subscribe, ui.get, ui.get);
}
