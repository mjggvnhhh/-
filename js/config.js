export const BOUNDS = {
  halfWidth: 11.5,
  minY: 1.4,
  maxY: 8.6,
  hoverY: 2.4,
  spawnZ: -250,
  killZ: 20
};

export const SPEED = {
  start: 26,
  max: 68,
  ramp: 0.55,
  boostMul: 1.65
};

export const ENERGY = {
  max: 100,
  drain: 26,
  regen: 5.5,
  crystal: 9,
  pad: 100
};

export const SCORE = {
  crystal: 10,
  gate: 50
};

export const COLORS = {
  fog: 0x0a0524,
  cyan: 0x00e5ff,
  magenta: 0xff2bd6,
  orange: 0xff9a1f,
  red: 0xff3344,
  violet: 0x7c4dff
};

export const QUALITY_PRESETS = {
  low: { pixelRatio: 1, shadowMap: 0, bloom: false, particles: 220, trails: false },
  med: { pixelRatio: 1.75, shadowMap: 1024, bloom: true, bloomStrength: 0.55, particles: 420, trails: true },
  high: { pixelRatio: 2, shadowMap: 2048, bloom: true, bloomStrength: 0.75, particles: 650, trails: true }
};

export const STORAGE_KEY = 'neonHorizon.v1';

export function isMobile() {
  return typeof matchMedia !== 'undefined' &&
    matchMedia('(pointer: coarse)').matches &&
    Math.min(window.innerWidth, window.innerHeight) < 900;
}
