export type EchoChoice = 'ignore' | 'answer' | 'fight';
export type FinalChoice = 'mercy' | 'duty' | 'anger';

export interface Items { jumper: boolean; navigator: boolean; multitool: boolean; pearl: boolean; watch: boolean; collar: boolean }

export interface SaveData {
  v: 1;
  started: boolean;
  unlocked: number;
  checkpoint: { level: number; stage: number } | null;
  items: Items;
  pieces: boolean[];
  photos: boolean[];
  echoChoice: EchoChoice | null;
  finalChoice: FinalChoice | null;
  endings: string[];
  clues: string[];
  savedAt: number;
}

const KEY = 'orion.save.v1';

export function freshSave(keepMeta?: SaveData): SaveData {
  return {
    v: 1, started: false, unlocked: 0, checkpoint: null,
    items: { jumper: false, navigator: false, multitool: false, pearl: false, watch: false, collar: false },
    pieces: [false, false, false, false, false],
    photos: keepMeta ? [...keepMeta.photos] : [false, false, false, false, false, false],
    echoChoice: null, finalChoice: null,
    endings: keepMeta ? [...keepMeta.endings] : [],
    clues: [], savedAt: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const d = JSON.parse(raw) as Partial<SaveData>;
    const f = freshSave();
    return {
      ...f, ...d,
      items: { ...f.items, ...(d.items || {}) },
      pieces: Array.isArray(d.pieces) && d.pieces.length === 5 ? d.pieces : f.pieces,
      photos: Array.isArray(d.photos) && d.photos.length === 6 ? d.photos : f.photos,
      endings: Array.isArray(d.endings) ? d.endings : [],
      clues: Array.isArray(d.clues) ? d.clues : [],
      v: 1,
    };
  } catch {
    return freshSave();
  }
}

export function writeSave(s: SaveData) {
  try {
    s.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — ignore */
  }
}
