import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY_PRESETS, SPEED, ENERGY, SCORE, STORAGE_KEY, isMobile } from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { ObstacleField } from './obstacles.js';
import { Particles, makeGlowTexture } from './effects.js';

export class Game {
  constructor(canvas, hud, input, audio) {
    this.canvas = canvas;
    this.hud = hud;
    this.input = input;
    this.audio = audio;
    this.state = 'menu';

    this._loadStorage();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 900);
    this.camera.position.set(0, 4.5, 9);

    this.world = new World(this.scene, this.renderer);
    this.player = new Player(this.scene, { trails: true }, makeGlowTexture());
    this.field = new ObstacleField(this.scene);
    this.particles = new Particles(this.scene, 500, makeGlowTexture());

    this._setupComposer();
    this.setQuality(this.settings.quality, true);

    this.speed = SPEED.start;
    this.dist = 0;
    this.score = 0;
    this.combo = 0;
    this.mult = 1;
    this.crystals = 0;
    this.shields = 3;
    this.energy = ENERGY.max;
    this.boostK = 0;
    this.padBoostT = 0;
    this.shake = 0;
    this.fov = 68;
    this.overT = 0;
    this._fpsEMA = 60;
    this._fpsCheckT = 0;

    this._camTarget = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._lastT = performance.now();

    this._loop = this._loop.bind(this);
    this._bindEvents();
    this._resize();
    this.hud.setMuted(this.settings.muted);
    this.hud.setQualityActive(this.settings.quality);
    this.hud.showMenu(this.best);
    this.hud.setBoosting(false);
    requestAnimationFrame(this._loop);
  }

  _loadStorage() {
    let s = {};
    try {
      s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {}
    this.settings = {
      quality: QUALITY_PRESETS[s.quality] ? s.quality : (isMobile() ? 'med' : 'high'),
      muted: !!s.muted
    };
    this.best = s.best || 0;
  }

  _saveStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        quality: this.settings.quality,
        muted: this.settings.muted,
        best: this.best
      }));
    } catch (e) {}
  }

  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.62);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
  }

  setQuality(name, silent) {
    if (!QUALITY_PRESETS[name]) name = 'med';
    this.settings.quality = name;
    const q = QUALITY_PRESETS[name];
    const dpr = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.world.applyQuality(q);
    this.bloomPass.enabled = q.bloom;
    this.bloomPass.strength = q.bloomStrength || 0.7;
    this.player.setTrailsEnabled(q.trails);
    this._resize();
    if (!silent) {
      this.hud.setQualityActive(name);
      this._saveStorage();
    }
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    this.input.onPauseToggle = () => {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    };
  }

  startRun() {
    this.audio.init();
    this.audio.startMusic();
    this.state = 'playing';
    this.speed = SPEED.start;
    this.dist = 0;
    this.score = 0;
    this.combo = 0;
    this.mult = 1;
    this.crystals = 0;
    this.shields = 3;
    this.energy = ENERGY.max;
    this.boostK = 0;
    this.padBoostT = 0;
    this.shake = 0;
    this.player.reset();
    this.player.group.visible = true;
    this.field.reset();
    this.input.reset();
    this.hud.hideMenu();
    this.hud.hideOver();
    this.hud.hidePause();
    this.hud.showUI();
    this.hud.setShields(3);
    this.hud.setMult(1);
    this.hud.setCrystals(0);
    this.hud.setScore(0);
    this.hud.setDist(0);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showPause();
    if (this.audio.engine) this.audio.engineLevel(0);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.init();
    this.state = 'playing';
    this.hud.hidePause();
    this._lastT = performance.now();
  }

  toMenu() {
    this.state = 'menu';
    this.player.reset();
    this.field.reset();
    this.hud.showMenu(this.best);
    this.hud.hideUI();
    if (this.audio.engine) this.audio.engineLevel(0);
  }

  endRun() {
    this.state = 'over';
    this.overT = 0;
    this.audio.gameover();
    this.audio.engineLevel(0);
    this.particles.emit(this.player.pos.x, this.player.pos.y, 0, {
      count: 90, speed: 14, life: 1.2, size: 0.45, spread: 0.6,
      r: 1, g: 0.5, b: 0.15
    });
    this.player.group.visible = false;
    const isRecord = this.score > this.best;
    if (isRecord) {
      this.best = Math.floor(this.score);
      this._saveStorage();
    }
    setTimeout(() => {
      if (this.state === 'over') {
        this.hud.showOver({
          score: this.score, dist: this.dist, crystals: this.crystals,
          best: this.best, isRecord
        });
      }
    }, 900);
  }

  _onHit() {
    if (this.player.invuln > 0 || this.state !== 'playing') return;
    this.shields--;
    this.combo = 0;
    this.mult = 1;
    this.player.hit();
    this.shake = 1;
    this.particles.emit(this.player.pos.x, this.player.pos.y, 0, {
      count: 40, speed: 10, life: 0.8, size: 0.35, spread: 0.5,
      r: 1, g: 0.3, b: 0.2
    });
    this.hud.flash();
    this.hud.popup(this.shields > 0 ? 'СТОЛКНОВЕНИЕ!' : 'КОРАБЛЬ УНИЧТОЖЕН');
    this.hud.setShields(Math.max(0, this.shields));
    this.hud.setMult(1);
    this.audio.hit();
    if (this.shields <= 0) this.endRun();
  }

  _onCrystal(x, y, z) {
    this.crystals++;
    this.combo++;
    this.mult = 1 + Math.min(4, Math.floor(this.combo / 4));
    this.score += SCORE.crystal * this.mult;
    this.energy = Math.min(ENERGY.max, this.energy + ENERGY.crystal);
    this.particles.emit(x, y, z, {
      count: 10, speed: 5, life: 0.5, size: 0.25, spread: 0.3,
      r: 0.3, g: 0.95, b: 1, grav: 2
    });
    this.audio.pickup(this.crystals);
    if (this.crystals % 12 === 0 && this.shields < 4) {
      this.shields++;
      this.hud.setShields(this.shields);
      this.hud.popup('ЩИТ +1');
      this.audio.shield();
    }
  }

  _onGate(x, y) {
    this.combo++;
    this.mult = 1 + Math.min(4, Math.floor(this.combo / 4));
    this.score += SCORE.gate * this.mult;
    this.particles.emit(x, y, 0, {
      count: 26, speed: 8, life: 0.7, size: 0.3, spread: 0.8,
      r: 1, g: 0.25, b: 0.85, grav: 0
    });
    this.hud.popup('ВРАТА +' + SCORE.gate * this.mult);
    this.audio.gate();
  }

  _onPad() {
    this.energy = ENERGY.max;
    this.padBoostT = 1.5;
    this.audio.boost();
    this.particles.emit(this.player.pos.x, 1, 0, {
      count: 24, speed: 9, life: 0.6, size: 0.3, spread: 1.2,
      r: 1, g: 0.6, b: 0.12, vy: 6, grav: -2
    });
    this.hud.popup('УСКОРЕНИЕ!');
  }

  _updatePlaying(dt) {
    this.input.update(dt);
    const wantBoost = (this.input.boostHeld || this.padBoostT > 0) && this.energy > 0;
    if (this.padBoostT > 0) this.padBoostT -= dt;
    if (wantBoost) {
      this.energy = Math.max(0, this.energy - ENERGY.drain * dt);
    } else {
      this.energy = Math.min(ENERGY.max, this.energy + ENERGY.regen * dt);
    }
    this.boostK += ((wantBoost ? 1 : 0) - this.boostK) * Math.min(1, dt * 6);

    this.speed = Math.min(SPEED.max, this.speed + SPEED.ramp * dt);
    const spd = this.speed * (1 + (SPEED.boostMul - 1) * this.boostK);
    const ds = spd * dt;
    this.dist += ds;
    const diff = Math.min(1, this.dist / 3500);

    this.score += ds * 1.1 * this.mult;

    const speedNorm = (this.speed - SPEED.start) / (SPEED.max - SPEED.start);
    this.player.update(dt, this.input.axis, this.boostK, speedNorm, true);
    this.world.update(dt, ds);
    this.field.update(dt, ds, diff, this.player, {
      onHit: () => this._onHit(),
      onCrystal: (x, y, z) => this._onCrystal(x, y, z),
      onGate: (x, y) => this._onGate(x, y),
      onPad: () => this._onPad()
    });

    this.audio.engineLevel(0.4 + 0.6 * speedNorm * (1 + this.boostK));

    this.hud.setScore(this.score);
    this.hud.setDist(this.dist);
    this.hud.setMult(this.mult);
    this.hud.setSpeed(Math.min(1, spd / SPEED.max), Math.round(spd * 12));
    this.hud.setBoost(this.energy / ENERGY.max);
    this.hud.setBoosting(this.boostK > 0.5);
  }

  _updateMenu(dt) {
    this.world.update(dt, 9 * dt);
    this.input.update(dt);
    this.player.pos.x = Math.sin(this.world.time * 0.4) * 2.5;
    this.player.pos.y = 2.6 + Math.sin(this.world.time * 0.7) * 0.4;
    this.player.update(dt, { x: 0, y: 0 }, 0, 0.1, false);
  }

  _updateOver(dt) {
    this.overT += dt;
    this.world.update(dt, Math.max(0, 14 - this.overT * 8) * dt);
  }

  _updateCamera(dt) {
    const p = this.player.pos;
    if (this.state === 'menu') {
      const t = this.world.time * 0.3;
      this._camTarget.set(Math.sin(t) * 5.5, 3.4 + Math.sin(t * 0.7) * 0.8, 7.5 + Math.cos(t) * 2.5);
      this.camera.position.lerp(this._camTarget, Math.min(1, dt * 2));
      this._lookTarget.set(p.x, p.y + 0.4, p.z - 4);
      this.camera.lookAt(this._lookTarget);
    } else {
      this._camTarget.set(p.x * 0.52, p.y + 3.1, 7.6);
      this.camera.position.lerp(this._camTarget, Math.min(1, dt * 5));
      this._lookTarget.set(p.x * 0.85, p.y * 0.6 + 1.2, -10);
      this.camera.lookAt(this._lookTarget);
    }
    const targetFov = 68 + this.boostK * 12;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 5);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const s = this.shake * this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.rotation.z += -this.player.velX * 0.004;
  }

  _loop() {
    requestAnimationFrame(this._loop);
    const now = performance.now();
    let dt = (now - this._lastT) / 1000;
    this._lastT = now;
    dt = Math.min(dt, 0.05);

    this._fpsEMA += ((1 / Math.max(dt, 0.001)) - this._fpsEMA) * 0.05;
    this._fpsCheckT += dt;
    if (this._fpsCheckT > 4 && this.state === 'playing') {
      this._fpsCheckT = 0;
      if (this._fpsEMA < 38) {
        if (this.settings.quality === 'high') this.setQuality('med');
        else if (this.settings.quality === 'med') this.setQuality('low');
      }
    }

    if (this.state === 'playing') this._updatePlaying(dt);
    else if (this.state === 'menu') this._updateMenu(dt);
    else if (this.state === 'over') this._updateOver(dt);

    this.particles.update(dt);
    this._updateCamera(dt);

    this.world.sky.position.copy(this.camera.position);
    this.world.stars.position.set(this.camera.position.x, 0, this.camera.position.z);

    if (this.bloomPass.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
