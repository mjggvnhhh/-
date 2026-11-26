import * as THREE from 'three';

export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Particles {
  constructor(scene, max, texture) {
    this.max = max;
    this.cursor = 0;
    this.items = new Array(max);
    for (let i = 0; i < max; i++) {
      this.items[i] = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, r: 1, g: 1, b: 1, drag: 1, grav: 0 };
    }
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.psize = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.psize, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aAlpha;
        attribute float aSize;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * 220.0 / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }

  emit(x, y, z, opts) {
    const o = opts || {};
    const n = o.count || 12;
    for (let i = 0; i < n; i++) {
      const p = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      const speed = (o.speed || 6) * (0.35 + Math.random() * 0.85);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p.x = x + (Math.random() - 0.5) * (o.spread || 0.4);
      p.y = y + (Math.random() - 0.5) * (o.spread || 0.4);
      p.z = z + (Math.random() - 0.5) * (o.spread || 0.4);
      p.vx = Math.sin(phi) * Math.cos(theta) * speed + (o.vx || 0);
      p.vy = Math.cos(phi) * speed + (o.vy || 0);
      p.vz = Math.sin(phi) * Math.sin(theta) * speed + (o.vz || 0);
      p.maxLife = (o.life || 0.7) * (0.6 + Math.random() * 0.8);
      p.life = p.maxLife;
      p.size = (o.size || 0.3) * (0.6 + Math.random() * 0.8);
      p.r = o.r !== undefined ? o.r : 1;
      p.g = o.g !== undefined ? o.g : 0.85;
      p.b = o.b !== undefined ? o.b : 0.4;
      p.drag = o.drag || 0.96;
      p.grav = o.grav !== undefined ? o.grav : -4;
    }
  }

  update(dt) {
    const items = this.items;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const p = items[i];
      const i3 = i * 3;
      if (p.life <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      any = true;
      p.life -= dt;
      const damp = Math.pow(p.drag, dt * 60);
      p.vx *= damp;
      p.vy = p.vy * damp + p.grav * dt;
      p.vz *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = Math.max(0, p.life / p.maxLife);
      this.pos[i3] = p.x;
      this.pos[i3 + 1] = p.y;
      this.pos[i3 + 2] = p.z;
      this.col[i3] = p.r;
      this.col[i3 + 1] = p.g;
      this.col[i3 + 2] = p.b;
      this.alpha[i] = k;
      this.psize[i] = p.size * (0.4 + 0.6 * k);
    }
    if (any || this._dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this._dirty = any;
    }
  }
}

export class Trail {
  constructor(scene, color, width, maxPoints) {
    this.max = maxPoints || 26;
    this.width = width || 0.16;
    this.count = 0;
    this.pts = new Array(this.max);
    for (let i = 0; i < this.max; i++) this.pts[i] = new THREE.Vector3();
    this.right = new THREE.Vector3();
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(this.max * 2 * 3);
    const cols = new Float32Array(this.max * 2 * 3);
    const idx = [];
    for (let i = 0; i < this.max - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setIndex(idx);
    const c = new THREE.Color(color);
    for (let i = 0; i < this.max; i++) {
      const f = Math.pow(1 - i / (this.max - 1), 1.6);
      for (let s = 0; s < 2; s++) {
        cols[(i * 2 + s) * 3] = c.r * f;
        cols[(i * 2 + s) * 3 + 1] = c.g * f;
        cols[(i * 2 + s) * 3 + 2] = c.b * f;
      }
    }
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.geo = geo;
  }

  reset() {
    this.count = 0;
    this.mesh.visible = false;
  }

  push(p, right) {
    for (let i = this.max - 1; i > 0; i--) {
      this.pts[i].copy(this.pts[i - 1]);
    }
    this.pts[0].copy(p);
    this.right.copy(right);
    if (this.count < this.max) this.count++;
    this.mesh.visible = true;
    this._rebuild();
  }

  _rebuild() {
    const pos = this.geo.attributes.position.array;
    for (let i = 0; i < this.max; i++) {
      const src = this.pts[Math.min(i, Math.max(0, this.count - 1))];
      const w = this.count > 0 ? this.width * Math.pow(1 - i / (this.max - 1), 0.8) : 0;
      const i6 = i * 6;
      pos[i6] = src.x - this.right.x * w;
      pos[i6 + 1] = src.y - this.right.y * w;
      pos[i6 + 2] = src.z - this.right.z * w;
      pos[i6 + 3] = src.x + this.right.x * w;
      pos[i6 + 4] = src.y + this.right.y * w;
      pos[i6 + 5] = src.z + this.right.z * w;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
