import * as THREE from '../vendor/three.module.js'
import { canvasTexture, clamp, lerp, makeNoise2D, mulberry32, smoothstep } from './utils.js'

const POND = { x: -8.8, z: 2.2, radius: 4.9 }
const TORII = { x: 0, z: -15.5 }

function makeGroundTexture() {
  const random = mulberry32(5150)
  const noise = makeNoise2D(88)
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#b9b7a8'
    ctx.fillRect(0, 0, w, h)
    const image = ctx.getImageData(0, 0, w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise(x * 0.06, y * 0.06) * 18 + noise(x * 0.19, y * 0.19) * 9 + noise(x * 0.7, y * 0.7) * 5
        const i = (y * w + x) * 4
        image.data[i] = clamp(176 + n, 120, 225)
        image.data[i + 1] = clamp(178 + n, 120, 230)
        image.data[i + 2] = clamp(160 + n * 0.8, 110, 215)
        image.data[i + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
    for (let i = 0; i < 900; i++) {
      const x = random() * w
      const y = random() * h
      const length = 2 + random() * 9
      ctx.strokeStyle = random() > 0.45
        ? `rgba(58,72,40,${0.05 + random() * 0.16})`
        : `rgba(196,186,150,${0.06 + random() * 0.14})`
      ctx.lineWidth = 0.6 + random() * 1.6
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + random() * 3 - 1.5, y + length)
      ctx.stroke()
    }
    for (let i = 0; i < 160; i++) {
      const x = random() * w
      const y = random() * h
      ctx.fillStyle = `rgba(70,88,44,${0.06 + random() * 0.12})`
      ctx.beginPath()
      ctx.ellipse(x, y, 2 + random() * 6, 1 + random() * 3, random() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }, { repeat: [20, 20] })
}

function makeWaterNormal() {
  const random = mulberry32(123)
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 240; i++) {
      const x = random() * w
      const y = random() * h
      const r = 8 + random() * 34
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
      gradient.addColorStop(0, 'rgba(255,255,255,0.20)')
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.05)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.14)')
      ctx.fillStyle = gradient
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }, { srgb: false, repeat: [3, 3] })
}

function makeRadialTexture(inner = 'rgba(255,255,255,0.9)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, inner)
    g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.35)'))
    g.addColorStop(1, outer)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

function makeStoneLantern(heightAt) {
  const group = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({ color: 0x8b8c80, roughness: 0.95 })
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x6f7167, roughness: 1 })
  const glow = new THREE.MeshStandardMaterial({
    color: 0xd8c7a2, emissive: 0xffa94d, emissiveIntensity: 0, roughness: 0.8
  })

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.58, 0.22, 8), stoneDark)
  base.position.y = 0.11
  group.add(base)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 1.0, 8), stone)
  shaft.position.y = 0.72
  group.add(shaft)
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.16, 8), stone)
  platform.position.y = 1.29
  group.add(platform)
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.5), glow)
  box.position.y = 1.6
  group.add(box)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), stone)
  frame.position.y = 1.84
  group.add(frame)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.4, 4), stoneDark)
  roof.position.y = 2.04
  roof.rotation.y = Math.PI / 4
  group.add(roof)
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), stone)
  finial.position.y = 2.3
  group.add(finial)

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  const light = new THREE.PointLight(0xffb264, 0, 13, 2)
  light.position.y = 1.65
  group.add(light)
  group.position.set(-5.3, heightAt(-5.3, -7.6), -7.6)
  group.rotation.y = 0.35
  return { group, light, glowMaterial: glow }
}

function makeTorii(heightAt) {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: 0xb2452d, roughness: 0.82, metalness: 0.02 })
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x8a3222, roughness: 0.9 })
  const stone = new THREE.MeshStandardMaterial({ color: 0x7d7e72, roughness: 1 })
  const rope = new THREE.MeshStandardMaterial({ color: 0xd6c6a0, roughness: 0.95 })
  const paper = new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.9, side: THREE.DoubleSide })

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5.1, 12), wood)
    pillar.position.set(side * 1.72, 2.55, 0)
    pillar.rotation.z = side * 0.012
    group.add(pillar)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.38, 0.26, 10), stone)
    base.position.set(side * 1.72, 0.13, 0)
    group.add(base)
  }

  const shimaki = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.19, 0.34), woodDark)
  shimaki.position.y = 4.98
  group.add(shimaki)

  const kasagiCenter = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 0.48), wood)
  kasagiCenter.position.y = 5.22
  group.add(kasagiCenter)
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.26, 0.46), wood)
    end.position.set(side * 2.35, 5.27, 0)
    end.rotation.z = side * 0.065
    group.add(end)
  }

  const nuki = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.26, 0.3), wood)
  nuki.position.y = 3.86
  group.add(nuki)
  const gakuzuka = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.92, 0.26), woodDark)
  gakuzuka.position.y = 4.45
  group.add(gakuzuka)

  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.09), woodDark)
  plaque.position.set(0, 4.48, 0.2)
  group.add(plaque)
  const plaqueFace = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.03), new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.7 }))
  plaqueFace.position.set(0, 4.48, 0.26)
  group.add(plaqueFace)

  const ropeBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 4.15, 7), rope)
  ropeBar.rotation.z = Math.PI / 2
  ropeBar.position.y = 3.45
  group.add(ropeBar)
  for (let i = 0; i < 3; i++) {
    const shide = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.42), paper)
    shide.position.set(-1.2 + i * 1.2, 3.22, 0.06)
    shide.rotation.z = 0.05
    group.add(shide)
  }

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  group.position.set(TORII.x, heightAt(TORII.x, TORII.z) - 0.04, TORII.z)
  group.rotation.y = 0
  return group
}

export class World {
  constructor(scene, { quality = 'high' } = {}) {
    this.scene = scene
    this.quality = quality
    this.noise = makeNoise2D(2024)
    this.random = mulberry32(9182)
    this.pathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.9, 0, 16),
      new THREE.Vector3(0.9, 0, 10.5),
      new THREE.Vector3(-0.5, 0, 5.4),
      new THREE.Vector3(0.75, 0, 0.2),
      new THREE.Vector3(0.25, 0, -5.2),
      new THREE.Vector3(0, 0, -10.4),
      new THREE.Vector3(0, 0, -16)
    ], false, 'catmullrom', 0.4)
    this.pathSamples = this.pathCurve.getSpacedPoints(150)
    this.waterTime = { value: 0 }
    this.pond = POND
    this.waterY = this.heightAt(POND.x, POND.z) + 1.35
    this.buildTerrain()
    this.buildWater()
    this.buildStones()
    this.buildTorii()
    this.buildLantern()
    this.buildFallenLog()
  }

  heightAt(x, z) {
    const n = this.noise
    let h = n(x * 0.026, z * 0.026) * 4.1
    h += n(x * 0.068 + 7.3, z * 0.068 - 2.1) * 1.15
    h += n(x * 0.17 - 3.7, z * 0.17 + 5.2) * 0.32
    h -= 0.75

    const dc = Math.hypot(x * 0.92, z + 2.5)
    h *= 0.58 + 0.42 * smoothstep(5.5, 21, dc)

    const dt = Math.hypot(x - TORII.x, z - TORII.z)
    h = lerp(h, 1.55, 1 - smoothstep(3.2, 8.5, dt))

    const dp = Math.hypot(x - POND.x, z - POND.z)
    const basin = 1 - smoothstep(2.8, 7.6, dp)
    h -= 3.55 * basin
    return h
  }

  slopeAt(x, z) {
    const e = 0.6
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z)
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e)
    return Math.hypot(dx, dz) / (2 * e)
  }

  distanceToPath(x, z) {
    let best = Infinity
    for (const point of this.pathSamples) {
      const dx = point.x - x
      const dz = point.z - z
      const d = dx * dx + dz * dz
      if (d < best) best = d
    }
    return Math.sqrt(best)
  }

  pondDistance(x, z) {
    return Math.hypot(x - POND.x, z - POND.z)
  }

  isWater(x, z) {
    return this.pondDistance(x, z) < POND.radius + 0.4 && this.heightAt(x, z) < this.waterY
  }

  buildTerrain() {
    const size = 116
    const segments = this.quality === 'low' ? 110 : 150
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
    geometry.rotateX(-Math.PI / 2)
    const position = geometry.getAttribute('position')
    const colors = new Float32Array(position.count * 3)
    const color = new THREE.Color()
    const mossA = new THREE.Color(0x4d6b34)
    const mossB = new THREE.Color(0x6f8b46)
    const mossC = new THREE.Color(0x38542c)
    const dirt = new THREE.Color(0x8a7251)
    const dirtDark = new THREE.Color(0x6d5a40)
    const mud = new THREE.Color(0x3d4530)
    const silt = new THREE.Color(0x2b3527)
    const rock = new THREE.Color(0x6d6a54)
    const shrineGround = new THREE.Color(0x7e8b5c)

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = position.getZ(i)
      const y = this.heightAt(x, z)
      position.setY(i, y)

      const slope = this.slopeAt(x, z)
      const pathDistance = this.distanceToPath(x, z)
      const pondDistance = this.pondDistance(x, z)
      const tint = this.noise(x * 0.12 + 3, z * 0.12 - 8) * 0.5 + 0.5
      const patch = this.noise(x * 0.4 - 11, z * 0.4 + 2) * 0.5 + 0.5

      color.copy(mossA).lerp(mossB, tint * 0.85)
      color.lerp(mossC, Math.max(0, 0.55 - tint) * 0.9)
      color.lerp(rock, smoothstep(0.55, 1.25, slope) * 0.6)
      color.offsetHSL(0, 0, (patch - 0.5) * 0.045)

      if (pathDistance < 2.3) {
        const edge = 1 - smoothstep(1.05, 2.3, pathDistance)
        const wear = 0.55 + 0.45 * smoothstep(0.15, 0.95, pathDistance)
        color.lerp(dirt, edge * wear)
        color.lerp(dirtDark, edge * 0.22 * (1 - patch))
      }

      if (pondDistance < POND.radius + 3.2) {
        const shore = 1 - smoothstep(POND.radius - 0.6, POND.radius + 3.2, pondDistance)
        color.lerp(mud, shore * 0.75)
        if (y < this.waterY) color.lerp(silt, 0.85)
      }

      const dt = Math.hypot(x - TORII.x, z - TORII.z)
      if (dt < 5.5) color.lerp(shrineGround, (1 - smoothstep(2.5, 5.5, dt)) * 0.4)

      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()

    const detail = makeGroundTexture()
    const bump = detail.clone()
    bump.colorSpace = THREE.NoColorSpace
    bump.needsUpdate = true
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: detail,
      bumpMap: bump,
      bumpScale: 0.4,
      roughness: 1,
      metalness: 0
    })
    this.terrain = new THREE.Mesh(geometry, material)
    this.terrain.receiveShadow = true
    this.terrain.name = 'terrain'
    this.scene.add(this.terrain)
  }

  buildWater() {
    const geometry = new THREE.CircleGeometry(POND.radius, 64)
    geometry.rotateX(-Math.PI / 2)
    this.waterMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: this.waterTime,
        uDeep: { value: new THREE.Color(0x2b5b4c) },
        uShallow: { value: new THREE.Color(0x69a577) },
        uSky: { value: new THREE.Color(0xbcd6d2) },
        uSunColor: { value: new THREE.Color(0xffd9a0) },
        uSunDir: { value: new THREE.Vector3(-0.4, 0.6, -0.7).normalize() },
        uBrightness: { value: 1 }
      },
      vertexShader: `
        varying vec3 vWorld;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSky;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uBrightness;
        varying vec3 vWorld;
        varying vec2 vUv;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float w1 = sin(vWorld.x * 1.5 + uTime * 0.9);
          float w2 = sin(vWorld.z * 2.1 - uTime * 1.15);
          float w3 = sin((vWorld.x + vWorld.z) * 3.4 + uTime * 1.7);
          float wave = (w1 + w2 + w3 * 0.4) / 2.4;
          vec3 n = normalize(vec3(wave * 0.055, 1.0, wave * 0.045));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
          vec3 color = mix(uDeep, uShallow, 0.45 + 0.45 * wave);
          color = mix(color, uSky, 0.28 + fresnel * 0.62);
          vec3 reflectDir = reflect(-normalize(uSunDir), n);
          float spec = pow(max(dot(reflectDir, viewDir), 0.0), 90.0);
          color += uSunColor * spec * 2.2;
          color += uSunColor * pow(max(dot(n, viewDir), 0.0), 6.0) * 0.06;
          color *= uBrightness;
          float alpha = mix(0.74, 0.96, fresnel);
          alpha *= smoothstep(1.0, 0.82, r);
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    })
    const water = new THREE.Mesh(geometry, this.waterMaterial)
    water.position.set(POND.x, this.waterY, POND.z)
    water.renderOrder = 2
    this.water = water
    this.scene.add(water)

    this.lilyMaterial = new THREE.MeshStandardMaterial({ color: 0x4e7a3a, roughness: 0.8, side: THREE.DoubleSide })
    const random = mulberry32(700)
    for (let i = 0; i < 7; i++) {
      const angle = random() * Math.PI * 2
      const radius = 1.2 + random() * (POND.radius - 2.4)
      const lily = new THREE.Mesh(new THREE.CircleGeometry(0.28 + random() * 0.22, 12, 0.3, Math.PI * 1.86), this.lilyMaterial)
      lily.rotation.x = -Math.PI / 2
      lily.rotation.z = random() * Math.PI
      lily.position.set(POND.x + Math.cos(angle) * radius, this.waterY + 0.015, POND.z + Math.sin(angle) * radius)
      lily.receiveShadow = true
      this.scene.add(lily)
    }
  }

  buildStones() {
    const geometry = new THREE.CylinderGeometry(0.34, 0.4, 0.1, 7)
    const material = new THREE.MeshStandardMaterial({ color: 0x9a988a, roughness: 1 })
    const count = 34
    const stones = new THREE.InstancedMesh(geometry, material, count)
    stones.receiveShadow = true
    stones.castShadow = true
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const position = new THREE.Vector3()
    const color = new THREE.Color()
    const random = mulberry32(445)
    for (let i = 0; i < count; i++) {
      const t = 0.02 + (i / (count - 1)) * 0.92
      const point = this.pathCurve.getPointAt(t)
      const tangent = this.pathCurve.getTangentAt(t)
      const side = (i % 2 === 0 ? 1 : -1) * (0.25 + random() * 0.55)
      const x = point.x + tangent.z * side
      const z = point.z - tangent.x * side
      position.set(x, this.heightAt(x, z) + 0.035, z)
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI, 0))
      const s = 0.7 + random() * 0.55
      scale.set(s, 1, s * (0.8 + random() * 0.4))
      matrix.compose(position, quaternion, scale)
      stones.setMatrixAt(i, matrix)
      color.setHSL(0.12, 0.05, 0.5 + random() * 0.16)
      stones.setColorAt(i, color)
    }
    this.scene.add(stones)
  }

  buildTorii() {
    this.torii = makeTorii((x, z) => this.heightAt(x, z))
    this.scene.add(this.torii)
  }

  buildLantern() {
    this.lantern = makeStoneLantern((x, z) => this.heightAt(x, z))
    this.scene.add(this.lantern.group)
  }

  buildFallenLog() {
    const group = new THREE.Group()
    const bark = new THREE.MeshStandardMaterial({ color: 0x5c4a35, roughness: 1 })
    const moss = new THREE.MeshStandardMaterial({ color: 0x55703b, roughness: 1 })
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 5.2, 9), bark)
    log.rotation.z = Math.PI / 2
    log.rotation.y = 0.4
    log.castShadow = true
    log.receiveShadow = true
    group.add(log)
    const random = mulberry32(31)
    for (let i = 0; i < 9; i++) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.18 + random() * 0.2, 6, 4), moss)
      patch.scale.set(1, 0.35, 1)
      patch.position.set((random() - 0.5) * 4.2, 0.26 + random() * 0.08, (random() - 0.5) * 0.5)
      patch.rotation.y = random() * Math.PI
      group.add(patch)
    }
    group.position.set(6.6, this.heightAt(6.6, 3.6) + 0.4, 3.6)
    this.scene.add(group)
  }

  update(dt) {
    this.waterTime.value += dt
  }
}
