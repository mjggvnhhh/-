import * as THREE from 'three';
import { COLORS } from './config.js';

const SEG_LEN = 30;
const SEG_COUNT = 9;

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.time = 0;
    this.scroll = 0;

    scene.fog = new THREE.Fog(COLORS.fog, 55, 290);

    this._buildSky();
    this._buildStars();
    this._buildFloor();
    this._buildWalls();
    this._buildMountains();
    this._buildLights();
    this._buildEnvironment(renderer);
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(420, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform float uTime;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 top = vec3(0.016, 0.008, 0.07);
          vec3 horizon = vec3(0.16, 0.04, 0.30);
          vec3 low = vec3(0.01, 0.004, 0.04);
          vec3 col = mix(horizon, top, smoothstep(0.0, 0.55, h));
          col = mix(low, col, smoothstep(-0.35, 0.05, h));
          float glow = pow(max(0.0, 1.0 - abs(h - 0.02) * 3.2), 3.0);
          col += vec3(0.35, 0.08, 0.45) * glow * 0.55;
          float aurora = sin(d.x * 5.0 + uTime * 0.15) * sin(d.z * 4.0 - uTime * 0.1);
          col += vec3(0.0, 0.10, 0.14) * smoothstep(0.25, 0.9, h) * max(0.0, aurora) * 0.6;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.skyMat = mat;
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  _buildStars() {
    const n = 420;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85);
      const r = 400;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbfd4ff,
      size: 1.6,
      sizeAttenuation: false,
      fog: false,
      transparent: true,
      opacity: 0.8
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  _buildFloor() {
    const geo = new THREE.PlaneGeometry(420, 420, 1, 1);
    const mat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        uScroll: { value: 0 },
        uTime: { value: 0 },
        uGlow: { value: new THREE.Color(COLORS.cyan) },
        uFog: { value: new THREE.Color(COLORS.fog) }
      },
      vertexShader: `
        varying vec3 vWorld;
        varying float vDepth;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mv = viewMatrix * wp;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uScroll;
        uniform float uTime;
        uniform vec3 uGlow;
        uniform vec3 uFog;
        varying vec3 vWorld;
        varying float vDepth;
        float gridLine(float coord, float w) {
          float g = abs(fract(coord - 0.5) - 0.5) / max(fwidth(coord), 0.0001);
          return 1.0 - min(g / w, 1.0);
        }
        void main() {
          float z = vWorld.z - uScroll;
          float gx = gridLine(vWorld.x / 4.0, 1.3);
          float gz = gridLine(z / 4.0, 1.3);
          float lines = max(gx, gz);
          float pulse = smoothstep(0.86, 1.0, sin(z * 0.07 - uTime * 2.6));
          vec3 col = vec3(0.012, 0.008, 0.05);
          col += uGlow * lines * (0.38 + pulse * 0.5);
          float edge = smoothstep(10.5, 13.0, abs(vWorld.x));
          col += uGlow * edge * (0.5 + pulse * 0.4);
          float fade = 1.0 - exp(-vDepth * 0.012);
          col = mix(col, uFog, fade);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.floorMat = mat;
    this.floor = new THREE.Mesh(geo, mat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(0, 0, -140);
    this.scene.add(this.floor);
  }

  _wallSegmentMaterials() {
    if (!this._wallMats) {
      this._wallMats = {
        body: new THREE.MeshStandardMaterial({ color: 0x120c2e, roughness: 0.85, metalness: 0.25 }),
        trim: new THREE.MeshBasicMaterial({ color: COLORS.magenta })
      };
    }
    return this._wallMats;
  }

  _buildWalls() {
    this.wallSegs = [];
    const mats = this._wallSegmentMaterials();
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let s = 0; s < SEG_COUNT; s++) {
      const seg = new THREE.Group();
      for (const side of [-1, 1]) {
        const sideGroup = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const m = new THREE.Mesh(boxGeo, mats.body);
          m.scale.set(2 + Math.random() * 3, 4 + Math.random() * 14, SEG_LEN / 5 + 0.5);
          m.position.set(side * (15.5 + Math.random() * 4), m.scale.y / 2 - 0.5, 0);
          sideGroup.add(m);
          if (Math.random() < 0.7) {
            const t = new THREE.Mesh(boxGeo, mats.trim);
            t.scale.set(0.22, 0.22, m.scale.z * 0.96);
            t.position.set(m.position.x - side * (m.scale.x / 2 + 0.05), m.scale.y - 0.3, 0);
            sideGroup.add(t);
          }
        }
        seg.add(sideGroup);
      }
      seg.position.z = -s * SEG_LEN + 20;
      this.scene.add(seg);
      this.wallSegs.push(seg);
    }
  }

  _buildMountains() {
    this.mountains = new THREE.Group();
    const geo = new THREE.ConeGeometry(1, 1, 4, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x150a33, roughness: 1, metalness: 0 });
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(geo, mat);
      const side = i % 2 === 0 ? -1 : 1;
      const s = 26 + Math.random() * 40;
      m.scale.set(s, 22 + Math.random() * 46, s);
      m.position.set(side * (42 + Math.random() * 30), m.scale.y / 2 - 6, -i * 34 + 20);
      m.rotation.y = Math.random() * Math.PI;
      this.mountains.add(m);
    }
    this.scene.add(this.mountains);
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0x5a48ff, 0x0a0524, 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0x8fb0ff, 1.35);
    this.sun.position.set(18, 42, 14);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -34;
    this.sun.shadow.camera.right = 34;
    this.sun.shadow.camera.top = 34;
    this.sun.shadow.camera.bottom = -34;
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 130;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  _buildEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x05020f);
    const mk = (color, intensity, x, y, z, sx, sy) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(sx, sy),
        new THREE.MeshBasicMaterial({ color })
      );
      m.material.color.multiplyScalar(intensity);
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    mk(0x00b8d4, 2.2, -8, 3, -6, 6, 3);
    mk(0xd81b9a, 1.8, 8, 2, -5, 6, 3);
    mk(0x5a2bd8, 1.2, 0, 6, 6, 10, 4);
    const rt = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = rt.texture;
    pmrem.dispose();
  }

  applyQuality(q) {
    this.sun.castShadow = q.shadowMap > 0;
    if (q.shadowMap > 0) {
      this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  update(dt, ds) {
    this.time += dt;
    this.scroll += ds;
    this.skyMat.uniforms.uTime.value = this.time;
    this.floorMat.uniforms.uTime.value = this.time;
    this.floorMat.uniforms.uScroll.value = this.scroll;
    for (const seg of this.wallSegs) {
      seg.position.z += ds;
      if (seg.position.z > 20 + SEG_LEN) {
        seg.position.z -= SEG_COUNT * SEG_LEN;
        for (const sideGroup of seg.children) {
          for (const m of sideGroup.children) {
            if (m.material === this._wallMats.body) {
              m.scale.y = 4 + Math.random() * 14;
              m.position.y = m.scale.y / 2 - 0.5;
            }
          }
        }
      }
    }
    for (const m of this.mountains.children) {
      m.position.z += ds * 0.9;
      if (m.position.z > 30) m.position.z -= 14 * 34;
    }
    this.stars.rotation.y += dt * 0.004;
  }
}
