import * as THREE from 'three'
import { BUILDING_DEFS, makeBuilding, makePlank, solidifyPlank } from './world.js'
import { Unit, UNIT_DEFS, UNIT_CAP } from './units.js'
import { sfx } from './sfx.js'

const PLANK_COST = 5, PLANK_INTERVAL = 1.1, PLANK_STEP = 2.4
const CALM_T = 65, WARN_T = 15, STORM_T = 24, DAMAGE_AT = 12
const RESCUE_T = 20, RESCUE_COST = 10, RESCUE_HEAL = 15, RESCUE_TARGET = 55
const SINK_TILT = 0.5

const $ = id => document.getElementById(id)

export class Game {
  constructor(ctx) {
    this.ctx = ctx // { scene, islands:[runtime], wind, skyMat, spawnBurst(pos,color,n), shake(m), homeIsland }
    this.state = {
      crystals: 40, wood: 8, anchors: 0,
      phase: 'calm', phaseT: CALM_T,
      power: 16, damageApplied: false, stormTick: 0,
      lost: 0, lastStormSank: 0, paused: false, over: false,
      collectStreak: 0, streakT: 0, crystalAcc: 0, collectorAcc: 0,
      stormCount: 0, scatteredThisStorm: [], kills: 0,
      barkT: 9, barks: [], seenBirds: new Set(JSON.parse(localStorage.getItem('fi_birds_seen') || '[]')),
    }
    this.bridges = []
    this.bolts = []          // 士兵箭矢
    this.birdMgr = null      // 由 main 注入
    this.selected = null
    this.selUnit = null
    this.burstsDone = true
    this.el = {
      crystal: $('r-crystal'), wood: $('r-wood'), anchor: $('r-anchor'),
      isles: $('r-isles'), lostEl: $('r-lost'), units: $('r-units'), birds: $('r-birds'),
      label: $('storm-label'), fill: $('storm-fill'),
      alerts: $('alerts'), toasts: $('toasts'),
      hud: $('hud'),
      panel: $('panel'), pTitle: $('panel-title'), pSub: $('panel-sub'), pBtns: $('panel-btns'),
      settle: $('settle'), sTitle: $('settle-title'), sBody: $('settle-body'),
    }
    $('settle-ok').onclick = () => { this.el.settle.classList.add('hidden'); this.state.paused = false; this.newCycle() }
    this.best = +(localStorage.getItem('fi_best') || 0)
    this.onEvent = null // 外部（引导系统）可注入
    this.updateHUD()
  }

  emit(name, data) { if (this.onEvent) this.onEvent(name, data) }

  // ---------- 叙事：精灵碎碎念 ----------
  static BARKS = {
    worker:   ['云晶亮晶晶的，真好采', '这棵树归我啦', '多囤点，风暴要来了', '今天也要加油干活', '手都磨出茧啦'],
    soldier:  ['有我守着，放心', '天上好像有动静……', '武器得擦亮点', '守岛是荣耀', '看见那只鸟的眼神了吗'],
    mechanic: ['这里还能再拧半圈', '桥板要扎牢', '结构没问题……应该吧', '倾斜了？交给我', '老岛和新岛的脾气不一样'],
  }

  spawnBark(u) {
    const phase = this.state.phase
    const text = phase === 'warning' ? '风暴！风暴要来了！！'
      : phase === 'storm' ? '抓稳了啊啊啊——'
      : Game.BARKS[u.type][Math.floor(Math.random() * Game.BARKS[u.type].length)]
    const el = document.createElement('div')
    el.className = 'bark'; el.textContent = text
    this.el.hud.appendChild(el)
    this.state.barks.push({ el, u, ttl: 2.6 })
  }

  updateBarks(dt) {
    const s = this.state
    s.barkT -= dt
    if (s.barkT <= 0) {
      s.barkT = 11 + Math.random() * 9
      const all = this.ownedIslands().flatMap(i => i.units)
      if (all.length && Math.random() < 0.8) this.spawnBark(all[Math.floor(Math.random() * all.length)])
    }
    for (let i = s.barks.length - 1; i >= 0; i--) {
      const b = s.barks[i]
      b.ttl -= dt
      if (b.ttl <= 0 || b.u.hp <= 0 || b.u.island.sunk) { b.el.remove(); s.barks.splice(i, 1); continue }
      const p = b.u.mesh.getWorldPosition(this._v || (this._v = new THREE.Vector3()))
      p.y += 1.8
      const scr = this.ctx.project(p)
      b.el.style.left = scr.x + 'px'; b.el.style.top = scr.y + 'px'
    }
  }

  // ---------- 积分与结算码 ----------
  score() {
    const s = this.state
    const units = this.ctx.islands.reduce((n, i) => n + (i.units ? i.units.length : 0), 0)
    return Math.max(0, this.ownedIslands().length * 100 + s.stormCount * 40 + units * 15 + s.kills * 10 + s.anchors * 20 - s.lost * 50)
  }
  saveScore() {
    const board = JSON.parse(localStorage.getItem('fi_board') || '[]')
    board.push(this.score())
    board.sort((a, b) => b - a)
    localStorage.setItem('fi_board', JSON.stringify(board.slice(0, 5)))
  }
  // ---------- 神鸟图鉴 ----------
  noteBird(def) {
    if (this.state.seenBirds.has(def.name)) return
    this.state.seenBirds.add(def.name)
    localStorage.setItem('fi_birds_seen', JSON.stringify([...this.state.seenBirds]))
    this.toast(`📖【神鸟图鉴】新收录：${def.name}——${def.desc}（${this.state.seenBirds.size}/8）`, 'miss')
    this.updateHUD()
  }

  scoreCode() {
    const s = this.state, owned = this.ownedIslands().length
    const raw = this.score() * 7919 + owned * 31 + s.stormCount * 17 + s.kills * 7
    return 'FI-' + raw.toString(36).toUpperCase() + '-' + ((raw * 13) % 46656).toString(36).toUpperCase()
  }

  // ---------- 工具 ----------
  toast(msg, cls = '') {
    const d = document.createElement('div')
    d.className = 'toast ' + cls; d.textContent = msg
    this.el.toasts.appendChild(d)
    setTimeout(() => d.remove(), 3000)
  }

  ownedIslands() { return this.ctx.islands.filter(i => i.owned && !i.sunk && !i.sinking) }

  islandById(id) { return this.ctx.islands.find(i => i.def.id === id) }

  edgeDist(a, b) {
    return a.group.position.distanceTo(b.group.position) - a.def.r - b.def.r
  }

  reachable(target) {
    if (target.owned || target.sunk) return false
    if (this.bridges.some(br => !br.broken && (br.to === target || br.from === target))) return false
    return this.ownedIslands().some(o => this.edgeDist(o, target) <= 30)
  }

  nearestOwned(target) {
    let best = null, bd = 1e9
    for (const o of this.ownedIslands()) {
      const d = this.edgeDist(o, target)
      if (d < bd) { bd = d; best = o }
    }
    return { island: best, dist: bd }
  }

  canAfford(cost) {
    return (cost.c || 0) <= this.state.crystals && (cost.w || 0) <= this.state.wood && (cost.a || 0) <= this.state.anchors
  }
  pay(cost) {
    this.state.crystals -= cost.c || 0; this.state.wood -= cost.w || 0; this.state.anchors -= cost.a || 0
    this.updateHUD()
  }
  costText(cost) {
    const p = []
    if (cost.c) p.push(`☁️${cost.c}`); if (cost.w) p.push(`🪵${cost.w}`); if (cost.a) p.push(`⚓${cost.a}`)
    return p.join(' ')
  }

  // ---------- 交互 ----------
  onClick(ud, point) {
    if (this.state.paused || this.state.over) return
    if (ud.kind === 'crystal') {
      const isl = this.islandById(ud.island)
      if (!isl.owned || isl.sunk) return this.toast('先搭桥抵达这座岛才能开采', 'bad')
      if (ud.cooldown > 0) return
      ud.cooldown = 4
      this.state.crystals += 2
      this.state.collectStreak = Math.min(this.state.collectStreak + 1, 8); this.state.streakT = 2
      sfx.collect(this.state.collectStreak)
      this.ctx.spawnBurst(point, 0x7ad8ff, 14)
      this.emit('crystal-click')
      this.updateHUD(); return
    }
    if (ud.kind === 'tree') {
      const isl = this.islandById(ud.island)
      if (!isl.owned || isl.sunk) return this.toast('先搭桥抵达这座岛才能采木', 'bad')
      if (ud.cooldown > 0) return
      ud.cooldown = 0.7
      this.state.wood += 1
      sfx.wood()
      this.ctx.spawnBurst(point, 0x58b868, 10)
      this.emit('wood-click')
      this.updateHUD(); return
    }
    if (ud.kind === 'unit') {
      this.selUnit = ud.ref; this.selected = null
      this.renderPanel(); return
    }
    if (ud.kind === 'bird') {
      const bird = ud.ref
      if (bird.kind === 'good' && !bird.dead) {
        const rw = bird.def.reward || {}
        this.state.crystals += rw.c || 0
        this.state.wood += rw.w || 0
        const parts = []
        if (rw.c) parts.push(`+${rw.c}☁️`); if (rw.w) parts.push(`+${rw.w}🪵`)
        this.ctx.spawnBurst(bird.mesh.position, 0xffd97a, 30)
        this.toast(`🕊️ ${bird.def.name}降下祥瑞：${parts.join(' ')}！`, 'good')
        sfx.win(); this.updateHUD()
        bird.vel.multiplyScalar(2.2)
      } else if (bird.kind === 'bad') {
        this.toast(`🦅 ${bird.def.name} HP ${bird.hp}——需要士兵对付它`, 'bad')
      }
      return
    }
    if (ud.kind === 'island') {
      this.selUnit = null
      const isl = this.islandById(ud.id)
      this.selected = isl
      this.emit(isl.owned ? 'select-owned' : 'select-unowned', isl)
      this.renderPanel()
    }
  }

  renderPanel() {
    const P = this.el
    P.pBtns.innerHTML = ''

    // 单位面板
    if (this.selUnit) {
      const u = this.selUnit
      if (u.hp <= 0 || u.island.sunk) { this.selUnit = null; P.panel.classList.add('hidden'); return }
      const d = UNIT_DEFS[u.type]
      P.panel.classList.remove('hidden')
      P.pTitle.textContent = `${d.icon} ${d.name} · 岛 #${u.island.def.id}`
      P.pSub.innerHTML = `HP ${u.hp}/${d.hp} · 状态：${{ idle:'待命', move:'移动中', work:'作业中', patrol:'巡逻中', fight:'反击灾鸟！', repair:'紧急修复中' }[u.state]}<br/>${d.desc}`
      const dis = document.createElement('button')
      dis.textContent = `遣散（返还 ${Math.floor((d.cost.c || 0) / 2)}☁️）`
      dis.onclick = () => this.dismissUnit(u)
      P.pBtns.appendChild(dis)
      const close = document.createElement('button')
      close.textContent = '关闭'
      close.onclick = () => { this.selUnit = null; this.renderPanel() }
      P.pBtns.appendChild(close)
      return
    }

    const isl = this.selected
    if (!isl) { P.panel.classList.add('hidden'); return }
    P.panel.classList.remove('hidden')

    if (isl.sunk) { P.panel.classList.add('hidden'); return }

    if (isl.tilted) {
      P.pTitle.textContent = `⚠️ 岛 #${isl.def.id} 正在倾斜！`
      P.pSub.innerHTML = `稳定度 ${Math.max(0, isl.stability | 0)} / 100 — ${isl.rescueT.toFixed(0)} 秒后沉没。<b>救它，还是眼睁睁看着它沉下去？</b>`
      const btn = document.createElement('button')
      btn.className = 'rescue'
      btn.textContent = `注入云晶救援（-${RESCUE_COST}☁️ → +${RESCUE_HEAL}稳定度）`
      btn.disabled = this.state.crystals < RESCUE_COST
      btn.onclick = () => this.rescue(isl)
      P.pBtns.appendChild(btn)
      const give = document.createElement('button')
      give.textContent = '放弃它'
      give.onclick = () => { isl.abandoned = true; this.renderPanel() }
      P.pBtns.appendChild(give)
      return
    }

    if (isl.owned) {
      const done = isl.buildings.filter(b => b.done)
      P.pTitle.textContent = `🏝️ 岛 #${isl.def.id}${isl.def.home ? '（家园）' : ''}`
      P.pSub.innerHTML =
        `稳定度 ${isl.stability | 0}/100 · 建筑 ${isl.buildings.length}/2` +
        (isl.anchored ? ' · ⚓已锚定' : '') +
        (isl.hasShield ? ' · 🛡️有护盾' : '') +
        (done.length ? `<br/>已有：${done.map(b => BUILDING_DEFS[b.type].name).join('、')}` : '') +
        `<br/>单位 ${isl.units.length}/${UNIT_CAP}：` +
        (isl.units.length ? isl.units.map(u => UNIT_DEFS[u.type].icon).join(' ') : '无')
      for (const [type, def] of Object.entries(BUILDING_DEFS)) {
        const btn = document.createElement('button')
        const full = isl.buildings.length >= 2
        const dup = type === 'anchor' && isl.anchored
        const poor = !this.canAfford(def.cost)
        btn.textContent = `${def.icon} ${def.name}（${this.costText(def.cost)}）` +
          (full ? ' ·槽位已满' : dup ? ' ·已锚定' : poor ? ' ·资源不足' : '')
        btn.disabled = full || dup || poor
        btn.title = full ? '每座岛最多 2 座建筑——去新岛建造' : dup ? '此岛已锚定' : poor ? `还差资源：${def.desc}` : def.desc
        btn.onclick = () => this.startBuilding(isl, type)
        P.pBtns.appendChild(btn)
      }
      for (const [type, def] of Object.entries(UNIT_DEFS)) {
        const btn = document.createElement('button')
        const full = isl.units.length >= UNIT_CAP
        const poor = !this.canAfford(def.cost)
        btn.textContent = `招募${def.icon}${def.name}（${this.costText(def.cost)}）` +
          (full ? ' ·岛已满员' : poor ? ' ·资源不足' : '')
        btn.disabled = full || poor
        btn.title = full ? '每座岛最多 3 个单位——搭桥去新岛扩编' : poor ? `还差资源：${def.desc}` : def.desc
        btn.onclick = () => this.hireUnit(isl, type)
        P.pBtns.appendChild(btn)
      }
      return
    }

    // 未拥有的岛
    const { island: src, dist } = this.nearestOwned(isl)
    const planks = Math.max(3, Math.ceil(dist / PLANK_STEP))
    const pending = this.bridges.find(b => b.to === isl && !b.complete && !b.broken)
    P.pTitle.textContent = `☁️ 未知之岛 #${isl.def.id}`
    if (pending) {
      const left = pending.planks.filter(p => !p.done).length
      P.pSub.innerHTML = `桥在建中——还差 <b>${left}</b> 块桥板（每块 ${PLANK_COST}☁️，自动铺设）`
    } else if (this.reachable(isl)) {
      P.pSub.innerHTML = `从岛 #${src.def.id} 搭桥约需 <b>${planks}</b> 块桥板（共 ${planks * PLANK_COST}☁️）`
      const btn = document.createElement('button')
      btn.textContent = `🌉 开始搭桥`
      btn.disabled = this.state.crystals < PLANK_COST
      btn.onclick = () => this.startBridge(src, isl)
      P.pBtns.appendChild(btn)
    } else {
      P.pSub.innerHTML = `距离太远（边距 ${dist.toFixed(0)}）。<b>先扩张到更近的岛。</b>`
    }
  }

  // ---------- 建造 ----------
  startBridge(from, to) {
    const dir = new THREE.Vector3().subVectors(to.group.position, from.group.position).normalize()
    const start = from.group.position.clone().addScaledVector(dir, from.def.r * 0.95)
    const end = to.group.position.clone().addScaledVector(dir, -to.def.r * 0.95)
    const n = Math.max(3, Math.ceil(start.distanceTo(end) / PLANK_STEP))
    const planks = []
    for (let i = 0; i < n; i++) {
      const pos = start.clone().lerp(end, i / (n - 1))
      const mesh = makePlank(pos, dir)
      this.ctx.scene.add(mesh)
      planks.push({ mesh, done: false })
    }
    this.bridges.push({ from, to, planks, next: 0, timer: 0, complete: false, broken: false })
    this.emit('bridge-start', { from, to })
    sfx.build()
    this.toast('开始铺桥——在风暴来之前抢完它！', 'miss')
    this.renderPanel()
  }

  startBuilding(isl, type) {
    const def = BUILDING_DEFS[type]
    if (isl.buildings.length >= 2 || !this.canAfford(def.cost)) return
    this.pay(def.cost)
    const slot = isl.slots[isl.buildings.length]
    const mesh = makeBuilding(type)
    mesh.position.copy(slot.position); mesh.position.y = 1.6
    mesh.traverse(m => { if (m.material && m.material.transparent !== undefined) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.45 } })
    slot.visible = false
    isl.group.add(mesh)
    isl.buildings.push({ type, mesh, done: false, progress: 0, slot })
    this.emit('building-start', isl)
    sfx.build()
    this.toast(`${def.icon} ${def.name} 开始建造（7s，未完工会被风暴吹散）`, 'miss')
    this.renderPanel()
  }

  finishBuilding(isl, b) {
    b.done = true
    b.mesh.traverse(m => { if (m.material) { m.material.opacity = 1; m.material.transparent = false } })
    if (b.type === 'anchor') { isl.anchored = true; this.toast('⚓ 此岛已永久锚定，风暴再也无法撼动它', 'good') }
    if (b.type === 'shield') isl.hasShield = true
    this.emit('building-done', isl)
    sfx.win()
    this.updateHUD()
  }

  rescue(isl) {
    if (this.state.crystals < RESCUE_COST || !isl.tilted) return
    this.state.crystals -= RESCUE_COST
    isl.stability += RESCUE_HEAL
    sfx.rescue()
    this.ctx.spawnBurst(isl.group.position.clone().setY(3), 0x9adfff, 20)
    if (isl.stability >= RESCUE_TARGET) {
      isl.tilted = false; isl.abandoned = false; isl.stability = 65
      this.toast('🎉 岛被拉回来了！', 'good'); sfx.win()
      this.emit('rescue', isl)
    }
    this.updateHUD(); this.renderPanel()
  }

  // ---------- 单位 ----------
  hireUnit(isl, type) {
    const def = UNIT_DEFS[type]
    if (isl.units.length >= UNIT_CAP || !this.canAfford(def.cost) || isl.sunk || isl.sinking) return
    this.pay(def.cost)
    const u = new Unit(type, isl)
    isl.units.push(u)
    u.mesh.traverse(m => { if (m.isMesh) this.ctx.addInteractive(m) })
    this.emit('unit-hired', u)
    sfx.build()
    this.toast(`${def.icon} ${def.name} 在岛 #${isl.def.id} 上岗了`, 'good')
    this.updateHUD(); this.renderPanel()
  }

  dismissUnit(u) {
    this.state.crystals += Math.floor((UNIT_DEFS[u.type].cost.c || 0) / 2)
    this.removeUnit(u)
    this.selUnit = null
    this.toast(`${UNIT_DEFS[u.type].icon} ${UNIT_DEFS[u.type].name} 已遣散`, 'miss')
    this.updateHUD(); this.renderPanel()
  }

  removeUnit(u) {
    const isl = u.island
    u.mesh.traverse(m => { if (m.isMesh) this.ctx.removeInteractive(m) })
    isl.group.remove(u.mesh)
    isl.units = isl.units.filter(x => x !== u)
    if (this.selUnit === u) { this.selUnit = null; this.renderPanel() }
  }

  fireBolt(from, bird, dmg) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe97a }))
    m.position.copy(from)
    this.ctx.scene.add(m)
    this.bolts.push({ mesh: m, target: bird, dmg })
  }

  // 灾鸟俯冲攻击结算：优先啄未完工建筑 → 啄工人 → 偷云晶
  birdStrike(bird) {
    const isl = bird.island
    if (!isl || isl.sunk || isl.sinking || !isl.owned) return
    sfx.scatter(); this.ctx.shake(0.12)
    const ub = isl.buildings.find(b => !b.done)
    if (ub && !isl.hasShield) {
      isl.buildings = isl.buildings.filter(b => b !== ub)
      ub.slot.visible = true
      ub.mesh.getWorldPosition(this._v || (this._v = new THREE.Vector3()))
      this.ctx.spawnBurst(this._v, 0xb08a5a, 40)
      isl.group.remove(ub.mesh)
      this.toast(`🦅 灾鸟啄散了未完工的${BUILDING_DEFS[ub.type].name}！`, 'bad')
      return
    }
    const prey = isl.units.find(u => u.type !== 'soldier')
    if (prey) {
      const preyName = UNIT_DEFS[prey.type].name
      prey.hp -= 1
      prey.mesh.getWorldPosition(this._v || (this._v = new THREE.Vector3()))
      this.ctx.spawnBurst(this._v, 0xff5a5a, 20)
      if (prey.hp <= 0) { this.removeUnit(prey); this.toast(`🦅 一名${preyName}被灾鸟啄死了`, 'bad') }
      else this.toast(`🦅 你的${preyName}被啄伤（HP ${prey.hp}）`, 'bad')
      this.updateHUD()
      return
    }
    const s = Math.min(5, this.state.crystals)
    if (s > 0) {
      this.state.crystals -= s; bird.stolen += s
      this.toast(`🦅 灾鸟叼走了 ${s} 云晶！击落它夺回来`, 'bad')
      this.updateHUD()
    } else {
      this.toast('🦅 灾鸟一无所获，骂骂咧咧地盘旋', 'miss')
    }
  }

  // ---------- 风暴循环 ----------
  newCycle() {
    const s = this.state
    s.phase = 'calm'; s.phaseT = CALM_T
    s.damageApplied = false; s.stormTick = 0
    // 动态难度：资产越多风暴越强；连败保护
    const owned = this.ownedIslands()
    const bCount = owned.reduce((n, i) => n + i.buildings.filter(b => b.done).length, 0)
    const tier = Math.floor((owned.length * 2 + bCount + s.crystals / 50) / 10)
    s.power = (16 + 7 * tier + (Math.random() * 6 - 3)) * (s.lastStormSank > 0 ? 0.8 : 1)
    document.body.classList.remove('warning', 'storming')
  }

  update(dt, t) {
    const s = this.state
    if (s.paused || s.over) return

    // 资源被动产出
    const owned = this.ownedIslands()
    const mines = owned.reduce((n, i) => n + i.crystals.length, 0)
    const collectors = owned.reduce((n, i) => n + i.buildings.filter(b => b.done && b.type === 'collector').length, 0)
    if (mines) { s.crystalAcc += dt; if (s.crystalAcc >= 7 / mines) { s.crystalAcc = 0; s.crystals += 1; this.updateHUD() } }
    if (collectors) { s.collectorAcc += dt; if (s.collectorAcc >= 5 / collectors) { s.collectorAcc = 0; s.crystals += 1; this.updateHUD() } }
    s.streakT -= dt; if (s.streakT <= 0) s.collectStreak = 0

    // 冷却
    for (const isl of this.ctx.islands) {
      for (const c of isl.crystals) c.userData.cooldown = Math.max(0, c.userData.cooldown - dt)
      for (const tr of isl.trees) tr.userData.cooldown = Math.max(0, tr.userData.cooldown - dt)
    }

    // 桥板铺设
    for (const br of this.bridges) {
      if (br.complete || br.broken) continue
      br.timer += dt
      if (br.timer >= PLANK_INTERVAL) {
        br.timer = 0
        const p = br.planks.find(p => !p.done)
        if (p && s.crystals >= PLANK_COST) {
          s.crystals -= PLANK_COST; p.done = true
          solidifyPlank(p.mesh); sfx.wood(); this.updateHUD()
          if (br.planks.every(x => x.done)) {
            br.complete = true
            this.claimIsland(br.to)
          } else if (this.selected === br.to) this.renderPanel()
        } else if (p && s.crystals < PLANK_COST) {
          // 资金不足：桥悬在半空——风暴会吃掉它
        }
      }
    }

    // 单位更新
    for (const isl of owned) {
      for (const u of isl.units.slice()) u.update(dt, this, t)
    }

    // 士兵箭矢追踪
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]
      if (!b.target || b.target.dead) { this.ctx.scene.remove(b.mesh); this.bolts.splice(i, 1); continue }
      const to = b.target.mesh.position
      if (b.mesh.position.distanceTo(to) < 0.8) {
        b.target.hp -= b.dmg
        this.ctx.spawnBurst(to.clone(), 0xffe97a, 12)
        if (b.target.hp <= 0) b.target.kill()
        this.ctx.scene.remove(b.mesh); this.bolts.splice(i, 1); continue
      }
      b.mesh.position.addScaledVector(to.clone().sub(b.mesh.position).normalize(), 30 * dt)
    }

    // 建筑施工（维修师加速）
    for (const isl of owned) {
      const mech = isl.units.filter(u => u.type === 'mechanic').length
      for (const b of isl.buildings) {
        if (b.done) continue
        b.progress += dt * (1 + mech)
        b.mesh.traverse(m => { if (m.material) m.material.opacity = 0.45 + 0.5 * (b.progress / 7) })
        if (b.progress >= 7) this.finishBuilding(isl, b)
      }
    }

    // 风暴状态机
    s.phaseT -= dt
    if (s.phase === 'calm') {
      if (s.phaseT <= 0) {
        s.phase = 'warning'; s.phaseT = WARN_T
        document.body.classList.add('warning')
        sfx.warn()
        this.toast('🌩️ 风暴逼近——未完工的建筑会被吹散！', 'bad')
      }
    } else if (s.phase === 'warning') {
      if (s.phaseT <= 0) {
        s.phase = 'storm'; s.phaseT = STORM_T; s.stormCount++
        document.body.classList.add('storming')
        this.ctx.wind.visible = true
        sfx.stormStart(); sfx.setStorm(true)
      }
    } else if (s.phase === 'storm') {
      const elapsed = STORM_T - s.phaseT
      // 吹散未完工物
      s.stormTick += dt
      if (s.stormTick >= 2.2) {
        s.stormTick = 0
        this.scatterOne()
      }
      // 中途结算稳定度伤害
      if (!s.damageApplied && elapsed >= DAMAGE_AT) {
        s.damageApplied = true
        this.applyStormDamage()
      }
      this.ctx.shake(0.06)
      if (s.phaseT <= 0) {
        s.phase = 'settle'
        this.ctx.wind.visible = false
        document.body.classList.remove('warning', 'storming')
        sfx.setStorm(false)
        this.settle()
      }
    }

    // 倾斜倒计时与沉没
    for (const isl of this.ctx.islands) {
      if (isl.tilted) {
        isl.rescueT -= dt
        if (isl.stability >= RESCUE_TARGET) { // 手动注入或维修师救回
          isl.tilted = false; isl.abandoned = false; isl.stability = Math.max(isl.stability, 60)
          this.toast(`🎉 岛 #${isl.def.id} 被稳住了！`, 'good')
          this.emit('rescue', isl)
        }
        const k = 1 - Math.max(0, isl.stability) / 100
        isl.group.rotation.z = SINK_TILT * k * (isl.def.id % 2 ? 1 : -1)
        isl.group.rotation.x = SINK_TILT * k * 0.6
        if (isl.rescueT <= 0) this.sinkIsland(isl)
      } else if (isl.sinking) {
        isl.sinkT -= dt
        isl.group.position.y -= dt * 6
        isl.group.rotation.z += dt * 0.25
        if (isl.sinkT <= 0) {
          isl.sunk = true
          this.ctx.scene.remove(isl.group)
        }
      } else if (isl.owned && !isl.sunk) {
        // 稳定度缓慢自愈到 70 上限
        if (isl.stability < 70) isl.stability = Math.min(70, isl.stability + dt * 1.2)
        isl.group.rotation.z *= 0.98; isl.group.rotation.x *= 0.98
      }
      // 漂浮呼吸
      if (!isl.sinking && !isl.sunk) isl.group.position.y = Math.sin(t * 0.5 + isl.def.id * 1.7) * 0.5
    }

    // 精灵碎碎念
    this.updateBarks(dt)

    // 风暴条 UI
    const total = s.phase === 'calm' ? CALM_T : s.phase === 'warning' ? WARN_T : STORM_T
    const frac = s.phase === 'storm' ? 1 : 1 - s.phaseT / total
    this.el.fill.style.width = (frac * 100) + '%'
    this.el.label.textContent =
      s.phase === 'calm' ? `☀️ 平静 · 风暴还有 ${s.phaseT.toFixed(0)}s（强度 ⚡${s.power.toFixed(0)}）` :
      s.phase === 'warning' ? `🌩️ 预警 ${s.phaseT.toFixed(0)}s——快把建筑抢完！` :
      `🌀 风暴肆虐中 ${s.phaseT.toFixed(0)}s`

    // 倾斜警报
    this.renderAlerts()
    if (this.selected && this.selected.tilted) this.renderPanel()
  }

  scatterOne() {
    // 找所有未完工的桥板和建筑，吹散最脆弱的一个
    const s = this.state
    const candidates = []
    for (const br of this.bridges) {
      if (br.complete || br.broken) continue
      for (const p of br.planks) if (!p.done) candidates.push({ kind: '桥板', mesh: p.mesh, owner: br, item: p })
    }
    for (const isl of this.ownedIslands()) {
      if (isl.hasShield) continue
      for (const b of isl.buildings) if (!b.done) candidates.push({ kind: BUILDING_DEFS[b.type].name, mesh: b.mesh, owner: isl, item: b, isl })
    }
    if (!candidates.length) return
    const c = candidates[Math.floor(Math.random() * candidates.length)]
    c.mesh.getWorldPosition(this._v || (this._v = new THREE.Vector3()))
    this.ctx.spawnBurst(this._v, 0xb08a5a, 40)
    sfx.scatter(); this.ctx.shake(0.15)
    if (c.kind === '桥板') {
      c.owner.planks = c.owner.planks.filter(p => p !== c.item)
      this.ctx.scene.remove(c.mesh)
      if (!c.owner.planks.length) { c.owner.broken = true; this.toast('💨 一座在建的桥被整个吹散了', 'bad') }
      else this.toast('💨 一块桥板被吹散了', 'bad')
    } else {
      c.isl.buildings = c.isl.buildings.filter(b => b !== c.item)
      c.item.slot.visible = true
      c.isl.group.remove(c.mesh)
      this.toast(`💨 未完工的${c.kind}被吹散了`, 'bad')
    }
    s.scatteredThisStorm.push(c.kind)
  }

  applyStormDamage() {
    const s = this.state, home = this.ctx.homeIsland
    let sankNow = 0
    for (const isl of this.ownedIslands()) {
      if (isl.anchored) continue
      const distHome = isl.group.position.distanceTo(home.group.position)
      const exposure = distHome > 14 ? 1 : 0.45
      let dmg = s.power * exposure * (isl.hasShield ? 0.5 : 1)
      isl.stability -= dmg
      if (isl.stability < 35 && !isl.tilted) {
        isl.tilted = true; isl.rescueT = RESCUE_T
        this.toast(`⚠️ 岛 #${isl.def.id} 正在倾斜！点击它选择救援或放弃`, 'bad')
        sfx.warn()
        this.emit('tilt', isl)
      }
    }
  }

  sinkIsland(isl) {
    isl.tilted = false; isl.sinking = true; isl.sinkT = 4
    this.state.lost++; this.state.lastStormSank++
    sfx.sink()
    // 关联的桥一起塌
    for (const br of this.bridges) {
      if (br.broken) continue
      if (br.from === isl || br.to === isl) {
        br.broken = true
        for (const p of br.planks) {
          const pos = p.mesh.position.clone()
          this.ctx.spawnBurst(pos, 0xb08a5a, 12)
          this.ctx.scene.remove(p.mesh)
        }
      }
    }
    this.ctx.spawnBurst(isl.group.position, 0x8a6a8f, 80)
    this.toast(`💔 岛 #${isl.def.id} 沉入了云海。它不会再回来了。`, 'bad')
    if (this.selected === isl) { this.selected = null; this.renderPanel() }
    if (isl.def.home) this.gameOver()
    this.updateHUD()
  }

  claimIsland(isl) {
    isl.owned = true
    if (isl.cover) { isl.group.remove(isl.cover); isl.cover = null }
    this.emit('island-claim', isl)
    this.toast(`🏝️ 抵达新岛 #${isl.def.id}！`, 'good')
    setTimeout(() => this.toast('📜 ' + isl.def.lore, 'miss'), 900)
    sfx.win()
    const owned = this.ownedIslands().length
    if (owned > this.best) { this.best = owned; localStorage.setItem('fi_best', String(this.best)) }
    this.updateHUD(); this.renderPanel()
    if (this.ctx.islands.every(i => i.owned || i.sunk)) {
      this.toast('👑 群岛之主！所有岛屿都已连接', 'good')
    }
  }

  settle() {
    const s = this.state
    s.anchors += 1
    let html = ''
    const lost = s.scatteredThisStorm
    if (lost.length) {
      const cnt = {}
      lost.forEach(k => cnt[k] = (cnt[k] || 0) + 1)
      html += `<div class="bad">被吹散：${Object.entries(cnt).map(([k, v]) => `${k}×${v}`).join('、')}</div>`
    } else html += `<div class="good">所有建筑都扛过了这场风暴。</div>`
    const tiltedN = this.ctx.islands.filter(i => i.tilted).length
    if (tiltedN) html += `<div class="bad">⚠️ ${tiltedN} 座岛正在倾斜——结算后继续救援！</div>`
    if (s.lastStormSank) html += `<div class="bad">💔 本场风暴你失去了 ${s.lastStormSank} 座岛。</div>`
    html += `<div class="good">⚓ 残骸中打捞到锚石 ×1（可建造锚桩永久固定一岛）</div>`
    // “差一点”钩子
    const pending = this.bridges.filter(b => !b.complete && !b.broken)
    if (pending.length) {
      const left = Math.min(...pending.map(b => b.planks.filter(p => !p.done).length))
      if (left > 0) html += `<div class="miss">就差 <b>${left}</b> 块桥板，新岛就是你的了。</div>`
    } else {
      const next = this.ctx.islands.find(i => this.reachable(i))
      if (next) html += `<div class="miss">未知之岛 #${next.def.id} 就在不远处等你搭桥。</div>`
      else html += `<div class="miss">下一场风暴强度会更高——未雨绸缪。</div>`
    }
    this.saveScore()
    html += `<div class="good">🏆 当前积分 ${this.score()} · 结算码 <b>${this.scoreCode()}</b><br/><span style="font-size:12px;opacity:.75">把结算码交给活动方即可兑换积分/奖励</span></div>`
    s.lastStormSank = 0; s.scatteredThisStorm = []
    this.el.sTitle.textContent = `第 ${s.stormCount} 场风暴过去了`
    this.el.sBody.innerHTML = html
    this.el.settle.classList.remove('hidden')
    s.paused = true
    this.updateHUD()
  }

  gameOver() {
    this.state.over = true
    this.saveScore()
    this.el.sTitle.textContent = '家园岛沉没了'
    this.el.sBody.innerHTML = `<div class="bad">你亲手建起的第一座岛沉入了云海。</div><div>群岛存续了 ${this.state.stormCount} 场风暴，连接 ${this.ownedIslands().length} 座岛，击落灾鸟 ${this.state.kills} 只。</div><div class="good">🏆 最终积分 ${this.score()} · 结算码 <b>${this.scoreCode()}</b></div>`
    this.el.settle.classList.remove('hidden')
    $('settle-ok').textContent = '重新开始'
    $('settle-ok').onclick = () => location.reload()
  }

  renderAlerts() {
    const tilted = this.ctx.islands.filter(i => i.tilted)
    const html = tilted.map(i => `<div class="alert">🏝️ 岛 #${i.def.id} 倾斜中 · ${i.rescueT.toFixed(0)}s · 稳定度${Math.max(0, i.stability | 0)}<br/>点击岛屿救援</div>`).join('')
    if (html !== this._alertHtml) { this.el.alerts.innerHTML = html; this._alertHtml = html }
  }

  updateHUD() {
    const s = this.state
    this.el.crystal.textContent = s.crystals | 0
    this.el.wood.textContent = s.wood | 0
    this.el.anchor.textContent = s.anchors | 0
    this.el.isles.textContent = this.ownedIslands().length
    this.el.lostEl.textContent = s.lost
    if (this.el.units) this.el.units.textContent = this.ctx.islands.reduce((n, i) => n + (i.units ? i.units.length : 0), 0)
    if (this.el.birds) this.el.birds.textContent = this.state.seenBirds.size + '/8'
  }
}
