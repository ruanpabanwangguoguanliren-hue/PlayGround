import * as THREE from '../vendor/three.module.js'
import { World } from './world.js'
import { Forest } from './trees.js'
import { Flora } from './flora.js'
import { Sky } from './sky.js'
import { CameraRig } from './controls.js'
import { ForestAudio } from './audio.js'
import { mulberry32 } from './utils.js'

const STORAGE_KEY = 'mori-forest-v1'
const canvas = document.getElementById('scene')
const loader = document.getElementById('loader')
const treeCount = document.getElementById('tree-count')
const hint = document.getElementById('hint')
const toastEl = document.getElementById('toast')
const soundBtn = document.getElementById('sound')
const tiltBtn = document.getElementById('tilt')
const resetBtn = document.getElementById('reset')
const timeButtons = [...document.querySelectorAll('[data-time]')]
const isTouch = window.matchMedia('(pointer: coarse)').matches
const isMobile = isTouch || Math.min(window.innerWidth, window.innerHeight) < 620
const isPhone = isTouch && Math.min(window.innerWidth, window.innerHeight) < 620
const quality = isPhone ? 'low' : 'high'
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let renderer
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  })
} catch (error) {
  document.getElementById('fallback').hidden = false
  loader.classList.add('is-hidden')
  throw error
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xc4d5c7, 0.0155)

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 900)
camera.position.set(0, 6, 15)

const world = new World(scene, { quality })
const sky = new Sky(scene, renderer, { quality })
const forest = new Forest(scene, world, { capacity: 240, quality })
const flora = new Flora(scene, world, forest, { quality })
const audio = new ForestAudio()

let initialTime = 'dusk'
sky.setPreset(initialTime, true)

function toast(message, duration = 2400) {
  toastEl.textContent = message
  toastEl.classList.add('is-visible')
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => toastEl.classList.remove('is-visible'), duration)
}

function updateCount() {
  treeCount.textContent = String(forest.total)
}

let hintHidden = false
function hideHint() {
  if (hintHidden) return
  hintHidden = true
  hint.classList.add('is-hidden')
}

const rig = new CameraRig(camera, canvas, world, {
  isMobile,
  onPlant: (x, z) => {
    const result = forest.plant(x, z)
    if (!result.ok) {
      if (result.reason === 'full') toast('この森はもういっぱいです')
      else toast('ここには植えられません')
      return
    }
    flora.ripple(x, z)
    flora.burstAt(x, z)
    audio.chime()
    saveForest()
    updateCount()
    hideHint()
  },
  onBlocked: (reason) => {
    if (reason === 'water') toast('水の上には植えられません')
    else if (reason === 'steep') toast('坂が急すぎて植えられません')
    else toast('近すぎます')
  }
})

if (new URLSearchParams(window.location.search).has('debug')) {
  window.__mori = { renderer, scene, camera, world, sky, forest, flora, rig, audio }
}

// Seed a believable, already-grown forest with a clear view to the shrine.
const rng = mulberry32(20261031)
let attempts = 0
while (forest.total < 112 && attempts < 20000) {
  attempts++
  const angle = rng() * Math.PI * 2
  const radius = 8 + Math.sqrt(rng()) * 28
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius - 3
  if (world.pondDistance(x, z) < world.pond.radius + 2.1) continue
  if (world.distanceToPath(x, z) < 2.5) continue
  if (Math.hypot(x - world.pond.x, z - world.pond.z) < 6.5) continue
  if (Math.hypot(x, z + 15.5) < 6.4) continue
  if (world.slopeAt(x, z) > 1.0) continue
  if (!forest.canPlantAt(x, z, 2.1)) continue
  if (Math.hypot(x * 0.85, z + 2) < 8.2) continue
  if (Math.abs(x) < 5.6 && z > -11 && z < 14) continue
  if (Math.hypot(x, z - 13) < 10.5) continue
  if (Math.hypot(x - 9.5, z + 9.5) < 4.2) continue
  const roll = rng()
  const type = roll < 0.42 ? 'broad' : roll < 0.83 ? 'fir' : 'birch'
  const height = (type === 'fir' ? 6.5 : type === 'birch' ? 7.4 : 6.8) + rng() * 3.6
  forest.addTree({
    x, z, type, height,
    rotation: rng() * Math.PI * 2,
    tilt: (rng() - 0.5) * 0.06,
    growth: 1
  })
}

// Dense silhouettes around the rim give the forest depth through the fog.
for (let i = 0; i < 48; i++) {
  const angle = (i / 48) * Math.PI * 2 + rng() * 0.12
  const radius = 29 + rng() * 10
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius - 6
  if (world.pondDistance(x, z) < world.pond.radius + 1.2) continue
  if (world.distanceToPath(x, z) < 2.2) continue
  if (Math.hypot(x, z + 15.5) < 5.5) continue
  if (Math.hypot(x, z - 13) < 13) continue
  if (!forest.canPlantAt(x, z, 1.7)) continue
  const type = rng() < 0.62 ? 'fir' : rng() < 0.7 ? 'broad' : 'birch'
  forest.addTree({
    x, z, type,
    height: 8 + rng() * 5,
    rotation: rng() * Math.PI * 2,
    tilt: (rng() - 0.5) * 0.05,
    growth: 1
  })
}

// Hero framing trees.
const heroes = [
  [-16.5, 3.2, 'broad', 13.4],
  [15.8, 4.2, 'broad', 13.8],
  [-16.8, -8.2, 'fir', 12.6],
  [10.4, 12.2, 'birch', 10.2]
]
for (const [x, z, type, height] of heroes) {
  if (!forest.canPlantAt(x, z, 1.2)) continue
  forest.addTree({ x, z, type, height, rotation: rng() * Math.PI * 2, tilt: (rng() - 0.5) * 0.04, growth: 1 })
}

function saveForest() {
  try {
    const data = forest.userTrees.map((tree) => ({
      x: Number(tree.x.toFixed(3)),
      z: Number(tree.z.toFixed(3)),
      type: tree.type,
      height: Number(tree.height.toFixed(2)),
      rotation: Number(tree.rotation.toFixed(3)),
      tilt: Number(tree.tilt.toFixed(3)),
      width: Number(tree.width.toFixed(3))
    }))
    if (data.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function loadForest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return
    for (const item of data.slice(0, 140)) {
      if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.z)) continue
      if (!['fir', 'broad', 'birch'].includes(item.type)) continue
      forest.addTree({
        x: item.x, z: item.z, type: item.type,
        height: Math.min(14, Math.max(3, Number(item.height) || 7)),
        rotation: Number(item.rotation) || 0,
        tilt: Math.min(0.1, Math.max(-0.1, Number(item.tilt) || 0)),
        width: Math.min(1.4, Math.max(0.7, Number(item.width) || 1)),
        growth: 1, user: true
      })
    }
  } catch {}
}

loadForest()
updateCount()

function setTime(name, announce = false) {
  sky.setPreset(name)
  audio.setPreset(name)
  for (const button of timeButtons) {
    button.setAttribute('aria-checked', button.dataset.time === name ? 'true' : 'false')
  }
  if (announce) {
    const messages = {
      dawn: '朝もやの森',
      day: '木もれ日の森',
      dusk: '夕暮れの森',
      night: '夜の森 — 蛍が舞いはじめました'
    }
    toast(messages[name] || '')
  }
}

setTime(initialTime)

for (const button of timeButtons) {
  button.addEventListener('click', () => {
    setTime(button.dataset.time, true)
    audio.plop()
  })
}

let soundOn = false
soundBtn.dataset.sound = 'off'
soundBtn.addEventListener('click', async () => {
  if (soundOn) {
    audio.disable()
    soundOn = false
    soundBtn.dataset.sound = 'off'
    soundBtn.setAttribute('aria-pressed', 'false')
    soundBtn.setAttribute('aria-label', '音をオンにする')
    toast('音をオフにしました')
    return
  }
  const ok = await audio.enable()
  soundOn = ok
  soundBtn.dataset.sound = ok ? 'on' : 'off'
  soundBtn.setAttribute('aria-pressed', ok ? 'true' : 'false')
  soundBtn.setAttribute('aria-label', ok ? '音をオフにする' : '音をオンにする')
  toast(ok ? '森の音をオンにしました' : '音を再生できませんでした')
})

let tiltOn = false
let tiltCheck = null
tiltBtn.addEventListener('click', async () => {
  if (tiltOn) {
    rig.disableTilt()
    tiltOn = false
    tiltBtn.setAttribute('aria-pressed', 'false')
    tiltBtn.setAttribute('aria-label', '端末の傾きをオンにする')
    clearTimeout(tiltCheck)
    toast('傾きをオフにしました')
    return
  }
  if (typeof window.DeviceOrientationEvent === 'undefined') {
    toast('この端末は傾きに対応していません')
    return
  }
  try {
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      const response = await window.DeviceOrientationEvent.requestPermission()
      if (response !== 'granted') {
        toast('モーションへのアクセスが許可されませんでした')
        return
      }
    }
    rig.enableTilt()
    tiltOn = true
    tiltBtn.setAttribute('aria-pressed', 'true')
    tiltBtn.setAttribute('aria-label', '端末の傾きをオフにする')
    toast('端末を傾けて、森を見わたしてみてください')
    clearTimeout(tiltCheck)
    tiltCheck = setTimeout(() => {
      if (tiltOn && !rig.tiltHasData) toast('傾きを検出できません。端末を少し動かしてみてください')
    }, 2200)
  } catch {
    toast('傾きを有効にできませんでした')
  }
})

resetBtn.addEventListener('click', () => {
  if (!forest.userTotal) {
    toast('植えた木はまだありません')
    return
  }
  forest.resetUserTrees()
  saveForest()
  audio.plop()
  toast('植えた木をリセットしました')
  hideHint()
})

let lastTotal = forest.total
let elapsed = 0
let adapted = false
let sampleTime = 0
let sampleFrames = 0
const clock = new THREE.Clock()

function animate() {
  const dt = Math.min(0.05, clock.getDelta())
  elapsed += dt
  rig.update(dt)
  sky.update(dt, elapsed, camera, world)
  world.update(dt)
  forest.update(dt)
  flora.update(dt, elapsed)
  const skyState = sky.current
  flora.setNight(skyState.fireflies, skyState.day)

  if (!prefersReducedMotion) {
    // Gentle idle life is handled by wind, mist and fireflies.
  }

  renderer.render(scene, camera)

  if (forest.total !== lastTotal) {
    lastTotal = forest.total
    updateCount()
  }

  if (!adapted) {
    sampleTime += dt
    sampleFrames++
    if (sampleTime > 3.2) {
      adapted = true
      const fps = sampleFrames / sampleTime
      if (fps < 44) {
        renderer.setPixelRatio(Math.max(1, Math.min(renderer.getPixelRatio(), 1.15)))
      }
      if (fps < 30) {
        const sun = sky.sun
        sun.shadow.mapSize.set(1024, 1024)
        if (sun.shadow.map) {
          sun.shadow.map.dispose()
          sun.shadow.map = null
        }
      }
    }
  }

  requestAnimationFrame(animate)
}

function resize() {
  const width = window.innerWidth
  const height = window.innerHeight
  const portrait = height > width
  camera.aspect = width / height
  camera.fov = isMobile && portrait ? 64 : 52
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2))
  renderer.setSize(width, height)
}

window.addEventListener('resize', resize)
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    resize()
    rig.calibrateTilt()
  }, 250)
})
if (screen.orientation) {
  screen.orientation.addEventListener?.('change', () => rig.calibrateTilt())
}

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return
  if (event.key === 'ArrowLeft') { rig.targetYaw += 0.18; event.preventDefault() }
  else if (event.key === 'ArrowRight') { rig.targetYaw -= 0.18; event.preventDefault() }
  else if (event.key === 'ArrowUp') { rig.targetPitch = Math.min(rig.maxPitch, rig.targetPitch + 0.08); event.preventDefault() }
  else if (event.key === 'ArrowDown') { rig.targetPitch = Math.max(rig.minPitch, rig.targetPitch - 0.08); event.preventDefault() }
  else if (event.key === '1') setTime('dawn', true)
  else if (event.key === '2') setTime('day', true)
  else if (event.key === '3') setTime('dusk', true)
  else if (event.key === '4') setTime('night', true)
  else if (event.key.toLowerCase() === 'm') soundBtn.click()
  else if (event.key.toLowerCase() === 't') tiltBtn.click()
  else if (event.key.toLowerCase() === 'r') resetBtn.click()
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) clock.getDelta()
})

setTimeout(hideHint, 11000)

resize()
renderer.compile(scene, camera)
renderer.render(scene, camera)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    loader.classList.add('is-hidden')
    animate()
  })
})
