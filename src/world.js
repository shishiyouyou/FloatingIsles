import * as THREE from 'three'

// ---------- 黄昏渐变天空 ----------
export function createSky() {
  const geo = new THREE.SphereGeometry(400, 24, 16)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x3b2a6e) },
      midColor: { value: new THREE.Color(0xb06ab3) },
      botColor: { value: new THREE.Color(0xffb36b) },
      darkness: { value: 0 },
    },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 vP; uniform vec3 topColor,midColor,botColor; uniform float darkness;
      void main(){
        float h = normalize(vP).y * .5 + .5;
        vec3 c = h > .55 ? mix(midColor, topColor, (h-.55)/.45) : mix(botColor, midColor, h/.55);
        c = mix(c, c*.35, darkness);
        gl_FragColor = vec4(c, 1.);
      }`,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = -10
  return mesh
}

// ---------- 云海 ----------
export function createCloudSea() {
  const group = new THREE.Group()
  const layers = []
  const cloudTex = makeCloudTexture()

  for (let i = 0; i < 3; i++) {
    const y = -14 - i * 9
    const mat = new THREE.MeshBasicMaterial({
      map: cloudTex, transparent: true, depthWrite: false,
      opacity: 0.5 - i * 0.12, color: new THREE.Color().setHSL(0.75, 0.35, 0.75 - i * 0.1),
    })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), mat)
    plane.rotation.x = -Math.PI / 2
    plane.position.y = y
    plane.renderOrder = -5 + i
    group.add(plane)
    layers.push({ mesh: plane, speed: 0.6 + i * 0.45, dir: i % 2 ? 1 : -1 })
  }

  const puffs = []
  const puffGeo = new THREE.SphereGeometry(1, 10, 8)
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xf0e6ff, transparent: true, opacity: 0.82 })
  for (let i = 0; i < 26; i++) {
    const puff = new THREE.Group()
    const n = 3 + (Math.random() * 3 | 0)
    for (let j = 0; j < n; j++) {
      const s = 1.2 + Math.random() * 2.2
      const m = new THREE.Mesh(puffGeo, puffMat)
      m.position.set(j * s * 0.9 - n * s * 0.45, Math.random() * 0.7, Math.random() * 1.6 - 0.8)
      m.scale.set(s, s * 0.55, s * 0.8)
      puff.add(m)
    }
    const ang = Math.random() * Math.PI * 2
    const rad = 30 + Math.random() * 90
    puff.position.set(Math.cos(ang) * rad, -9 + Math.random() * 10, Math.sin(ang) * rad)
    puff.userData = { ang, rad, speed: 0.008 + Math.random() * 0.02, y0: puff.position.y, ph: Math.random() * 9 }
    group.add(puff)
    puffs.push(puff)
  }

  return {
    group,
    update(t, dt) {
      for (const l of layers) {
        l.mesh.position.x = Math.sin(t * 0.02 * l.dir) * 18 * l.speed
        l.mesh.position.z = Math.cos(t * 0.016 * l.dir) * 14 * l.speed
      }
      for (const p of puffs) {
        const u = p.userData; u.ang += u.speed * dt
        p.position.x = Math.cos(u.ang) * u.rad; p.position.z = Math.sin(u.ang) * u.rad
        p.position.y = u.y0 + Math.sin(t * 0.4 + u.ph) * 0.8
      }
    },
  }
}

function makeCloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 18 + Math.random() * 55
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, 'rgba(255,255,255,0.16)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3)
  return tex
}

// ---------- 浮岛 ----------
const grassMat = new THREE.MeshLambertMaterial({ color: 0x6fc06a })
const grassDark = new THREE.MeshLambertMaterial({ color: 0x4e9e5c })
const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a6a8f })
const rockDark = new THREE.MeshLambertMaterial({ color: 0x6a4f78 })
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3a })
const leafMat = new THREE.MeshLambertMaterial({ color: 0x58b868 })
const crystalMat = new THREE.MeshLambertMaterial({ color: 0x7ad8ff, emissive: 0x2288cc, emissiveIntensity: 0.7 })

export function makeIsland(def) {
  const group = new THREE.Group()
  const r = def.r

  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1.6, 9), grassMat)
  top.castShadow = top.receiveShadow = true
  top.userData = { kind: 'island', id: def.id }
  group.add(top)

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 0.9, 0.5, 9), grassDark)
  rim.position.y = 0.9; rim.castShadow = true; group.add(rim)

  const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, r * 1.5, 9), Math.random() > 0.5 ? rockMat : rockDark)
  cone.rotation.x = Math.PI; cone.position.y = -0.8 - r * 0.75; cone.castShadow = true
  group.add(cone)

  for (let i = 0; i < 4; i++) {
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.6 + Math.random() * 0.9, 7, 5), grassDark)
    const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.6
    bump.position.set(Math.cos(a) * d, 0.8, Math.sin(a) * d)
    bump.scale.y = 0.4; bump.receiveShadow = true
    group.add(bump)
  }

  const trees = []
  for (let i = 0; i < (def.trees || 0); i++) {
    const tree = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 6), trunkMat)
    trunk.position.y = 0.7; trunk.castShadow = true
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.9, 7), leafMat)
    leaf.position.y = 2.0; leaf.castShadow = true
    tree.add(trunk, leaf)
    const a = Math.random() * Math.PI * 2, d = r * 0.45 + Math.random() * r * 0.3
    tree.position.set(Math.cos(a) * d, 0.8, Math.sin(a) * d)
    tree.userData = { kind: 'tree', island: def.id, cooldown: 0 }
    trunk.userData = leaf.userData = tree.userData
    group.add(tree); trees.push(tree)
  }

  const crystals = []
  for (let i = 0; i < (def.crystal || 0); i++) {
    const cr = new THREE.Group()
    for (let j = 0; j < 3; j++) {
      const s = 0.5 + Math.random() * 0.6
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(s), crystalMat)
      shard.position.set(j * 0.7 - 0.7, s * 0.8, (j % 2) * 0.6 - 0.3)
      shard.rotation.y = Math.random() * 3; shard.castShadow = true
      cr.add(shard)
    }
    const a = Math.random() * Math.PI * 2, d = r * 0.35
    cr.position.set(Math.cos(a) * d, 0.8, Math.sin(a) * d)
    cr.userData = { kind: 'crystal', island: def.id, cooldown: 0 }
    cr.children.forEach(m => { m.userData = cr.userData })
    group.add(cr); crystals.push(cr)
  }

  const slots = []
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    const a = (i === 0 ? -1 : 1) * 0.7 + Math.PI / 2
    ring.position.set(Math.cos(a) * r * 0.55, 1.68, Math.sin(a) * r * 0.55)
    group.add(ring); slots.push(ring)
  }

  group.position.set(def.x, 0, def.z)
  return { group, top, trees, crystals, slots }
}

// ---------- 建筑 ----------
export const BUILDING_DEFS = {
  collector: { name: '云晶采集器', icon: '⛏️', cost: { c: 25, w: 5 }, desc: '+1 云晶 / 5s' },
  shield:    { name: '护盾塔',     icon: '🛡️', cost: { c: 35, w: 15 }, desc: '保护本岛建筑不被吹散，沉没伤害减半' },
  anchor:    { name: '锚桩',       icon: '⚓', cost: { a: 1, w: 10 }, desc: '永久固定——此岛不会再倾斜沉没' },
}

export function makeBuilding(type) {
  const g = new THREE.Group()
  if (type === 'collector') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.6, 8), rockMat)
    base.position.y = 0.3
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), crystalMat.clone())
    orb.position.y = 1.6
    g.add(base, orb)
    g.userData.orb = orb
  } else if (type === 'shield') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.2, 6), trunkMat)
    pole.position.y = 1.1
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x9adfff, emissive: 0x2277bb, emissiveIntensity: 0.5, transparent: true, opacity: 0.75 }))
    dome.position.y = 2.5
    g.add(pole, dome)
  } else if (type === 'anchor') {
    const pylon = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 6), rockDark)
    pylon.position.y = 1.2
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 6, 14),
      new THREE.MeshLambertMaterial({ color: 0xd8b25a, emissive: 0x8a6a20, emissiveIntensity: 0.4 }))
    ring.position.y = 2.6
    g.add(pylon, ring)
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true })
  return g
}

// ---------- 桥板 ----------
const plankGeo = new THREE.BoxGeometry(1.6, 0.22, 1.0)
const plankMat = new THREE.MeshLambertMaterial({ color: 0xb08a5a })
const ghostMat = new THREE.MeshLambertMaterial({ color: 0xb08a5a, transparent: true, opacity: 0.22 })

export function makePlank(pos, dir) {
  const m = new THREE.Mesh(plankGeo, ghostMat.clone())
  m.position.copy(pos); m.position.y += 0.4 + Math.random() * 0.15
  m.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2 + (Math.random() - 0.5) * 0.12
  m.castShadow = true
  return m
}
export function solidifyPlank(m) { m.material = plankMat }

// ---------- 风暴风线 ----------
export function createWindLines(count = 360) {
  const pos = new Float32Array(count * 6)
  const seeds = []
  for (let i = 0; i < count; i++) {
    seeds.push({ x: (Math.random() - 0.5) * 160, y: -8 + Math.random() * 30, z: (Math.random() - 0.5) * 160, v: 18 + Math.random() * 30 })
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd8c8ff, transparent: true, opacity: 0.35 }))
  lines.visible = false
  lines.userData = {
    update(dt, strength) {
      const a = geo.attributes.position.array
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i]
        s.x += s.v * dt * strength
        if (s.x > 85) { s.x = -85; s.y = -8 + Math.random() * 30; s.z = (Math.random() - 0.5) * 160 }
        a[i * 6] = s.x; a[i * 6 + 1] = s.y; a[i * 6 + 2] = s.z
        a[i * 6 + 3] = s.x - 2.2; a[i * 6 + 4] = s.y; a[i * 6 + 5] = s.z
      }
      geo.attributes.position.needsUpdate = true
    },
  }
  return lines
}

// ---------- 碎片爆破粒子 ----------
export function makeBurst(color = 0xb08a5a, n = 60) {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(n * 3), vel = []
  for (let i = 0; i < n; i++) {
    pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0
    vel.push(new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6 + 1, (Math.random() - 0.5) * 8))
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.35, transparent: true, opacity: 0.9 }))
  pts.userData = {
    life: 1.1,
    update(dt) {
      const a = geo.attributes.position.array
      for (let i = 0; i < n; i++) {
        vel[i].y -= 9 * dt
        a[i * 3] += vel[i].x * dt; a[i * 3 + 1] += vel[i].y * dt; a[i * 3 + 2] += vel[i].z * dt
      }
      this.life -= dt
      pts.material.opacity = Math.max(0, this.life / 1.1) * 0.9
      geo.attributes.position.needsUpdate = true
      return this.life > 0
    },
  }
  return pts
}
