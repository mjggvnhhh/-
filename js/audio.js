export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.engine = null;
    this.music = null;
    this._arpTimer = null;
    this._arpStep = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this._buildEngine();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.9, this.ctx.currentTime + 0.1);
    }
  }

  _buildEngine() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 4;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 60;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 60.7;
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    o1.start();
    o2.start();
    this.engine = { gain, filter, o1, o2 };
  }

  engineLevel(level) {
    if (!this.engine || !this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.engine.gain.gain;
    g.linearRampToValueAtTime(0.045 * level, t + 0.15);
    const base = 52 + level * 78;
    this.engine.o1.frequency.linearRampToValueAtTime(base, t + 0.15);
    this.engine.o2.frequency.linearRampToValueAtTime(base * 1.012, t + 0.15);
    this.engine.filter.frequency.linearRampToValueAtTime(280 + level * 1600, t + 0.15);
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  pickup(step) {
    const base = 720 * Math.pow(1.0595, (step % 8) * 2);
    this._blip(base, 0.16, 'sine', 0.22, base * 1.5);
  }

  gate() {
    this._blip(523, 0.3, 'triangle', 0.2, 1046);
    setTimeout(() => this._blip(784, 0.35, 'triangle', 0.18, 1568), 90);
  }

  shield() {
    this._blip(440, 0.25, 'triangle', 0.2, 880);
    setTimeout(() => this._blip(660, 0.3, 'triangle', 0.18, 1320), 100);
  }

  hit() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 0.5;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    this._blip(90, 0.45, 'sine', 0.4, 38);
  }

  boost() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 0.7;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3800, t + dur);
    const g = ctx.createGain();
    g.gain.value = 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  gameover() {
    this._blip(392, 0.5, 'sawtooth', 0.15, 110);
    setTimeout(() => this._blip(294, 0.8, 'sawtooth', 0.15, 73), 240);
  }

  startMusic() {
    if (!this.ctx || this.music) return;
    const ctx = this.ctx;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.035;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = 165.3;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    o1.connect(f);
    o2.connect(f);
    f.connect(padGain);
    padGain.connect(this.master);
    o1.start();
    o2.start();
    lfo.start();
    this.music = { padGain, nodes: [o1, o2, lfo] };

    const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.2, 587.3];
    const pattern = [0, 3, 5, 3, 6, 5, 3, 2];
    this._arpTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      if (this.ctx.state !== 'running') return;
      const n = scale[pattern[this._arpStep % pattern.length]] * 2;
      this._arpStep++;
      this._blip(n, 0.22, 'square', 0.028);
    }, 250);
  }

  stopMusic() {
    if (this._arpTimer) {
      clearInterval(this._arpTimer);
      this._arpTimer = null;
    }
    if (this.music) {
      for (const n of this.music.nodes) {
        try { n.stop(); } catch (e) {}
      }
      this.music = null;
    }
  }
}
