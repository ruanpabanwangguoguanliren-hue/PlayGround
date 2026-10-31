import * as THREE from '../vendor/three.module.js'
import { addWind, canvasTexture, clamp, mulberry32, paintGeometry, smoothstep } from './utils.js'

function buildGrassGeometry() {
  const positions = []
  const colors = []
  const random = mulberry32(11)
  const base = new THREE.Color(0x50722f)
  const tip = new THREE.Color(0xb9d47c)
  const color = new THREE.Color()

  const addBlade = (angle, lean, height, width, offsetX, offsetZ) => {
    const rows = 4
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const leanX = Math.cos(lean)
    const leanZ = Math.sin(lean)
    const points = []
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1)
      const curve = t * t
      const px = offsetX + leanX * curve * 0.22
      const pz = offsetZ + leanZ * curve * 0.22
      const py = t * height
      const halfWidth = width * (1 - t * 0.92) * 0.5
      points.push([px - cos * halfWidth, py, pz - sin * halfWidth], [px + cos * halfWidth, py, pz + sin * halfWidth])
    }
    for (let i = 0; i < rows - 1; i++) {
      const a = points[i * 2]
      const b = points[i * 2 + 1]
      const c = points[(i + 1) * 2]
      const d = points[(i + 1) * 2 + 1]
      const t0 = i / (rows - 1)
      const t1 = (i + 1) / (rows - 1)
      for (const [p, t] of [[a, t0], [b, t0], [c, t1], [b, t0], [d, t1], [c, t1]]) {
        positions.push(p[0], p[1], p[2])
        color.copy(base).lerp(tip, t * 0.9)
        colors.push(color.r, color.g, color.b)
      }
    }
  }

  for (let i = 0; i < 7; i++) {
    const angle = random() * Math.PI
    addBlade(angle, random() * Math.PI * 2, 0.62 + random() * 0.42, 0.035 + random() * 0.035, (random() - 0.5) * 0.24, (random() - 0.5) * 0.24)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildFernGeometry() {
  const positions = []
  const colors = []
  const base = new THREE.Color(0x355426)
  const tip = new THREE.Color(0x8fb65a)
  const color = new THREE.Color()
  const fronds = 6
  for (let f = 0; f < fronds; f++) {
    const angle = (f / fronds) * Math.PI * 2
    const dirX = Math.cos(angle)
    const dirZ = Math.sin(angle)
    const sideX = -dirZ
    const sideZ = dirX
    const rows = 5
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1)
      const t2 = (i + 1) / (rows - 1)
      const r1 = t * 0.55
      const r2 = t2 * 0.55
      const y1 = 0.16 + Math.sin(t * Math.PI * 0.8) * 0.62 - t * t * 0.3
      const y2 = 0.16 + Math.sin(t2 * Math.PI * 0.8) * 0.62 - t2 * t2 * 0.3
      const w1 = 0.17 * (1 - t * 0.75) + 0.015
      const w2 = 0.17 * (1 - t2 * 0.75) + 0.015
      const p1 = [dirX * r1 - sideX * w1, y1, dirZ * r1 - sideZ * w1]
      const p2 = [dirX * r1 + sideX * w1, y1, dirZ * r1 + sideZ * w1]
      const p3 = [dirX * r2 - sideX * w2, y2, dirZ * r2 - sideZ * w2]
      const p4 = [dirX * r2 + sideX * w2, y2, dirZ * r2 + sideZ * w2]
      for (const [p, t3] of [[p1, t], [p2, t], [p3, t2], [p2, t], [p4, t2], [p3, t2]]) {
        positions.push(p[0], p[1], p[2])
        color.copy(base).lerp(tip, t3)
        colors.push(color.r, color.g, color.b)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildFlowerGeometry() {
  const geometries = []
  const stem = new THREE.CylinderGeometry(0.006, 0.009, 0.34, 3)
  stem.translate(0, 0.17, 0)
  geometries.push(stem)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const petal = new THREE.CircleGeometry(0.055, 5)
    petal.scale(1, 0.55, 1)
    petal.rotateX(-Math.PI / 2)
    petal.rotateZ(angle)
    petal.translate(Math.cos(angle) * 0.055, 0.36, Math.sin(angle) * 0.055)
    geometries.push(petal)
  }
  const center = new THREE.SphereGeometry(0.026, 6, 4)
  center.translate(0, 0.37, 0)
  geometries.push(center)
  const merged = new THREE.BufferGeometry()
  let vertexCount = 0
  const prepared = geometries.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    vertexCount += n.getAttribute('position').count
    return n
  })
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)
  let offset = 0
  const stemColor = new THREE.Color(0x3f5c2a)
  const petalColor = new THREE.Color(0xf6efdd)
  for (const g of prepared) {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    positions.set(p.array, offset * 3)
    normals.set(n.array, offset * 3)
    const isStem = g === prepared[0]
    const c = isStem ? stemColor : petalColor
    for (let i = 0; i < p.count; i++) {
      colors[(offset + i) * 3] = c.r
      colors[(offset + i) * 3 + 1] = c.g
      colors[(offset + i) * 3 + 2] = c.b
    }
    offset += p.count
  }
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return merged
}

function buildMushroomGeometry() {
  const stem = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 6)
  stem.translate(0, 0.11, 0)
  const cap = new THREE.SphereGeometry(0.16, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)
  cap.scale(1, 0.75, 1)
  cap.translate(0, 0.22, 0)
  const merged = new THREE.BufferGeometry()
  const geos = [stem, cap].map((g) => g.index ? g.toNonIndexed() : g)
  let count = 0
  for (const g of geos) count += g.getAttribute('position').count
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  let offset = 0
  const stemColor = new THREE.Color(0xe6dcc2)
  const capColor = new THREE.Color(0xb5432f)
  geos.forEach((g, index) => {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    positions.set(p.array, offset * 3)
    normals.set(n.array, offset * 3)
    const c = index === 0 ? stemColor : capColor
    for (let i = 0; i < p.count; i++) {
      colors[(offset + i) * 3] = c.r
      colors[(offset + i) * 3 + 1] = c.g
      colors[(offset + i) * 3 + 2] = c.b
    }
    offset += p.count
  })
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return merged
}

function buildReedGeometry() {
  const positions = []
  const colors = []
  const base = new THREE.Color(0x5c6d33)
  const tip = new THREE.Color(0xa8ad66)
  const color = new THREE.Color()
  const random = mulberry32(66)
  for (let b = 0; b < 4; b++) {
    const angle = random() * Math.PI * 2
    const lean = 0.1 + random() * 0.25
    const height = 1.1 + random() * 0.8
    const halfWidth = 0.022
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const rows = 3
    const pts = []
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1)
      const x = Math.cos(angle + lean) * t * t * 0.3
      const z = Math.sin(angle + lean) * t * t * 0.3
      const w = halfWidth * (1 - t * 0.85)
      pts.push([x - cos * w, t * height, z - sin * w], [x + cos * w, t * height, z + sin * w])
    }
    for (let i = 0; i < rows - 1; i++) {
      const a = pts[i * 2]
      const b2 = pts[i * 2 + 1]
      const c = pts[(i + 1) * 2]
      const d = pts[(i + 1) * 2 + 1]
      const t0 = i / (rows - 1)
      const t1 = (i + 1) / (rows - 1)
      for (const [p, t] of [[a, t0], [b2, t0], [c, t1], [b2, t0], [d, t1], [c, t1]]) {
        positions.push(p[0], p[1], p[2])
        color.copy(base).lerp(tip, t)
        colors.push(color.r, color.g, color.b)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function softDotTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

export class Flora {
  constructor(scene, world, forest, { quality = 'high' } = {}) {
    this.scene = scene
    this.world = world
    this.forest = forest
    this.quality = quality
    this.timeUniform = { value: 0 }
    this.random = mulberry32(20261031)
    this.mobile = quality === 'low'
    this.grass = this.buildGrass()
    this.ferns = this.buildFerns()
    this.rocks = this.buildRocks()
    this.flowers = this.buildFlowers()
    this.mushrooms = this.buildMushrooms()
    this.reeds = this.buildReeds()
    this.leaves = this.buildLeaves()
    this.buildFireflies()
    this.buildPollen()
    this.buildButterflies()
    this.buildBirds()
    this.buildRipples()
    this.buildBurst()

    this.densityMeshes = [
      this.grass, this.ferns, this.flowers, this.mushrooms, this.reeds, this.leaves
    ]
    for (const mesh of this.densityMeshes) mesh.userData.baseCount = mesh.count
  }

  reduceDensity(scale) {
    for (const mesh of this.densityMeshes) {
      mesh.count = Math.max(0, Math.floor(mesh.userData.baseCount * scale))
    }
  }

  nearWater(x, z, margin = 0.25) {
    return this.world.pondDistance(x, z) < this.world.pond.radius + margin && this.world.heightAt(x, z) < this.world.waterY + 0.35
  }

  buildGrass() {
    const count = this.mobile ? 5400 : 11800
    const geometry = buildGrassGeometry()
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true, side: THREE.DoubleSide
    })
    addWind(material, this.timeUniform, { strength: 0.14, heightPower: 1.0, speed: 1.25 })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const random = this.random
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 4) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * 37
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius - 2
      if (this.world.isWater(x, z) || this.nearWater(x, z, 4.8)) continue
      if (this.world.pondDistance(x, z) < this.world.pond.radius + 4.5) continue
      if (this.world.slopeAt(x, z) > 1.15) continue
      const pathDistance = this.world.distanceToPath(x, z)
      if (pathDistance < 1.45) continue
      if (Math.hypot(x, z + 4) < 3.2) continue
      position.set(x, this.world.heightAt(x, z) - 0.02, z)
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0))
      const size = 0.66 + random() * 0.55
      const pathScale = 0.58 + 0.42 * smoothstep(1.45, 4.5, pathDistance)
      const nearCamera = smoothstep(3, 10, Math.hypot(x, z - 13))
      scale.set(
        size * (0.8 + random() * 0.5),
        size * (0.58 + random() * 0.48) * pathScale * (0.42 + 0.58 * nearCamera),
        size * (0.8 + random() * 0.5)
      )
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(placed, matrix)
      color.setHSL(0.21 + (random() - 0.5) * 0.05, 0.3 + random() * 0.16, 0.5 + random() * 0.16)
      mesh.setColorAt(placed, color)
      placed++
    }
    mesh.count = placed
    this.scene.add(mesh)
    return mesh
  }

  buildFerns() {
    const count = this.mobile ? 260 : 560
    const geometry = buildFernGeometry()
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide
    })
    addWind(material, this.timeUniform, { strength: 0.055, heightPower: 1.0, speed: 1.0 })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const random = this.random
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 8) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = 5 + Math.sqrt(random()) * 30
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius - 2
      if (this.world.isWater(x, z) || this.nearWater(x, z, 0.8)) continue
      if (this.world.slopeAt(x, z) > 0.95) continue
      if (this.world.distanceToPath(x, z) < 1.8) continue
      if (Math.hypot(x, z + 15.5) < 3) continue
      position.set(x, this.world.heightAt(x, z) - 0.03, z)
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0))
      const size = 0.75 + random() * 1.1
      scale.set(size, size * (0.8 + random() * 0.5), size)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(placed, matrix)
      color.setHSL(0.24 + (random() - 0.5) * 0.05, 0.3, 0.5 + random() * 0.18)
      mesh.setColorAt(placed, color)
      placed++
    }
    mesh.count = placed
    this.scene.add(mesh)
    return mesh
  }

  buildRocks() {
    const count = this.mobile ? 26 : 46
    const geometry = new THREE.DodecahedronGeometry(1, 0)
    const material = new THREE.MeshStandardMaterial({ roughness: 0.98, metalness: 0, flatShading: true })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.castShadow = true
    mesh.receiveShadow = true
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const random = this.random
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 20) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = 6 + Math.sqrt(random()) * 28
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius - 2
      if (this.world.isWater(x, z)) continue
      if (this.world.distanceToPath(x, z) < 1.7) continue
      if (Math.hypot(x, z + 15.5) < 4) continue
      if (Math.hypot(x, z + 4) < 4) continue
      const size = 0.22 + Math.pow(random(), 2) * 1.1
      position.set(x, this.world.heightAt(x, z) + size * 0.18, z)
      quaternion.setFromEuler(new THREE.Euler(random() * 0.5, random() * Math.PI * 2, random() * 0.5))
      scale.set(size * (0.8 + random() * 0.6), size * (0.55 + random() * 0.5), size * (0.8 + random() * 0.6))
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(placed, matrix)
      const mossy = random() < 0.55
      color.setHSL(mossy ? 0.22 : 0.1, mossy ? 0.16 : 0.05, 0.34 + random() * 0.18)
      mesh.setColorAt(placed, color)
      placed++
    }
    mesh.count = placed
    this.scene.add(mesh)
    return mesh
  }

  buildFlowers() {
    const count = this.mobile ? 240 : 620
    const geometry = buildFlowerGeometry()
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide
    })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const random = this.random
    const palette = [0xfff4dd, 0xffd9e2, 0xffe9a8, 0xe8e0ff, 0xfff0f0]
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 10) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = 3 + Math.sqrt(random()) * 30
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius - 2
      if (this.world.isWater(x, z) || this.nearWater(x, z, 0.6)) continue
      if (this.world.slopeAt(x, z) > 0.9) continue
      if (this.world.distanceToPath(x, z) < 1.4) continue
      if (Math.hypot(x, z + 15.5) < 3.5) continue
      position.set(x, this.world.heightAt(x, z) - 0.01, z)
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0))
      const size = 0.8 + random() * 0.9
      scale.set(size, size * (0.8 + random() * 0.6), size)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(placed, matrix)
      color.set(palette[Math.floor(random() * palette.length)])
      color.offsetHSL(0, 0, (random() - 0.5) * 0.08)
      mesh.setColorAt(placed, color)
      placed++
    }
    mesh.count = placed
    this.scene.add(mesh)
    return mesh
  }

  buildMushrooms() {
    const count = this.mobile ? 40 : 90
    const geometry = buildMushroomGeometry()
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.castShadow = true
    mesh.receiveShadow = true
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const random = this.random
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 14) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = 6 + Math.sqrt(random()) * 26
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius - 2
      if (this.world.isWater(x, z) || this.nearWater(x, z, 1)) continue
      if (this.world.distanceToPath(x, z) < 1.9) continue
      if (this.world.slopeAt(x, z) > 0.8) continue
      position.set(x, this.world.heightAt(x, z) - 0.02, z)
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0))
      const size = 0.6 + random() * 1.0
      scale.set(size, size * (0.8 + random() * 0.7), size)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(placed, matrix)
      placed++
    }
    mesh.count = placed
    this.scene.add(mesh)
    return mesh
  }

  buildReeds() {
    const count = this.mobile ? 90 : 190
    const geometry = buildReedGeometry()
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, side: THREE.DoubleSide
    })
    addWind(material, this.timeUniform, { strength: 0.07, heightPower: 1.1, speed: 1.1 })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const random = this.random
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 20) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = this.world.pond.radius * (0.78 + random() * 0.36)
      const x = this.world.pond.x + Math.cos(angle) * radius
      const z = this.world.pond.z + Math.sin(angle) * radius
      if (this.world.isWater(x, z)) continue
      position.set(x, this.world.heightAt(x, z) - 0.04, z)
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0))
      const size = 0.7 + random() * 0.6
      scale.set(size, size * (0.8 + random() * 0.7), size)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(placed, matrix)
      color.setHSL(0.2 + random() * 0.06, 0.3, 0.48 + random() * 0.16)
      mesh.setColorAt(placed, color)
      placed++
    }
    mesh.count = placed
    this.scene.add(mesh)
    return mesh
  }

  buildLeaves() {
    const count = this.mobile ? 220 : 520
    const geometry = new THREE.CircleGeometry(1, 5)
    geometry.rotateX(-Math.PI / 2)
    geometry.scale(1, 1, 0.55)
    const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, side: THREE.DoubleSide })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.receiveShadow = true
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const random = this.random
    const trees = this.forest.trees
    let placed = 0
    for (let i = 0; i < count; i++) {
      let x, z, y
      if (i < 26) {
        const angle = random() * Math.PI * 2
        const radius = random() * (this.world.pond.radius - 0.8)
        x = this.world.pond.x + Math.cos(angle) * radius
        z = this.world.pond.z + Math.sin(angle) * radius
        y = this.world.waterY + 0.018
      } else {
        const tree = trees[Math.floor(random() * trees.length)]
        if (!tree) break
        const angle = random() * Math.PI * 2
        const radius = 0.6 + Math.pow(random(), 1.8) * 4.2
        x = tree.x + Math.cos(angle) * radius
        z = tree.z + Math.sin(angle) * radius
        if (this.world.isWater(x, z)) continue
        y = this.world.heightAt(x, z) + 0.025
      }
      position.set(x, y, z)
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0))
      const size = 0.05 + random() * 0.085
      scale.set(size, 1, size)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(placed, matrix)
      const warm = random()
      color.setHSL(0.05 + warm * 0.07, 0.45 + random() * 0.2, 0.3 + random() * 0.18)
      mesh.setColorAt(placed, color)
      placed++
    }
    mesh.count = placed
    this.scene.add(mesh)
    return mesh
  }

  buildFireflies() {
    const count = this.mobile ? 90 : 150
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)
    const random = this.random
    for (let i = 0; i < count; i++) {
      let x, z
      if (random() < 0.55) {
        const angle = random() * Math.PI * 2
        const radius = this.world.pond.radius * (0.55 + random() * 1.5)
        x = this.world.pond.x + Math.cos(angle) * radius
        z = this.world.pond.z + Math.sin(angle) * radius
      } else {
        const angle = random() * Math.PI * 2
        const radius = 2 + Math.sqrt(random()) * 14
        x = Math.cos(angle) * radius
        z = Math.sin(angle) * radius - 4
      }
      const ground = this.world.heightAt(x, z)
      positions[i * 3] = x
      positions[i * 3 + 1] = Math.max(ground + 0.5, this.world.waterY + 0.4) + random() * 2.4
      positions[i * 3 + 2] = z
      phases[i] = random() * Math.PI * 2
      sizes[i] = 0.55 + random() * 1.1
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    this.fireflyMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.timeUniform,
        uOpacity: { value: 0 },
        uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) }
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.45 + aPhase) * 0.65;
          p.y += sin(uTime * 0.7 + aPhase * 1.7) * 0.32;
          p.z += cos(uTime * 0.38 + aPhase * 1.3) * 0.65;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (95.0 / max(1.0, -mv.z));
          float blink = 0.28 + 0.72 * pow(max(0.0, sin(uTime * 1.4 + aPhase * 5.0)), 2.0);
          vAlpha = blink;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float glow = smoothstep(0.5, 0.0, d);
          glow *= glow;
          vec3 color = mix(vec3(0.65, 1.0, 0.35), vec3(1.0, 0.82, 0.32), 0.4 + 0.6 * glow);
          gl_FragColor = vec4(color, glow * vAlpha * uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    })
    this.fireflies = new THREE.Points(geometry, this.fireflyMaterial)
    this.fireflies.frustumCulled = false
    this.scene.add(this.fireflies)
  }

  buildPollen() {
    const count = this.mobile ? 140 : 280
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)
    const random = this.random
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * 26
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius - 2
      positions[i * 3] = x
      positions[i * 3 + 1] = this.world.heightAt(x, z) + 0.4 + random() * 7
      positions[i * 3 + 2] = z
      phases[i] = random() * Math.PI * 2
      sizes[i] = 0.4 + random() * 0.8
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    this.pollenMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.timeUniform,
        uOpacity: { value: 0.55 },
        uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) }
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.12 + aPhase) * 1.4;
          p.y += sin(uTime * 0.2 + aPhase * 2.0) * 0.6;
          p.z += cos(uTime * 0.1 + aPhase * 1.4) * 1.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (46.0 / max(1.0, -mv.z));
          vAlpha = 0.5 + 0.5 * sin(uTime * 0.9 + aPhase * 3.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(1.0, 0.95, 0.78, a * vAlpha * uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    })
    this.pollen = new THREE.Points(geometry, this.pollenMaterial)
    this.pollen.frustumCulled = false
    this.scene.add(this.pollen)
  }

  buildButterflies() {
    this.butterflies = []
    const random = this.random
    const colors = [0xffe9a8, 0xf4f1e0, 0xa8c8ff, 0xffc7a8]
    for (let i = 0; i < 7; i++) {
      const group = new THREE.Group()
      const material = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length], roughness: 0.8, side: THREE.DoubleSide
      })
      const wingGeometry = new THREE.CircleGeometry(0.16, 6)
      wingGeometry.scale(1, 0.72, 1)
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group()
        const wing = new THREE.Mesh(wingGeometry, material)
        wing.position.x = side * 0.12
        wing.rotation.y = side * 0.2
        pivot.add(wing)
        pivot.userData.side = side
        group.add(pivot)
      }
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.16, 5), new THREE.MeshStandardMaterial({ color: 0x2f2a22, roughness: 0.9 }))
      body.rotation.x = Math.PI / 2
      group.add(body)
      const center = new THREE.Vector3(
        (random() - 0.5) * 16,
        0,
        (random() - 0.5) * 16 - 3
      )
      group.userData = {
        center,
        radiusX: 1.5 + random() * 3.5,
        radiusZ: 1.5 + random() * 3.5,
        speed: 0.25 + random() * 0.3,
        phase: random() * Math.PI * 2,
        height: 0.6 + random() * 1.8,
        wings: group.children.filter((c) => c.userData.side),
        flap: 8 + random() * 6
      }
      group.scale.setScalar(0.9 + random() * 0.5)
      this.scene.add(group)
      this.butterflies.push(group)
    }
  }

  buildBirds() {
    this.birds = []
    const material = new THREE.MeshBasicMaterial({ color: 0x2a2d2a, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
    for (let i = 0; i < 5; i++) {
      const group = new THREE.Group()
      const wingGeometry = new THREE.PlaneGeometry(1.1, 0.2)
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group()
        const wing = new THREE.Mesh(wingGeometry, material)
        wing.position.x = side * 0.55
        pivot.add(wing)
        pivot.userData.side = side
        group.add(pivot)
      }
      group.userData = {
        radius: 16 + i * 5,
        height: 20 + i * 3,
        speed: 0.035 + i * 0.006,
        phase: (i / 5) * Math.PI * 2,
        wings: group.children
      }
      this.scene.add(group)
      this.birds.push(group)
    }
  }

  buildRipples() {
    const texture = canvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.16, w / 2, h / 2, w * 0.5)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
      g.addColorStop(0.72, 'rgba(255,255,255,0.28)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    })
    this.ripples = []
    for (let i = 0; i < 5; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        color: 0xffe6b8, opacity: 0
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
      mesh.rotation.x = -Math.PI / 2
      mesh.visible = false
      this.scene.add(mesh)
      this.ripples.push({ mesh, life: 0 })
    }
  }

  buildBurst() {
    const count = 34
    const positions = new Float32Array(count * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.burstMaterial = new THREE.PointsMaterial({
      map: softDotTexture(), color: 0xffe7b0, size: 0.32, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0
    })
    this.burst = new THREE.Points(geometry, this.burstMaterial)
    this.burst.frustumCulled = false
    this.burst.visible = false
    this.burstParticles = []
    this.burstLife = 0
    this.scene.add(this.burst)
  }

  ripple(x, z) {
    const ripple = this.ripples.find((r) => r.life <= 0) || this.ripples[0]
    ripple.life = 1
    ripple.mesh.visible = true
    ripple.mesh.position.set(x, this.world.heightAt(x, z) + 0.06, z)
    ripple.mesh.material.opacity = 0.9
    ripple.mesh.scale.setScalar(0.4)
  }

  burstAt(x, z) {
    const y = this.world.heightAt(x, z) + 0.15
    const positions = this.burst.geometry.getAttribute('position')
    this.burstParticles = []
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i, x, y, z)
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 1.4
      this.burstParticles.push({
        vx: Math.cos(angle) * speed,
        vy: 1.2 + Math.random() * 1.8,
        vz: Math.sin(angle) * speed
      })
    }
    positions.needsUpdate = true
    this.burstLife = 1
    this.burst.visible = true
    this.burstMaterial.opacity = 1
  }

  setNight(value, dayValue = 1) {
    this.fireflyMaterial.uniforms.uOpacity.value = value
    this.pollenMaterial.uniforms.uOpacity.value = 0.5 * dayValue
    for (const butterfly of this.butterflies) butterfly.visible = dayValue > 0.35
    for (const bird of this.birds) bird.visible = dayValue > 0.25
  }

  update(dt, time) {
    this.timeUniform.value = time
    const positions = this.burst.geometry.getAttribute('position')
    if (this.burstLife > 0) {
      this.burstLife -= dt * 1.4
      for (let i = 0; i < this.burstParticles.length; i++) {
        const p = this.burstParticles[i]
        p.vy -= dt * 2.2
        positions.setXYZ(i, positions.getX(i) + p.vx * dt, positions.getY(i) + p.vy * dt, positions.getZ(i) + p.vz * dt)
      }
      positions.needsUpdate = true
      this.burstMaterial.opacity = Math.max(0, this.burstLife)
      if (this.burstLife <= 0) this.burst.visible = false
    }

    for (const ripple of this.ripples) {
      if (ripple.life <= 0) continue
      ripple.life -= dt * 1.1
      const t = 1 - ripple.life
      ripple.mesh.scale.setScalar(0.4 + t * 3.2)
      ripple.mesh.material.opacity = Math.max(0, ripple.life * 0.85)
      if (ripple.life <= 0) ripple.mesh.visible = false
    }

    for (const butterfly of this.butterflies) {
      if (!butterfly.visible) continue
      const data = butterfly.userData
      const t = time * data.speed + data.phase
      const x = data.center.x + Math.cos(t) * data.radiusX + Math.sin(t * 2.3) * 0.6
      const z = data.center.z + Math.sin(t * 1.1) * data.radiusZ
      const ground = this.world.heightAt(x, z)
      const y = Math.max(ground + data.height, this.world.waterY + 0.5) + Math.sin(t * 3.1) * 0.25
      butterfly.position.set(x, y, z)
      butterfly.rotation.y = Math.atan2(-Math.sin(t), Math.cos(t) * 1.1)
      for (const wing of data.wings) {
        const flap = Math.sin(time * data.flap + data.phase) * 0.9
        wing.rotation.z = wing.userData.side * flap
      }
    }

    for (const bird of this.birds) {
      if (!bird.visible) continue
      const data = bird.userData
      const t = time * data.speed + data.phase
      const x = Math.cos(t) * data.radius
      const z = Math.sin(t) * data.radius - 10
      bird.position.set(x, data.height + Math.sin(t * 2.0) * 0.6, z)
      bird.rotation.y = -t + Math.PI / 2
      const flap = Math.sin(time * 7 + data.phase) * 0.6
      for (const wing of data.wings) {
        wing.rotation.z = wing.userData.side * flap
      }
    }
  }
}
