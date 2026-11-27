export class HUD {
  constructor(callbacks) {
    this.cb = callbacks;
    this.$ = (id) => document.getElementById(id);
    this.el = {
      score: this.$('score'),
      dist: this.$('dist'),
      mult: this.$('mult'),
      shields: this.$('shields'),
      speedFill: this.$('speedFill'),
      speedVal: this.$('speedVal'),
      boostFill: this.$('boostFill'),
      boostBtn: this.$('boostBtn'),
      crystals: this.$('crystals'),
      menu: this.$('menu'),
      pauseOv: this.$('pauseOv'),
      overOv: this.$('overOv'),
      bestMenu: this.$('bestMenu'),
      finalScore: this.$('finalScore'),
      finalDist: this.$('finalDist'),
      finalCrystals: this.$('finalCrystals'),
      overBest: this.$('overBest'),
      newRecord: this.$('newRecord'),
      hitFlash: this.$('hitFlash'),
      combo: this.$('combo'),
      vignette: this.$('vignette'),
      ui: this.$('ui')
    };

    this.el.boostBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cb.onBoost(true);
    }, { passive: false });
    this.el.boostBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.cb.onBoost(false);
    }, { passive: false });
    this.el.boostBtn.addEventListener('mousedown', () => this.cb.onBoost(true));
    window.addEventListener('mouseup', () => this.cb.onBoost(false));

    this.$('btnStart').addEventListener('click', () => this.cb.onStart());
    this.$('btnRetry').addEventListener('click', () => this.cb.onStart());
    this.$('btnResume').addEventListener('click', () => this.cb.onResume());
    this.$('btnMenuFromPause').addEventListener('click', () => this.cb.onToMenu());
    this.$('btnMenuFromOver').addEventListener('click', () => this.cb.onToMenu());
    this.$('btnPause').addEventListener('click', () => this.cb.onPause());
    this.$('btnSound').addEventListener('click', () => this.cb.onSound());

    for (const b of document.querySelectorAll('.qbtn')) {
      b.addEventListener('click', () => this.cb.onQuality(b.dataset.q));
    }

    this._comboTimer = null;
    this.setShields(3);
  }

  setMuted(m) {
    this.$('btnSound').textContent = m ? '🔇' : '🔊';
  }

  showUI() {
    this.el.ui.classList.remove('hidden');
  }

  hideUI() {
    this.el.ui.classList.add('hidden');
  }

  setQualityActive(q) {
    for (const b of document.querySelectorAll('.qbtn')) {
      b.classList.toggle('active', b.dataset.q === q);
    }
  }

  setScore(v) {
    this.el.score.textContent = Math.floor(v).toString().padStart(6, '0');
  }

  setDist(v) {
    this.el.dist.textContent = Math.floor(v) + ' м';
  }

  setMult(m) {
    this.el.mult.textContent = 'x' + m;
    this.el.mult.classList.toggle('hot', m > 1);
  }

  setCrystals(n) {
    this.el.crystals.textContent = n;
  }

  setShields(n) {
    const dots = this.el.shields.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('off', i >= n);
    }
  }

  setSpeed(norm, kmh) {
    this.el.speedFill.style.transform = 'scaleX(' + norm.toFixed(3) + ')';
    this.el.speedVal.textContent = kmh + ' км/ч';
  }

  setBoost(f) {
    this.el.boostFill.style.height = (f * 100).toFixed(1) + '%';
    this.el.boostBtn.classList.toggle('ready', f > 0.15);
  }

  setBoosting(on) {
    this.el.vignette.classList.toggle('boosting', on);
  }

  popup(text) {
    this.el.combo.textContent = text;
    this.el.combo.classList.remove('show');
    void this.el.combo.offsetWidth;
    this.el.combo.classList.add('show');
    clearTimeout(this._comboTimer);
    this._comboTimer = setTimeout(() => this.el.combo.classList.remove('show'), 900);
  }

  flash() {
    this.el.hitFlash.classList.remove('show');
    void this.el.hitFlash.offsetWidth;
    this.el.hitFlash.classList.add('show');
  }

  showMenu(best) {
    this.el.bestMenu.textContent = 'РЕКОРД: ' + Math.floor(best);
    this.el.menu.classList.remove('hidden');
    this.el.pauseOv.classList.add('hidden');
    this.el.overOv.classList.add('hidden');
  }

  hideMenu() {
    this.el.menu.classList.add('hidden');
  }

  showPause() {
    this.el.pauseOv.classList.remove('hidden');
  }

  hidePause() {
    this.el.pauseOv.classList.add('hidden');
  }

  showOver(stats) {
    this.el.finalScore.textContent = Math.floor(stats.score);
    this.el.finalDist.textContent = Math.floor(stats.dist) + ' м';
    this.el.finalCrystals.textContent = stats.crystals;
    this.el.overBest.textContent = 'РЕКОРД: ' + Math.floor(stats.best);
    this.el.newRecord.classList.toggle('hidden', !stats.isRecord);
    this.el.overOv.classList.remove('hidden');
  }

  hideOver() {
    this.el.overOv.classList.add('hidden');
  }
}
