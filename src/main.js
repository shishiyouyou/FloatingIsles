import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createSky, createCloudSea, createWindLines, makeIsland, makeBurst } from './world.js'
import { Game } from './game.js'
import { Tutorial } from './tutorial.js'
import { BirdManager, Bird, GOOD_TYPES } from './birds.js'
import { Unit } from './units.js'
import { sfx } from './sfx.js'

// ---------- 渲染器 / 场景 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.getElementById('app').appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x6a4a9e, 60, 260)

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 800)
camera.position.set(26, 24, 30)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.maxPolarAngle = Math.PI * 0.46
controls.minDistance = 14
controls.maxDistance = 90
controls.target.set(0, 0, 0)
controls.enabled = false // 开场后启用

// ---------- 光照 ----------
const sun = new THREE.DirectionalLight(0xffc890, 1.6)
sun.position.set(40, 50, 25)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60
sun.shadow.camera.far = 160
scene.add(sun)
scene.add(new THREE.HemisphereLight(0xb08aff, 0x3a2a55, 0.75))
const amb = new THREE.AmbientLight(0x604a80, 0.5)
scene.add(amb)

// ---------- 天空 / 云海 / 风线 ----------
const sky = createSky()
scene.add(sky)
const sea = createCloudSea()
scene.add(sea.group)
const wind = createWindLines()
scene.add(wind)

// ---------- 群岛 ----------
const ISLAND_DEFS = [
  { id: 0, x: 0,   z: 0,   r: 7,   home: true, crystal: 1, trees: 2,
    lore: '家园岛——天空之城最后的碎片。你守护的灯芯还在这里亮着。' },
  { id: 1, x: 17,  z: -7,  r: 5.5, crystal: 1, trees: 1,
    lore: '碑刻残片：「……第一座桥就是我们在这里铺下的。风再大，也要向前。」' },
  { id: 2, x: -16, z: 9,   r: 5,   trees: 2, crystal: 0,
    lore: '碑刻残片：「风铃树会唱歌。城里的孩子说，听见歌声就不会迷路。」' },
  { id: 3, x: 33,  z: 7,   r: 6,   crystal: 2, trees: 1,
    lore: '碑刻残片：「双晶矿脉，全城最富的岛。也是第一个被灾鸟盯上的地方。」' },
  { id: 4, x: -33, z: -11, r: 5.5, crystal: 1, trees: 1,
    lore: '碑刻残片：「风暴纪第七年，这座岛倾斜了三天三夜。有人守住了它。」' },
  { id: 5, x: 9,   z: 24,  r: 4.5, trees: 3, crystal: 0,
    lore: '碑刻残片：「这里种满了树。木头的香气能安抚受惊的小精灵。」' },
  { id: 6, x: -9,  z: -27, r: 6,   crystal: 1, trees: 2,
    lore: '碑刻残片：「最远的哨站。守塔人最后一条记录：蚀风鸦王，又来了。」' },
  { id: 7, x: 25,  z: -26, r: 5,   crystal: 1, trees: 1,
    lore: '碑刻残片：「城的东翼。如果它还在，从这里能望见灯塔的光。」' },
]

const coverMat = new THREE.MeshLambertMaterial({ color: 0xd8ccff, transparent: true, opacity: 0.55 })
const islands = []
const interactives = []
for (const def of ISLAND_DEFS) {
  const built = makeIsland(def)
  const isl = {
    def, ...built,
    owned: !!def.home, stability: 100, tilted: false, rescueT: 0,
    sinking: false, sunk: false, sinkT: 0, anchored: false, hasShield: false,
    buildings: [], units: [], abandoned: false, cover: null,
  }
  if (!def.home) {
    const cover = new THREE.Mesh(new THREE.SphereGeometry(def.r * 1.15, 10, 8), coverMat)
    cover.scale.y = 0.7; cover.position.y = 1.5
    built.group.add(cover)
    isl.cover = cover
  }
  scene.add(built.group)
  islands.push(isl)
  interactives.push(built.top)
  for (const c of built.crystals) interactives.push(...c.children)
  for (const tr of built.trees) interactives.push(...tr.children)
}

// ---------- 粒子爆发池 ----------
const bursts = []
function spawnBurst(pos, color, n = 40) {
  const b = makeBurst(color, n)
  b.position.copy(pos)
  scene.add(b)
  bursts.push(b)
}

// ---------- 震屏 ----------
let shakeAmp = 0
function shake(m) { shakeAmp = Math.min(0.6, shakeAmp + m) }

// ---------- 游戏逻辑 ----------
const addInteractive = m => interactives.push(m)
const removeInteractive = m => { const i = interactives.indexOf(m); if (i >= 0) interactives.splice(i, 1) }

const _pv = new THREE.Vector3()
function project(worldPos) {
  _pv.copy(worldPos).project(camera)
  return { x: (_pv.x * 0.5 + 0.5) * innerWidth, y: (-_pv.y * 0.5 + 0.5) * innerHeight }
}

const game = new Game({
  scene, islands, wind, skyMat: sky.material,
  spawnBurst, shake, homeIsland: islands[0],
  addInteractive, removeInteractive, project,
})
const birds = new BirdManager({ scene, camera, game, islands, spawnBurst, addInteractive, removeInteractive })
game.birdMgr = birds
const tutorial = new Tutorial(game, { scene, islands })
game.onEvent = (n, d) => tutorial.onEvent(n, d)

// ---------- 开场阅兵（启程前的阵容展示，启程时撤下）----------
let introOpen = true
const demoUnits = ['worker', 'soldier', 'mechanic'].map((tp, i) => {
  const u = new Unit(tp, islands[0])
  u.demo = true
  u.pos.set(Math.cos(i * 2.1) * 2, Math.sin(i * 2.1) * 2)
  return u
})
// 一只灾鸟在远处未开发岛上盘旋示威（飞走后隔一会儿再来）
const farIsle = islands[3]
let demoBad = null, demoBadT = 0
function spawnDemoBad() {
  const isl = islands[3 + (Math.random() * 3 | 0)]
  const b = new Bird('bifang', new THREE.Vector3(120, 22, 60), isl.group.position.clone(), birds)
  b.island = isl; b.orbitR = isl.def.r + 6; b.attacks = 0
  birds.birds.push(b)
  return b
}
demoBad = spawnDemoBad()
let demoBirdT = 6, gustT = 12, demoGust = false
function spawnDemoGood() {
  const a = Math.random() * Math.PI * 2
  const tp = GOOD_TYPES[Math.floor(Math.random() * GOOD_TYPES.length)]
  const from = new THREE.Vector3(Math.cos(a) * 120, 10 + Math.random() * 10, Math.sin(a) * 120)
  const to = new THREE.Vector3(-Math.cos(a) * 120, 12, -Math.sin(a) * 120)
  birds.birds.push(new Bird(tp, from, to, birds))
}
function clearIntroCast() {
  for (const u of demoUnits) islands[0].group.remove(u.mesh)
  if (demoBad) demoBad.dispose()
  demoUnits.length = 0
}
// 起步班底：2 采集工 + 1 士兵（真实单位，落地就干活）
function spawnStartingUnits() {
  const home = islands[0]
  for (const tp of ['worker', 'worker', 'soldier']) {
    const u = new Unit(tp, home)
    home.units.push(u)
    u.mesh.traverse(m => { if (m.isMesh) addInteractive(m) })
  }
  game.updateHUD()
}

// ---------- 拾取 ----------
const ray = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let downPos = null
renderer.domElement.addEventListener('pointerdown', e => { downPos = [e.clientX, e.clientY] })
renderer.domElement.addEventListener('pointerup', e => {
  if (!downPos) return
  const dx = e.clientX - downPos[0], dy = e.clientY - downPos[1]
  downPos = null
  if (dx * dx + dy * dy > 36) return // 拖拽不算点击
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
  ray.setFromCamera(mouse, camera)
  const inScene = m => { let p = m; while (p) { if (p === scene) return true; p = p.parent } return false }
  const hits = ray.intersectObjects(interactives.filter(inScene), false)
  if (hits.length) {
    const ud = hits[0].object.userData
    if (ud.kind) game.onClick(ud, hits[0].point)
  }
})

// ---------- 主循环 ----------
const clock = new THREE.Clock()
let shakeOffset = new THREE.Vector3()
function loop() {
  requestAnimationFrame(loop)
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  sea.update(t, dt)

  // 开场阅兵更新：单位走位 / 定期吉运鸟 / 周期性远风预告风暴
  if (introOpen) {
    for (const u of demoUnits) u.update(dt, game, t)
    demoBirdT -= dt
    if (demoBirdT <= 0) { demoBirdT = 8 + Math.random() * 5; spawnDemoGood() }
    if (!demoBad || !birds.birds.includes(demoBad)) {
      demoBadT -= dt
      if (demoBadT <= 0) { demoBadT = 18; demoBad = spawnDemoBad() }
    }
    gustT -= dt
    if (gustT <= 0) gustT = 16
    demoGust = gustT < 4.5
    if (demoGust) wind.visible = true
  }

  wind.userData.update(dt, game.state.phase === 'storm' ? 1.6 : 0.4)

  // 天空随风暴变暗（开场远风也轻微压暗）
  let targetDark = game.state.phase === 'storm' ? 0.55 : game.state.phase === 'warning' ? 0.25 : 0
  if (introOpen && demoGust) targetDark = Math.max(targetDark, 0.28)
  sky.material.uniforms.darkness.value += (targetDark - sky.material.uniforms.darkness.value) * dt * 2

  // 建筑宝珠旋转
  for (const isl of islands) for (const b of isl.buildings) if (b.mesh.userData.orb) b.mesh.userData.orb.rotation.y += dt * 2

  // 爆发粒子
  for (let i = bursts.length - 1; i >= 0; i--) {
    if (!bursts[i].userData.update(dt)) { scene.remove(bursts[i]); bursts.splice(i, 1) }
  }

  game.update(dt, t)
  tutorial.update(dt, t)
  birds.update(dt, t)

  // 震屏
  if (shakeAmp > 0.001) {
    shakeOffset.set((Math.random() - 0.5) * shakeAmp, (Math.random() - 0.5) * shakeAmp, (Math.random() - 0.5) * shakeAmp)
    shakeAmp *= Math.pow(0.001, dt)
  } else shakeOffset.set(0, 0, 0)

  controls.update()
  camera.position.add(shakeOffset)
  renderer.render(scene, camera)
  camera.position.sub(shakeOffset)
}
loop()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

// ---------- 开场 ----------
const SLIDES = [
  '云海之上，曾有一座天空之城。\n万岛相连，灯塔夜夜长明。',
  '蚀风之年，风暴撕碎了大陆。\n群岛四散漂流，灯芯盏盏熄灭，灾鸟占据了天空。',
  '你是最后的建造师。\n率领幸存的小精灵——重连群岛，重燃灯芯。\n在灾鸟与风暴的间隙，活下去。',
]
let slideIdx = 0
const slideText = document.getElementById('slide-text')
const slideDots = document.getElementById('slide-dots')
const startBtn = document.getElementById('intro-start')
SLIDES.forEach((_, i) => {
  const d = document.createElement('span')
  if (i === 0) d.className = 'on'
  slideDots.appendChild(d)
})
function renderSlide() {
  slideText.style.opacity = 0
  setTimeout(() => {
    slideText.innerHTML = SLIDES[slideIdx].replace(/\n/g, '<br/>')
    slideText.style.opacity = 1
    slideDots.querySelectorAll('span').forEach((d, i) => d.className = i === slideIdx ? 'on' : '')
  }, 400)
}
startBtn.onclick = () => {
  if (slideIdx < SLIDES.length - 1) { slideIdx++; renderSlide(); return }
  beginGame()
}
const board = JSON.parse(localStorage.getItem('fi_board') || '[]')
if (board.length) document.getElementById('best').innerHTML =
  '积分榜：' + board.slice(0, 3).map((s, i) => `${['🥇','🥈','🥉'][i] || '·'} ${s}`).join('　')
function beginGame() {
  document.getElementById('intro').classList.add('hidden')
  introOpen = false
  clearIntroCast()
  wind.visible = false
  birds.active = true
  spawnStartingUnits()
  controls.enabled = true
  controls.autoRotate = false
  sfx.unlock(); sfx.win()
  game.toast('起步班底已就位：2 名采集工自动干活，1 名士兵巡逻护岛', 'good')
}
// 开场自动旋转展示
controls.autoRotate = true
controls.autoRotateSpeed = 0.8
