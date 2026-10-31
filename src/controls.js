import * as THREE from '../vendor/three.module.js'
import { clamp, damp } from './utils.js'

export class CameraRig {
  constructor(camera, domElement, world, { onPlant, onBlocked, isMobile = false } = {}) {
    this.camera = camera
    this.dom = domElement
    this.world = world
    this.onPlant = onPlant || (() => {})
    this.onBlocked = onBlocked || (() => {})

    this.target = new THREE.Vector3(0, 2.0, -4.6)
    this.yaw = 0
    this.pitch = isMobile ? 0.18 : 0.16
    this.radius = isMobile ? 20.5 : 18.2
    this.targetYaw = this.yaw
    this.targetPitch = this.pitch
    this.targetRadius = this.radius
    this.minRadius = 7.5
    this.maxRadius = 40
    this.minPitch = 0.015
    this.maxPitch = 1.15

    this.pointers = new Map()
    this.dragging = false
    this.multiTouch = false
    this.moved = 0
    this.downAt = 0
    this.pinchStart = 0
    this.pinchStartRadius = this.radius
    this.raycaster = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()
    this.time = 0

    this.tiltEnabled = false
    this.tiltHasData = false
    this.tiltX = 0
    this.tiltY = 0
    this.tiltTargetX = 0
    this.tiltTargetY = 0
    this.tiltBaseline = null
    this.tiltEvents = 0

    this.onPointerDown = this.onPointerDown.bind(this)
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)
    this.onPointerCancel = this.onPointerCancel.bind(this)
    this.onWheel = this.onWheel.bind(this)
    this.onOrientation = this.onOrientation.bind(this)
    this.onContextMenu = (event) => event.preventDefault()

    domElement.addEventListener('pointerdown', this.onPointerDown)
    domElement.addEventListener('pointermove', this.onPointerMove)
    domElement.addEventListener('pointerup', this.onPointerUp)
    domElement.addEventListener('pointercancel', this.onPointerCancel)
    domElement.addEventListener('wheel', this.onWheel, { passive: true })
    domElement.addEventListener('contextmenu', this.onContextMenu)
  }

  setPointerFromEvent(event) {
    const rect = this.dom.getBoundingClientRect()
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    return this.ndc
  }

  onPointerDown(event) {
    try {
      this.dom.setPointerCapture?.(event.pointerId)
    } catch {}
    this.pointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY
    })
    if (this.pointers.size === 1) {
      this.dragging = true
      this.moved = 0
      this.downAt = performance.now()
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
      this.pinchStartRadius = this.targetRadius
      this.dragging = false
      this.multiTouch = true
    }
  }

  onPointerMove(event) {
    const pointer = this.pointers.get(event.pointerId)
    if (!pointer) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    pointer.x = event.clientX
    pointer.y = event.clientY
    this.moved += Math.hypot(dx, dy)

    if (this.pointers.size === 1 && this.dragging) {
      this.targetYaw -= dx * 0.0042
      this.targetPitch = clamp(this.targetPitch + dy * 0.0032, this.minPitch, this.maxPitch)
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (this.pinchStart > 20) {
        this.targetRadius = clamp(this.pinchStartRadius * (this.pinchStart / Math.max(20, distance)), this.minRadius, this.maxRadius)
      }
    }
  }

  onPointerUp(event) {
    const pointer = this.pointers.get(event.pointerId)
    if (!pointer) return
    const duration = performance.now() - this.downAt
    const wasSingle = this.pointers.size === 1
    const wasMultiTouch = this.multiTouch
    this.pointers.delete(event.pointerId)
    try {
      this.dom.releasePointerCapture?.(event.pointerId)
    } catch {}
    if (this.pointers.size === 0) {
      this.dragging = false
      this.multiTouch = false
    }
    if (this.pointers.size === 1) {
      const [remaining] = [...this.pointers.values()]
      remaining.startX = remaining.x
      remaining.startY = remaining.y
      this.downAt = performance.now()
      this.moved = 0
    }
    if (!wasSingle || wasMultiTouch || this.moved > 11 || duration > 550) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    this.tryPlant(event)
  }

  onPointerCancel(event) {
    this.pointers.delete(event.pointerId)
    if (this.pointers.size === 0) {
      this.dragging = false
      this.multiTouch = false
    }
  }

  onWheel(event) {
    this.targetRadius = clamp(this.targetRadius * (1 + event.deltaY * 0.0011), this.minRadius, this.maxRadius)
  }

  tryPlant(event) {
    this.setPointerFromEvent(event)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObject(this.world.terrain, false)
    if (!hits.length) return
    const point = hits[0].point
    if (this.world.isWater(point.x, point.z)) {
      this.onBlocked('water')
      return
    }
    if (this.world.slopeAt(point.x, point.z) > 1.35) {
      this.onBlocked('steep')
      return
    }
    if (point.distanceTo(this.camera.position) < 3.5) {
      this.onBlocked('near')
      return
    }
    this.onPlant(point.x, point.z)
  }

  getScreenAngle() {
    const angle = (screen.orientation && typeof screen.orientation.angle === 'number')
      ? screen.orientation.angle
      : (typeof window.orientation === 'number' ? window.orientation : 0)
    return ((angle % 360) + 360) % 360
  }

  onOrientation(event) {
    if (!this.tiltEnabled) return
    if (event.beta === null && event.gamma === null) return
    const beta = event.beta || 0
    const gamma = event.gamma || 0
    const angle = this.getScreenAngle()
    let x = gamma
    let y = beta
    if (angle === 90) { x = beta; y = -gamma }
    else if (angle === 270) { x = -beta; y = gamma }
    else if (angle === 180) { x = -gamma; y = -beta }

    this.tiltEvents++
    if (!this.tiltBaseline) {
      this.tiltBaseline = { x, y }
      return
    }
    this.tiltHasData = true
    this.tiltTargetX = clamp((x - this.tiltBaseline.x) / 26, -1, 1)
    this.tiltTargetY = clamp((y - this.tiltBaseline.y) / 26, -1, 1)
  }

  enableTilt() {
    if (this.tiltEnabled) return
    this.tiltEnabled = true
    this.tiltBaseline = null
    this.tiltEvents = 0
    this.tiltHasData = false
    window.addEventListener('deviceorientation', this.onOrientation, true)
  }

  disableTilt() {
    this.tiltEnabled = false
    this.tiltBaseline = null
    this.tiltTargetX = 0
    this.tiltTargetY = 0
    window.removeEventListener('deviceorientation', this.onOrientation, true)
  }

  calibrateTilt() {
    this.tiltBaseline = null
    this.tiltTargetX = 0
    this.tiltTargetY = 0
  }

  update(dt) {
    this.time += dt
    this.yaw = damp(this.yaw, this.targetYaw, 7.5, dt)
    this.pitch = damp(this.pitch, this.targetPitch, 7.5, dt)
    this.radius = damp(this.radius, this.targetRadius, 7.5, dt)
    this.tiltX = damp(this.tiltX, this.tiltEnabled ? this.tiltTargetX : 0, 4.5, dt)
    this.tiltY = damp(this.tiltY, this.tiltEnabled ? this.tiltTargetY : 0, 4.5, dt)

    const yaw = this.yaw + this.tiltX * 0.16
    const pitch = clamp(this.pitch + this.tiltY * 0.1, this.minPitch, this.maxPitch)
    const radius = this.radius
    const x = this.target.x + Math.sin(yaw) * Math.cos(pitch) * radius
    const z = this.target.z + Math.cos(yaw) * Math.cos(pitch) * radius
    let y = this.target.y + Math.sin(pitch) * radius
    const ground = this.world.heightAt(x, z) + 0.9
    if (y < ground) y = ground
    const breathe = Math.sin(this.time * 0.55) * 0.035 + Math.sin(this.time * 0.21) * 0.025
    this.camera.position.set(x, y, z)
    this.camera.lookAt(this.target.x + this.tiltX * 0.25, this.target.y + breathe, this.target.z)
    this.camera.rotateZ(-this.tiltX * 0.028)
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown)
    this.dom.removeEventListener('pointermove', this.onPointerMove)
    this.dom.removeEventListener('pointerup', this.onPointerUp)
    this.dom.removeEventListener('pointercancel', this.onPointerCancel)
    this.dom.removeEventListener('wheel', this.onWheel)
    this.dom.removeEventListener('contextmenu', this.onContextMenu)
    this.disableTilt()
  }
}
