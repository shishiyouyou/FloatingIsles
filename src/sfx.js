// 极简 WebAudio 合成音效——无需任何音频资源
let ctx = null
let stormNoise = null

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, dur = 0.15, type = 'sine', gain = 0.12, slide = 0) {
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain()
    o.type = type; o.frequency.value = freq
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur)
    g.gain.setValueAtTime(gain, a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
    o.connect(g); g.connect(a.destination)
    o.start(); o.stop(a.currentTime + dur)
  } catch (e) { /* 音频不可用时静默 */ }
}

function noiseBurst(dur = 0.3, gain = 0.15, freq = 800) {
  try {
    const a = ac()
    const len = Math.floor(a.sampleRate * dur)
    const buf = a.createBuffer(1, len, a.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = a.createBufferSource(); src.buffer = buf
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq
    const g = a.createGain(); g.gain.value = gain
    src.connect(f); f.connect(g); g.connect(a.destination); src.start()
  } catch (e) {}
}

export const sfx = {
  unlock() { ac() },
  collect(step = 0) { // 上行音阶，连采越高
    const scale = [523, 587, 659, 698, 784, 880, 988, 1047]
    tone(scale[Math.min(step, scale.length - 1)], 0.18, 'sine', 0.14)
  },
  wood() { tone(340, 0.09, 'triangle', 0.12, -60) },
  build() { tone(220, 0.16, 'triangle', 0.13); setTimeout(() => tone(330, 0.16, 'triangle', 0.1), 80) },
  scatter() { noiseBurst(0.35, 0.2, 2400); tone(500, 0.3, 'sawtooth', 0.05, -380) },
  rescue() { tone(392, 0.12, 'sine', 0.14); setTimeout(() => tone(523, 0.14, 'sine', 0.13), 70); setTimeout(() => tone(659, 0.2, 'sine', 0.12), 140) },
  sink() { tone(90, 1.4, 'sine', 0.3, -55); noiseBurst(0.9, 0.12, 300) },
  warn() { tone(196, 0.5, 'sine', 0.1); setTimeout(() => tone(185, 0.6, 'sine', 0.1), 550) },
  stormStart() { noiseBurst(1.2, 0.18, 500) },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.13), i * 120)) },
  setStorm(on) {
    try {
      const a = ac()
      if (on && !stormNoise) {
        const len = a.sampleRate * 2
        const buf = a.createBuffer(1, len, a.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
        const src = a.createBufferSource(); src.buffer = buf; src.loop = true
        const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 0.6
        const g = a.createGain(); g.gain.value = 0
        g.gain.linearRampToValueAtTime(0.07, a.currentTime + 2)
        src.connect(f); f.connect(g); g.connect(a.destination); src.start()
        stormNoise = { src, g }
      } else if (!on && stormNoise) {
        stormNoise.g.gain.linearRampToValueAtTime(0, a.currentTime + 1.5)
        const s = stormNoise; stormNoise = null
        setTimeout(() => { try { s.src.stop() } catch (e) {} }, 2000)
      }
    } catch (e) {}
  },
}
