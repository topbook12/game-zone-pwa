/**
 * Turbo Rush — pseudo-3D arcade racing engine (Outrun-style segment renderer).
 * Fixed-timestep simulation + canvas projection renderer with curves, hills,
 * traffic AI, checkpoints, nitro, particles, camera shake and a parallax sunset.
 */
import type { CarCosmetics, EngineOptions, GamePhase, HudData, InputState } from './types'
import type { SoundEngine } from './audio'
import { mulberry32 } from '@/lib/daily'
import {
  createPlayerCar,
  createSpriteAssets,
  type PlayerCarImages,
  type SpriteAssets,
} from './sprites'

/* ------------------------- tuning ------------------------- */
const STEP = 1 / 60
const SEG_LEN = 200
const RUMBLE_LEN = 3
const ROAD_W = 2200
const LANES = 3
const FOV = 100
const CAM_H = 1150
const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180)
const PLAYER_Z = CAM_H * CAM_DEPTH
const DRAW_DIST = 240
const FOG_DENSITY = 4.2
const MAX_SPEED = SEG_LEN * 60
const NITRO_MULT = 1.28
const ACCEL = MAX_SPEED / 4.5
const BRAKING = -MAX_SPEED / 1.55
const DECEL = -MAX_SPEED / 6
const OFF_DECEL = -MAX_SPEED / 1.7
const OFF_LIMIT = MAX_SPEED / 3.2
const CENTRIFUGAL = 0.31
const PLAYER_W = 0.31
const CAR_W = 0.29
const KMH = 0.012
const START_TIME = 60
const CP_SEGS = 400
const CP_INTERVAL = CP_SEGS * SEG_LEN
const CP_BONUS = 24
const TRACK_SEGS = 1600
const METERS_PER_UNIT = 1 / 300
const TILT_DEADZONE = 0.12

/* ------------------------- colors ------------------------- */
const COLORS = {
  light: { road: '#6d6d6d', grass: '#cfa76b', rumble: '#f5f1e3', lane: '#f0ead6' },
  dark: { road: '#666666', grass: '#c39a5f', rumble: '#d84f45', lane: '#c9c2ad' },
  start: { road: '#e8e4da', grass: '#cfa76b', rumble: '#e8e4da', lane: '#c9c2ad' },
  cp: { road: '#616161', grass: '#cfa76b', rumble: '#e76f51', lane: '#c9c2ad' },
} as const
type ColorKey = keyof typeof COLORS
const FOG_COLOR = '#ffe3b8'
const FOG_RGB: [number, number, number] = [255, 227, 184]

/* ------------------------- internal types ------------------------- */
interface Point {
  world: { x: number; y: number; z: number }
  camera: { x: number; y: number; z: number }
  screen: { x: number; y: number; w: number; scale: number }
}

interface SegSprite {
  key: string
  offset: number
}

interface Segment {
  index: number
  p1: Point
  p2: Point
  curve: number
  colorKey: ColorKey
  sprites: SegSprite[]
  cars: TrafficCar[]
  clip: number
  fog: number
  looped: boolean
}

interface TrafficCar {
  offset: number
  z: number
  speed: number
  key: string
  prevDiff: number
  drift: number
  aiT: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  grav: number
}

interface Cloud {
  fx: number
  fy: number
  s: number
  spd: number
  par: number
}

/* ------------------------- helpers ------------------------- */
function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
function wrap(v: number, max: number): number {
  return ((v % max) + max) % max
}
function easeIn(a: number, b: number, p: number): number {
  return a + (b - a) * p * p
}
function easeInOut(a: number, b: number, p: number): number {
  return a + (b - a) * (0.5 - Math.cos(p * Math.PI) / 2)
}
function fogFactor(p: number, density: number): number {
  return 1 / Math.exp(p * p * density)
}
function overlap(x1: number, w1: number, x2: number, w2: number): boolean {
  return Math.abs(x1 - x2) < ((w1 + w2) / 2) * 0.85
}
function poly(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  x4: number, y4: number,
  color: string
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}
function makePoint(y: number, z: number): Point {
  return {
    world: { x: 0, y, z },
    camera: { x: 0, y: 0, z: 0 },
    screen: { x: 0, y: 0, w: 0, scale: 0 },
  }
}
function project(p: Point, camX: number, camY: number, camZ: number, width: number, height: number): void {
  p.camera.x = p.world.x - camX
  p.camera.y = p.world.y - camY
  p.camera.z = p.world.z - camZ
  const scale = CAM_DEPTH / p.camera.z
  p.screen.scale = scale
  p.screen.x = Math.round(width / 2 + (scale * p.camera.x * width) / 2)
  p.screen.y = Math.round(height / 2 - (scale * p.camera.y * height) / 2)
  p.screen.w = Math.round((scale * ROAD_W * width) / 2)
}

/* ------------------------- engine ------------------------- */
export class RacingEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private opts: EngineOptions
  private sound: SoundEngine

  W = 0
  H = 0
  private raf = 0
  private lastT = 0
  private acc = 0
  private phase: GamePhase = 'menu'
  private prevPhase: GamePhase = 'menu'

  private segments: Segment[] = []
  private trackLength = 0
  private cars: TrafficCar[] = []
  private assets: SpriteAssets = {}
  private playerImgs: PlayerCarImages | null = null

  position = 0
  playerX = 0
  speed = 0
  time = START_TIME
  score = 0
  overtakes = 0
  nitro = 0.5
  nitroActive = false
  topSpeed = 0
  totalDist = 0
  autoGas = false
  input: InputState = { left: false, right: false, gas: false, brake: false, nitro: false, steerAnalog: 0 }
  /** +0.6 nitro armed from a rewarded ad — consumed at the next startGame. */
  private pendingNitroBonus = 0
  /** Equipped cosmetics (Phase 4): paint color + exhaust trail. */
  private carColor = '#d92328'
  private trail: CarCosmetics['trail'] = null

  private nextCp = CP_INTERVAL
  private countdownT = 0
  private lastCount = -1
  private steerSmooth = 0
  private offRoad = false
  private crashCd = 0
  private shakeT = 0
  private shakeMag = 0
  private crashFlash = 0
  private timeAbs = 0
  private bgShift = 0
  private particles: Particle[] = []
  private clouds: Cloud[] = []
  private stars: { fx: number; fy: number; s: number; tw: number; ph: number }[] = []
  private skyline: { x: number; w: number; h: number; ant: boolean }[] = []
  private birds: { fx: number; fy: number; spd: number; ph: number }[] = []
  private rng: () => number = Math.random
  /** When set (daily challenge), every run rebuilds the SAME seeded circuit. */
  dailySeed: number | null = null
  private skyGrad: CanvasGradient | null = null
  private vignette: CanvasGradient | null = null
  /** Draw distance + particle budget shrink on small/low-power screens. */
  private drawDist = DRAW_DIST
  private maxParticles = 240
  /* Adaptive quality: if a device can't hold the frame rate, the loop steps
     this down (draw distance, DPR, particles) until it can — a slow phone
     degrades gracefully instead of turning into a slideshow. */
  private quality = 1
  private fpsEma = 0
  private qualityCd = 0
  private baseDraw = DRAW_DIST
  private baseDprCap = 1.75
  private baseParticles = 240

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions, sound: SoundEngine) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.opts = opts
    this.sound = sound
    this.clouds = Array.from({ length: 6 }, () => ({
      fx: Math.random(),
      fy: 0.05 + Math.random() * 0.24,
      s: 0.7 + Math.random() * 0.9,
      spd: 2 + Math.random() * 5,
      par: 0.03 + Math.random() * 0.05,
    }))
    // stars (upper sky, twinkle)
    this.stars = Array.from({ length: 64 }, () => ({
      fx: Math.random(),
      fy: Math.random() * 0.34,
      s: 0.5 + Math.random() * 1.4,
      tw: 0.6 + Math.random() * 2.4,
      ph: Math.random() * Math.PI * 2,
    }))
    // distant city skyline silhouette
    let sx = -0.05
    while (sx < 1.1) {
      const w = 0.018 + Math.random() * 0.042
      this.skyline.push({
        x: sx,
        w,
        h: 0.02 + Math.random() * 0.075,
        ant: Math.random() < 0.28,
      })
      sx += w + 0.006 + Math.random() * 0.02
    }
    // lazy birds drifting across the sky
    this.birds = Array.from({ length: 3 }, (_, i) => ({
      fx: Math.random(),
      fy: 0.08 + Math.random() * 0.16,
      spd: 8 + Math.random() * 10,
      ph: i * 2.1,
    }))
  }

  boot(): void {
    this.assets = createSpriteAssets()
    this.playerImgs = createPlayerCar(this.carColor)
    this.buildWorld(1)
    this.resize()
    this.toMenu()
  }

  /** Rebuild track + scenery + traffic from a seed (deterministic per seed). */
  private buildWorld(seed: number): void {
    this.rng = mulberry32(seed)
    this.buildTrack()
    this.decorate()
    this.seedCars()
  }

  /** Apply cosmetics: repaint the player car + set the exhaust trail. */
  setCosmetics(spec: CarCosmetics): void {
    if (spec.carColor && spec.carColor !== this.carColor) {
      this.carColor = spec.carColor
      if (this.playerImgs) this.playerImgs = createPlayerCar(this.carColor)
    }
    this.trail = spec.trail ?? null
  }

  /** Arm the rewarded-ad nitro bonus (applied at the next race start). */
  armNitroBonus(): void {
    this.pendingNitroBonus = 0.6
  }

  /** Set the daily-challenge seed (or null for a fresh random circuit each run). */
  setDaily(seed: number | null): void {
    this.dailySeed = seed
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    /* Mobile budget: narrow viewports render fewer segments at a slightly lower
       resolution — keeps 60fps within reach on budget phones, full detail on desktop. */
    const small = w < 640
    this.baseDprCap = small ? 1.5 : 1.75
    this.baseDraw = small ? 150 : DRAW_DIST
    this.baseParticles = small ? 140 : 240
    const dpr = Math.min(this.baseDprCap * this.quality, window.devicePixelRatio || 1)
    this.drawDist = Math.max(70, Math.round(this.baseDraw * this.quality))
    this.maxParticles = Math.round(this.baseParticles * this.quality)
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.W = w
    this.H = h
    if (this.ctx) {
      const g = this.ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#e0714a')
      g.addColorStop(0.4, '#f2a25c')
      g.addColorStop(0.72, '#ffd9a0')
      g.addColorStop(1, '#ffe9c4')
      this.skyGrad = g
      const v = this.ctx.createRadialGradient(
        w / 2, h * 0.42, Math.min(w, h) * 0.36,
        w / 2, h * 0.5, Math.max(w, h) * 0.78
      )
      v.addColorStop(0, 'rgba(24,10,4,0)')
      v.addColorStop(1, 'rgba(24,10,4,0.42)')
      this.vignette = v
    }
  }

  /* --------------- lifecycle --------------- */

  startGame(): void {
    const seed = this.dailySeed ?? ((Math.random() * 0xffffffff) >>> 0)
    this.buildWorld(seed)
    this.resetRun()
    if (this.pendingNitroBonus > 0) {
      this.nitro = Math.min(1, this.nitro + this.pendingNitroBonus)
      this.pendingNitroBonus = 0
    }
    this.phase = 'countdown'
    this.countdownT = 3.0
    this.lastCount = -1
    this.opts.onPhase?.('countdown')
    this.startLoop()
  }

  pause(): void {
    if (this.phase === 'playing' || this.phase === 'countdown') {
      this.prevPhase = this.phase
      this.phase = 'paused'
      this.opts.onPhase?.('paused')
      this.stopLoop()
      this.sound.stopEngine()
    }
  }

  resume(): void {
    if (this.phase === 'paused') {
      this.phase = this.prevPhase
      this.opts.onPhase?.(this.phase)
      this.lastT = 0
      this.startLoop()
    }
  }

  toMenu(): void {
    this.resetRun()
    this.speed = MAX_SPEED * 0.5
    this.phase = 'menu'
    this.opts.onPhase?.('menu')
    this.startLoop()
  }

  shutdown(): void {
    this.stopLoop()
  }

  private resetRun(): void {
    this.position = 0
    this.playerX = 0
    this.speed = 0
    this.time = START_TIME
    this.score = 0
    this.overtakes = 0
    this.nitro = 0.5
    this.nitroActive = false
    this.topSpeed = 0
    this.totalDist = 0
    this.nextCp = CP_INTERVAL
    this.steerSmooth = 0
    this.offRoad = false
    this.crashCd = 0
    this.shakeT = 0
    this.crashFlash = 0
    this.particles = []
    this.input.steerAnalog = 0
    this.seedCars()
    this.sound.stopEngine()
  }

  private startLoop(): void {
    if (!this.raf) {
      this.lastT = 0
      this.acc = 0
      this.raf = requestAnimationFrame(this.loop)
    }
  }

  private stopLoop(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
  }

  private loop = (t: number): void => {
    this.raf = requestAnimationFrame(this.loop)
    if (!this.lastT) this.lastT = t
    let frameDt = (t - this.lastT) / 1000
    this.lastT = t
    if (frameDt > 0.1) frameDt = 0.1

    /* Adaptive quality governor — step down while avg fps < 36 (min 3s apart). */
    const inst = 1 / Math.max(frameDt, 1e-3)
    this.fpsEma = this.fpsEma > 0 ? this.fpsEma * 0.95 + inst * 0.05 : inst
    this.qualityCd -= frameDt
    if (this.qualityCd <= 0 && this.fpsEma < 36 && this.quality > 0.42) {
      this.quality = Math.max(0.42, this.quality - 0.18)
      this.qualityCd = 3
      this.resize()
    }

    this.acc += frameDt
    while (this.acc >= STEP) {
      this.step(STEP)
      this.acc -= STEP
    }
    this.render()
    if (this.phase !== 'menu' && this.phase !== 'paused') {
      this.opts.onFrame?.(this.hud())
    }
  }

  private step(dt: number): void {
    switch (this.phase) {
      case 'menu':
        this.attractStep(dt)
        break
      case 'countdown':
        this.countdownStep(dt)
        break
      case 'playing':
        this.playStep(dt)
        break
      case 'gameover':
        this.coastStep(dt)
        break
      default:
        break
    }
  }

  /* --------------- simulation steps --------------- */

  private attractStep(dt: number): void {
    this.timeAbs += dt
    const pSeg = this.findSegment(this.position + PLAYER_Z)
    this.speed += (MAX_SPEED * 0.5 - this.speed) * Math.min(1, dt * 0.7)
    this.position = wrap(this.position + this.speed * dt, this.trackLength)
    const targetX = clamp(-pSeg.curve * 0.12, -0.8, 0.8)
    this.playerX += (targetX - this.playerX) * Math.min(1, dt * 1.4)
    this.bgShift += pSeg.curve * (this.speed / MAX_SPEED) * dt * 55
    this.updateCars(dt, false)
    this.updateParticles(dt)
    this.bucketCars()
  }

  private countdownStep(dt: number): void {
    this.timeAbs += dt
    this.updateParticles(dt)
    this.bucketCars()
    this.decayFx(dt)
    this.countdownT -= dt
    const n = Math.ceil(this.countdownT)
    if (n !== this.lastCount && n > 0) {
      this.lastCount = n
      this.opts.onEvent?.({ type: 'countdown', value: n })
      this.sound.blip(540, 0.12)
    }
    if (this.countdownT <= 0) {
      this.phase = 'playing'
      this.opts.onPhase?.('playing')
      this.opts.onEvent?.({ type: 'countdown', value: 0 })
      this.sound.blip(880, 0.5, 'square', 0.22)
      this.sound.startEngine()
    }
  }

  private playStep(dt: number): void {
    const pSeg = this.findSegment(this.position + PLAYER_Z)
    const spct = this.speed / MAX_SPEED
    const dx = dt * 2.3 * spct

    this.position = wrap(this.position + this.speed * dt, this.trackLength)
    this.totalDist += this.speed * dt

    // steering + centrifugal force (analog tilt/drag wins over buttons)
    const analog = this.input.steerAnalog
    const steerIn =
      Math.abs(analog) > TILT_DEADZONE
        ? analog
        : (this.input.left ? -1 : 0) + (this.input.right ? 1 : 0)
    this.steerSmooth += (steerIn - this.steerSmooth) * Math.min(1, dt * 9)
    this.playerX += steerIn * dx
    this.playerX -= dx * spct * pSeg.curve * CENTRIFUGAL

    // nitro
    const wantNitro = this.input.nitro && this.nitro > 0.02 && !this.input.brake
    if (wantNitro && !this.nitroActive) {
      this.opts.onEvent?.({ type: 'nitrostart' })
      this.sound.nitroBurst()
    }
    this.nitroActive = wantNitro
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - dt * 0.3)

    // throttle
    const gas = this.input.gas || (this.autoGas && !this.input.brake)
    if (this.input.brake) this.speed += BRAKING * dt
    else if (gas && this.nitroActive) this.speed += ACCEL * 1.5 * dt
    else if (gas) this.speed += (this.speed > MAX_SPEED ? DECEL * 1.4 : ACCEL) * dt
    else this.speed += DECEL * dt

    const cap = this.nitroActive ? MAX_SPEED * NITRO_MULT : MAX_SPEED
    if (this.speed > cap) this.speed = Math.max(cap, this.speed - MAX_SPEED * 0.6 * dt)
    if (this.speed < 0) this.speed = 0

    // off-road
    this.offRoad = Math.abs(this.playerX) > 1.02
    if (this.offRoad) {
      if (this.speed > OFF_LIMIT) this.speed += OFF_DECEL * dt
      this.spawnDust()
    }
    this.spawnTrail()
    this.playerX = clamp(this.playerX, -2.4, 2.4)

    // roadside collisions
    if (this.crashCd <= 0) {
      for (const spr of pSeg.sprites) {
        const asset = this.assets[spr.key]
        if (!asset || asset.collide === undefined) continue
        if (overlap(this.playerX, PLAYER_W, spr.offset, asset.collide)) {
          this.hardCrash()
          break
        }
      }
    }

    // traffic collisions
    if (this.crashCd <= 0) {
      for (const car of pSeg.cars) {
        if (this.speed > car.speed && overlap(this.playerX, PLAYER_W, car.offset, CAR_W)) {
          this.softCrash(car)
          break
        }
      }
    }
    this.crashCd = Math.max(0, this.crashCd - dt)

    // traffic + overtakes
    this.updateCars(dt, true)
    this.bgShift += pSeg.curve * spct * dt * 55

    // checkpoints
    while (this.totalDist >= this.nextCp) {
      this.time += CP_BONUS
      this.score += 500
      this.nextCp += CP_INTERVAL
      this.opts.onEvent?.({ type: 'checkpoint', bonus: CP_BONUS })
      this.sound.checkpoint()
    }

    // score & time
    this.score += dt * (40 + 150 * spct)
    this.topSpeed = Math.max(this.topSpeed, this.speed)
    this.time -= dt
    if (this.time <= 0) {
      this.time = 0
      this.endGame()
    }

    this.sound.updateEngine(spct, this.nitroActive)
    this.timeAbs += dt
    this.updateParticles(dt)
    this.bucketCars()
    this.decayFx(dt)
  }

  private coastStep(dt: number): void {
    this.timeAbs += dt
    this.speed = Math.max(0, this.speed + DECEL * 2 * dt)
    this.position = wrap(this.position + this.speed * dt, this.trackLength)
    this.updateCars(dt, false)
    this.updateParticles(dt)
    this.bucketCars()
    this.decayFx(dt)
  }

  private decayFx(dt: number): void {
    this.shakeT = Math.max(0, this.shakeT - dt)
    this.crashFlash = Math.max(0, this.crashFlash - dt * 1.6)
  }

  private updateCars(dt: number, countOvertakes: boolean): void {
    const playerAbs = wrap(this.position + PLAYER_Z, this.trackLength)
    for (const car of this.cars) {
      car.z = wrap(car.z + car.speed * dt, this.trackLength)
      car.aiT -= dt
      if (car.aiT <= 0) {
        car.aiT = 2 + Math.random() * 3
        car.drift = (Math.random() - 0.5) * 0.4
      }
      car.offset = clamp(car.offset + car.drift * dt * 0.35, -0.85, 0.85)
      if (countOvertakes) {
        let diff = car.z - playerAbs
        if (diff > this.trackLength / 2) diff -= this.trackLength
        if (diff < -this.trackLength / 2) diff += this.trackLength
        if (
          car.prevDiff > 0 &&
          diff <= 0 &&
          Math.abs(car.prevDiff) < 3000 &&
          Math.abs(diff) < 3000
        ) {
          this.overtakes += 1
          this.score += 150
          this.nitro = Math.min(1, this.nitro + 0.07)
          this.opts.onEvent?.({ type: 'overtake' })
          this.sound.whoosh()
        }
        car.prevDiff = diff
      }
    }
  }

  private bucketCars(): void {
    for (const seg of this.segments) seg.cars.length = 0
    for (const car of this.cars) {
      this.findSegment(car.z).cars.push(car)
    }
  }

  /* --------------- crashes --------------- */

  private hardCrash(): void {
    this.speed = Math.min(this.speed, MAX_SPEED * 0.12)
    this.shakeT = 0.9
    this.shakeMag = 26
    this.crashFlash = 0.85
    this.crashCd = 1.2
    this.spawnSparks(22)
    this.sound.crash()
    this.opts.onEvent?.({ type: 'crash' })
  }

  private softCrash(car: TrafficCar): void {
    this.speed = Math.min(this.speed, car.speed * 0.55)
    this.shakeT = 0.5
    this.shakeMag = 15
    this.crashFlash = 0.55
    this.crashCd = 0.9
    this.spawnSparks(12)
    this.sound.crash()
    this.opts.onEvent?.({ type: 'crash' })
  }

  private endGame(): void {
    this.phase = 'gameover'
    this.opts.onPhase?.('gameover')
    this.opts.onEvent?.({
      type: 'gameover',
      result: {
        score: Math.floor(this.score),
        distanceKm: (this.totalDist * METERS_PER_UNIT) / 1000,
        overtakes: this.overtakes,
        topSpeedKmh: this.topSpeed * KMH,
      },
    })
    this.sound.stopEngine()
    this.sound.gameover()
  }

  /* --------------- particles --------------- */

  private spawnDust(): void {
    const carW = this.playerCarW()
    const by = this.H - 14
    for (let i = 0; i < 2; i++) {
      const side = Math.random() < 0.5 ? -1 : 1
      this.particles.push({
        x: this.W / 2 + side * carW * (0.35 + Math.random() * 0.15),
        y: by - Math.random() * 10,
        vx: side * (40 + Math.random() * 90),
        vy: -(40 + Math.random() * 90),
        life: 0.45 + Math.random() * 0.35,
        max: 0.8,
        size: 3 + Math.random() * 5,
        color: Math.random() < 0.5 ? '#d7b487' : '#b98d5f',
        grav: 160,
      })
    }
  }

  /** Equipped cosmetic trail — streams from the exhausts while driving. */
  private spawnTrail(): void {
    const trail = this.trail
    if (!trail || this.speed < MAX_SPEED * 0.25) return
    const carW = this.playerCarW()
    const by = this.H - 16
    for (const side of [-1, 1]) {
      if (Math.random() > 0.75) continue
      this.particles.push({
        x: this.W / 2 + side * carW * 0.3,
        y: by,
        vx: side * (10 + Math.random() * 30),
        vy: 50 + Math.random() * 60,
        life: 0.3 + Math.random() * 0.3,
        max: 0.6,
        size: 2 + Math.random() * 3.5,
        color: trail.rainbow
          ? `hsl(${Math.floor((this.timeAbs * 220 + (side > 0 ? 40 : 0)) % 360)}, 95%, 62%)`
          : trail.color,
        grav: -40,
      })
    }
  }

  private spawnSparks(n: number): void {
    const palette = ['#ffd166', '#ff9f1c', '#ff5d40', '#fff3d6']
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: this.W / 2 + (Math.random() - 0.5) * 44,
        y: this.H - 30 - Math.random() * 26,
        vx: (Math.random() - 0.5) * 440,
        vy: -(60 + Math.random() * 280),
        life: 0.3 + Math.random() * 0.35,
        max: 0.65,
        size: 1.5 + Math.random() * 2.5,
        color: palette[Math.floor(Math.random() * palette.length)],
        grav: 640,
      })
    }
  }

  private updateParticles(dt: number): void {
    const arr = this.particles
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.grav * dt
      p.life -= dt
      if (p.life <= 0) {
        arr[i] = arr[arr.length - 1]
        arr.pop()
      }
    }
    while (arr.length > this.maxParticles) arr.shift()
  }

  private playerCarW(): number {
    const scale = CAM_DEPTH / PLAYER_Z
    return Math.min(scale * 660 * (this.W / 2), this.H * 0.46)
  }

  /* --------------- track --------------- */

  private lastY(): number {
    return this.segments.length === 0
      ? 0
      : this.segments[this.segments.length - 1].p2.world.y
  }

  private addSegment(curve: number, y: number): void {
    const n = this.segments.length
    let colorKey: ColorKey = Math.floor(n / RUMBLE_LEN) % 2 === 0 ? 'light' : 'dark'
    if (n < 8) colorKey = 'start'
    else if (n % CP_SEGS < 4) colorKey = 'cp'
    this.segments.push({
      index: n,
      p1: makePoint(this.lastY(), n * SEG_LEN),
      p2: makePoint(y, (n + 1) * SEG_LEN),
      curve,
      colorKey,
      sprites: [],
      cars: [],
      clip: 0,
      fog: 0,
      looped: false,
    })
  }

  private addRoad(enter: number, hold: number, leave: number, curve: number, y: number): void {
    const startY = this.lastY()
    const endY = startY + y * SEG_LEN
    const total = enter + hold + leave
    for (let i = 0; i < enter; i++) {
      this.addSegment(easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total))
    }
    for (let i = 0; i < hold; i++) {
      this.addSegment(curve, easeInOut(startY, endY, (enter + i) / total))
    }
    for (let i = 0; i < leave; i++) {
      this.addSegment(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (enter + hold + i) / total))
    }
  }

  private addStraight(n: number): void {
    const a = Math.floor(n / 3)
    this.addRoad(a, n - 2 * a, a, 0, 0)
  }

  private buildTrack(): void {
    this.segments = []
    const rng = this.rng
    this.addStraight(50)
    const target = TRACK_SEGS - 80
    while (this.segments.length < target) {
      const roll = rng()
      const len = 24 + Math.floor(rng() * 36)
      const a = Math.max(4, Math.floor(len / 3))
      if (roll < 0.2) {
        this.addStraight(len)
      } else if (roll < 0.44) {
        // sweeping curve, maybe with elevation
        const dir = rng() < 0.5 ? -1 : 1
        this.addRoad(a, len, a, dir * (2 + rng() * 4), (rng() - 0.4) * 70)
      } else if (roll < 0.6) {
        // S-curve combo
        const dir = rng() < 0.5 ? -1 : 1
        const c = 2 + rng() * 4
        this.addRoad(a, len, a, dir * c, 0)
        this.addRoad(a, len, a, -dir * c, (rng() - 0.3) * 50)
      } else if (roll < 0.76) {
        // hills / rollers
        this.addRoad(a, len, a, 0, (rng() - 0.5) * 130)
      } else if (roll < 0.9) {
        // hard hairpin-ish bend
        const dir = rng() < 0.5 ? -1 : 1
        this.addRoad(Math.max(4, a - 6), Math.max(8, len - 10), Math.max(4, a - 6), dir * (4 + rng() * 2.5), 0)
      } else {
        this.addStraight(len)
      }
    }
    // pad to exactly TRACK_SEGS so checkpoints align every lap
    while (this.segments.length < TRACK_SEGS) this.addStraight(Math.min(60, TRACK_SEGS - this.segments.length))
    this.segments.length = TRACK_SEGS
    this.trackLength = this.segments.length * SEG_LEN
  }

  private seg(n: number): Segment {
    return this.segments[n]
  }

  private decorate(): void {
    this.seg(12).sprites.push({ key: 'gantryStart', offset: 0 })
    for (let n = CP_SEGS; n < TRACK_SEGS; n += CP_SEGS) {
      this.seg(n).sprites.push({ key: 'gantryCp', offset: 0 })
    }
    // palms + bushes
    let n = 18
    while (n < TRACK_SEGS - 10) {
      const side = this.rng() < 0.5 ? -1 : 1
      this.seg(n).sprites.push({
        key: this.rng() < 0.5 ? 'palmA' : 'palmB',
        offset: side * (1.8 + this.rng() * 2.8),
      })
      if (this.rng() < 0.4) {
        this.seg(n).sprites.push({ key: 'bush', offset: -side * (1.4 + this.rng() * 2.5) })
      }
      n += 10 + Math.floor(this.rng() * 14)
    }
    // billboards
    const boardSegs = [80, 210, 460, 700, 940, 1180, 1420]
    boardSegs.forEach((s, i) => {
      this.seg(s).sprites.push({ key: `board${i % 4}`, offset: (i % 2 === 0 ? -1 : 1) * 2.0 })
    })
    // rocks
    n = 24
    while (n < TRACK_SEGS - 6) {
      if (this.rng() < 0.5) {
        this.seg(n).sprites.push({
          key: 'rock',
          offset: (this.rng() < 0.5 ? -1 : 1) * (1.6 + this.rng() * 1.8),
        })
      }
      n += 18 + Math.floor(this.rng() * 22)
    }
    // poles on curve outsides
    for (let s = 0; s < TRACK_SEGS; s += 24) {
      const sg = this.seg(s)
      if (Math.abs(sg.curve) > 2) {
        sg.sprites.push({ key: 'pole', offset: (sg.curve > 0 ? -1 : 1) * 1.35 })
      }
    }
  }

  private seedCars(): void {
    this.cars = []
    const keys = ['car0', 'car1', 'car2', 'car3', 'car4']
    const count = 20 + Math.floor(this.rng() * 10)
    for (let i = 0; i < count; i++) {
      this.cars.push({
        offset: [-0.667, 0, 0.667][i % 3] + (this.rng() - 0.5) * 0.12,
        z: 80 * SEG_LEN + this.rng() * (this.trackLength - 100 * SEG_LEN),
        speed: MAX_SPEED * (0.24 + this.rng() * 0.38),
        key: keys[i % 5],
        prevDiff: 1e9,
        drift: 0,
        aiT: this.rng() * 3,
      })
    }
  }

  private findSegment(z: number): Segment {
    return this.segments[Math.floor(wrap(z, this.trackLength) / SEG_LEN) % TRACK_SEGS]
  }

  /* --------------- rendering --------------- */

  private render(): void {
    const ctx = this.ctx
    if (!ctx || this.W === 0) return
    const W = this.W
    const H = this.H

    ctx.save()
    if (this.shakeT > 0) {
      const m = this.shakeMag * this.shakeT
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m)
    }

    const baseSeg = this.findSegment(this.position)
    const basePercent = (this.position % SEG_LEN) / SEG_LEN
    const playerSeg = this.findSegment(this.position + PLAYER_Z)
    const playerPercent = ((this.position + PLAYER_Z) % SEG_LEN) / SEG_LEN
    const playerY = lerp(playerSeg.p1.world.y, playerSeg.p2.world.y, playerPercent)
    const spct = this.speed / MAX_SPEED

    this.renderBackground(playerY)

    let maxy = H
    let x = 0
    let dx = -(baseSeg.curve * basePercent)
    const segCount = this.segments.length
    for (let n = 0; n < this.drawDist; n++) {
      const seg = this.segments[(baseSeg.index + n) % segCount]
      seg.looped = seg.index < baseSeg.index
      seg.fog = fogFactor(n / this.drawDist, FOG_DENSITY)
      seg.clip = maxy
      const camZ = this.position - (seg.looped ? this.trackLength : 0)
      project(seg.p1, this.playerX * ROAD_W - x, playerY + CAM_H, camZ, W, H)
      project(seg.p2, this.playerX * ROAD_W - x - dx, playerY + CAM_H, camZ, W, H)
      x += dx
      dx += seg.curve
      if (
        seg.p1.camera.z <= CAM_DEPTH ||
        seg.p2.screen.y >= seg.p1.screen.y ||
        seg.p2.screen.y >= maxy
      ) {
        continue
      }
      this.renderSegment(seg)
      maxy = seg.p2.screen.y
    }

    // sprites & traffic, far to near
    for (let n = this.drawDist - 1; n > 0; n--) {
      const seg = this.segments[(baseSeg.index + n) % segCount]
      if (seg.p1.camera.z <= CAM_DEPTH) continue
      for (const car of seg.cars) {
        const pct = (car.z % SEG_LEN) / SEG_LEN
        const scale = lerp(seg.p1.screen.scale, seg.p2.screen.scale, pct)
        const cx = lerp(seg.p1.screen.x, seg.p2.screen.x, pct) + scale * car.offset * ROAD_W * (W / 2)
        const cy = lerp(seg.p1.screen.y, seg.p2.screen.y, pct)
        this.drawSprite(car.key, cx, cy, scale, seg.clip, seg.fog, true)
      }
      for (const spr of seg.sprites) {
        const scale = seg.p1.screen.scale
        const sx = seg.p1.screen.x + scale * spr.offset * ROAD_W * (W / 2)
        this.drawSprite(spr.key, sx, seg.p1.screen.y, scale, seg.clip, seg.fog, false)
      }
    }

    this.renderPlayer(spct)
    this.renderParticles()
    this.renderSpeedLines(spct)

    if (this.crashFlash > 0) {
      ctx.fillStyle = `rgba(255,84,48,${(this.crashFlash * 0.32).toFixed(3)})`
      ctx.fillRect(0, 0, W, H)
    }
    if (this.nitroActive) {
      // subtle heat tint pulsing with the boost
      const heat = 0.05 + 0.045 * Math.sin(this.timeAbs * 22)
      ctx.fillStyle = `rgba(255,122,40,${heat.toFixed(3)})`
      ctx.fillRect(0, 0, W, H)
    }
    if (this.vignette) {
      ctx.fillStyle = this.vignette
      ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
  }

  private renderBackground(playerY: number): void {
    const ctx = this.ctx
    if (!ctx) return
    const W = this.W
    const H = this.H
    const horizonY = H * 0.58 - clamp(playerY * 0.008, -80, 80)

    // sky
    if (this.skyGrad) {
      ctx.fillStyle = this.skyGrad
      ctx.fillRect(0, 0, W, H)
    } else {
      ctx.fillStyle = '#f2a25c'
      ctx.fillRect(0, 0, W, H)
    }

    // twinkling stars in the upper sky
    for (const st of this.stars) {
      const a = 0.18 + 0.5 * Math.abs(Math.sin(this.timeAbs * st.tw + st.ph))
      ctx.fillStyle = `rgba(255,244,224,${a.toFixed(3)})`
      const px = wrap(st.fx * W - this.bgShift * 0.008, W)
      ctx.fillRect(px, st.fy * H * 0.9, st.s, st.s)
    }

    // sun with glow + lens streak
    const sunX = W * 0.63
    const sunY = horizonY - H * 0.17
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.32)
    glow.addColorStop(0, 'rgba(255,214,140,0.6)')
    glow.addColorStop(1, 'rgba(255,214,140,0)')
    ctx.fillStyle = glow
    /* Fill only the sky band — everything below the horizon is repainted by the
       ground band + road segments right after, so a full-screen fill is wasted work. */
    ctx.fillRect(0, 0, W, horizonY + 2)
    const streak = ctx.createLinearGradient(sunX - W * 0.28, sunY, sunX + W * 0.28, sunY)
    streak.addColorStop(0, 'rgba(255,224,170,0)')
    streak.addColorStop(0.5, 'rgba(255,224,170,0.28)')
    streak.addColorStop(1, 'rgba(255,224,170,0)')
    ctx.fillStyle = streak
    ctx.fillRect(sunX - W * 0.28, sunY - H * 0.004, W * 0.56, H * 0.008)
    ctx.fillStyle = '#fff3d6'
    ctx.beginPath()
    ctx.arc(sunX, sunY, H * 0.055, 0, Math.PI * 2)
    ctx.fill()

    // clouds
    ctx.fillStyle = 'rgba(255,244,230,0.72)'
    for (const c of this.clouds) {
      const span = W + 340
      let px = wrap(c.fx * span + this.timeAbs * c.spd * 6 - this.bgShift * c.par, span) - 170
      const py = c.fy * H * 0.55 + 20
      const s = c.s * (H / 720)
      ctx.beginPath()
      ctx.ellipse(px, py, 44 * s, 14 * s, 0, 0, Math.PI * 2)
      ctx.ellipse(px - 26 * s, py + 6 * s, 26 * s, 10 * s, 0, 0, Math.PI * 2)
      ctx.ellipse(px + 28 * s, py + 4 * s, 30 * s, 11 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // drifting birds (tiny flapping V shapes)
    ctx.strokeStyle = 'rgba(70,38,24,0.55)'
    ctx.lineWidth = 1.4
    for (const b of this.birds) {
      const span = W + 60
      const px = wrap(b.fx * span + this.timeAbs * b.spd - this.bgShift * 0.012, span) - 30
      const py = b.fy * H + Math.sin(this.timeAbs * 0.7 + b.ph) * 6
      const flap = Math.sin(this.timeAbs * 7 + b.ph) * 2.4
      ctx.beginPath()
      ctx.moveTo(px - 4, py + flap)
      ctx.lineTo(px, py - flap)
      ctx.lineTo(px + 4, py + flap)
      ctx.stroke()
    }

    // distant city skyline (slowest parallax layer)
    const cityShift = this.bgShift * 0.02
    ctx.fillStyle = 'rgba(122,70,48,0.5)'
    for (const b of this.skyline) {
      const bw = b.w * W
      const bx = wrap(b.x * W - cityShift, W + 140) - 70
      const bh = b.h * H
      ctx.fillRect(bx, horizonY - bh, bw, bh + 2)
      if (b.ant) {
        ctx.fillRect(bx + bw / 2 - 1, horizonY - bh - 6, 2, 6)
      }
    }

    // mountain ridges (procedural, parallax on curves)
    this.drawRidge('#d98e5f', H * 0.17, 0.05, 0.006, horizonY)
    this.drawRidge('#a05c3d', H * 0.11, 0.11, 0.011, horizonY)

    // haze at the horizon
    const haze = ctx.createLinearGradient(0, horizonY - 64, 0, horizonY)
    haze.addColorStop(0, 'rgba(255,227,184,0)')
    haze.addColorStop(1, 'rgba(255,227,184,0.9)')
    ctx.fillStyle = haze
    ctx.fillRect(0, horizonY - 64, W, 64)

    // ground band below horizon (seamless base for the road)
    ctx.fillStyle = COLORS.light.grass
    ctx.fillRect(0, horizonY, W, H - horizonY)
  }

  private drawRidge(color: string, amp: number, par: number, freq: number, horizonY: number): void {
    const ctx = this.ctx
    if (!ctx) return
    const W = this.W
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, horizonY + 4)
    for (let px = 0; px <= W; px += 10) {
      const t = (px + this.bgShift * par) * freq
      const hgt =
        Math.sin(t) * 0.55 + Math.sin(t * 0.53 + 1.7) * 0.3 + Math.sin(t * 1.7 + 0.4) * 0.15
      ctx.lineTo(px, horizonY - (hgt * 0.5 + 0.65) * amp)
    }
    ctx.lineTo(W, horizonY + 4)
    ctx.closePath()
    ctx.fill()
  }

  private renderSegment(seg: Segment): void {
    const ctx = this.ctx
    if (!ctx) return
    const p1 = seg.p1.screen
    const p2 = seg.p2.screen
    const col = COLORS[seg.colorKey]

    ctx.fillStyle = col.grass
    ctx.fillRect(0, p2.y, this.W, p1.y - p2.y)

    const r1 = p1.w / 5
    const r2 = p2.w / 5
    poly(ctx, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, col.rumble)
    poly(ctx, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, col.rumble)
    poly(ctx, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, col.road)

    if (seg.colorKey === 'light') {
      const lw1 = (p1.w * 2) / LANES
      const lw2 = (p2.w * 2) / LANES
      const ld1 = (p1.w * 2) / 32
      const ld2 = (p2.w * 2) / 32
      let lx1 = p1.x - p1.w + lw1
      let lx2 = p2.x - p2.w + lw2
      for (let lane = 1; lane < LANES; lane++) {
        poly(ctx, lx1 - ld1 / 2, p1.y, lx1 + ld1 / 2, p1.y, lx2 + ld2 / 2, p2.y, lx2 - ld2 / 2, p2.y, col.lane)
        lx1 += lw1
        lx2 += lw2
      }
    }

    // reflective cat-eyes along the road edges (every 8th segment)
    if (seg.index % 8 === 0 && p1.w > 8) {
      const er = clamp(p1.w * 0.007, 0.8, 2.6)
      ctx.fillStyle = 'rgba(255,233,168,0.95)'
      ctx.beginPath()
      ctx.arc(p1.x - p1.w * 1.04, p1.y, er, 0, Math.PI * 2)
      ctx.arc(p1.x + p1.w * 1.04, p1.y, er, 0, Math.PI * 2)
      ctx.fill()
    }

    if (seg.fog < 1) {
      const [r, g, b] = FOG_RGB
      ctx.fillStyle = `rgba(${r},${g},${b},${(1 - seg.fog).toFixed(3)})`
      ctx.fillRect(0, p2.y, this.W, p1.y - p2.y)
    }
  }

  private drawSprite(
    key: string,
    x: number,
    y: number,
    scale: number,
    clipY: number,
    fogPct: number,
    isCar: boolean
  ): void {
    const ctx = this.ctx
    const asset = this.assets[key]
    if (!ctx || !asset) return
    const img = asset.img
    const destW = scale * asset.worldW * (this.W / 2)
    if (destW < 1.5) return
    const destH = destW * (img.height / img.width)
    const destX = x - destW / 2
    const destY = y - destH
    const clipH = Math.max(0, destY + destH - clipY)
    if (clipH >= destH) return

    ctx.globalAlpha = fogPct
    if (isCar) {
      ctx.fillStyle = 'rgba(20,8,4,0.3)'
      ctx.beginPath()
      ctx.ellipse(x, y - 2, destW * 0.42, destW * 0.055, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.drawImage(
      img,
      0, 0, img.width, img.height * (1 - clipH / destH),
      destX, destY, destW, destH - clipH
    )
    if (isCar && fogPct > 0.25) {
      // rear tail-light glow (we see the back of traffic cars)
      ctx.fillStyle = `rgba(255,64,40,${(0.42 * fogPct).toFixed(3)})`
      ctx.beginPath()
      ctx.ellipse(x - destW * 0.26, y - destH * 0.16, destW * 0.07, destH * 0.05, 0, 0, Math.PI * 2)
      ctx.ellipse(x + destW * 0.26, y - destH * 0.16, destW * 0.07, destH * 0.05, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private renderPlayer(spct: number): void {
    const ctx = this.ctx
    if (!ctx || !this.playerImgs) return
    const W = this.W
    const H = this.H
    const carW = this.playerCarW()
    const img = this.input.brake ? this.playerImgs.brake : this.playerImgs.normal
    const carH = carW * (img.height / img.width)
    const bounce = (Math.random() * 2 - 1) * spct * (this.offRoad ? 5 : 1.8)
    const cx = W / 2
    const bottomY = H - 12 + bounce

    // shadow
    ctx.fillStyle = 'rgba(20,8,4,0.35)'
    ctx.beginPath()
    ctx.ellipse(cx, bottomY - 6, carW * 0.44, carW * 0.07, 0, 0, Math.PI * 2)
    ctx.fill()

    // dusk headlight cone projecting up the road
    const lightLen = carH * 2.4
    const coneTop = bottomY - carH * 0.9 - lightLen
    const cone = ctx.createLinearGradient(cx, bottomY - carH * 0.9, cx, coneTop)
    cone.addColorStop(0, 'rgba(255,232,175,0.30)')
    cone.addColorStop(1, 'rgba(255,232,175,0)')
    ctx.fillStyle = cone
    ctx.beginPath()
    ctx.moveTo(cx - carW * 0.24, bottomY - carH * 0.9)
    ctx.lineTo(cx + carW * 0.24, bottomY - carH * 0.9)
    ctx.lineTo(cx + carW * 0.62, coneTop)
    ctx.lineTo(cx - carW * 0.62, coneTop)
    ctx.closePath()
    ctx.fill()

    // nitro flames
    if (this.nitroActive) {
      const fl = carW * (0.28 + Math.random() * 0.16)
      for (const ex of [cx - carW * 0.3, cx + carW * 0.3]) {
        const fy = bottomY - carH * 0.25
        const grd = ctx.createLinearGradient(ex, fy, ex, fy + fl)
        grd.addColorStop(0, 'rgba(255,240,180,0.95)')
        grd.addColorStop(0.4, 'rgba(255,150,40,0.85)')
        grd.addColorStop(1, 'rgba(255,60,20,0)')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.moveTo(ex - carW * 0.05, fy)
        ctx.lineTo(ex + carW * 0.05, fy)
        ctx.lineTo(ex, fy + fl)
        ctx.closePath()
        ctx.fill()
      }
    }

    // car with steering tilt
    const tilt =
      this.steerSmooth * 0.055 + (this.offRoad ? Math.sin(this.timeAbs * 34) * 0.012 : 0)
    ctx.save()
    ctx.translate(cx, bottomY - carH / 2)
    ctx.rotate(tilt)
    ctx.drawImage(img, -carW / 2, -carH / 2, carW, carH)
    ctx.restore()

    // brake-light glow when slowing down
    if (this.input.brake) {
      const bg = ctx.createRadialGradient(cx, bottomY - carH * 0.28, 0, cx, bottomY - carH * 0.28, carW * 0.42)
      bg.addColorStop(0, 'rgba(255,64,40,0.5)')
      bg.addColorStop(1, 'rgba(255,64,40,0)')
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.ellipse(cx, bottomY - carH * 0.28, carW * 0.42, carH * 0.18, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // nitro exhaust particles
    if (this.nitroActive && Math.random() < 0.9) {
      for (const ex of [cx - carW * 0.3, cx + carW * 0.3]) {
        this.particles.push({
          x: ex,
          y: bottomY - carH * 0.18,
          vx: (Math.random() - 0.5) * 60,
          vy: 90 + Math.random() * 60,
          life: 0.3,
          max: 0.3,
          size: 3 + Math.random() * 4,
          color: Math.random() < 0.5 ? '#ffb703' : '#ff6b35',
          grav: 0,
        })
      }
    }
  }

  private renderParticles(): void {
    const ctx = this.ctx
    if (!ctx) return
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private renderSpeedLines(spct: number): void {
    const ctx = this.ctx
    if (!ctx) return
    const boost = this.nitroActive ? 0.25 : 0
    const a = Math.min(0.55, ((spct - 0.62) / 0.38) * 0.5 + boost)
    if (a <= 0) return
    ctx.strokeStyle = `rgba(255,236,210,${a.toFixed(3)})`
    ctx.lineWidth = 2
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2
      const sxp = this.W / 2 + Math.cos(ang) * this.W * 0.3 * (0.75 + Math.random() * 0.5)
      const syp = this.H / 2 + Math.sin(ang) * this.H * 0.3 * (0.75 + Math.random() * 0.5)
      const len = 50 + spct * 150 * Math.random()
      ctx.beginPath()
      ctx.moveTo(sxp, syp)
      ctx.lineTo(sxp + Math.cos(ang) * len, syp + Math.sin(ang) * len)
      ctx.stroke()
    }
  }

  private hud(): HudData {
    return {
      speedKmh: this.speed * KMH,
      speedPercent: this.speed / MAX_SPEED,
      score: Math.floor(this.score),
      timeLeft: this.time,
      distanceKm: (this.totalDist * METERS_PER_UNIT) / 1000,
      overtakes: this.overtakes,
      nitro: this.nitro,
      nitroActive: this.nitroActive,
      braking: this.input.brake,
      offRoad: this.offRoad,
    }
  }
}
