import * as THREE from 'three'

export const UNIT_DEFS = {
  worker:   { name: '采集工', icon: '👷', cost: { c: 20, w: 5 },  color: 0xffd97a, hp: 3, speed: 3.2, desc: '自动采集本岛的云晶和风木' },
  soldier:  { name: '士兵',   icon: '⚔️', cost: { c: 30, w: 12 }, color: 0xff6b6b, hp: 5, speed: 3.6, desc: '沿岛巡逻，自动反击进入射程的灾鸟' },
  mechanic: { name: '维修师', icon: '🔧', cost: { c: 35, w: 18 }, color: 0x7ad8ff, hp: 3, speed: 3.0, desc: '本岛建造速度×2；岛倾斜时免费缓慢修复' },
}
export const UNIT_CAP = 3 // 每岛容量
export const SOLDIER_RANGE = 15, SOLDIER_COOL = 1.4, SOLDIER_DMG = 1
export const HARVEST_TIME = 2.5, MECHANIC_REPAIR = 3

// 小人模型：头+躯干+双臂+双腿，带职业装备；四肢存在 userData 供走路动画
function makeUnitMesh(type) {
  const def = UNIT_DEFS[type]
  const g = new THREE.Group()
  const skin = new THREE.MeshLambertMaterial({ color: 0xffe0c0 })
  const cloth = new THREE.MeshLambertMaterial({ color: def.color })
  const dark = new THREE.MeshLambertMaterial({ color: 0x4a3a5a })

  // 双腿
  const legGeo = new THREE.BoxGeometry(0.13, 0.34, 0.14)
  const legL = new THREE.Mesh(legGeo, dark); legL.position.set(-0.1, 0.17, 0)
  const legR = new THREE.Mesh(legGeo, dark); legR.position.set(0.1, 0.17, 0)
  // 躯干
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.26, 0.48, 8), cloth)
  torso.position.y = 0.58; torso.castShadow = true
  // 手臂（挂在肩点，绕 x 摆）
  const armGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.42, 6)
  armGeo.translate(0, -0.19, 0) // 原点上移到肩部
  const armL = new THREE.Mesh(armGeo, cloth); armL.position.set(-0.28, 0.78, 0)
  const armR = new THREE.Mesh(armGeo, cloth); armR.position.set(0.28, 0.78, 0)
  // 头 + 眼睛
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 9), skin)
  head.position.y = 1.02; head.castShadow = true
  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 5)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x3a2a4a })
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.09, 1.05, 0.19)
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.09, 1.05, 0.19)
  g.add(legL, legR, torso, armL, armR, head, eyeL, eyeR)

  if (type === 'worker') {
    // 草帽 + 稿子 + 挎包
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 10), new THREE.MeshLambertMaterial({ color: 0xd8b25a }))
    hat.position.y = 1.22; g.add(hat)
    const pick = new THREE.Group()
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5), dark)
    const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x9a9aae }))
    pHead.position.y = 0.26
    pick.add(handle, pHead)
    pick.position.set(0.3, 0.62, 0.12); pick.rotation.z = -0.4
    g.add(pick)
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.14), new THREE.MeshLambertMaterial({ color: 0x8a5a3a }))
    bag.position.set(0, 0.55, -0.3); g.add(bag)
    g.userData.tool = pick
  } else if (type === 'soldier') {
    // 头盔 + 长矛 + 盾
    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.34, 9), new THREE.MeshLambertMaterial({ color: 0x9a2a3a }))
    helm.position.y = 1.26; g.add(helm)
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 6, 14), new THREE.MeshLambertMaterial({ color: 0x7a1a2a }))
    brim.rotation.x = Math.PI / 2; brim.position.y = 1.14; g.add(brim)
    const spear = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 5), dark)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), new THREE.MeshLambertMaterial({ color: 0xd8d8e8 }))
    tip.position.y = 0.85
    spear.add(shaft, tip)
    spear.position.set(0.32, 0.9, 0.1)
    g.add(spear)
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 12), new THREE.MeshLambertMaterial({ color: 0xb08a3a }))
    shield.rotation.z = Math.PI / 2; shield.position.set(-0.34, 0.6, 0.08); g.add(shield)
    g.userData.tool = spear
  } else {
    // 鸭舌帽 + 扳手 + 背包
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0x2266aa }))
    cap.position.y = 1.22; g.add(cap)
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.16), new THREE.MeshLambertMaterial({ color: 0x2266aa }))
    brim.position.set(0, 1.17, 0.26); g.add(brim)
    const wrench = new THREE.Group()
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 5), new THREE.MeshLambertMaterial({ color: 0x9a9aae }))
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 5, 10, Math.PI * 1.4), new THREE.MeshLambertMaterial({ color: 0x9a9aae }))
    jaw.position.y = 0.24
    wrench.add(bar, jaw)
    wrench.position.set(0.3, 0.62, 0.12); wrench.rotation.z = -0.4
    g.add(wrench)
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.16), new THREE.MeshLambertMaterial({ color: 0x2266aa }))
    pack.position.set(0, 0.6, -0.3); g.add(pack)
    g.userData.tool = wrench
  }
  g.userData.limbs = { armL, armR, legL, legR }
  return g
}

export class Unit {
  constructor(type, island) {
    this.type = type
    this.def = UNIT_DEFS[type]
    this.island = island
    this.hp = this.def.hp
    this.state = 'idle'        // idle | move | work | patrol | fight | repair
    this.pos = new THREE.Vector2((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)
    this.dest = null           // Vector2 local
    this.node = null           // 采集目标节点 {obj, isCrystal}
    this.channelT = 0
    this.cool = 0
    this.t = Math.random() * 10
    this.mesh = makeUnitMesh(type)
    this.mesh.position.set(this.pos.x, 1.65, this.pos.y)
    this.mesh.traverse(m => { if (m.isMesh) m.userData = { kind: 'unit', ref: this } })
    island.group.add(this.mesh)
  }

  // 在本岛范围内随机选点
  randomPoint(scale = 0.65) {
    const r = this.island.def.r * scale
    const a = Math.random() * Math.PI * 2
    return new THREE.Vector2(Math.cos(a) * r * Math.random(), Math.sin(a) * r * Math.random())
  }

  moveToward(dt, dest, speed) {
    const dx = dest.x - this.pos.x, dz = dest.y - this.pos.y
    const d = Math.hypot(dx, dz)
    if (d < 0.25) return true
    const v = this.def.speed * dt
    this.pos.x += dx / d * Math.min(v, d)
    this.pos.y += dz / d * Math.min(v, d)
    this.mesh.rotation.y = Math.atan2(dx, dz)
    return false
  }

  update(dt, game, t) {
    this.t += dt
    this.cool = Math.max(0, this.cool - dt)
    const isl = this.island
    let working = false

    if (this.type === 'worker') {
      // 自动采集循环：找最近的资源节点 → 走过去 → 采集 → 换下一个
      if (!this.node) {
        if (this.demo) { this.node = 'rest' }
        else {
        const nodes = []
        for (const c of isl.crystals) nodes.push({ obj: c, isCrystal: true })
        for (const tr of isl.trees) nodes.push({ obj: tr, isCrystal: false })
        if (nodes.length) this.node = nodes[Math.floor(Math.random() * nodes.length)]
        else this.node = 'rest'
        }
      }
      if (this.node === 'rest') {
        this.state = 'idle'
        if (!this.dest || this.moveToward(dt, this.dest, 1)) this.dest = this.randomPoint(0.4)
      } else {
        const np = this.node.obj.position
        const dest = new THREE.Vector2(np.x, np.z)
        if (this.moveToward(dt, dest, 1)) {
          working = true
          this.state = 'work'
          this.channelT += dt
          if (this.channelT >= HARVEST_TIME) {
            this.channelT = 0
            if (this.node.isCrystal) { game.state.crystals += 1; game.ctx.spawnBurst(this.mesh.getWorldPosition(new THREE.Vector3()), 0x7ad8ff, 6) }
            else { game.state.wood += 1; game.ctx.spawnBurst(this.mesh.getWorldPosition(new THREE.Vector3()), 0x58b868, 6) }
            game.updateHUD()
            this.node = null
          }
        } else this.state = 'move'
      }
    } else if (this.type === 'soldier') {
      // 灾鸟索敌：本岛周边射程内
      const bird = game.birdMgr ? game.birdMgr.nearestBadBird(isl.group.position, SOLDIER_RANGE) : null
      if (bird) {
        this.state = 'fight'
        const bp = bird.mesh.position
        const local = isl.group.worldToLocal(bp.clone())
        this.mesh.rotation.y = Math.atan2(local.x - this.pos.x, local.z - this.pos.y)
        if (this.cool <= 0) {
          this.cool = SOLDIER_COOL
          game.fireBolt(this.mesh.getWorldPosition(new THREE.Vector3()), bird, SOLDIER_DMG)
        }
      } else {
        this.state = 'patrol'
        if (!this.dest || this.moveToward(dt, this.dest, 0.7)) { this.dest = null }
        if (!this.dest && Math.random() < dt * 0.5) {
          const a = Math.random() * Math.PI * 2
          this.dest = new THREE.Vector2(Math.cos(a) * isl.def.r * 0.72, Math.sin(a) * isl.def.r * 0.72)
        }
      }
    } else if (this.type === 'mechanic') {
      if (isl.tilted && !isl.sinking) {
        // 免费缓慢修复（正反馈：岛肉眼可见回正）
        this.state = 'repair'
        isl.stability += MECHANIC_REPAIR * dt
        working = true
        if (Math.random() < dt * 4) game.ctx.spawnBurst(this.mesh.getWorldPosition(new THREE.Vector3()), 0x7ad8ff, 4)
        const c = isl.buildings[0]
        if (c) { const lp = c.mesh.position; this.moveToward(dt, new THREE.Vector2(lp.x, lp.z + 1.2), 0.8) }
      } else {
        // 优先站在未完工建筑旁
        const busy = isl.buildings.find(b => !b.done)
        if (busy) {
          this.state = 'work'
          const lp = busy.mesh.position
          this.moveToward(dt, new THREE.Vector2(lp.x + 1.4, lp.z + 1.2), 0.8)
        } else {
          this.state = 'idle'
          if (!this.dest || this.moveToward(dt, this.dest, 0.8)) this.dest = this.randomPoint(0.35)
        }
      }
    }

    // 位置与四肢动画：走路摆腿摆臂，作业挥工具，待机呼吸
    const L = this.mesh.userData.limbs
    const walking = this.state === 'move' || this.state === 'patrol'
    const bob = working ? Math.abs(Math.sin(this.t * 8)) * 0.12 : Math.sin(this.t * 2.2) * 0.03
    this.mesh.position.set(this.pos.x, 1.65 + bob, this.pos.y)
    if (walking) {
      const s = Math.sin(this.t * 10) * 0.55
      L.legL.rotation.x = s; L.legR.rotation.x = -s
      L.armL.rotation.x = -s * 0.7; L.armR.rotation.x = s * 0.7
      this.mesh.rotation.z = 0
    } else if (working && L && this.mesh.userData.tool) {
      L.armR.rotation.x = -1.3 + Math.abs(Math.sin(this.t * 8)) * 0.9
      L.armL.rotation.x = 0.15; L.legL.rotation.x = L.legR.rotation.x = 0
      this.mesh.userData.tool.rotation.x = -0.6 + Math.abs(Math.sin(this.t * 8)) * 0.5
    } else {
      L.legL.rotation.x = L.legR.rotation.x = 0
      L.armL.rotation.x = L.armR.rotation.x = Math.sin(this.t * 2.2) * 0.06
      this.mesh.rotation.z = 0
    }
  }
}
