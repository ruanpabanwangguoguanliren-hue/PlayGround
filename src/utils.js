import * as THREE from '../vendor/three.module.js'

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1)
export const smoothstep = (a, b, x) => {
  const t = invLerp(a, b, x)
  return t * t * (3 - 2 * t)
}
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt))
export const easeOutBack = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Cheap, stable 2D value noise.
export function makeNoise2D(seed = 1) {
  const hash = (x, y) => {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1274126177)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = hash(xi, yi)
    const b = hash(xi + 1, yi)
    const c = hash(xi, yi + 1)
    const d = hash(xi + 1, yi + 1)
    return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1
  }
}

export function canvasTexture(width, height, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  draw(ctx, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.anisotropy = 4
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Merge non-indexed geometries that all have position/normal/uv.
export function mergeGeometries(geometries) {
  const prepared = geometries.map((geometry) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    if (!g.getAttribute('uv')) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
    }
    return g
  })
  let vertexCount = 0
  for (const g of prepared) vertexCount += g.getAttribute('position').count
  const position = new Float32Array(vertexCount * 3)
  const normal = new Float32Array(vertexCount * 3)
  const uv = new Float32Array(vertexCount * 2)
  const color = new Float32Array(vertexCount * 3)
  let offset = 0
  for (const g of prepared) {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const t = g.getAttribute('uv')
    position.set(p.array, offset * 3)
    normal.set(n.array, offset * 3)
    uv.set(t.array, offset * 2)
    color.fill(1, offset * 3, (offset + p.count) * 3)
    offset += p.count
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3))
  merged.computeBoundingSphere()
  return merged
}

export function paintGeometry(geometry, colorFn) {
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < position.count; i++) {
    colorFn(color, position.getX(i), position.getY(i), position.getZ(i), i)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

// Add a gentle wind sway to an instanced standard material.
export function addWind(material, timeUniform, { strength = 0.045, heightPower = 1.6, speed = 1.0 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform
    shader.uniforms.uWindStrength = { value: strength }
    shader.uniforms.uWindSpeed = { value: speed }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime;
        uniform float uWindStrength;
        uniform float uWindSpeed;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 windOrigin = vec3(instanceMatrix[3]);
          float windPhase = windOrigin.x * 0.55 + windOrigin.z * 0.75;
          float variationSeed = windOrigin.x * 0.37 + windOrigin.z * 0.61;
          float radial = 1.0 + 0.07 * sin(variationSeed * 2.7 + position.y * 5.0) + 0.03 * sin(variationSeed * 7.3 + position.x * 8.0);
          transformed.x *= radial;
          transformed.z *= radial;
          transformed.y *= 1.0 + 0.035 * sin(variationSeed * 4.1 + position.x * 6.0);
          float windWave = sin(uWindTime * uWindSpeed + windPhase) + 0.45 * sin(uWindTime * uWindSpeed * 2.3 + windPhase * 1.7);
          float windMask = pow(max(position.y, 0.0), ${heightPower.toFixed(2)});
          transformed.x += windWave * windMask * uWindStrength;
          transformed.z += cos(uWindTime * uWindSpeed * 0.8 + windPhase) * windMask * uWindStrength * 0.55;
        #endif`
      )
  }
  material.customProgramCacheKey = () => `wind-${strength}-${heightPower}-${speed}`
  return material
}
