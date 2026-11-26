const BLOCK = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  down = new Set<string>();
  pressed = new Set<string>();
  private onDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
    this.anyKey?.();
  };
  private onUp = (e: KeyboardEvent) => { this.down.delete(e.code); };
  private onBlur = () => { this.down.clear(); };
  anyKey: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }
  destroy() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
  isDown(...codes: string[]) { return codes.some((c) => this.down.has(c)); }
  hit(...codes: string[]) { return codes.some((c) => this.pressed.has(c)); }
  consume(...codes: string[]) { codes.forEach((c) => this.pressed.delete(c)); }
  get interact() { return this.hit('KeyE', 'Space', 'Enter'); }
  get axis() {
    let x = 0, y = 0;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    if (this.isDown('KeyW', 'ArrowUp')) y -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) y += 1;
    return { x, y };
  }
  endFrame() { this.pressed.clear(); }
}
