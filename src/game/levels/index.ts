import type { Game } from '../game';
import type { Stage } from '../stage';
import type { Mood } from '../audio';
import type { SaveData } from '../save';
import { L0Lab, L0Path, L0Cave } from './level0';
import { L1Rooftops, L1ClockTower, L1Underworks, L1Heart, L1Chase } from './level1';
import { L2Island, L2Boat, L2Dive, L2Temple, L2Leviathan, L2Impostor } from './level2';
import { L3Library, L3Keeper } from './level3';
import { L4Shelter, L4Village, L4Maze, L4Mist, L4Choice } from './level4';
import { L5Path, L5Swarm, L5Lab, L5Battle } from './level5';

export interface LevelDef {
  name: string;
  subtitle: string;
  mood: Mood;
  intro?: string;
  stages: (new (g: Game) => Stage)[];
  reward: { title: string; items: string[]; apply: (s: SaveData) => void } | null;
  color: string;
  helper: string;
}

export const LEVELS: LevelDef[] = [
  {
    name: 'The Main World', subtitle: 'Tutorial — Mountain lab, observatory & cave', mood: 'main', intro: 'intro0',
    stages: [L0Lab, L0Path, L0Cave], color: 'from-indigo-900 to-slate-900', helper: '—',
    reward: { title: 'The Jump', items: ['Universe Jumper', 'Orb Navigator'], apply: (s) => { s.items.jumper = true; s.items.navigator = true; } },
  },
  {
    name: 'Gearfall City', subtitle: 'Machine Universe', mood: 'gear', intro: 'intro1',
    stages: [L1Rooftops, L1ClockTower, L1Underworks, L1Heart, L1Chase], color: 'from-amber-800 to-orange-950', helper: 'Engineer Arin',
    reward: { title: 'Gearfall City restored', items: ['Orb Piece 1', 'Multi-Tool  [1]'], apply: (s) => { s.items.multitool = true; s.pieces[0] = true; } },
  },
  {
    name: 'The Drowned World', subtitle: 'Ocean Universe', mood: 'ocean', intro: 'intro2',
    stages: [L2Island, L2Boat, L2Dive, L2Temple, L2Leviathan, L2Impostor], color: 'from-cyan-800 to-slate-950', helper: 'Warrior Arin',
    reward: { title: 'The Drowned World endures', items: ['Orb Piece 2', 'Pearl Charm  [2]'], apply: (s) => { s.items.pearl = true; s.pieces[1] = true; } },
  },
  {
    name: 'The Looping Library', subtitle: 'Time Universe', mood: 'library', intro: 'intro3',
    stages: [L3Library, L3Keeper], color: 'from-purple-900 to-rose-950', helper: 'Genius Arin',
    reward: { title: 'Time moves forward again', items: ['Orb Piece 3', 'Pocket Watch  [3]'], apply: (s) => { s.items.watch = true; s.pieces[2] = true; } },
  },
  {
    name: 'The Quiet Sky', subtitle: 'Dream Universe', mood: 'sky', intro: 'intro4',
    stages: [L4Shelter, L4Village, L4Maze, L4Mist, L4Choice], color: 'from-pink-400 to-rose-800', helper: 'Healer Arin & Orion',
    reward: { title: 'The last piece', items: ['Orb Piece 4', "Orion's Collar  [4]"], apply: (s) => { s.items.collar = true; s.pieces[3] = true; } },
  },
  {
    name: 'The Hollow Universe', subtitle: 'Final Universe', mood: 'hollow',
    stages: [L5Path, L5Swarm, L5Lab, L5Battle], color: 'from-zinc-800 to-black', helper: 'Spirits of every Arin',
    reward: null,
  },
];
