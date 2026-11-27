import * as THREE from 'three';
import { BOUNDS } from './config.js';

export class ObstacleField {
  constructor(scene) {
    this.scene = scene;
    this.sinceSpawn = 60;
    this.nextGap = 30;
    this.time = 0;
    this._mats = {
      body: new THREE.MeshStandardMaterial({ color: 0x161038, metalness: 0.6, roughness: 0.5 }),
      trim: new THREE.MeshBasicMaterial({ color: 0xff2bd6 }),
      beam: new THREE.MeshBasicMaterial({ color: 0xff3344 }),
      pylon: new THREE.MeshStandardMaterial({ color: 0x1c1440, metalness: 0.7, roughness: 0.4 }),
      gate: new THREE.MeshBasicMaterial({ color: 0xff2bd6 }),
      crystal: new THREE.MeshStandardMaterial({
        color: 0x00e5ff, metalness: 0.2, roughness: 0.1,
        emissive: 0x00b0d0, emissiveIntensity: 1.4
      }),
      pad: new THREE.MeshBasicMaterial({ color: 0xff9a1f, transparent: true, opacity: 0.55 })
    };
    this._geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      torus: new THREE.TorusGeometry(3.0, 0.16, 10, 40),
      octa: new THREE.OctahedronGeometry(0.45, 0)
    };
    this._initPools();
  }

  _initPools() {
    const mkPool = (n, builder) => {
      const arr = [];
      for (let i = 0; i < n; i++) {
        const item = builder();
        item.active = false;
        item.g.visible = false;
        this.scene.add(item.g);
        arr.push(item);
      }
      return arr;
    };

    this.pillars = mkPool(10, () => {
      const g = new THREE.Group();
      const main = new THREE.Mesh(this._geo.box, this._mats.body);
      main.castShadow = true;
      g.add(main);
      const t1 = new THREE.Mesh(this._geo.box, this._mats.trim);
      const t2 = new THREE.Mesh(this._geo.box, this._mats.trim);
      g.add(t1, t2);
      return { g, main, t1, t2, w: 2, h: 8, d: 2 };
    });

    this.blocks = mkPool(8, () => {
      const g = new THREE.Group();
      const parts = [];
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(this._geo.box, this._mats.body);
        m.castShadow = true;
        g.add(m);
        parts.push(m);
      }
      const strip = new THREE.Mesh(this._geo.box, this._mats.trim);
      g.add(strip);
      return { g, parts, strip, spheres: [], spin: 0 };
    });

    this.beams = mkPool(4, () => {
      const g = new THREE.Group();
      const p1 = new THREE.Mesh(this._geo.box, this._mats.pylon);
      const p2 = new THREE.Mesh(this._geo.box, this._mats.pylon);
      const bar = new THREE.Mesh(this._geo.box, this._mats.beam);
      p1.castShadow = true;
      p2.castShadow = true;
      g.add(p1, p2, bar);
      return { g, p1, p2, bar, y: 4 };
    });

    this.gates = mkPool(5, () => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(this._geo.torus, this._mats.gate);
      g.add(ring);
      return { g, ring, x: 0, y: 4, z: 0, prevZ: 0 };
    });

    this.crystals = mkPool(40, () => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(this._geo.octa, this._mats.crystal);
      g.add(m);
      return { g, m, baseY: 3, z: 0, phase: Math.random() * 6.28 };
    });

    this.pads = mkPool(4, () => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(this._geo.box, this._mats.pad);
      g.add(m);
      return { g, m, z: 0 };
    });
  }

  reset() {
    for (const pool of [this.pillars, this.blocks, this.beams, this.gates, this.crystals, this.pads]) {
      for (const it of pool) {
        it.active = false;
        it.g.visible = false;
      }
    }
    this.sinceSpawn = 40;
    this.nextGap = 30;
  }

  _free(pool) {
    for (const it of pool) {
      if (!it.active) return it;
    }
    return null;
  }

  _place(item, x, y, z) {
    item.active = true;
    item.g.visible = true;
    item.g.position.set(x, y, z);
    if (item.z !== undefined) item.z = z;
  }

  _spawnPillarWall(diff) {
    const gapC = (Math.random() * 2 - 1) * 7.5;
    const gapHalf = 3.4 + (1 - diff) * 2.0;
    for (const side of [-1, 1]) {
      let edge = side * 12.5;
      let guard = 0;
      while ((side < 0 ? edge < gapC - gapHalf : edge > gapC + gapHalf) && guard++ < 4) {
        const it = this._free(this.pillars);
        if (!it) break;
        const w = 1.8 + Math.random() * 2.4;
        const inner = side < 0 ? Math.min(edge + w / 2, gapC - gapHalf) : Math.max(edge - w / 2, gapC + gapHalf);
        const cx = (edge + inner) / 2;
        const h = 6 + Math.random() * 9;
        it.w = w;
        it.h = h;
        it.d = 1.6 + Math.random() * 1.2;
        it.main.scale.set(w, h, it.d);
        it.main.position.y = 0;
        it.t1.scale.set(0.16, h * 0.9, 0.16);
        it.t1.position.set(w / 2 - 0.1, 0, it.d / 2 + 0.05);
        it.t2.scale.set(0.16, h * 0.9, 0.16);
        it.t2.position.set(-w / 2 + 0.1, 0, it.d / 2 + 0.05);
        this._place(it, cx, h / 2, BOUNDS.spawnZ - Math.random() * 6);
        edge = cx - side * (w / 2 + 0.4);
      }
    }
  }

  _spawnBlocks(diff) {
    const n = 2 + Math.floor(Math.random() * 2 + diff * 2);
    for (let i = 0; i < n; i++) {
      const it = this._free(this.blocks);
      if (!it) break;
      const cx = (Math.random() * 2 - 1) * 9.5;
      const cy = 1.8 + Math.random() * 6;
      it.spheres.length = 0;
      const s0 = 1.2 + Math.random() * 1.6;
      it.parts[0].scale.setScalar(s0);
      it.parts[0].position.set(0, 0, 0);
      it.parts[0].rotation.set(0.3, 0.4, 0.2);
      it.spheres.push({ ox: 0, oy: 0, oz: 0, r: s0 * 0.75 });
      for (let j = 1; j < 3; j++) {
        if (Math.random() < 0.4 - diff * 0.1) {
          it.parts[j].scale.setScalar(0.001);
          continue;
        }
        const s = 0.9 + Math.random() * 1.4;
        const ox = (Math.random() - 0.5) * 3;
        const oy = (Math.random() - 0.5) * 2.4;
        const oz = (Math.random() - 0.5) * 2.5;
        it.parts[j].scale.setScalar(s);
        it.parts[j].position.set(ox, oy, oz);
        it.parts[j].rotation.set(Math.random(), Math.random(), Math.random());
        it.spheres.push({ ox, oy, oz, r: s * 0.75 });
      }
      it.strip.scale.set(s0 * 1.05, 0.1, 0.1);
      it.strip.position.set(0, -s0 / 2 - 0.1, 0);
      it.spin = (Math.random() - 0.5) * 0.8;
      this._place(it, cx, cy, BOUNDS.spawnZ - Math.random() * 8);
    }
  }

  _spawnBeam() {
    const it = this._free(this.beams);
    if (!it) return;
    it.y = 2.4 + Math.random() * 5;
    it.p1.scale.set(1.4, 16, 1.4);
    it.p1.position.set(-12.6, it.y - 8, 0);
    it.p2.scale.set(1.4, 16, 1.4);
    it.p2.position.set(12.6, it.y - 8, 0);
    it.bar.scale.set(26, 0.5, 0.5);
    it.bar.position.set(0, it.y, 0);
    this._place(it, 0, 0, BOUNDS.spawnZ);
  }

  _spawnGate() {
    const it = this._free(this.gates);
    if (!it) return;
    it.x = (Math.random() * 2 - 1) * 7;
    it.y = 2.6 + Math.random() * 3.4;
    it.g.rotation.set(0, 0, Math.random() * Math.PI);
    this._place(it, it.x, it.y, BOUNDS.spawnZ);
    it.prevZ = BOUNDS.spawnZ;
    it.z = BOUNDS.spawnZ;
  }

  _spawnCrystals() {
    const n = 5 + Math.floor(Math.random() * 3);
    const x0 = (Math.random() * 2 - 1) * 8;
    const y0 = 2 + Math.random() * 5;
    const arc = (Math.random() * 2 - 1) * 0.5;
    for (let i = 0; i < n; i++) {
      const it = this._free(this.crystals);
      if (!it) return;
      const x = THREE.MathUtils.clamp(x0 + arc * i, -10, 10);
      it.baseY = THREE.MathUtils.clamp(y0 + Math.sin(i * 0.9) * 0.8, 1.8, 8);
      it.phase = i * 0.7;
      const z = BOUNDS.spawnZ - i * 6;
      this._place(it, x, it.baseY, z);
      it.z = z;
    }
  }

  _spawnPad() {
    const it = this._free(this.pads);
    if (!it) return;
    it.m.scale.set(3.6, 0.12, 8);
    const z = BOUNDS.spawnZ;
    this._place(it, (Math.random() * 2 - 1) * 8, 0.08, z);
    it.z = z;
  }

  _spawn(diff) {
    const r = Math.random();
    if (r < 0.30) this._spawnPillarWall(diff);
    else if (r < 0.52) this._spawnBlocks(diff);
    else if (r < 0.66) this._spawnBeam();
    else if (r < 0.82) this._spawnGate();
    else this._spawnCrystals();
    if (Math.random() < 0.14) this._spawnPad();
    if (Math.random() < 0.35) this._spawnCrystals();
  }

  update(dt, ds, diff, player, ev) {
    this.time += dt;
    this.sinceSpawn += ds;
    if (this.sinceSpawn >= this.nextGap) {
      this.sinceSpawn = 0;
      this.nextGap = (30 - diff * 13) * (0.85 + Math.random() * 0.4);
      this._spawn(diff);
    }

    const px = player.pos.x;
    const py = player.pos.y;
    const pr = player.radius;

    for (const it of this.pillars) {
      if (!it.active) continue;
      it.g.position.z += ds;
      const z = it.g.position.z;
      if (z > BOUNDS.killZ) {
        it.active = false;
        it.g.visible = false;
        continue;
      }
      if (Math.abs(z) < it.d / 2 + pr && py < it.h + pr * 0.5) {
        if (Math.abs(px - it.g.position.x) < it.w / 2 + pr * 0.7) ev.onHit(z);
      }
    }

    for (const it of this.blocks) {
      if (!it.active) continue;
      it.g.position.z += ds;
      it.g.rotation.y += it.spin * dt;
      const z = it.g.position.z;
      if (z > BOUNDS.killZ) {
        it.active = false;
        it.g.visible = false;
        continue;
      }
      if (Math.abs(z) < 4.5) {
        for (const s of it.spheres) {
          const dx = px - (it.g.position.x + s.ox);
          const dy = py - (it.g.position.y + s.oy);
          const dz = -z - s.oz;
          if (dx * dx + dy * dy + dz * dz < (s.r + pr) * (s.r + pr)) {
            ev.onHit(z);
            break;
          }
        }
      }
    }

    for (const it of this.beams) {
      if (!it.active) continue;
      it.g.position.z += ds;
      const z = it.g.position.z;
      if (z > BOUNDS.killZ) {
        it.active = false;
        it.g.visible = false;
        continue;
      }
      if (Math.abs(z) < 0.6 + pr && Math.abs(py - it.y) < 0.5 + pr * 0.6) ev.onHit(z);
    }

    for (const it of this.gates) {
      if (!it.active) continue;
      it.prevZ = it.z;
      it.z += ds;
      it.g.position.z = it.z;
      it.g.rotation.z += dt * 0.6;
      if (it.z > BOUNDS.killZ) {
        it.active = false;
        it.g.visible = false;
        continue;
      }
      if (it.prevZ < 0 && it.z >= 0) {
        const dx = px - it.x;
        const dy = py - it.y;
        if (dx * dx + dy * dy < 2.6 * 2.6) ev.onGate(it.x, it.y);
      }
    }

    for (const it of this.crystals) {
      if (!it.active) continue;
      it.z += ds;
      it.g.position.z = it.z;
      it.g.position.y = it.baseY + Math.sin(this.time * 3 + it.phase) * 0.3;
      it.m.rotation.y += dt * 2.6;
      it.m.rotation.x += dt * 1.1;
      if (it.z > BOUNDS.killZ) {
        it.active = false;
        it.g.visible = false;
        continue;
      }
      if (Math.abs(it.z) < 1.6) {
        const dx = px - it.g.position.x;
        const dy = py - it.g.position.y;
        const dz = -it.z;
        if (dx * dx + dy * dy + dz * dz < 1.8 * 1.8) {
          it.active = false;
          it.g.visible = false;
          ev.onCrystal(it.g.position.x, it.g.position.y, it.z);
        }
      }
    }

    for (const it of this.pads) {
      if (!it.active) continue;
      it.z += ds;
      it.g.position.z = it.z;
      it.m.scale.x = 3.6 + Math.sin(this.time * 6) * 0.25;
      if (it.z > BOUNDS.killZ) {
        it.active = false;
        it.g.visible = false;
        continue;
      }
      if (Math.abs(it.z) < 2.2 && Math.abs(px - it.g.position.x) < 2.1 && py < 3.2) {
        it.active = false;
        it.g.visible = false;
        ev.onPad(it.g.position.x, 1, it.z);
      }
    }
  }
}
