import { Game } from './game.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';

window.addEventListener('load', () => {
  const canvas = document.getElementById('scene');
  const input = new Input(canvas);
  const audio = new AudioSys();
  const hud = new HUD({
    onStart: () => game.startRun(),
    onResume: () => game.resume(),
    onPause: () => game.pause(),
    onToMenu: () => game.toMenu(),
    onBoost: (on) => { input.boostHeld = on; if (on) audio.init(); },
    onSound: () => {
      audio.init();
      audio.setMuted(!audio.muted);
      hud.setMuted(audio.muted);
      try {
        const s = JSON.parse(localStorage.getItem('neonHorizon.v1') || '{}');
        s.muted = audio.muted;
        localStorage.setItem('neonHorizon.v1', JSON.stringify(s));
      } catch (e) {}
    },
    onQuality: (q) => game.setQuality(q)
  });
  const game = new Game(canvas, hud, input, audio);
});
