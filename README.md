# ORION

A 2D top-down sci-fi narrative adventure that runs fully in the browser.
Built with React, TypeScript, Canvas and Tailwind. Everything is local:
- Art, lighting and particles are drawn in code on the Canvas.
- Music and sound effects are generated with Web Audio.
- Saves go to localStorage.

## Run
```
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

## Controls
| Key | Action |
| --- | --- |
| WASD / Arrows | Move |
| E / Space | Interact, advance dialogue, attack |
| Shift | Dodge |
| Q | Block (tap it just before a hit to counter) |
| 1 | Multi-Tool |
| 2 | Pearl Charm |
| 3 | Pocket Watch |
| 4 | Orion's Collar |
| Tab | Switch Arins (Gearfall City) |
| Esc / P | Pause / Save |
| H | Show or hide controls |
| X | Skip cutscene |

## Structure
- `src/game/game.ts`: the game loop, how stages and levels connect, overlays, tools and saving.
- `src/game/stage.ts`: the base class every area extends.
- `src/game/levels/level0-5.ts`: the 25 areas, spread across 6 levels.
- `src/game/cutscenes.ts`: all cutscenes, plus the 3 endings and the bonus epilogue.
- `src/game/audio.ts`: procedural music for each level, and the sound effects.
- `src/game/draw.ts` and `src/game/backdrops.ts`: the procedural art.
- `src/ui/*`: the React HUD, menus, dialogue box, level select and ending screens.

## Endings
The ending depends on two things:
1. What you choose at the Echo in the Quiet Sky.
2. What you choose at the end of the final battle.

The choices are Mercy, Duty and Anger. Find all 6 hidden Photos of Orion to unlock the bonus epilogue.
