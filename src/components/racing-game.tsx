'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Trophy,
  Coins,
  Gauge,
  Home,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toBn, readStoredNumber, useStoredNumber, writeStoredNumber } from '@/lib/bn'

type Phase = 'menu' | 'playing' | 'paused' | 'over'

interface Traffic {
  x: number
  y: number
  w: number
  h: number
  /** নিজের গতি (ইউজারের গতির ভগ্নাংশ) */
  rel: number
  color: string
}

interface Coin {
  x: number
  y: number
  r: number
  phase: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
}

interface Engine {
  w: number
  h: number
  playerX: number
  playerY: number
  carW: number
  carH: number
  speed: number
  distance: number
  coins: number
  traffic: Traffic[]
  coinArr: Coin[]
  particles: Particle[]
  spawnT: number
  coinT: number
  roadOff: number
  shake: number
  hudT: number
}

interface HudState {
  score: number
  coins: number
  kmh: number
}

interface FinalState {
  score: number
  coins: number
  kmh: number
  isBest: boolean
}

const LANES = 3
const ROAD_MARGIN_RATIO = 0.07
const BASE_SPEED = 300
const MAX_SPEED = 760
const ACCEL = 9
const KEY_STEER = 640
const POINTER_STEER = 980
const BEST_KEY = 'gz-racing-best'
const SOUND_KEY = 'gz-sound'

const TRAFFIC_COLORS = [
  '#475569',
  '#dc2626',
  '#059669',
  '#7c3aed',
  '#d97706',
  '#334155',
  '#0d9488',
]

/* ---------------- ক্যানভাস হেল্পার ---------------- */

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${g},${b})`
}

/** টপ-ডাউন গাড়ি আঁকা (সব গাড়ি উপরের দিকে মুখ করা) */
function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: string,
  isPlayer: boolean
) {
  const x = cx - w / 2
  const y = cy - h / 2

  // চাকা
  ctx.fillStyle = '#0a0a0c'
  const ww = w * 0.16
  const wh = h * 0.17
  roundRectPath(ctx, x - ww * 0.35, y + h * 0.14, ww, wh, 3)
  ctx.fill()
  roundRectPath(ctx, x + w - ww * 0.65, y + h * 0.14, ww, wh, 3)
  ctx.fill()
  roundRectPath(ctx, x - ww * 0.35, y + h * 0.69, ww, wh, 3)
  ctx.fill()
  roundRectPath(ctx, x + w - ww * 0.65, y + h * 0.69, ww, wh, 3)
  ctx.fill()

  // বডি
  const grad = ctx.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, shade(color, 40))
  grad.addColorStop(0.55, color)
  grad.addColorStop(1, shade(color, -55))
  ctx.fillStyle = grad
  roundRectPath(ctx, x, y, w, h, w * 0.24)
  ctx.fill()

  // কেবিন
  ctx.fillStyle = 'rgba(10, 14, 24, 0.9)'
  roundRectPath(ctx, x + w * 0.16, y + h * 0.26, w * 0.68, h * 0.36, w * 0.16)
  ctx.fill()

  // সামনের কাচ
  ctx.fillStyle = 'rgba(165, 180, 205, 0.55)'
  roundRectPath(ctx, x + w * 0.2, y + h * 0.28, w * 0.6, h * 0.12, w * 0.1)
  ctx.fill()

  // হেডলাইট (সামনে)
  ctx.fillStyle = isPlayer ? '#fde68a' : '#e5e7eb'
  roundRectPath(ctx, x + w * 0.1, y - h * 0.008, w * 0.2, h * 0.05, 2)
  ctx.fill()
  roundRectPath(ctx, x + w * 0.7, y - h * 0.008, w * 0.2, h * 0.05, 2)
  ctx.fill()

  // টেললাইট (পেছনে)
  ctx.fillStyle = isPlayer ? '#ef4444' : '#b91c1c'
  roundRectPath(ctx, x + w * 0.1, y + h * 0.96, w * 0.2, h * 0.05, 2)
  ctx.fill()
  roundRectPath(ctx, x + w * 0.7, y + h * 0.96, w * 0.2, h * 0.05, 2)
  ctx.fill()
}

function playSound(kind: 'coin' | 'crash', muted: boolean) {
  if (muted) return
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime

    if (kind === 'coin') {
      osc.type = 'square'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.setValueAtTime(1320, now + 0.06)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.13)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.start(now)
      osc.stop(now + 0.42)
    }
    setTimeout(() => ctx.close().catch(() => undefined), 700)
  } catch {
    /* সাউন্ড সাপোর্ট না থাকলে সমস্যা নেই */
  }
}

function createEngine(w: number, h: number): Engine {
  const margin = w * ROAD_MARGIN_RATIO
  const roadW = w - margin * 2
  const laneW = roadW / LANES
  const carW = laneW * 0.56
  const carH = carW * 1.85
  return {
    w,
    h,
    playerX: margin + laneW * 1.5,
    playerY: h - carH - 26,
    carW,
    carH,
    speed: BASE_SPEED,
    distance: 0,
    coins: 0,
    traffic: [],
    coinArr: [],
    particles: [],
    spawnT: 0.9,
    coinT: 1.4,
    roadOff: 0,
    shake: 0,
    hudT: 0,
  }
}

/* ---------------- কম্পোনেন্ট ---------------- */

interface RacingGameProps {
  onExit: () => void
}

export function RacingGame({ onExit }: RacingGameProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engRef = useRef<Engine | null>(null)
  const phaseRef = useRef<Phase>('menu')
  const inputRef = useRef({
    left: false,
    right: false,
    pointerActive: false,
    pointerX: 0,
  })
  const mutedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('menu')
  const [hud, setHud] = useState<HudState>({ score: 0, coins: 0, kmh: 0 })
  const [final, setFinal] = useState<FinalState | null>(null)

  /** সেরা স্কোর ও সাউন্ড সেটিং — localStorage store থেকে প্রতিক্রিয়াশীলভাবে */
  const best = useStoredNumber(BEST_KEY)
  const muted = useStoredNumber(SOUND_KEY) === 1

  /* ইঞ্জিনের ভেতরে ব্যবহারের জন্য muted রেফে মিরর করা */
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  /* গেম শুরু */
  const startGame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    engRef.current = createEngine(w, h)
    setFinal(null)
    setHud({ score: 0, coins: 0, kmh: Math.round(BASE_SPEED / 2.6) })
    setPhaseBoth('playing')
  }, [setPhaseBoth])

  /* বিরতি/চালু */
  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') setPhaseBoth('paused')
    else if (phaseRef.current === 'paused') setPhaseBoth('playing')
  }, [setPhaseBoth])

  const toggleMute = useCallback(() => {
    writeStoredNumber(SOUND_KEY, mutedRef.current ? 0 : 1)
  }, [])

  /* মেইন গেম লুপ */
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = performance.now()

    /* সাইজিং (DPR সহ) */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!engRef.current) {
        engRef.current = createEngine(w, h)
      } else {
        const eng = engRef.current
        const margin = w * ROAD_MARGIN_RATIO
        const roadW = w - margin * 2
        const laneW = roadW / LANES
        eng.w = w
        eng.h = h
        eng.carW = laneW * 0.56
        eng.carH = eng.carW * 1.85
        eng.playerY = h - eng.carH - 26
        eng.playerX = Math.max(
          margin + eng.carW / 2,
          Math.min(margin + roadW - eng.carW / 2, eng.playerX)
        )
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    /* স্পন + আপডেট */
    const laneCenter = (eng: Engine, lane: number) => {
      const margin = eng.w * ROAD_MARGIN_RATIO
      const laneW = (eng.w - margin * 2) / LANES
      return margin + laneW * (lane + 0.5)
    }

    const spawnTraffic = (eng: Engine) => {
      const margin = eng.w * ROAD_MARGIN_RATIO
      const laneW = (eng.w - margin * 2) / LANES
      const wantTwo = eng.speed > 470 && Math.random() < 0.35
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5)
      const count = wantTwo ? 2 : 1
      const chosen: number[] = []
      for (const lane of lanes) {
        if (chosen.length >= count) break
        // এন্ট্রি জোনে এই লেনে কেউ আছে কি না
        const occupied = eng.traffic.some(
          (t) =>
            Math.abs(t.x - laneCenter(eng, lane)) < laneW * 0.55 &&
            t.y < eng.carH * 2.6
        )
        if (!occupied) chosen.push(lane)
      }
      for (const lane of chosen) {
        eng.traffic.push({
          x: laneCenter(eng, lane),
          y: -eng.carH * 1.6 - Math.random() * 90,
          w: eng.carW * (0.9 + Math.random() * 0.14),
          h: eng.carW * 1.85 * (0.9 + Math.random() * 0.14),
          rel: eng.speed * (0.5 + Math.random() * 0.3),
          color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
        })
      }
    }

    const spawnCoin = (eng: Engine) => {
      const margin = eng.w * ROAD_MARGIN_RATIO
      const laneW = (eng.w - margin * 2) / LANES
      const lane = Math.floor(Math.random() * LANES)
      const occupied = eng.traffic.some(
        (t) =>
          Math.abs(t.x - laneCenter(eng, lane)) < laneW * 0.6 &&
          t.y > -eng.carH * 2 &&
          t.y < eng.carH * 3
      )
      if (occupied) return
      eng.coinArr.push({
        x: laneCenter(eng, lane),
        y: -14,
        r: laneW * 0.16,
        phase: Math.random() * Math.PI * 2,
      })
    }

    const burst = (eng: Engine, x: number, y: number, colors: string[], n: number, force: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const v = force * (0.3 + Math.random() * 0.9)
        eng.particles.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - force * 0.3,
          life: 0.5 + Math.random() * 0.5,
          max: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 3.5,
        })
      }
    }

    const crash = (eng: Engine) => {
      burst(
        eng,
        eng.playerX,
        eng.playerY,
        ['#fbbf24', '#f97316', '#ef4444', '#94a3b8', '#52525b'],
        42,
        260
      )
      eng.shake = 0.45
      setPhaseBoth('over')
      playSound('crash', mutedRef.current)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(180)

      const score = Math.floor(eng.distance / 45) + eng.coins * 10
      const prevBest = readStoredNumber(BEST_KEY, 0)
      const isBest = score > prevBest
      if (isBest) {
        writeStoredNumber(BEST_KEY, score)
      }
      // মোট খেলার হিসাব
      writeStoredNumber('gz-plays', readStoredNumber('gz-plays', 0) + 1)
      setFinal({
        score,
        coins: eng.coins,
        kmh: Math.round(eng.speed / 2.6),
        isBest,
      })
    }

    const update = (eng: Engine, dt: number) => {
      eng.speed = Math.min(MAX_SPEED, eng.speed + ACCEL * dt)
      eng.distance += eng.speed * dt
      eng.roadOff = (eng.roadOff + eng.speed * dt) % 44

      /* স্টিয়ারিং */
      const margin = eng.w * ROAD_MARGIN_RATIO
      const roadW = eng.w - margin * 2
      const inp = inputRef.current
      if (inp.pointerActive) {
        const dx = inp.pointerX - eng.playerX
        const step = POINTER_STEER * dt
        eng.playerX += Math.max(-step, Math.min(step, dx))
      } else if (inp.left && !inp.right) {
        eng.playerX -= KEY_STEER * dt
      } else if (inp.right && !inp.left) {
        eng.playerX += KEY_STEER * dt
      }
      eng.playerX = Math.max(
        margin + eng.carW / 2,
        Math.min(margin + roadW - eng.carW / 2, eng.playerX)
      )

      /* ট্রাফিক স্পন */
      eng.spawnT -= dt
      if (eng.spawnT <= 0) {
        spawnTraffic(eng)
        const interval = Math.max(0.5, 1.2 - eng.speed / 1000)
        eng.spawnT = interval * (0.7 + Math.random() * 0.6)
      }

      /* ট্রাফিক চলাচল */
      for (let i = eng.traffic.length - 1; i >= 0; i--) {
        const t = eng.traffic[i]
        t.y += (eng.speed - t.rel) * dt
        if (t.y > eng.h + t.h * 1.6) {
          eng.traffic.splice(i, 1)
          continue
        }
        // সংঘর্ষ (একটু দয়ালু হিটবক্স)
        const px = eng.playerX
        const py = eng.playerY
        const pw = eng.carW * 0.72
        const ph = eng.carH * 0.84
        const tx = t.x
        const ty = t.y
        const tw = t.w * 0.74
        const th = t.h * 0.84
        if (
          Math.abs(px - tx) < (pw + tw) / 2 &&
          Math.abs(py - ty) < (ph + th) / 2
        ) {
          crash(eng)
          return
        }
      }

      /* কয়েন */
      eng.coinT -= dt
      if (eng.coinT <= 0) {
        spawnCoin(eng)
        eng.coinT = 1.2 + Math.random() * 1.1
      }
      for (let i = eng.coinArr.length - 1; i >= 0; i--) {
        const c = eng.coinArr[i]
        c.y += eng.speed * dt
        if (c.y > eng.h + 20) {
          eng.coinArr.splice(i, 1)
          continue
        }
        const nearestX = Math.max(
          eng.playerX - eng.carW * 0.42,
          Math.min(c.x, eng.playerX + eng.carW * 0.42)
        )
        const nearestY = Math.max(
          eng.playerY - eng.carH * 0.46,
          Math.min(c.y, eng.playerY + eng.carH * 0.46)
        )
        const dx = c.x - nearestX
        const dy = c.y - nearestY
        if (dx * dx + dy * dy < (c.r + 7) * (c.r + 7)) {
          eng.coins += 1
          eng.coinArr.splice(i, 1)
          burst(eng, c.x, c.y, ['#fbbf24', '#fde68a', '#f59e0b'], 8, 120)
          playSound('coin', mutedRef.current)
        }
      }

      /* পার্টিকেল */
      for (let i = eng.particles.length - 1; i >= 0; i--) {
        const p = eng.particles[i]
        p.life -= dt
        if (p.life <= 0) {
          eng.particles.splice(i, 1)
          continue
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 340 * dt
      }
    }

    /* রেন্ডার */
    const render = (eng: Engine, now: number) => {
      const w = eng.w
      const h = eng.h
      const margin = w * ROAD_MARGIN_RATIO
      const roadX = margin
      const roadW = w - margin * 2

      ctx.clearRect(0, 0, w, h)

      ctx.save()
      if (eng.shake > 0) {
        eng.shake = Math.max(0, eng.shake - 0.016)
        ctx.translate(
          (Math.random() - 0.5) * 12 * eng.shake,
          (Math.random() - 0.5) * 12 * eng.shake
        )
      }

      // পাশের ব্যাকগ্রাউন্ড
      const sideGrad = ctx.createLinearGradient(0, 0, 0, h)
      sideGrad.addColorStop(0, '#0d1410')
      sideGrad.addColorStop(1, '#090c0a')
      ctx.fillStyle = sideGrad
      ctx.fillRect(0, 0, w, h)

      // সাইড স্ট্রাইপ (গতির অনুভূতি)
      ctx.fillStyle = 'rgba(120, 140, 120, 0.05)'
      const sideOff = (eng.roadOff * 0.6) % 56
      for (let y = -56 + sideOff; y < h; y += 56) {
        ctx.fillRect(4, y, margin - 10, 26)
        ctx.fillRect(w - margin + 6, y, margin - 10, 26)
      }

      // রাস্তা
      const roadGrad = ctx.createLinearGradient(roadX, 0, roadX + roadW, 0)
      roadGrad.addColorStop(0, '#17181d')
      roadGrad.addColorStop(0.5, '#212228')
      roadGrad.addColorStop(1, '#17181d')
      ctx.fillStyle = roadGrad
      ctx.fillRect(roadX, 0, roadW, h)

      // কার্ব (লাল-সাদা)
      const curbOff = eng.roadOff % 44
      for (let y = -44 + curbOff; y < h; y += 44) {
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(roadX - 6, y, 6, 22)
        ctx.fillRect(roadX + roadW, y, 6, 22)
        ctx.fillStyle = '#e2e8f0'
        ctx.fillRect(roadX - 6, y + 22, 6, 22)
        ctx.fillRect(roadX + roadW, y + 22, 6, 22)
      }

      // লেনের ড্যাশ লাইন
      const laneW = roadW / LANES
      ctx.fillStyle = 'rgba(226, 232, 240, 0.5)'
      for (let l = 1; l < LANES; l++) {
        const lx = roadX + laneW * l
        for (let y = -44 + curbOff; y < h; y += 44) {
          ctx.fillRect(lx - 2, y, 4, 24)
        }
      }

      // স্পিড স্ট্রিক
      if (eng.speed > 500 && phaseRef.current === 'playing') {
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        for (let i = 0; i < 6; i++) {
          const sx = roadX + Math.random() * roadW
          const sy = Math.random() * h
          ctx.fillRect(sx, sy, 2, 50 + eng.speed / 8)
        }
      }

      // কয়েন
      for (const c of eng.coinArr) {
        const wob = Math.abs(Math.cos(now / 260 + c.phase)) * 0.55 + 0.45
        ctx.save()
        ctx.translate(c.x, c.y)
        ctx.scale(wob, 1)
        const cg = ctx.createRadialGradient(-c.r * 0.3, -c.r * 0.3, 1, 0, 0, c.r)
        cg.addColorStop(0, '#fef3c7')
        cg.addColorStop(0.6, '#fbbf24')
        cg.addColorStop(1, '#b45309')
        ctx.fillStyle = cg
        ctx.beginPath()
        ctx.arc(0, 0, c.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#92400e'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#92400e'
        ctx.font = `bold ${c.r}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('$', 0, 1)
        ctx.restore()
      }

      // ট্রাফিক
      for (const t of eng.traffic) {
        drawCar(ctx, t.x, t.y, t.w, t.h, t.color, false)
      }

      // প্লেয়ারের হেডলাইট গ্লো
      if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
        const glow = ctx.createRadialGradient(
          eng.playerX,
          eng.playerY - eng.carH * 0.5,
          6,
          eng.playerX,
          eng.playerY - eng.carH * 0.5,
          eng.carH * 1.4
        )
        glow.addColorStop(0, 'rgba(253, 230, 138, 0.14)')
        glow.addColorStop(1, 'rgba(253, 230, 138, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(roadX, 0, roadW, h)
      }

      // প্লেয়ার
      drawCar(
        ctx,
        eng.playerX,
        eng.playerY,
        eng.carW,
        eng.carH,
        '#ef4444',
        true
      )

      // এক্সহস্ট ফ্লেম
      if (phaseRef.current === 'playing') {
        ctx.fillStyle = 'rgba(251, 146, 60, 0.85)'
        const fl = 8 + Math.random() * 14
        ctx.beginPath()
        ctx.moveTo(eng.playerX - eng.carW * 0.22, eng.playerY + eng.carH * 0.52)
        ctx.lineTo(eng.playerX - eng.carW * 0.22 + 4, eng.playerY + eng.carH * 0.52 + fl)
        ctx.lineTo(eng.playerX - eng.carW * 0.22 + 8, eng.playerY + eng.carH * 0.52)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(eng.playerX + eng.carW * 0.14, eng.playerY + eng.carH * 0.52)
        ctx.lineTo(eng.playerX + eng.carW * 0.14 + 4, eng.playerY + eng.carH * 0.52 + fl * 0.8)
        ctx.lineTo(eng.playerX + eng.carW * 0.14 + 8, eng.playerY + eng.carH * 0.52)
        ctx.fill()
      }

      // পার্টিকেল
      for (const p of eng.particles) {
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
      ctx.globalAlpha = 1

      // ভিনিয়েট
      const vig = ctx.createRadialGradient(
        w / 2,
        h / 2,
        h * 0.35,
        w / 2,
        h / 2,
        h * 0.85
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.45)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, w, h)

      ctx.restore()
    }

    /* লুপ */
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const eng = engRef.current
      if (eng) {
        if (phaseRef.current === 'playing') {
          update(eng, dt)
          eng.hudT += dt
          if (eng.hudT > 0.12) {
            eng.hudT = 0
            setHud({
              score: Math.floor(eng.distance / 45) + eng.coins * 10,
              coins: eng.coins,
              kmh: Math.round(eng.speed / 2.6),
            })
          }
        }
        render(eng, now)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    /* কীবোর্ড */
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        inputRef.current.left = true
        e.preventDefault()
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        inputRef.current.right = true
        e.preventDefault()
      } else if (k === ' ' || k === 'p' || k === 'P') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
          togglePause()
          e.preventDefault()
        }
      } else if (k === 'Enter') {
        if (phaseRef.current === 'menu' || phaseRef.current === 'over') {
          startGame()
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') inputRef.current.left = false
      if (k === 'ArrowRight' || k === 'd' || k === 'D') inputRef.current.right = false
    }

    /* টাচ/মাউস স্টিয়ারিং */
    const updatePointerX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect()
      inputRef.current.pointerX = clientX - rect.left
    }
    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      inputRef.current.pointerActive = true
      updatePointerX(e.clientX)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (inputRef.current.pointerActive) updatePointerX(e.clientX)
    }
    const onPointerUp = () => {
      inputRef.current.pointerActive = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [setPhaseBoth, startGame, togglePause])

  return (
    <div className="flex flex-col gap-3">
      {/* টপ বার */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onExit}
          className="border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800 hover:text-amber-300"
        >
          <ChevronLeft className="h-4 w-4" />
          হাবে ফিরুন
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMute}
            aria-label={muted ? 'সাউন্ড চালু করুন' : 'সাউন্ড বন্ধ করুন'}
            className="h-8 w-8 border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:text-amber-300"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={togglePause}
            disabled={phase !== 'playing' && phase !== 'paused'}
            className="border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800"
          >
            {phase === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {phase === 'paused' ? 'চালু' : 'বিরতি'}
          </Button>
        </div>
      </div>

      {/* গেম এরিয়া */}
      <div
        ref={wrapRef}
        className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl shadow-amber-950/20"
        style={{ height: 'min(62dvh, 620px)', minHeight: 380 }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          aria-label="টার্বো রেসিং গেম"
        />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-col gap-1.5">
            <div className="rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
              <span className="text-xs text-zinc-400">স্কোর</span>
              <span className="ml-2 text-lg font-bold tabular-nums text-amber-300">
                {toBn(hud.score)}
              </span>
            </div>
            <div className="flex gap-1.5">
              <div className="flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-sm font-semibold tabular-nums text-amber-200">
                  {toBn(hud.coins)}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
                <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-sm font-semibold tabular-nums text-emerald-200">
                  {toBn(hud.kmh)}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-zinc-400">সেরা</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-zinc-200">
              {toBn(best)}
            </span>
          </div>
        </div>

        {/* মেনু ওভারলে */}
        {phase === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-stone-950/85 p-6 text-center backdrop-blur-sm">
            <div className="text-6xl">🏎️</div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-amber-300">
                টার্বো রেসিং
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                গাড়ি এড়িয়ে চলুন, কয়েন কুড়ান — যত দূর, তত স্কোর!
              </p>
            </div>
            {best > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-amber-200">
                  আপনার সেরা স্কোর: {toBn(best)}
                </span>
              </div>
            )}
            <Button
              onClick={startGame}
              size="lg"
              className="h-12 px-8 bg-amber-500 text-base font-bold text-stone-950 hover:bg-amber-400"
            >
              <Play className="h-5 w-5" />
              খেলা শুরু করুন
            </Button>
            <div className="space-y-1 text-xs text-zinc-500">
              <p>📱 মোবাইল: স্ক্রিনে চাপ দিয়ে বাঁয়ে-ডানে টানুন</p>
              <p>💻 কম্পিউটার: ← → বা A / D • বিরতি: Space</p>
            </div>
          </div>
        )}

        {/* বিরতি ওভারলে */}
        {phase === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950/80 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-zinc-100">বিরতি ⏸️</h2>
            <div className="flex gap-2">
              <Button
                onClick={togglePause}
                className="bg-amber-500 font-semibold text-stone-950 hover:bg-amber-400"
              >
                <Play className="h-4 w-4" />
                চালিয়ে যান
              </Button>
              <Button
                onClick={startGame}
                variant="outline"
                className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                <RotateCcw className="h-4 w-4" />
                নতুন করে
              </Button>
              <Button
                onClick={onExit}
                variant="outline"
                className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                <Home className="h-4 w-4" />
                হাব
              </Button>
            </div>
          </div>
        )}

        {/* গেম ওভার ওভারলে */}
        {phase === 'over' && final && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950/90 p-6 text-center backdrop-blur-sm">
            <div className="text-5xl">💥</div>
            <h2 className="text-2xl font-extrabold text-red-400">গেম শেষ!</h2>
            {final.isBest && (
              <div className="rounded-full border border-amber-400/50 bg-amber-500/15 px-4 py-1 text-sm font-semibold text-amber-300">
                🏆 নতুন রেকর্ড!
              </div>
            )}
            <div className="grid w-full max-w-[280px] grid-cols-3 gap-2">
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-3">
                <div className="text-[11px] text-zinc-400">স্কোর</div>
                <div className="text-xl font-bold text-amber-300">
                  {toBn(final.score)}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-3">
                <div className="text-[11px] text-zinc-400">কয়েন</div>
                <div className="text-xl font-bold text-amber-200">
                  {toBn(final.coins)}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-3">
                <div className="text-[11px] text-zinc-400">সর্বোচ্চ গতি</div>
                <div className="text-xl font-bold text-emerald-300">
                  {toBn(final.kmh)}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={startGame}
                size="lg"
                className="bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
              >
                <RotateCcw className="h-4 w-4" />
                আবার খেলুন
              </Button>
              <Button
                onClick={onExit}
                size="lg"
                variant="outline"
                className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                <Home className="h-4 w-4" />
                হাবে ফিরুন
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* নিচের হিন্ট */}
      <p className="text-center text-xs text-zinc-500">
        রাস্তার গতি ক্রমেই বাড়বে — মনোযোগ ধরে রাখুন! কয়েন = +১০ পয়েন্ট
      </p>
    </div>
  )
}
