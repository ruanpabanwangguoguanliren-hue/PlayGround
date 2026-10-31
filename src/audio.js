const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]

export class ForestAudio {
  constructor() {
    this.ctx = null
    this.enabled = false
    this.master = null
    this.windGain = null
    this.waterGain = null
    this.nightGain = null
    this.birdTimer = null
    this.cricketTimer = null
    this.preset = 'dawn'
    this.chimeIndex = 0
  }

  async enable() {
    if (this.enabled) return true
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return false
      if (!this.ctx) this.build(new AudioContextClass())
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      this.enabled = true
      this.master.gain.cancelScheduledValues(this.ctx.currentTime)
      this.master.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.4)
      this.scheduleBirds()
      this.scheduleCrickets()
      this.applyPreset()
      return true
    } catch {
      this.enabled = false
      return false
    }
  }

  disable() {
    if (!this.ctx) return
    this.enabled = false
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25)
    clearTimeout(this.birdTimer)
    clearTimeout(this.cricketTimer)
  }

  build(ctx) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)

    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
    const data = noise.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }

    const wind = ctx.createBufferSource()
    wind.buffer = noise
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 480
    windFilter.Q.value = 0.5
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0.1
    wind.connect(windFilter).connect(this.windGain).connect(this.master)
    wind.start()

    const windLfo = ctx.createOscillator()
    windLfo.frequency.value = 0.09
    const windLfoGain = ctx.createGain()
    windLfoGain.gain.value = 0.045
    windLfo.connect(windLfoGain).connect(this.windGain.gain)
    windLfo.start()

    const water = ctx.createBufferSource()
    water.buffer = noise
    water.loop = true
    const waterFilter = ctx.createBiquadFilter()
    waterFilter.type = 'bandpass'
    waterFilter.frequency.value = 1250
    waterFilter.Q.value = 0.7
    this.waterGain = ctx.createGain()
    this.waterGain.gain.value = 0.035
    water.connect(waterFilter).connect(this.waterGain).connect(this.master)
    water.start()

    const waterLfo = ctx.createOscillator()
    waterLfo.frequency.value = 0.23
    const waterLfoGain = ctx.createGain()
    waterLfoGain.gain.value = 0.014
    waterLfo.connect(waterLfoGain).connect(this.waterGain.gain)
    waterLfo.start()

    this.nightGain = ctx.createGain()
    this.nightGain.gain.value = 0
    this.nightGain.connect(this.master)
  }

  applyPreset() {
    if (!this.ctx || !this.windGain) return
    const now = this.ctx.currentTime
    const wind = { dawn: 0.11, day: 0.075, dusk: 0.09, night: 0.055 }[this.preset] || 0.09
    this.windGain.gain.setTargetAtTime(wind, now, 1.5)
    const night = this.preset === 'night' ? 0.16 : this.preset === 'dusk' ? 0.05 : 0
    this.nightGain.gain.setTargetAtTime(night, now, 1.5)
  }

  setPreset(name) {
    this.preset = name
    this.applyPreset()
  }

  scheduleBirds() {
    clearTimeout(this.birdTimer)
    if (!this.enabled) return
    const delay = 1800 + Math.random() * 4200
    this.birdTimer = setTimeout(() => {
      if (this.enabled && this.preset !== 'night') this.bird()
      this.scheduleBirds()
    }, delay)
  }

  scheduleCrickets() {
    clearTimeout(this.cricketTimer)
    if (!this.enabled) return
    const delay = 500 + Math.random() * 900
    this.cricketTimer = setTimeout(() => {
      if (this.enabled && (this.preset === 'night' || this.preset === 'dusk')) this.cricket()
      this.scheduleCrickets()
    }, delay)
  }

  bird() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const notes = 2 + Math.floor(Math.random() * 3)
    const base = 1900 + Math.random() * 700
    for (let i = 0; i < notes; i++) {
      const start = now + i * (0.09 + Math.random() * 0.06)
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.25), start)
      osc.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.35), start + 0.055)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.028, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11)
      osc.connect(gain).connect(this.master)
      osc.start(start)
      osc.stop(start + 0.13)
    }
  }

  cricket() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const tremolo = this.ctx.createOscillator()
    const tremoloGain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 3800 + Math.random() * 700
    gain.gain.value = 0.0001
    tremolo.frequency.value = 26 + Math.random() * 12
    tremoloGain.gain.value = 0.03
    tremolo.connect(tremoloGain).connect(gain.gain)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.04, now + 0.05)
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.35)
    osc.connect(gain).connect(this.nightGain)
    osc.start(now)
    tremolo.start(now)
    osc.stop(now + 0.4)
    tremolo.stop(now + 0.4)
  }

  chime() {
    if (!this.enabled || !this.ctx) return
    const now = this.ctx.currentTime
    const base = PENTATONIC[this.chimeIndex % PENTATONIC.length]
    this.chimeIndex++
    const frequencies = [base, base * 1.5]
    frequencies.forEach((frequency, i) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = i === 0 ? 'sine' : 'triangle'
      osc.frequency.value = frequency
      const start = now + i * 0.03
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.075 : 0.022, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.5)
      osc.connect(gain).connect(this.master)
      osc.start(start)
      osc.stop(start + 1.6)
    })
  }

  plop() {
    if (!this.enabled || !this.ctx) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(420, now)
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18)
    gain.gain.setValueAtTime(0.045, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
    osc.connect(gain).connect(this.master)
    osc.start(now)
    osc.stop(now + 0.32)
  }
}
