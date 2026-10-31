import * as THREE from '../vendor/three.module.js'
import { canvasTexture, clamp, damp, lerp, mulberry32 } from './utils.js'

const PRESETS = {
  dawn: {
    label: '朝',
    skyTop: 0x4a7cad,
    skyHorizon: 0xffd7a6,
    sunColor: 0xffd29a,
    fog: 0xc8dbc8,
    fogDensity: 0.0132,
    sunDir: new THREE.Vector3(-0.5, 0.13, -0.85).normalize(),
    lightDir: new THREE.Vector3(-0.76, 0.56, 0.3).normalize(),
    sunIntensity: 2.5,
    hemiSky: 0xc2e2f4,
    hemiGround: 0x53613f,
    hemiIntensity: 1.14,
    exposure: 1.12,
    stars: 0,
    fireflies: 0.35,
    day: 0.72,
    mist: 0.17,
    lantern: 0.25,
    waterSky: 0xbdd9dd,
    sunScale: 62
  },
  day: {
    label: '昼',
    skyTop: 0x3c8ed4,
    skyHorizon: 0xd8eff8,
    sunColor: 0xfff4dc,
    fog: 0xcfe6d8,
    fogDensity: 0.0102,
    sunDir: new THREE.Vector3(-0.45, 0.4, -0.8).normalize(),
    lightDir: new THREE.Vector3(-0.74, 0.7, 0.26).normalize(),
    sunIntensity: 2.85,
    hemiSky: 0xd4eefb,
    hemiGround: 0x5d6c46,
    hemiIntensity: 1.18,
    exposure: 1.05,
    stars: 0,
    fireflies: 0,
    day: 1,
    mist: 0.075,
    lantern: 0,
    waterSky: 0xb8dfe6,
    sunScale: 42
  },
  dusk: {
    label: '夕',
    skyTop: 0x3e4382,
    skyHorizon: 0xffa96b,
    sunColor: 0xffa15f,
    fog: 0xd7a88f,
    fogDensity: 0.0142,
    sunDir: new THREE.Vector3(-0.66, 0.1, -0.75).normalize(),
    lightDir: new THREE.Vector3(-0.7, 0.34, 0.5).normalize(),
    sunIntensity: 2.55,
    hemiSky: 0xacb2da,
    hemiGround: 0x58443a,
    hemiIntensity: 0.88,
    exposure: 1.13,
    stars: 0.15,
    fireflies: 0.85,
    day: 0.42,
    mist: 0.16,
    lantern: 0.8,
    waterSky: 0xe8b79c,
    sunScale: 70
  },
  night: {
    label: '夜',
    skyTop: 0x060c1c,
    skyHorizon: 0x132744,
    sunColor: 0xaac2ff,
    fog: 0x101c2e,
    fogDensity: 0.0155,
    sunDir: new THREE.Vector3(0.48, 0.55, -0.68).normalize(),
    lightDir: new THREE.Vector3(0.4, 0.7, 0.55).normalize(),
    sunIntensity: 1.3,
    hemiSky: 0x3d5680,
    hemiGround: 0x162018,
    hemiIntensity: 0.62,
    exposure: 1.34,
    stars: 1,
    fireflies: 1,
    day: 0,
    mist: 0.1,
    lantern: 1,
    waterSky: 0x22365a,
    sunScale: 26
  }
}

function glowTexture(inner, mid) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, inner)
    g.addColorStop(0.12, inner)
    g.addColorStop(0.3, mid)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

function softBlobTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.16)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

export class Sky {
  constructor(scene, renderer, { quality = 'high' } = {}) {
    this.scene = scene
    this.renderer = renderer
    this.quality = quality
    this.current = {}
    this.target = {}

    this.buildDome()
    this.buildStars()
    this.buildSunAndMoon()
    this.buildLights()
    this.buildMist()

    this.tmpColor = new THREE.Color()
    this.tmpVector = new THREE.Vector3()
    this.mistTime = 0
    this.setPreset('dawn', true)
  }

  buildDome() {
    this.skyUniforms = {
      uTop: { value: new THREE.Color(0x5c86b0) },
      uHorizon: { value: new THREE.Color(0xf6d6ae) },
      uSunColor: { value: new THREE.Color(0xffd8a2) },
      uSunDir: { value: new THREE.Vector3(-0.55, 0.15, -0.82).normalize() }
    }
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPosition = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition - cameraPosition);
          float h = clamp(dir.y, -1.0, 1.0);
          float t = pow(clamp(h, 0.0, 1.0), 0.52);
          vec3 color = mix(uHorizon, uTop, t);
          float sun = max(dot(dir, normalize(uSunDir)), 0.0);
          color += uSunColor * pow(sun, 320.0) * 2.4;
          color += uSunColor * pow(sun, 14.0) * 0.28;
          color += uSunColor * pow(sun, 4.0) * 0.07;
          float below = smoothstep(-0.25, 0.03, h);
          color = mix(uHorizon * 0.72, color, below);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    })
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(440, 40, 24), material)
    this.dome.frustumCulled = false
    this.scene.add(this.dome)
  }

  buildStars() {
    const count = this.quality === 'low' ? 500 : 900
    const random = mulberry32(808)
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(0.06 + random() * 0.94)
      const radius = 410
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
      positions[i * 3 + 1] = Math.cos(phi) * radius
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius
      phases[i] = random() * Math.PI * 2
      sizes[i] = 0.5 + Math.pow(random(), 3) * 2.2
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    this.starMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) }
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (1.4 + 0.6 * sin(uTime * 0.7 + aPhase));
          vAlpha = uOpacity * (0.55 + 0.45 * sin(uTime * 1.3 + aPhase * 2.0));
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(0.86, 0.91, 1.0, a * vAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    })
    this.stars = new THREE.Points(geometry, this.starMaterial)
    this.stars.frustumCulled = false
    this.scene.add(this.stars)
  }

  buildSunAndMoon() {
    const sunTexture = glowTexture('rgba(255,248,224,1)', 'rgba(255,205,132,0.55)')
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTexture, color: 0xfff0cc, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, toneMapped: false
    }))
    this.sunSprite.scale.setScalar(60)
    this.scene.add(this.sunSprite)

    const moonTexture = glowTexture('rgba(235,242,255,1)', 'rgba(150,180,255,0.35)')
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTexture, color: 0xdfe8ff, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, toneMapped: false
    }))
    this.moonSprite.scale.setScalar(26)
    this.moonSprite.position.set(170, 190, -260)
    this.scene.add(this.moonSprite)
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xb9d6e8, 0x46523a, 0.8)
    this.scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(0xffd8a2, 2.2)
    this.sun.position.set(-40, 30, -50)
    this.sun.castShadow = true
    const size = this.quality === 'low' ? 1024 : 2048
    this.sun.shadow.mapSize.set(size, size)
    this.sun.shadow.camera.left = -30
    this.sun.shadow.camera.right = 30
    this.sun.shadow.camera.top = 30
    this.sun.shadow.camera.bottom = -30
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 120
    this.sun.shadow.bias = -0.0006
    this.sun.shadow.normalBias = 0.035
    this.sun.shadow.radius = 4
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    this.fill = new THREE.DirectionalLight(0x9fc4e8, 0.25)
    this.fill.position.set(30, 20, 40)
    this.scene.add(this.fill)

    this.rim = new THREE.DirectionalLight(0xffd8a2, 0.4)
    this.rim.position.set(-30, 20, -30)
    this.scene.add(this.rim)
  }

  buildMist() {
    const texture = softBlobTexture()
    this.mistLayers = []
    const random = mulberry32(616)
    for (let i = 0; i < 8; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, opacity: 0.15, depthWrite: false,
        color: 0xd8e2d4, fog: false, side: THREE.DoubleSide, toneMapped: false
      })
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(26 + random() * 22, 14 + random() * 12), material)
      plane.rotation.x = -Math.PI / 2
      plane.rotation.z = random() * Math.PI
      plane.position.set((random() - 0.5) * 36, 0.6 + random() * 1.8, (random() - 0.5) * 30 - 4)
      plane.renderOrder = 4
      this.scene.add(plane)
      this.mistLayers.push({
        mesh: plane,
        baseX: plane.position.x,
        baseZ: plane.position.z,
        speed: 0.08 + random() * 0.16,
        phase: random() * Math.PI * 2
      })
    }
  }

  setPreset(name, instant = false) {
    const preset = PRESETS[name] || PRESETS.dawn
    this.presetName = name in PRESETS ? name : 'dawn'
    this.target = {
      skyTop: new THREE.Color(preset.skyTop),
      skyHorizon: new THREE.Color(preset.skyHorizon),
      sunColor: new THREE.Color(preset.sunColor),
      fog: new THREE.Color(preset.fog),
      fogDensity: preset.fogDensity,
      sunDir: preset.sunDir.clone(),
      lightDir: preset.lightDir.clone(),
      sunIntensity: preset.sunIntensity,
      hemiSky: new THREE.Color(preset.hemiSky),
      hemiGround: new THREE.Color(preset.hemiGround),
      hemiIntensity: preset.hemiIntensity,
      exposure: preset.exposure,
      stars: preset.stars,
      fireflies: preset.fireflies,
      day: preset.day,
      mist: preset.mist,
      lantern: preset.lantern,
      waterSky: new THREE.Color(preset.waterSky),
      sunScale: preset.sunScale
    }
    if (instant || !this.current.skyTop) {
      this.current = {
        skyTop: this.target.skyTop.clone(),
        skyHorizon: this.target.skyHorizon.clone(),
        sunColor: this.target.sunColor.clone(),
        fog: this.target.fog.clone(),
        fogDensity: this.target.fogDensity,
        sunDir: this.target.sunDir.clone(),
        lightDir: this.target.lightDir.clone(),
        sunIntensity: this.target.sunIntensity,
        hemiSky: this.target.hemiSky.clone(),
        hemiGround: this.target.hemiGround.clone(),
        hemiIntensity: this.target.hemiIntensity,
        exposure: this.target.exposure,
        stars: this.target.stars,
        fireflies: this.target.fireflies,
        day: this.target.day,
        mist: this.target.mist,
        lantern: this.target.lantern,
        waterSky: this.target.waterSky.clone(),
        sunScale: this.target.sunScale
      }
      this.apply()
    }
  }

  apply() {
    const c = this.current
    this.skyUniforms.uTop.value.copy(c.skyTop)
    this.skyUniforms.uHorizon.value.copy(c.skyHorizon)
    this.skyUniforms.uSunColor.value.copy(c.sunColor)
    this.skyUniforms.uSunDir.value.copy(c.sunDir)
    this.hemi.color.copy(c.hemiSky)
    this.hemi.groundColor.copy(c.hemiGround)
    this.hemi.intensity = c.hemiIntensity
    this.sun.color.copy(c.sunColor)
    this.sun.intensity = c.sunIntensity
    this.sun.position.copy(c.lightDir).multiplyScalar(55)
    this.sun.target.position.set(0, 0, -4)
    this.fill.color.copy(c.sunColor)
    this.fill.intensity = 0.25 + c.day * 0.5
    this.rim.color.copy(c.sunColor)
    this.rim.intensity = 0.28 + c.day * 0.42
    this.rim.position.copy(c.sunDir).multiplyScalar(48)
    this.renderer.toneMappingExposure = c.exposure
    this.scene.fog.color.copy(c.fog)
    this.scene.fog.density = c.fogDensity
    this.starMaterial.uniforms.uOpacity.value = c.stars
    this.sunSprite.material.opacity = clamp(c.day * 1.1, 0, 1)
    this.sunSprite.scale.setScalar(c.sunScale)
    this.sunSprite.position.copy(c.sunDir).multiplyScalar(340)
    this.moonSprite.material.opacity = Math.max(0, 1 - c.day * 1.3) * 0.95
    this.moonSprite.position.copy(c.sunDir).multiplyScalar(340)
    for (const layer of this.mistLayers) {
      layer.mesh.material.color.copy(c.fog)
      layer.mesh.material.opacity = c.mist
    }
  }

  update(dt, time, camera, world) {
    const c = this.current
    const t = this.target
    const k = 1 - Math.exp(-dt * 1.6)
    c.skyTop.lerp(t.skyTop, k)
    c.skyHorizon.lerp(t.skyHorizon, k)
    c.sunColor.lerp(t.sunColor, k)
    c.fog.lerp(t.fog, k)
    c.hemiSky.lerp(t.hemiSky, k)
    c.hemiGround.lerp(t.hemiGround, k)
    c.waterSky.lerp(t.waterSky, k)
    c.sunDir.lerp(t.sunDir, k).normalize()
    c.lightDir.lerp(t.lightDir, k).normalize()
    c.fogDensity = damp(c.fogDensity, t.fogDensity, 1.6, dt)
    c.sunIntensity = damp(c.sunIntensity, t.sunIntensity, 1.6, dt)
    c.hemiIntensity = damp(c.hemiIntensity, t.hemiIntensity, 1.6, dt)
    c.exposure = damp(c.exposure, t.exposure, 1.6, dt)
    c.stars = damp(c.stars, t.stars, 1.6, dt)
    c.fireflies = damp(c.fireflies, t.fireflies, 1.6, dt)
    c.day = damp(c.day, t.day, 1.6, dt)
    c.mist = damp(c.mist, t.mist, 1.6, dt)
    c.lantern = damp(c.lantern, t.lantern, 1.6, dt)
    c.sunScale = damp(c.sunScale, t.sunScale, 1.6, dt)
    this.apply()

    this.dome.position.copy(camera.position)
    this.stars.position.copy(camera.position)
    this.starMaterial.uniforms.uTime.value = time

    this.mistTime += dt
    for (const layer of this.mistLayers) {
      layer.mesh.position.x = layer.baseX + Math.sin(this.mistTime * layer.speed + layer.phase) * 5.5
      layer.mesh.position.z = layer.baseZ + Math.cos(this.mistTime * layer.speed * 0.8 + layer.phase) * 4.5
    }

    if (world) {
      world.waterMaterial.uniforms.uSky.value.copy(c.waterSky)
      world.waterMaterial.uniforms.uSunColor.value.copy(c.sunColor)
      world.waterMaterial.uniforms.uSunDir.value.copy(c.sunDir)
      world.waterMaterial.uniforms.uBrightness.value = 0.32 + c.day * 0.68
      const lantern = world.lantern
      if (lantern) {
        lantern.light.intensity = c.lantern * (8.5 + Math.sin(time * 7.3) * 0.7 + Math.sin(time * 13.1) * 0.4)
        lantern.glowMaterial.emissiveIntensity = c.lantern * 1.6
      }
    }
    return c
  }
}

export { PRESETS }
