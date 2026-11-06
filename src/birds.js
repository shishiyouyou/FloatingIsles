import * as THREE from 'three'
import { sfx } from './sfx.js'

// ==================== 中国神鸟图鉴 ====================
export const BIRD_DEFS = {
  phoenix:   { name: '凤凰',     kind: 'good', reward: { c: 12 },      scale: 1.6, speed: 11, desc: '百鸟之王，见则天下安宁' },
  jinwu:     { name: '三足金乌', kind: 'good', reward: { w: 10 },      scale: 1.45, speed: 12, desc: '驮日神鸦，三足踏金光' },
  chongming: { name: '重明鸟',   kind: 'good', reward: { c: 6, w: 6 }, scale: 1.3, speed: 10, desc: '双瞳神鸡，力逐妖邪' },
  danque:    { name: '丹雀',     kind: 'good', reward: { c: 8 },       scale: 1.15, speed: 14, desc: '衔穗朱鸟，神农之使' },
  bifang:    { name: '毕方',     kind: 'bad', hp: 3, speed: 12, attacks: 3, scale: 1.55, desc: '独脚火兆，见则讹火' },
  miemeng:   { name: '灭蒙鸟',   kind: 'bad', hp: 3, speed: 10, attacks: 3, scale: 1.4, desc: '青羽赤尾，异域凶禽' },
  guiche:    { name: '鬼车',     kind: 'bad', hp: 9, speed: 8,  attacks: 5, scale: 2.3, boss: true, desc: '九头妖鸟，滴血摄魂' },
}
export const GOOD_TYPES = ['phoenix', 'jinwu', 'chongming', 'danque']
export const BAD_TYPES = ['bifang', 'miemeng']
export const BOSS_TYPE = 'guiche'

// ---------- 共用部件 ----------
function membrane(span, chord, color, opacity = 0.92) {
  const geo = new THREE.BufferGeometry()
  const v = new Float32Array([
    0, 0, chord * 0.5,   -span, 0.12, -chord * 0.35,   -span * 0.55, 0, chord * 0.15,
    0, 0, chord * 0.5,   -span * 0.55, 0, chord * 0.15,   0, 0, -chord * 0.5,
    0, 0, -chord * 0.5,  -span * 0.55, 0, chord * 0.15,   -span, 0.12, -chord * 0.35,
  ])
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity }))
}

function addHit(g, r = 2.2) {
  const hit = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), new THREE.MeshBasicMaterial({ visible: false }))
  g.add(hit); g.userData.hit = hit
  return g
}
function lam(c, e = 0, ei = 0) { return new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei }) }

// ---------- 凤凰：金身凤冠，五条长翎尾 ----------
function makePhoenix() {
  const g = new THREE.Group()
  const bodyMat = lam(0xffd9a0, 0xff7a30, 0.45)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 9), bodyMat)
  body.scale.set(0.75, 0.75, 1.7)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bodyMat)
  head.position.set(0, 0.3, 0.85)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), lam(0xffd97a))
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.28, 1.3)
  g.add(body, head, beak)
  const crestMat = lam(0xffb36b, 0xff6a20, 0.5)
  for (let i = -1; i <= 1; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 5), crestMat)
    c.position.set(i * 0.12, 0.58, 0.7 - Math.abs(i) * 0.06); c.rotation.x = -0.55
    g.add(c)
  }
  for (const s of [-1, 1]) {
    const wg = new THREE.Group()
    wg.add(membrane(2.6, 0.95, 0xffb36b))
    const w2 = membrane(1.8, 0.75, 0xffd97a); w2.position.set(-0.15, 0.07, 0.28)
    wg.add(w2)
    wg.position.set(s * 0.35, 0.15, 0); wg.scale.x = s
    g.add(wg)
    if (s < 0) g.userData.wl = wg; else g.userData.wr = wg
  }
  const tailCols = [0xff6b4a, 0xffd97a, 0xff8a5a, 0xffb36b, 0xff5a5a]
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.09, 2.1, 5), lam(tailCols[i], tailCols[i], 0.45))
    t.material.transparent = true; t.material.opacity = 0.9
    t.position.set((i - 2) * 0.14, -0.1 - Math.abs(i - 2) * 0.07, -1.35 - (i % 2) * 0.25)
    t.rotation.x = Math.PI / 2 + 0.28
    g.add(t)
  }
  g.userData.wings = [g.userData.wl, g.userData.wr]
  return addHit(g, 2.4)
}

// ---------- 三足金乌：金乌负日，三足 ----------
function makeJinwu() {
  const g = new THREE.Group()
  // 背负日轮
  const sun = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.1, 8, 24), lam(0xffd94a, 0xffaa00, 0.9))
  sun.position.set(0, 0.3, -0.3); g.add(sun)
  const bodyMat = lam(0xffc94a, 0xcc6600, 0.5)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 9), bodyMat)
  body.scale.set(0.7, 0.7, 1.5)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), lam(0x2a1a1a))
  head.position.set(0, 0.32, 0.8)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), lam(0xff8a3a))
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.3, 1.2)
  g.add(body, head, beak)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd94a }))
    eye.position.set(s * 0.13, 0.4, 1.0); g.add(eye)
    const wg = new THREE.Group()
    wg.add(membrane(2.2, 0.85, 0xff8a3a))
    wg.position.set(s * 0.35, 0.1, 0.1); wg.scale.x = s
    g.add(wg)
    if (s < 0) g.userData.wl = wg; else g.userData.wr = wg
  }
  // 三足（标志性）：向后拖的三条腿
  for (const x of [-0.18, 0, 0.18]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 5), lam(0x2a1a1a))
    leg.position.set(x, -0.35, -0.3); leg.rotation.x = 0.5
    g.add(leg)
  }
  g.userData.wings = [g.userData.wl, g.userData.wr]
  return addHit(g, 2.3)
}

// ---------- 重明鸟：神鸡，双瞳，短圆翼 ----------
function makeChongming() {
  const g = new THREE.Group()
  const bodyMat = lam(0xd8b25a)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 9), bodyMat)
  body.scale.set(0.85, 0.9, 1.4)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bodyMat)
  head.position.set(0, 0.45, 0.75)
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.3), lam(0xdd3a3a))
  comb.position.set(0, 0.78, 0.72)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), lam(0xffd97a))
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.42, 1.1)
  g.add(body, head, comb, beak)
  // 双瞳（每侧两个瞳点）
  for (const s of [-1, 1]) for (const d of [-0.04, 0.04]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0x4a2aff }))
    eye.position.set(s * 0.15, 0.5 + d, 0.95); g.add(eye)
  }
  for (const s of [-1, 1]) {
    const wg = new THREE.Group()
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lam(0xb08a3a))
    w.scale.set(1.4, 0.18, 0.8)
    wg.add(w); wg.position.set(s * 0.55, 0.15, 0); wg.scale.x = s
    g.add(wg)
    if (s < 0) g.userData.wl = wg; else g.userData.wr = wg
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 6), lam(0x8a6a3a))
  tail.position.set(0, 0.1, -0.9); tail.rotation.x = Math.PI / 2 + 0.4
  g.add(tail)
  g.userData.wings = [g.userData.wl, g.userData.wr]
  return addHit(g, 2.0)
}

// ---------- 丹雀：朱红灵雀，燕尾 ----------
function makeDanque() {
  const g = new THREE.Group()
  const bodyMat = lam(0xdd3a3a, 0x881a1a, 0.3)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), bodyMat)
  body.scale.set(0.65, 0.65, 1.8)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 9, 7), bodyMat)
  head.position.set(0, 0.22, 0.72)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), lam(0xffd94a))
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.2, 1.0)
  g.add(body, head, beak)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0x2a1a1a }))
    eye.position.set(s * 0.11, 0.28, 0.86); g.add(eye)
    const wg = new THREE.Group()
    wg.add(membrane(1.9, 0.6, 0xff5a4a))
    wg.position.set(s * 0.28, 0.12, 0); wg.scale.x = s
    g.add(wg)
    if (s < 0) g.userData.wl = wg; else g.userData.wr = wg
  }
  // 燕尾双翎
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.1, 5), lam(0xdd3a3a))
    t.position.set(s * 0.14, -0.05, -0.9); t.rotation.x = Math.PI / 2 + 0.2; t.rotation.z = -s * 0.2
    g.add(t)
  }
  g.userData.wings = [g.userData.wl, g.userData.wr]
  return addHit(g, 1.8)
}

// ---------- 毕方：独脚怪鹤，青羽红斑，白喙 ----------
function makeBifang() {
  const g = new THREE.Group()
  const bodyMat = lam(0x3a8a5a)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 9), bodyMat)
  body.scale.set(0.7, 0.7, 1.6)
  // 长脖
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.9, 6), bodyMat)
  neck.position.set(0, 0.45, 0.85); neck.rotation.x = 0.5
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 7), bodyMat)
  head.position.set(0, 0.75, 1.15)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 6), lam(0xf0f0e8))
  beak.rotation.x = Math.PI / 2 - 0.15; beak.position.set(0, 0.7, 1.55)
  g.add(body, neck, head, beak)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd94a }))
    eye.position.set(s * 0.12, 0.8, 1.2); g.add(eye)
    const wg = new THREE.Group()
    wg.add(membrane(2.8, 1.0, 0x4a9a6a))
    const tip = membrane(1.0, 0.6, 0xdd3a3a); tip.position.set(-1.9, 0.05, -0.1)
    wg.add(tip)
    wg.position.set(s * 0.35, 0.2, 0); wg.scale.x = s
    g.add(wg)
    if (s < 0) g.userData.wl = wg; else g.userData.wr = wg
  }
  // 标志性独脚（中间一条长腿拖后）
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 5), lam(0xdd3a3a))
  leg.position.set(0, -0.55, -0.2); leg.rotation.x = 0.7
  g.add(leg)
  // 红斑
  for (let i = 0; i < 4; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), lam(0xdd3a3a))
    dot.position.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, -0.2 - i * 0.15)
    g.add(dot)
  }
  g.userData.wings = [g.userData.wl, g.userData.wr]
  return addHit(g, 2.4)
}

// ---------- 灭蒙鸟：青羽赤尾 ----------
function makeMiemeng() {
  const g = new THREE.Group()
  const bodyMat = lam(0x3a6a9a)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 9), bodyMat)
  body.scale.set(0.72, 0.72, 1.65)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), bodyMat)
  head.position.set(0, 0.32, 0.85)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 6), lam(0x2a2a3a))
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.28, 1.25)
  g.add(body, head, beak)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff8a3a }))
    eye.position.set(s * 0.12, 0.38, 0.98); g.add(eye)
    const wg = new THREE.Group()
    wg.add(membrane(2.4, 0.9, 0x4a8aba))
    wg.position.set(s * 0.33, 0.15, 0); wg.scale.x = s
    g.add(wg)
    if (s < 0) g.userData.wl = wg; else g.userData.wr = wg
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.4, 6), lam(0xdd3a3a, 0x881a1a, 0.4))
  tail.position.set(0, -0.05, -1.15); tail.rotation.x = Math.PI / 2 + 0.2
  g.add(tail)
  g.userData.wings = [g.userData.wl, g.userData.wr]
  return addHit(g, 2.2)
}

// ---------- 鬼车：九头妖鸟（Boss）----------
function makeGuiche() {
  const g = new THREE.Group()
  const bodyMat = lam(0x2a1a3a)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9), bodyMat)
  body.scale.set(0.9, 0.8, 1.6)
  g.add(body)
  // 九头扇面：1主头 + 8小头呈扇形
  const headMat = lam(0x3a2a4a)
  const mkHead = (x, y, z, s) => {
    const h = new THREE.Group()
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 6), headMat)
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, 0.3 * s, 5), lam(0x8a8a9a))
    beak.rotation.x = Math.PI / 2; beak.position.z = 0.24 * s
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 5, 4), new THREE.MeshBasicMaterial({ color: 0xff3a3a }))
    const eR = eL.clone()
    eL.position.set(-0.08 * s, 0.06 * s, 0.16 * s); eR.position.set(0.08 * s, 0.06 * s, 0.16 * s)
    h.add(skull, beak, eL, eR)
    h.position.set(x, y, z)
    h.lookAt(x * 3, y * 2, z + 4)
    g.add(h)
    // 小脖颈
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.5 * s, 5), bodyMat)
    neck.position.set(x * 0.7, y - 0.25 * s, z - 0.15); neck.rotation.x = -0.6
    g.add(neck)
  }
  mkHead(0, 0.55, 1.0, 1.3)
  for (let i = 0; i < 8; i++) {
    const a = (i / 7 - 0.5) * Math.PI * 0.9
    mkHead(Math.sin(a) * 0.85, 0.55 + Math.cos(a) * 0.25, 0.75, 0.75)
  }
  for (const s of [-1, 1]) {
    const wg = new THREE.Group()
    wg.add(membrane(3.0, 1.2, 0x4a2a5a, 0.88))
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.8, 5), bodyMat)
    bone.rotation.z = Math.PI / 2; bone.position.x = -1.4
    wg.add(bone)
    wg.position.set(s * 0.4, 0.25, 0.2); wg.scale.x = s
    g.add(wg)
    if (s < 0) g.userData.wl = wg; else g.userData.wr = wg
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.2, 6), lam(0x4a2a5a))
  tail.position.set(0, -0.1, -1.2); tail.rotation.x = Math.PI / 2 + 0.15
  g.add(tail)
  g.userData.wings = [g.userData.wl, g.userData.wr]
  return addHit(g, 3.2)
}

const BUILDERS = { phoenix: makePhoenix, jinwu: makeJinwu, chongming: makeChongming, danque: makeDanque, bifang: makeBifang, miemeng: makeMiemeng, guiche: makeGuiche }

// ==================== 行为 ====================
export class Bird {
  constructor(type, from, to, mgr) {
    this.type = type
    this.def = BIRD_DEFS[type]
    this.kind = this.def.kind
    this.mgr = mgr
    this.hp = this.def.hp || 1
    this.mesh = BUILDERS[type]()
    this.mesh.scale.setScalar(this.def.scale)
    this.mesh.position.copy(from)
    this.mesh.userData.hit.userData = { kind: 'bird', ref: this }
    mgr.ctx.scene.add(this.mesh)
    mgr.ctx.addInteractive(this.mesh.userData.hit)
    this.flapT = Math.random() * 9
    this.dead = false
    if (this.kind === 'good') {
      this.state = 'fly'
      this.vel = new THREE.Vector3().subVectors(to, from).normalize().multiplyScalar(this.def.speed)
      this.vel.y += 1.5
    } else {
      this.state = 'swoop'   // 先向镜头俯冲示威，再转向目标岛
      this.target = to
      this.island = null
      this.orbitA = Math.random() * Math.PI * 2
      this.orbitR = 0
      this.diveT = 0
      this.divePoint = null
      this.attacks = 0
      this.maxAttacks = this.def.attacks || 3
      this.boss = !!this.def.boss
      this.stolen = 0
      this.swoopDone = false
      const cam = mgr.ctx.camera
      this.swoopPoint = cam ? cam.position.clone().multiplyScalar(0.55) : new THREE.Vector3(0, 20, 40)
    }
    this.mgr.game.noteBird(this.def)
  }

  kill() {
    if (this.dead) return
    this.dead = true
    this.mgr.ctx.spawnBurst(this.mesh.position, this.def.boss ? 0x8a3a5a : 0x4a8aba, this.def.boss ? 90 : 50)
    if (this.kind === 'bad') {
      this.mgr.game.state.kills++
      const back = 3 + this.stolen + (this.boss ? 20 : 0)
      this.mgr.game.state.crystals += back
      this.mgr.game.toast(this.boss ? `👑 击落${this.def.name}！夺回 ${back} 云晶，群岛欢呼` : `🏹 击落${this.def.name}！夺回 ${back} 云晶`, 'good')
      this.mgr.game.updateHUD()
      sfx.win()
    }
    this.dispose()
  }

  dispose() {
    this.mgr.ctx.removeInteractive(this.mesh.userData.hit)
    this.mgr.ctx.scene.remove(this.mesh)
    this.mgr.birds = this.mgr.birds.filter(b => b !== this)
  }

  update(dt, t) {
    this.flapT += dt * (this.kind === 'good' ? 8 : 10)
    const flap = Math.sin(this.flapT) * 0.7
    const [wl, wr] = this.mesh.userData.wings
    wl.rotation.z = flap; wr.rotation.z = flap

    if (this.kind === 'good') {
      this.mesh.position.addScaledVector(this.vel, dt)
      this.mesh.position.y += Math.sin(t * 2 + this.flapT) * dt * 2
      this.mesh.rotation.y = Math.atan2(this.vel.x, this.vel.z)
      if (this.mesh.position.length() > 150) this.dispose()
      return
    }

    const m = this.mesh
    const speed = this.def.speed
    if (this.state === 'swoop') {
      // 冲向镜头制造压迫感
      const dir = this.swoopPoint.clone().sub(m.position)
      const d = dir.length()
      m.position.addScaledVector(dir.normalize(), speed * 1.6 * dt)
      m.rotation.y = Math.atan2(dir.x, dir.z)
      if (d < 12 && !this.swoopDone) {
        this.swoopDone = true
        this.mgr.game.ctx.shake(0.18)
        sfx.stormStart()
      }
      if (d < 6 || this.swoopDone) this.state = 'approach'
    } else if (this.state === 'approach') {
      const dest = this.target.clone().setY(7)
      const dd = m.position.distanceTo(dest)
      if (dd < this.orbitR + 2) this.state = 'orbit'
      else {
        const dir = dest.sub(m.position).normalize()
        m.position.addScaledVector(dir, speed * dt)
        m.rotation.y = Math.atan2(dir.x, dir.z)
      }
    } else if (this.state === 'orbit') {
      this.orbitA += dt * 1.6
      const p = this.target
      m.position.set(p.x + Math.cos(this.orbitA) * this.orbitR, 6 + Math.sin(this.orbitA * 2) * 0.9, p.z + Math.sin(this.orbitA) * this.orbitR)
      m.rotation.y = this.orbitA + Math.PI / 2 + Math.PI
      this.diveT += dt
      if (this.diveT > 2.2 && this.attacks < this.maxAttacks) {
        this.diveT = 0
        this.state = 'dive'
        const a = Math.random() * Math.PI * 2
        this.divePoint = new THREE.Vector3(p.x + Math.cos(a) * this.orbitR * 0.35, 2.2, p.z + Math.sin(a) * this.orbitR * 0.35)
      }
      if (this.attacks >= this.maxAttacks) this.state = 'flee'
    } else if (this.state === 'dive') {
      const dir = this.divePoint.clone().sub(m.position)
      if (dir.length() < 0.6) {
        this.attacks++
        this.mgr.game.birdStrike(this)
        this.state = 'rise'
      } else {
        m.position.addScaledVector(dir.normalize(), speed * 1.6 * dt)
        m.rotation.x = -0.5
      }
    } else if (this.state === 'rise') {
      m.position.y += dt * 8; m.rotation.x = 0
      if (m.position.y > 6) this.state = 'orbit'
    } else if (this.state === 'flee') {
      const away = m.position.clone().setY(70).sub(m.position).normalize()
      m.position.addScaledVector(away, speed * 1.8 * dt)
      m.rotation.x = -0.6
      if (m.position.y > 65) this.dispose()
    }
  }
}

export class BirdManager {
  constructor(ctx) {
    this.ctx = ctx   // { scene, camera, game, islands, spawnBurst, addInteractive, removeInteractive }
    this.game = ctx.game
    this.birds = []
    this.goodT = 14
    this.badT = 45
    this.firstGood = true; this.firstBad = true
    this.active = false
  }

  nearestBadBird(islandPos, range) {
    let best = null, bd = range
    for (const b of this.birds) {
      if (b.kind !== 'bad' || b.dead || b.state === 'flee') continue
      const d = b.mesh.position.distanceTo(islandPos)
      if (d < bd) { bd = d; best = b }
    }
    return best
  }

  raidSize() {
    return Math.min(3, 1 + Math.floor(this.game.state.stormCount / 3))
  }

  pickVictimIsland() {
    const owned = this.game.ownedIslands()
    if (!owned.length) return null
    const sorted = owned.slice().sort((a, b) =>
      (a.units || []).filter(u => u.type === 'soldier').length -
      (b.units || []).filter(u => u.type === 'soldier').length)
    return Math.random() < 0.65 ? sorted[0] : owned[Math.floor(Math.random() * owned.length)]
  }

  update(dt, t) {
    if (!this.active) {
      for (const b of this.birds.slice()) b.update(dt, t)
      return
    }
    this.goodT -= dt; this.badT -= dt
    if (this.goodT <= 0) {
      this.goodT = 26 + Math.random() * 20
      const tp = GOOD_TYPES[Math.floor(Math.random() * GOOD_TYPES.length)]
      const a = Math.random() * Math.PI * 2
      const from = new THREE.Vector3(Math.cos(a) * 140, 12 + Math.random() * 14, Math.sin(a) * 140)
      const to = new THREE.Vector3(-Math.cos(a) * 140, 8 + Math.random() * 10, -Math.sin(a) * 140)
      this.birds.push(new Bird(tp, from, to, this))
      if (this.firstGood) { this.firstGood = false; this.game.toast('🕊️ 有神鸟掠过——点中它降下祥瑞！', 'miss') }
    }
    if (this.badT <= 0) {
      const iv = Math.max(30, 58 - this.game.state.stormCount * 3)
      this.badT = iv + Math.random() * 15
      const victim = this.pickVictimIsland()
      if (victim) {
        const n = this.raidSize()
        const bossRaid = this.game.state.stormCount > 0 && this.game.state.stormCount % 3 === 2
        const names = []
        for (let i = 0; i < n; i++) {
          const tp = (bossRaid && i === 0) ? BOSS_TYPE : BAD_TYPES[Math.floor(Math.random() * BAD_TYPES.length)]
          const a = Math.random() * Math.PI * 2
          const from = new THREE.Vector3(Math.cos(a) * 140, 20 + i * 5, Math.sin(a) * 140)
          const b = new Bird(tp, from, victim.group.position.clone(), this)
          b.island = victim
          b.orbitR = victim.def.r * 0.9 + 4 + i * 1.5 + (b.boss ? 2.5 : 0)
          this.birds.push(b)
          names.push(b.def.name)
        }
        sfx.warn()
        this.game.toast(bossRaid ? `👑 鬼车率 ${n - 1} 凶禽压向岛 #${victim.def.id}！` : `🦅 ${names.join('、')}扑向岛 #${victim.def.id}！`, 'bad')
        if (this.firstBad) { this.firstBad = false; this.game.emit('first-badbird') }
      }
    }
    for (const b of this.birds.slice()) b.update(dt, t)
  }
}
