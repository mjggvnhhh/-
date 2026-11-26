export class Input {
  constructor(canvas) {
    this.axis = { x: 0, y: 0 };
    this.boostHeld = false;
    this.onPauseToggle = null;

    this._touchId = null;
    this._startX = 0;
    this._startY = 0;
    this._touchAxis = { x: 0, y: 0 };
    this._keys = new Set();
    this._range = Math.min(window.innerWidth, window.innerHeight) * 0.22;

    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));
    canvas.addEventListener('touchcancel', (e) => this._onTouchEnd(e));
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup', () => { this._mouseDown = false; this._touchAxis.x = 0; this._touchAxis.y = 0; });

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    window.addEventListener('blur', () => {
      this._keys.clear();
      this.boostHeld = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onTouchStart(e) {
    e.preventDefault();
    if (this._touchId !== null) return;
    const t = e.changedTouches[0];
    this._touchId = t.identifier;
    this._startX = t.clientX;
    this._startY = t.clientY;
    this._touchAxis.x = 0;
    this._touchAxis.y = 0;
  }

  _onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this._touchId) continue;
      const dx = (t.clientX - this._startX) / this._range;
      const dy = (t.clientY - this._startY) / this._range;
      const len = Math.hypot(dx, dy);
      const k = len > 1 ? 1 / len : 1;
      this._touchAxis.x = dx * k;
      this._touchAxis.y = -dy * k;
    }
  }

  _onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this._touchId) {
        this._touchId = null;
        this._touchAxis.x = 0;
        this._touchAxis.y = 0;
      }
    }
  }

  _onMouseDown(e) {
    this._mouseDown = true;
    this._mouseStartX = e.clientX;
    this._mouseStartY = e.clientY;
  }

  _onMouseMove(e) {
    if (!this._mouseDown) return;
    const dx = (e.clientX - this._mouseStartX) / this._range;
    const dy = (e.clientY - this._mouseStartY) / this._range;
    const len = Math.hypot(dx, dy);
    const k = len > 1 ? 1 / len : 1;
    this._touchAxis.x = dx * k;
    this._touchAxis.y = -dy * k;
  }

  _onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this._keys.add(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') this.boostHeld = true;
    if ((e.code === 'KeyP' || e.code === 'Escape') && this.onPauseToggle) this.onPauseToggle();
  }

  _onKeyUp(e) {
    this._keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') this.boostHeld = false;
  }

  update(dt) {
    let kx = 0;
    let ky = 0;
    if (this._keys.has('ArrowLeft') || this._keys.has('KeyA')) kx -= 1;
    if (this._keys.has('ArrowRight') || this._keys.has('KeyD')) kx += 1;
    if (this._keys.has('ArrowUp') || this._keys.has('KeyW')) ky += 1;
    if (this._keys.has('ArrowDown') || this._keys.has('KeyS')) ky -= 1;
    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky) || 1;
      const s = Math.min(1, dt * 10);
      this.axis.x += (kx / len - this.axis.x) * s;
      this.axis.y += (ky / len - this.axis.y) * s;
    } else {
      const s = Math.min(1, dt * 14);
      this.axis.x += (this._touchAxis.x - this.axis.x) * s;
      this.axis.y += (this._touchAxis.y - this.axis.y) * s;
    }
  }

  reset() {
    this.axis.x = 0;
    this.axis.y = 0;
    this._touchAxis.x = 0;
    this._touchAxis.y = 0;
    this._touchId = null;
    this.boostHeld = false;
  }
}
