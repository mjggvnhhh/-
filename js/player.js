import * as THREE from 'three';
import { Trail } from './effects.js';

export class Player {
  constructor(scene, quality, glowTex) {
    this.group = this._buildShip();
    scene.add(this.group);

    this.pos = new THREE.Vector3(0, 2.4, 0);
    this.velX = 0;
    this.velY = 0;
    this.radius = 0.85;
    this.invuln = 0;
    this.trailsEnabled = quality.trails !== false;
    this.trails = [
      new Trail(scene, 0x00c3ff, 0.16, 26),
      new Trail(scene, 0xff2bd6, 0.13, 26)
    ];

    this.engineGlowA = this._makeGlowSprite(glowTex, 0x66d9ff, 1.4);
    this.engineGlowA.position.set(-0.28, 0, 1.15);
    this.engineGlowB = this._makeGlowSprite(glowTex, 0x66d9ff, 1.4);
    this.engineGlowB.position.set(0.28, 0, 1.15);
    this.group.add(this.engineGlowA, this.engineGlowB);

    this.light = new THREE.PointLight(0x33ccff, 6, 14, 1.8);
    this.light.position.set(0, 0.4, 1.2);
    this.group.add(this.light);

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._right = new THREE.Vector3();
  }

  _makeGlowSprite(tex, color, scale) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(scale);
    return s;
  }

  _buildShip() {
    const ship = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0x1c2350, metalness: 0.85, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0d1128, metalness: 0.7, roughness: 0.45 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a1428, metalness: 1, roughness: 0.05, envMapIntensity: 1.6 });
    const neon = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const neonM = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 6), hull);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.55;
    ship.add(nose);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.0, 6), hull);
    body.rotation.x = Math.PI / 2;
    body.position.z = -0.25;
    ship.add(body);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.8), dark);
    tail.position.set(0, 0.02, 0.85);
    ship.add(tail);

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), glass);
    canopy.scale.set(1, 0.75, 2.0);
    canopy.position.set(0, 0.22, -0.45);
    ship.add(canopy);

    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.85), hull);
      wing.position.set(side * 0.85, -0.02, 0.35);
      wing.rotation.z = side * 0.09;
      wing.rotation.y = -side * 0.22;
      ship.add(wing);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.8), side < 0 ? neon : neonM);
      strip.position.set(side * 1.44, 0.02, 0.38);
      strip.rotation.y = -side * 0.22;
      ship.add(strip);

      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.6), dark);
      fin.position.set(side * 0.42, 0.3, 0.8);
      fin.rotation.z = -side * 0.3;
      ship.add(fin);

      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.5, 10), dark);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(side * 0.28, 0, 1.0);
      ship.add(engine);

      const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), neon);
      nozzle.position.set(side * 0.28, 0, 1.26);
      ship.add(nozzle);
    }

    ship.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return ship;
  }

  reset() {
    this.pos.set(0, 2.4, 0);
    this.velX = 0;
    this.velY = 0;
    this.invuln = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    for (const t of this.trails) t.reset();
  }

  hit() {
    this.invuln = 1.6;
  }

  setTrailsEnabled(on) {
    this.trailsEnabled = on;
    if (!on) for (const t of this.trails) t.mesh.visible = false;
  }

  update(dt, axis, boostK, speedNorm, allowControl) {
    if (allowControl) {
      const targetVX = axis.x * 26;
      const targetVY = axis.y * 11;
      const k = Math.min(1, dt * 6.5);
      this.velX += (targetVX - this.velX) * k;
      this.velY += (targetVY - this.velY) * k;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x + this.velX * dt, -11.5, 11.5);
      this.pos.y = THREE.MathUtils.clamp(this.pos.y + this.velY * dt, 1.4, 8.6);
      if (this.pos.x <= -11.5 || this.pos.x >= 11.5) this.velX *= 0.3;
      if (this.pos.y <= 1.4 || this.pos.y >= 8.6) this.velY *= 0.3;
    }

    this.group.position.copy(this.pos);
    this.group.position.y += Math.sin(performance.now() * 0.002) * 0.06;
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -this.velX * 0.022, Math.min(1, dt * 10));
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, this.velY * 0.014, Math.min(1, dt * 10));
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, -this.velX * 0.006, Math.min(1, dt * 10));

    if (this.invuln > 0) {
      this.invuln -= dt;
      this.group.visible = Math.floor(performance.now() / 80) % 2 === 0;
      if (this.invuln <= 0) this.group.visible = true;
    }

    const glowScale = 1.2 + speedNorm * 1.2 + boostK * 1.6;
    this.engineGlowA.scale.setScalar(glowScale);
    this.engineGlowB.scale.setScalar(glowScale);
    this.light.intensity = 4 + speedNorm * 4 + boostK * 8;

    if (this.trails.length && this.trailsEnabled) {
      this.group.updateMatrixWorld();
      this._right.set(1, 0, 0).applyQuaternion(this.group.quaternion);
      const tailA = this._tmpA.set(-0.28, 0, 1.3).applyMatrix4(this.group.matrixWorld);
      const tailB = this._tmpB.set(0.28, 0, 1.3).applyMatrix4(this.group.matrixWorld);
      this.trails[0].push(tailA, this._right);
      this.trails[1].push(tailB, this._right);
    }
  }
}
