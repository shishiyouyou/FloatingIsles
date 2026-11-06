import * as THREE from 'three'

// 新手引导：分步教学 + 金色信标高亮目标 + 步骤卡片
// 只在首次游戏时显示（localStorage），可随时跳过
export class Tutorial {
  constructor(game, ctx) {
    this.game = game
    this.ctx = ctx // { scene, islands }
    this.done = localStorage.getItem('fi_tutorial_done') === '1'
    this.stepIdx = 0
    this.autoT = 0
    this.bridgeTarget = null   // 正在搭桥的终点岛
    this.lastClaimed = null    // 最新抵达的岛

    const home = ctx.islands[0]
    this.steps = [
      {
        ev: 'crystal-click',
        text: '☁️ 第 1 步 / 共 7 步：点击主岛上发光的水晶矿，采集云晶——这是一切建造的材料',
        tgt: () => home.crystals[0],
      },
      {
        ev: 'wood-click',
        text: '🪵 第 2 步：点击一棵树，采集风木（升级和锚定要用）',
        tgt: () => home.trees[0],
      },
      {
        ev: 'select-unowned',
        text: '🏝️ 第 3 步：点击旁边被云雾罩住的岛，看看怎么过去',
        tgt: () => this.nearestReachable(),
      },
      {
        ev: 'bridge-start',
        text: '🌉 第 4 步：在底部弹出的面板里，点击「开始搭桥」',
        tgt: null,
      },
      {
        ev: 'island-claim',
        text: '⏳ 桥板正在自动铺设（每块 5 云晶）。盯住它——风暴来临时没铺完的部分会被吹散！',
        tgt: () => this.bridgeTarget,
      },
      {
        ev: 'building-start',
        text: '🏗️ 第 5 步：点击刚抵达的新岛，建一座「云晶采集器」让资源自己长',
        tgt: () => this.lastClaimed,
      },
      {
        ev: 'unit-hired',
        text: '👷 第 6 步：点击刚抵达的新岛，在面板「招募」一名采集工——他会替你自动干活，解放双手',
        tgt: () => this.lastClaimed || this.ctx.islands.find(i => i.owned && i.units.length < 3),
      },
      {
        ev: null, auto: 10,
        text: '🎉 第 7 步（最后）：🦅灾鸟会来啄建筑、抢云晶——招募士兵驻守反击；🕊️吉运鸟记得点它！守住你的群岛！',
        tgt: null,
      },
    ]

    // DOM 卡片
    this.card = document.getElementById('tut')
    this.textEl = document.getElementById('tut-text')
    document.getElementById('tut-skip').onclick = () => this.finish(true)

    // 金色信标（光环 + 下指箭头）
    const g = new THREE.Group()
    const gold = new THREE.MeshBasicMaterial({ color: 0xffd97a })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.1, 8, 36), gold)
    ring.rotation.x = Math.PI / 2
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 4), gold)
    arrow.rotation.x = Math.PI
    arrow.position.y = -1.4
    g.add(ring, arrow)
    g.visible = false
    this.beacon = g
    ctx.scene.add(g)

    if (!this.done) this.show()
  }

  nearestReachable() {
    let best = null, bd = 1e9
    for (const i of this.ctx.islands) {
      if (!i.owned || i.sunk || i.sinking) continue
      for (const t of this.ctx.islands) {
        if (t.owned || t.sunk || t.sinking) continue
        const d = this.game.edgeDist(i, t)
        if (d <= 30 && d < bd) { bd = d; best = t }
      }
    }
    return best
  }

  show() {
    this.card.classList.remove('hidden')
    this.render()
  }

  render() {
    const s = this.steps[this.stepIdx]
    this.textEl.textContent = s.text
  }

  onEvent(name, data) {
    if (this.done) return
    // 事件触发的额外教学提示（不打断主步骤）
    if (name === 'tilt') {
      this.game.toast('⚠️ 教学提示：点击倾斜的岛 → 连续点「注入云晶」直到它回正！', 'miss')
      return
    }
    if (name === 'first-badbird') {
      this.game.toast('💡 教学提示：灾鸟怕士兵——在没有驻军的岛上它们会为所欲为', 'miss')
      return
    }
    if (name === 'bridge-start') this.bridgeTarget = data?.to || this.bridgeTarget
    if (name === 'island-claim') this.lastClaimed = data || this.lastClaimed
    const s = this.steps[this.stepIdx]
    if (s && s.ev === name) this.advance()
  }

  advance() {
    this.stepIdx++
    this.autoT = 0
    if (this.stepIdx >= this.steps.length) return this.finish(false)
    this.render()
  }

  finish(skipped) {
    this.done = true
    localStorage.setItem('fi_tutorial_done', '1')
    this.card.classList.add('hidden')
    this.beacon.visible = false
    if (!skipped) this.game.toast('🎓 教学完成——现在，群岛是你的了', 'good')
  }

  update(dt, t) {
    if (this.done) return
    const s = this.steps[this.stepIdx]
    if (!s) return
    // 自动推进步骤
    if (s.auto) { this.autoT += dt; if (this.autoT >= s.auto) this.advance() }
    // 信标跟随目标
    const tgt = s.tgt && s.tgt()
    if (tgt) {
      const p = new THREE.Vector3()
      if (tgt.group) p.copy(tgt.group.position) // 岛
      else tgt.getWorldPosition ? tgt.getWorldPosition(p) : p.copy(tgt.position) // 子物体
      this.beacon.position.set(p.x, p.y + 4.5 + Math.sin(t * 3) * 0.4, p.z)
      this.beacon.rotation.y = t * 1.5
      this.beacon.visible = true
      // 光环脉动
      const k = 1 + Math.sin(t * 4) * 0.12
      this.beacon.scale.set(k, k, k)
    } else {
      this.beacon.visible = false
    }
  }
}
