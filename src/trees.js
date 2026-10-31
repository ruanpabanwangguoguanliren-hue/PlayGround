import * as THREE from '../vendor/three.module.js'
import {
  addWind,
  canvasTexture,
  clamp,
  lerp,
  mergeGeometries,
  mulberry32,
  paintGeometry
} from './utils.js'

const TREE_TYPES = ['fir', 'broad', 'birch']

function makeBarkTexture() {
  const random = mulberry32(77)
  return canvasTexture(128, 256, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, 0)
    gradient.addColorStop(0, '#5b4632')
    gradient.addColorStop(0.5, '#7a6146')
    gradient.addColorStop(1, '#4e3a29')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 180; i++) {
      const x = random() * w
      const y = random() * h
      const length = 18 + random() * 90
      const shade = random() > 0.5 ? 'rgba(34,24,16,' : 'rgba(150,124,92,'
      ctx.strokeStyle = shade + (0.06 + random() * 0.22) + ')'
      ctx.lineWidth = 0.6 + random() * 2.2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.bezierCurveTo(x + random() * 5 - 2.5, y + length * 0.4, x + random() * 6 - 3, y + length * 0.7, x + random() * 4 - 2, y + length)
      ctx.stroke()
    }
    for (let i = 0; i < 40; i++) {
      const x = random() * w
      const y = random() * h
      const r = 3 + random() * 12
      const moss = ctx.createRadialGradient(x, y, 0, x, y, r)
      moss.addColorStop(0, `rgba(96,118,58,${0.10 + random() * 0.18})`)
      moss.addColorStop(1, 'rgba(96,118,58,0)')
      ctx.fillStyle = moss
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  })
}

function makeBirchTexture() {
  const random = mulberry32(311)
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e6e1d2'
    ctx.fillRect(0, 0, w, h)
    const gradient = ctx.createLinearGradient(0, 0, w, 0)
    gradient.addColorStop(0, 'rgba(120,112,96,0.22)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.05)')
    gradient.addColorStop(1, 'rgba(100,94,80,0.25)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 46; i++) {
      const x = random() * w
      const y = random() * h
      const width = 6 + random() * 30
      const height = 1 + random() * 4
      ctx.fillStyle = `rgba(42,38,32,${0.35 + random() * 0.5})`
      ctx.beginPath()
      ctx.ellipse(x, y, width * 0.5, height * 0.5, random() * 0.4 - 0.2, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 18; i++) {
      const x = random() * w
      const y = random() * h
      ctx.fillStyle = `rgba(88,98,62,${0.08 + random() * 0.12})`
      ctx.fillRect(x, y, 8 + random() * 26, 4 + random() * 14)
    }
  })
}

function buildFirCanopy() {
  const profile = [
    [0.02, 0.12], [0.20, 0.16], [0.09, 0.23], [0.30, 0.32], [0.12, 0.40],
    [0.27, 0.50], [0.10, 0.58], [0.22, 0.68], [0.08, 0.76], [0.15, 0.86],
    [0.05, 0.94], [0.015, 1.02]
  ].map(([x, y]) => new THREE.Vector2(x, y))
  let geometry = new THREE.LatheGeometry(profile, 9)
  geometry = geometry.toNonIndexed()
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    const wobble = 1 + Math.sin(y * 37 + position.getX(i) * 9) * 0.08
    position.setX(i, position.getX(i) * wobble)
    position.setZ(i, position.getZ(i) * wobble)
  }
  geometry.computeVertexNormals()
  paintGeometry(geometry, (color, x, y) => {
    const shade = clamp(0.5 + y * 0.62, 0.45, 1.15)
    color.setRGB(shade * 0.86, shade * 0.98, shade * 0.82)
  })
  return geometry
}

function buildBroadCanopy() {
  const blobs = [
    [0, 0.82, 0, 0.30], [0.19, 0.70, 0.05, 0.23], [-0.17, 0.73, -0.08, 0.25],
    [0.02, 0.94, 0.11, 0.21], [-0.05, 0.65, -0.17, 0.20], [0.13, 0.88, -0.14, 0.18]
  ]
  const geometries = blobs.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 1)
    g.scale(1.05, 0.86, 1.05)
    g.translate(x, y, z)
    return g
  })
  const geometry = mergeGeometries(geometries)
  paintGeometry(geometry, (color, x, y) => {
    const shade = clamp(0.52 + y * 0.55, 0.5, 1.12)
    const warm = clamp((x + 0.4) * 0.25, -0.06, 0.06)
    color.setRGB(shade * (0.9 + warm), shade * (1.0 + warm * 0.4), shade * (0.84 + warm))
  })
  return geometry
}

function buildBirchCanopy() {
  const blobs = [
    [0, 0.8, 0, 0.23], [0.13, 0.72, 0.04, 0.17], [-0.12, 0.76, -0.06, 0.18],
    [0.01, 0.93, 0.06, 0.15], [-0.02, 0.68, -0.12, 0.14]
  ]
  const geometries = blobs.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 1)
    g.scale(1.0, 0.95, 1.0)
    g.translate(x, y, z)
    return g
  })
  const geometry = mergeGeometries(geometries)
  paintGeometry(geometry, (color, x, y) => {
    const shade = clamp(0.58 + y * 0.5, 0.55, 1.14)
    color.setRGB(shade * 0.94, shade * 1.02, shade * 0.84)
  })
  return geometry
}

function branchCylinder(length, radius, tilt, yaw, offsetY) {
  const g = new THREE.CylinderGeometry(radius * 0.55, radius, length, 5, 1)
  g.translate(0, length * 0.5, 0)
  g.rotateZ(tilt)
  g.rotateY(yaw)
  g.translate(0, offsetY, 0)
  return g
}

function buildTrunk(type) {
  if (type === 'fir') {
    const trunk = new THREE.CylinderGeometry(0.016, 0.05, 0.7, 7, 1)
    trunk.translate(0, 0.35, 0)
    return mergeGeometries([trunk])
  }
  const trunk = new THREE.CylinderGeometry(0.022, 0.055, 0.62, 7, 1)
  trunk.translate(0, 0.31, 0)
  const branchA = branchCylinder(0.34, 0.022, 0.72, 0.4, 0.42)
  const branchB = branchCylinder(0.3, 0.02, -0.62, 2.6, 0.5)
  const branchC = branchCylinder(0.24, 0.016, 0.5, 4.3, 0.56)
  return mergeGeometries([trunk, branchA, branchB, branchC])
}

function makeAncientTree(terrainHeight) {
  const group = new THREE.Group()
  const random = mulberry32(90210)
  const bark = makeBarkTexture()
  const trunkMat = new THREE.MeshStandardMaterial({ map: bark, color: 0x8a7355, roughness: 1 })
  const canopyMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true,
    emissive: 0x0b1609, emissiveIntensity: 0.2
  })

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 1.25, 7.4, 11, 4), trunkMat)
  trunk.position.y = 3.7
  trunk.castShadow = true
  trunk.receiveShadow = true
  group.add(trunk)

  const rootMat = trunkMat
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + random() * 0.4
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.55, 2.6, 6), rootMat)
    root.position.set(Math.cos(angle) * 0.85, 0.5, Math.sin(angle) * 0.85)
    root.rotation.z = Math.cos(angle) * 0.95
    root.rotation.x = -Math.sin(angle) * 0.95
    root.castShadow = true
    group.add(root)
  }

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + random() * 0.5
    const length = 3.6 + random() * 2.8
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, length, 6), trunkMat)
    branch.position.set(Math.cos(angle) * 0.5, 5.0 + random() * 1.6, Math.sin(angle) * 0.5)
    branch.rotation.z = 0.75 + random() * 0.35
    branch.rotation.y = -angle
    branch.castShadow = true
    group.add(branch)
  }

  const canopyGeometries = []
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2 + random() * 0.3
    const ring = i === 0 ? 0 : 1.5 + random() * 3.8
    const y = 7.0 + random() * 3.6 + (i === 0 ? 1.4 : 0)
    const r = 1.25 + random() * 1.85
    const g = new THREE.IcosahedronGeometry(r, 1)
    g.scale(1.08, 0.7, 1.08)
    g.translate(Math.cos(angle) * ring, y, Math.sin(angle) * ring)
    canopyGeometries.push(g)
  }
  const canopyGeo = mergeGeometries(canopyGeometries)
  paintGeometry(canopyGeo, (color, x, y) => {
    const shade = clamp(0.44 + y * 0.026, 0.46, 0.96)
    color.setRGB(shade * 0.9, shade * 1.0, shade * 0.82)
  })
  const canopy = new THREE.Mesh(canopyGeo, canopyMat)
  canopy.castShadow = true
  canopy.receiveShadow = true
  group.add(canopy)

  group.position.y = terrainHeight
  return group
}

export class Forest {
  constructor(scene, world, { capacity = 220, quality = 'high' } = {}) {
    this.scene = scene
    this.world = world
    this.capacity = capacity
    this.quality = quality
    this.random = mulberry32(424242)
    this.trees = []
    this.userTrees = []
    this.free = { fir: [], broad: [], birch: [] }
    this.cursor = { fir: 0, broad: 0, birch: 0 }
    this.growing = new Set()
    this.timeUniform = { value: 0 }

    const bark = makeBarkTexture()
    const birchBark = makeBirchTexture()
    const trunkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 1, metalness: 0 })
    const birchMat = new THREE.MeshStandardMaterial({ map: birchBark, roughness: 0.95, metalness: 0 })
    const firMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.94, metalness: 0, flatShading: true, side: THREE.DoubleSide,
      emissive: 0x0b160a, emissiveIntensity: 0.22
    })
    const broadMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true,
      emissive: 0x0c170a, emissiveIntensity: 0.2
    })
    addWind(firMat, this.timeUniform, { strength: 0.02, speed: 0.8 })
    addWind(broadMat, this.timeUniform, { strength: 0.028, speed: 0.7 })

    const geometries = {
      fir: { trunk: buildTrunk('fir'), canopy: buildFirCanopy(), trunkMat, canopyMat: firMat },
      broad: { trunk: buildTrunk('broad'), canopy: buildBroadCanopy(), trunkMat, canopyMat: broadMat },
      birch: { trunk: buildTrunk('broad'), canopy: buildBirchCanopy(), trunkMat: birchMat, canopyMat: broadMat }
    }

    this.meshes = {}
    for (const type of TREE_TYPES) {
      const count = type === 'fir' ? Math.round(capacity * 0.4) : type === 'broad' ? Math.round(capacity * 0.4) : Math.round(capacity * 0.2)
      const trunk = new THREE.InstancedMesh(geometries[type].trunk, geometries[type].trunkMat, count)
      const canopy = new THREE.InstancedMesh(geometries[type].canopy, geometries[type].canopyMat, count)
      trunk.castShadow = true
      trunk.receiveShadow = true
      canopy.castShadow = true
      canopy.receiveShadow = true
      trunk.frustumCulled = false
      canopy.frustumCulled = false
      trunk.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      canopy.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      const zero = new THREE.Matrix4().makeScale(0, 0, 0)
      for (let i = 0; i < count; i++) {
        trunk.setMatrixAt(i, zero)
        canopy.setMatrixAt(i, zero)
      }
      trunk.instanceMatrix.needsUpdate = true
      canopy.instanceMatrix.needsUpdate = true
      scene.add(trunk, canopy)
      this.meshes[type] = { trunk, canopy, count }
    }

    this.ancient = makeAncientTree(world.heightAt(9.5, -9.5))
    this.ancient.position.x = 9.5
    this.ancient.position.z = -9.5
    this.ancient.rotation.y = -0.4
    scene.add(this.ancient)

    this._matrix = new THREE.Matrix4()
    this._position = new THREE.Vector3()
    this._quaternion = new THREE.Quaternion()
    this._scale = new THREE.Vector3()
    this._euler = new THREE.Euler()
    this._color = new THREE.Color()
  }

  get total() {
    return this.trees.length
  }

  get userTotal() {
    return this.userTrees.length
  }

  canPlantAt(x, z, radius = 1.15) {
    for (const tree of this.trees) {
      const dx = tree.x - x
      const dz = tree.z - z
      if (dx * dx + dz * dz < radius * radius) return false
    }
    return true
  }

  addTree({ x, z, type = 'broad', height = 7, rotation = 0, tilt = 0, width = 1, growth = 1, animate = false, user = false, tint = null }) {
    const meshInfo = this.meshes[type]
    if (!meshInfo) return null
    let index
    if (this.free[type].length) index = this.free[type].pop()
    else if (this.cursor[type] < meshInfo.count) index = this.cursor[type]++
    else return null

    const tree = {
      x, z, type, height, rotation, tilt,
      width: width * (0.9 + this.random() * 0.24),
      growth: animate ? 0 : growth,
      targetGrowth: 1,
      animate,
      dying: false,
      user,
      index,
      phase: this.random() * Math.PI * 2,
      sway: 0.85 + this.random() * 0.3
    }
    tree.y = this.world.heightAt(x, z) - 0.08
    this.trees.push(tree)
    if (user) this.userTrees.push(tree)

    const canopyTint = tint || this.colorForType(type)
    const trunkTint = new THREE.Color(0.95 + this.random() * 0.1, 0.9 + this.random() * 0.1, 0.85 + this.random() * 0.1)
    meshInfo.trunk.setColorAt(index, trunkTint)
    meshInfo.canopy.setColorAt(index, canopyTint)
    meshInfo.trunk.instanceColor.needsUpdate = true
    meshInfo.canopy.instanceColor.needsUpdate = true
    this.writeMatrix(tree)
    if (animate) this.growing.add(tree)
    return tree
  }

  colorForType(type) {
    const color = new THREE.Color()
    if (type === 'fir') color.setHSL(0.33 + (this.random() - 0.5) * 0.03, 0.32, 0.46 + this.random() * 0.12)
    else if (type === 'birch') color.setHSL(0.22 + (this.random() - 0.5) * 0.04, 0.4, 0.58 + this.random() * 0.1)
    else color.setHSL(0.25 + (this.random() - 0.5) * 0.05, 0.42, 0.48 + this.random() * 0.12)
    return color
  }

  writeMatrix(tree) {
    const info = this.meshes[tree.type]
    const g = tree.dying ? Math.max(0, tree.growth) : tree.growth
    const s = tree.height * g
    if (s <= 0.0001) {
      this._matrix.makeScale(0, 0, 0)
      info.trunk.setMatrixAt(tree.index, this._matrix)
      info.canopy.setMatrixAt(tree.index, this._matrix)
      info.trunk.instanceMatrix.needsUpdate = true
      info.canopy.instanceMatrix.needsUpdate = true
      return
    }
    this._euler.set(tree.tilt * Math.cos(tree.phase), tree.rotation, tree.tilt * Math.sin(tree.phase))
    this._quaternion.setFromEuler(this._euler)
    this._position.set(tree.x, tree.y, tree.z)
    const w = tree.width * (tree.type === 'broad' ? 1.02 : 1)
    this._scale.set(s * w, s, s * w)
    this._matrix.compose(this._position, this._quaternion, this._scale)
    info.trunk.setMatrixAt(tree.index, this._matrix)
    info.canopy.setMatrixAt(tree.index, this._matrix)
    info.trunk.instanceMatrix.needsUpdate = true
    info.canopy.instanceMatrix.needsUpdate = true
  }

  plant(x, z, { user = true, animate = true, type = null } = {}) {
    if (!this.canPlantAt(x, z)) return { ok: false, reason: 'close' }
    const random = this.random
    const chosen = type || (random() < 0.42 ? 'broad' : random() < 0.62 ? 'fir' : 'birch')
    const base = chosen === 'fir' ? 6.2 : chosen === 'birch' ? 7.4 : 6.8
    const height = base + random() * 3.4
    const tree = this.addTree({
      x, z, type: chosen, height,
      rotation: random() * Math.PI * 2,
      tilt: (random() - 0.5) * 0.05,
      animate,
      user
    })
    if (!tree) return { ok: false, reason: 'full' }
    return { ok: true, tree }
  }

  resetUserTrees() {
    for (const tree of this.userTrees) {
      tree.dying = true
      tree.animate = true
      this.growing.add(tree)
    }
    this.userTrees = []
  }

  update(dt) {
    this.timeUniform.value += dt
    if (!this.growing.size) return
    for (const tree of [...this.growing]) {
      if (tree.dying) {
        tree.growth -= dt * 1.6
        if (tree.growth <= 0) {
          tree.growth = 0
          this.writeMatrix(tree)
          this.free[tree.type].push(tree.index)
          const at = this.trees.indexOf(tree)
          if (at >= 0) this.trees.splice(at, 1)
          this.growing.delete(tree)
          continue
        }
      } else {
        tree.growth = Math.min(1, tree.growth + dt / 1.35)
        if (tree.growth >= 1) {
          tree.growth = 1
          tree.animate = false
          this.growing.delete(tree)
        }
      }
      this.writeMatrix(tree)
    }
  }
}

export { TREE_TYPES }
