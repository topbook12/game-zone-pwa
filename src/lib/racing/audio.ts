/**
 * Procedural Web Audio engine for Turbo Rush.
 * Engine hum, wind noise and arcade SFX — synthesized at runtime, zero audio assets.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engineGain: GainNode | null = null
  private engFilter: BiquadFilterNode | null = null
  private osc1: OscillatorNode | null = null
  private osc2: OscillatorNode | null = null
  private windGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private engineRunning = false
  private muted = false

  /** Must be called from a user gesture. Safe to call repeatedly. */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    try {
      const ctx = new AC()
      this.ctx = ctx

      this.master = ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.6
      this.master.connect(ctx.destination)

      // Shared white-noise buffer (wind, skids, crashes)
      const len = Math.floor(ctx.sampleRate * 1.2)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      this.noiseBuffer = buf

      // Engine: two detuned oscillators through a lowpass
      this.engFilter = ctx.createBiquadFilter()
      this.engFilter.type = 'lowpass'
      this.engFilter.frequency.value = 320

      this.engineGain = ctx.createGain()
      this.engineGain.gain.value = 0
      this.engFilter.connect(this.engineGain)
      this.engineGain.connect(this.master)

      this.osc1 = ctx.createOscillator()
      this.osc1.type = 'sawtooth'
      this.osc1.frequency.value = 55
      this.osc1.connect(this.engFilter)
      this.osc1.start()

      this.osc2 = ctx.createOscillator()
      this.osc2.type = 'square'
      this.osc2.frequency.value = 83
      const g2 = ctx.createGain()
      g2.gain.value = 0.35
      this.osc2.connect(g2)
      g2.connect(this.engFilter)
      this.osc2.start()

      // Wind: looped noise through a bandpass
      const wind = ctx.createBufferSource()
      wind.buffer = buf
      wind.loop = true
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 800
      bp.Q.value = 0.6
      this.windGain = ctx.createGain()
      this.windGain.gain.value = 0
      wind.connect(bp)
      bp.connect(this.windGain)
      this.windGain.connect(this.master)
      wind.start()
    } catch {
      this.ctx = null
    }
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05)
    }
  }

  startEngine(): void {
    if (!this.ctx || !this.engineGain) return
    this.engineRunning = true
    this.engineGain.gain.setTargetAtTime(0.03, this.ctx.currentTime, 0.1)
  }

  stopEngine(): void {
    if (!this.ctx || !this.engineGain || !this.windGain) return
    this.engineRunning = false
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08)
    this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08)
  }

  /** Called every step while driving. */
  updateEngine(speedPercent: number, nitro: boolean): void {
    if (!this.ctx || !this.engineRunning || !this.osc1 || !this.osc2 || !this.engFilter) return
    const t = this.ctx.currentTime
    const f = 52 + speedPercent * 185 + (nitro ? 42 : 0)
    this.osc1.frequency.setTargetAtTime(f, t, 0.06)
    this.osc2.frequency.setTargetAtTime(f * 1.5 + 4, t, 0.06)
    this.engFilter.frequency.setTargetAtTime(240 + speedPercent * 1500, t, 0.08)
    if (this.engineGain) {
      this.engineGain.gain.setTargetAtTime(0.035 + speedPercent * 0.07, t, 0.1)
    }
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(speedPercent * speedPercent * 0.14, t, 0.12)
    }
  }

  blip(freq: number, dur = 0.12, type: OscillatorType = 'square', vol = 0.16): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  checkpoint(): void {
    this.blip(660, 0.1, 'square', 0.16)
    window.setTimeout(() => this.blip(990, 0.16, 'square', 0.16), 95)
  }

  whoosh(): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1600, t)
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.22)
    bp.Q.value = 1.1
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.12, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + 0.26)
  }

  nitroBurst(): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(400, t)
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.4)
    bp.Q.value = 0.9
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.16, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + 0.5)
  }

  crash(): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const t = this.ctx.currentTime

    // Noise burst
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1400, t)
    lp.frequency.exponentialRampToValueAtTime(160, t + 0.32)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    src.connect(lp)
    lp.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + 0.38)

    // Low thump
    const osc = this.ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(130, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.28)
    const og = this.ctx.createGain()
    og.gain.setValueAtTime(0.4, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.connect(og)
    og.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.32)
  }

  gameover(): void {
    this.blip(440, 0.2, 'sawtooth', 0.14)
    window.setTimeout(() => this.blip(330, 0.3, 'sawtooth', 0.14), 190)
  }
}
