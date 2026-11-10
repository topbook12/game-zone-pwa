'use client'

/**
 * Snake Neon — premium mobile-first canvas arcade (embedded view in the hub).
 *
 * Architecture notes (React 19 / Next 16 friendly):
 *  - Fixed-timestep loop (accumulator) driven by requestAnimationFrame.
 *  - ALL mutable game state lives in refs; React state only mirrors
 *    phase / HUD numbers / sync outcome / mute, so the 60fps loop never
 *    re-renders per frame and no setState runs synchronously in effects.
 *  - Canvas uses a fixed logical coordinate system scaled by
 *    devicePixelRatio (capped at 2) via ctx.setTransform.
 *  - Neon look: emerald glowing snake, pulsing fuchsia orb, faint grid,
 *    vignette, particle burst + floating score popups, red flash + screen
 *    shake on death.
 *  - Audio: one tiny Web Audio oscillator `beep()` helper; the AudioContext
 *    is created lazily on the first user gesture (start press).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkAchievements } from '@/lib/achievements'
import { readStoredNumber, STORAGE_KEYS, useStoredNumber, writeStoredNumber } from '@/lib/game-store'
import { submitScore, type SubmitOutcome } from '@/lib/leaderboard'
import { fmt, getLang, useI18n } from '@/lib/i18n'

/* ------------------------------ constants ------------------------------ */

const GRID = 20
const BASE_STEPS = 7 // steps per second at start
const STEP_GAIN = 0.35 // steps/sec added per food
const MAX_STEPS = 15
const FOOD_POINTS = 10
const BONUS_SPEED_OVER = 8 // speed bonus applies past this steps/sec
const SWIPE_MIN_PX = 24
const CELL_INSET = 1.5
const CELL_RADIUS = 5
const DEATH_FX_MS = 320 // red flash + shake duration
const DEATH_DELAY_MS = 650 // overlay appears after the death animation

const INITIAL_SNAKE: Cell[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
]

const DIR_UP: Cell = { x: 0, y: -1 }
const DIR_DOWN: Cell = { x: 0, y: 1 }
const DIR_LEFT: Cell = { x: -1, y: 0 }
const DIR_RIGHT: Cell = { x: 1, y: 0 }

type Phase = 'menu' | 'playing' | 'paused' | 'gameover'

interface Cell {
  x: number
  y: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  color: string
}

interface Popup {
  x: number
  y: number
  text: string
  born: number
}

/** Rounded-rect path helper (avoids ctx.roundRect availability concerns). */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

const PAD_BTN =
  'flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-400/40 ' +
  'bg-emerald-500/15 text-emerald-300 transition active:scale-95 active:bg-emerald-500/35'

const ICON_BTN =
  'flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/15 ' +
  'bg-black/40 text-zinc-200 transition hover:bg-black/60 active:scale-90 disabled:opacity-40'

/* ------------------------------ component ------------------------------ */

export interface SnakeGameProps {
  onExit: () => void
}

export function SnakeGame({ onExit }: SnakeGameProps) {
  const { t } = useI18n()

  /* --------------------------- refs (game state) --------------------------- */
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const snakeRef = useRef<Cell[]>(INITIAL_SNAKE.map((c) => ({ ...c })))
  const dirRef = useRef<Cell>({ x: 1, y: 0 })
  const queueRef = useRef<Cell[]>([])
  const foodRef = useRef<Cell | null>({ x: 14, y: 10 })
  const scoreRef = useRef(0)
  const stepsRef = useRef(BASE_STEPS)
  const accumRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const popupsRef = useRef<Popup[]>([])
  const deathAtRef = useRef<number | null>(null)
  const dyingRef = useRef(false)
  const submittedRef = useRef(false) // end-of-run pipeline guard (once per run)
  const recordRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const sizeRef = useRef(0)
  const vignetteRef = useRef<CanvasGradient | null>(null)
  const swipeRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const mutedRef = useRef(false)

  /* ------------------------ React mirror state ------------------------ */
  const [phase, setPhase] = useState<Phase>('menu')
  const [score, setScore] = useState(0)
  const [speedLabel, setSpeedLabel] = useState(BASE_STEPS.toFixed(1))
  const [result, setResult] = useState<{ score: number; record: boolean } | null>(null)
  const [sync, setSync] = useState<SubmitOutcome | null>(null)
  const [muted, setMuted] = useState(false)
  const [hasTouch] = useState(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  )
  const storedBest = useStoredNumber(STORAGE_KEYS.snakeBest)

  const phaseRef = useRef<Phase>('menu')
  const handlePhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  /* --------------------------- audio (tiny) --------------------------- */

  const ensureAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        void audioRef.current.resume().catch(() => undefined)
      } catch {
        /* ignore */
      }
      return
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctor) audioRef.current = new Ctor()
    } catch {
      /* ignore */
    }
  }, [])

  const beep = useCallback((freqFrom: number, freqTo: number, dur: number, type: OscillatorType) => {
    if (mutedRef.current) return
    const ctx = audioRef.current
    if (!ctx || ctx.state === 'closed') return
    try {
      const t0 = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freqFrom, t0)
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur / 1000)
      gain.gain.setValueAtTime(0.07, t0)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / 1000)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + dur / 1000)
    } catch {
      /* ignore */
    }
  }, [])

  /* --------------------------- game helpers --------------------------- */

  const spawnFood = useCallback(() => {
    const snake = snakeRef.current
    for (let tries = 0; tries < 400; tries++) {
      const x = Math.floor(Math.random() * GRID)
      const y = Math.floor(Math.random() * GRID)
      if (!snake.some((s) => s.x === x && s.y === y)) {
        foodRef.current = { x, y }
        return
      }
    }
    foodRef.current = null // board full — no free cell left
  }, [])

  /** End-of-run pipeline — guarded to run exactly once per run. */
  const commitRun = useCallback((finalScore: number) => {
    if (submittedRef.current) return
    submittedRef.current = true
    const prevBest = readStoredNumber(STORAGE_KEYS.snakeBest, 0)
    recordRef.current = finalScore > prevBest
    if (recordRef.current) writeStoredNumber(STORAGE_KEYS.snakeBest, finalScore)
    writeStoredNumber(STORAGE_KEYS.plays, readStoredNumber(STORAGE_KEYS.plays, 0) + 1)
    setSync(null)
    void submitScore('snake', finalScore)
      .then((outcome) => setSync(outcome))
      .catch(() => setSync({ status: 'queued' }))
    checkAchievements(getLang())
  }, [])

  const resetBoard = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    dyingRef.current = false
    deathAtRef.current = null
    snakeRef.current = INITIAL_SNAKE.map((c) => ({ ...c }))
    dirRef.current = { x: 1, y: 0 }
    queueRef.current = []
    accumRef.current = 0
    particlesRef.current = []
    popupsRef.current = []
    spawnFood()
  }, [spawnFood])

  const startGame = useCallback(() => {
    ensureAudio()
    resetBoard()
    scoreRef.current = 0
    stepsRef.current = BASE_STEPS
    submittedRef.current = false
    recordRef.current = false
    setScore(0)
    setSpeedLabel(BASE_STEPS.toFixed(1))
    setResult(null)
    setSync(null)
    handlePhase('playing')
  }, [ensureAudio, handlePhase, resetBoard])

  const goMenu = useCallback(() => {
    resetBoard()
    scoreRef.current = 0
    stepsRef.current = BASE_STEPS
    setScore(0)
    setSpeedLabel(BASE_STEPS.toFixed(1))
    setResult(null)
    setSync(null)
    handlePhase('menu')
  }, [handlePhase, resetBoard])

  const togglePause = useCallback(() => {
    const p = phaseRef.current
    if (p === 'playing') {
      handlePhase('paused')
    } else if (p === 'paused') {
      accumRef.current = 0
      handlePhase('playing')
    }
  }, [handlePhase])

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current
    setMuted(mutedRef.current)
  }, [])

  const steer = useCallback((d: Cell) => {
    if (phaseRef.current !== 'playing' || dyingRef.current) return
    const q = queueRef.current
    const last = q.length > 0 ? q[q.length - 1] : dirRef.current
    if ((d.x === last.x && d.y === last.y) || (d.x === -last.x && d.y === -last.y)) return
    if (q.length < 3) q.push({ x: d.x, y: d.y })
  }, [])

  /** Back button — mid-run exits (score > 0) still commit the run once. */
  const handleExit = useCallback(() => {
    const p = phaseRef.current
    if (!submittedRef.current && scoreRef.current > 0 && (p === 'playing' || p === 'paused')) {
      commitRun(scoreRef.current)
    }
    onExit()
  }, [commitRun, onExit])

  /* --------------------------- engine (loop) --------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = performance.now()
    let disposed = false

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const size = Math.max(1, Math.floor(rect.width))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = size
      const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.34, size / 2, size / 2, size * 0.74)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.55)')
      vignetteRef.current = g
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const cell = () => sizeRef.current / GRID

    const burst = (gx: number, gy: number) => {
      const c = cell()
      const cx = (gx + 0.5) * c
      const cy = (gy + 0.5) * c
      const colors = ['#a3e635', '#e879f9', '#34d399']
      for (let i = 0; i < 7; i++) {
        const ang = (Math.PI * 2 * i) / 7 + Math.random() * 0.6
        const sp = c * (0.045 + Math.random() * 0.05)
        particlesRef.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          born: performance.now(),
          color: colors[i % colors.length],
        })
      }
      if (particlesRef.current.length > 80) {
        particlesRef.current.splice(0, particlesRef.current.length - 80)
      }
    }

    const die = (now: number) => {
      if (dyingRef.current) return
      dyingRef.current = true
      deathAtRef.current = now
      beep(220, 60, 300, 'sawtooth')
      commitRun(scoreRef.current)
      setResult({ score: scoreRef.current, record: recordRef.current })
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        dyingRef.current = false
        handlePhase('gameover')
      }, DEATH_DELAY_MS)
    }

    const step = (now: number) => {
      // consume one queued turn per step (skip same/opposite dirs)
      const q = queueRef.current
      while (q.length > 0) {
        const d = q.shift() as Cell
        const cur = dirRef.current
        const opposite = d.x === -cur.x && d.y === -cur.y
        const same = d.x === cur.x && d.y === cur.y
        if (!opposite && !same) {
          dirRef.current = d
          break
        }
      }
      const snake = snakeRef.current
      const head = snake[0]
      if (!head) return
      const nx = head.x + dirRef.current.x
      const ny = head.y + dirRef.current.y
      // walls kill (no wrap)
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
        die(now)
        return
      }
      const food = foodRef.current
      const eating = food !== null && nx === food.x && ny === food.y
      // self-collision (tail cell vacates unless growing)
      const limit = eating ? snake.length : snake.length - 1
      for (let i = 0; i < limit; i++) {
        if (snake[i].x === nx && snake[i].y === ny) {
          die(now)
          return
        }
      }
      snake.unshift({ x: nx, y: ny })
      if (eating) {
        const bonus = stepsRef.current > BONUS_SPEED_OVER ? Math.round(stepsRef.current) : 0
        const pts = FOOD_POINTS + bonus
        scoreRef.current += pts
        setScore(scoreRef.current)
        stepsRef.current = Math.min(MAX_STEPS, stepsRef.current + STEP_GAIN)
        setSpeedLabel(stepsRef.current.toFixed(1))
        burst(nx, ny)
        popupsRef.current.push({ x: nx, y: ny, text: `+${pts}`, born: now })
        beep(660, 880, 80, 'square')
        spawnFood()
      } else {
        snake.pop()
      }
    }

    const drawGrid = () => {
      const size = sizeRef.current
      const c = cell()
      ctx.strokeStyle = 'rgba(16,185,129,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 1; i < GRID; i++) {
        const p = i * c
        ctx.moveTo(p, 0)
        ctx.lineTo(p, size)
        ctx.moveTo(0, p)
        ctx.lineTo(size, p)
      }
      ctx.stroke()
    }

    const drawFood = (now: number) => {
      const f = foodRef.current
      if (!f) return
      const c = cell()
      const cx = (f.x + 0.5) * c
      const cy = (f.y + 0.5) * c
      const r = c * 0.32 * (1 + Math.sin(now / 220) * 0.12)
      ctx.save()
      ctx.shadowBlur = 16
      ctx.shadowColor = 'rgba(232,121,249,0.9)'
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0, '#fdf4ff')
      g.addColorStop(0.45, '#e879f9')
      g.addColorStop(1, 'rgba(217,70,239,0.05)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const drawSnake = () => {
      const snake = snakeRef.current
      const c = cell()
      const n = snake.length
      ctx.save()
      ctx.shadowBlur = 12
      ctx.shadowColor = 'rgba(52,211,153,0.8)'
      for (let i = n - 1; i >= 0; i--) {
        const s = snake[i]
        const k = n > 1 ? i / (n - 1) : 0 // 0 = head … 1 = tail
        ctx.fillStyle = i === 0 ? '#a7f3d0' : `rgba(52,211,153,${(0.95 - 0.55 * k).toFixed(3)})`
        rr(ctx, s.x * c + CELL_INSET, s.y * c + CELL_INSET, c - CELL_INSET * 2, c - CELL_INSET * 2, CELL_RADIUS)
        ctx.fill()
      }
      ctx.restore()
      // head eyes — two tiny dots offset by the current direction
      const head = snake[0]
      if (head) {
        const d = dirRef.current
        const hx = (head.x + 0.5) * c
        const hy = (head.y + 0.5) * c
        const fwd = c * 0.16
        const side = c * 0.18
        const r = Math.max(1.2, c * 0.07)
        ctx.fillStyle = '#022c22'
        for (const s of [-1, 1]) {
          ctx.beginPath()
          ctx.arc(hx + d.x * fwd - d.y * side * s, hy + d.y * fwd + d.x * side * s, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const drawFx = (now: number, dt: number) => {
      const c = cell()
      const parts = particlesRef.current
      const scale = dt / 16.7
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        const age = now - p.born
        if (age > 480) {
          parts.splice(i, 1)
          continue
        }
        const k = 1 - age / 480
        p.x += p.vx * scale
        p.y += p.vy * scale
        ctx.globalAlpha = k
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(1, c * 0.09 * k), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      const pops = popupsRef.current
      ctx.font = `800 ${Math.max(11, c * 0.55)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textAlign = 'center'
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]
        const age = now - p.born
        if (age > 700) {
          pops.splice(i, 1)
          continue
        }
        ctx.globalAlpha = 1 - age / 700
        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(232,121,249,0.8)'
        ctx.fillStyle = '#f0abfc'
        ctx.fillText(p.text, (p.x + 0.5) * c, (p.y + 0.5) * c - age * 0.025 - c * 0.2)
        ctx.shadowBlur = 0
      }
      ctx.globalAlpha = 1
    }

    const render = (now: number, dt: number) => {
      const size = sizeRef.current
      if (size <= 0) return
      // death: red flash + screen shake
      let sx = 0
      let sy = 0
      const deathAt = deathAtRef.current
      const shaking = deathAt !== null && now - deathAt < DEATH_FX_MS
      if (shaking && deathAt !== null) {
        const k = 1 - (now - deathAt) / DEATH_FX_MS
        const mag = 5 * k
        sx = (Math.random() * 2 - 1) * mag
        sy = (Math.random() * 2 - 1) * mag
      }
      ctx.fillStyle = '#050807'
      ctx.fillRect(0, 0, size, size)
      ctx.save()
      ctx.translate(sx, sy)
      drawGrid()
      drawFood(now)
      drawSnake()
      drawFx(now, dt)
      ctx.restore()
      if (vignetteRef.current) {
        ctx.fillStyle = vignetteRef.current
        ctx.fillRect(0, 0, size, size)
      }
      if (shaking && deathAt !== null) {
        const k = 1 - (now - deathAt) / DEATH_FX_MS
        ctx.fillStyle = `rgba(239,68,68,${(0.4 * k).toFixed(3)})`
        ctx.fillRect(0, 0, size, size)
      }
    }

    const tick = (now: number) => {
      if (disposed) return
      raf = requestAnimationFrame(tick)
      const dt = Math.min(now - last, 100)
      last = now
      if (phaseRef.current === 'playing' && !dyingRef.current) {
        accumRef.current += dt
        let interval = 1000 / stepsRef.current
        let guard = 0
        while (accumRef.current >= interval && guard < 8) {
          accumRef.current -= interval
          guard += 1
          step(now)
          if (phaseRef.current !== 'playing' || dyingRef.current) break
          interval = 1000 / stepsRef.current
        }
      }
      render(now, dt)
    }
    raf = requestAnimationFrame(tick)

    // auto-pause when the tab/app goes to the background
    const onVis = () => {
      if (document.hidden && phaseRef.current === 'playing' && !dyingRef.current) {
        handlePhase('paused')
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      const ac = audioRef.current
      audioRef.current = null
      if (ac) void ac.close().catch(() => undefined)
    }
  }, [beep, commitRun, handlePhase, spawnFood])

  /* ------------------------------ keyboard ------------------------------ */

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault()
      const p = phaseRef.current
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          steer(DIR_UP)
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          steer(DIR_DOWN)
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          steer(DIR_LEFT)
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          steer(DIR_RIGHT)
          break
        case ' ':
        case 'p':
        case 'P':
          if (!e.repeat) togglePause()
          break
        case 'Enter':
          if (!e.repeat && (p === 'menu' || p === 'gameover')) startGame()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [startGame, steer, togglePause])

  /* --------------------------- swipe handlers --------------------------- */

  const onSwipeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    swipeRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
  }

  const onSwipeEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current
    swipeRef.current = null
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    if (Math.max(ax, ay) < SWIPE_MIN_PX) return
    if (ax >= ay) steer({ x: dx > 0 ? 1 : -1, y: 0 })
    else steer({ x: 0, y: dy > 0 ? 1 : -1 })
  }

  /* ------------------------------- render ------------------------------- */

  return (
    <div
      className="flex w-full flex-col items-center gap-4 py-2"
      role="application"
      aria-label={t.snake.appAria}
    >
      {/* ------------------------------ HUD ------------------------------ */}
      <div className="flex w-full max-w-[440px] items-center gap-1">
        <button type="button" onClick={handleExit} aria-label={t.snake.backAria} className={ICON_BTN}>
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h2
          className="hidden min-w-0 flex-1 truncate text-[13px] font-black tracking-[0.16em] text-emerald-300 [text-shadow:0_0_14px_rgba(16,185,129,0.85)] min-[400px]:block"
        >
          {t.snake.title}
        </h2>

        <div className="ml-auto flex flex-none items-center gap-1">
          <div className="rounded-lg border border-white/15 bg-black/40 px-1.5 py-1 text-center">
            <div className="text-[8px] font-bold tracking-[0.18em] text-zinc-400">{t.snake.score}</div>
            <div className="text-sm font-black leading-none tabular-nums text-emerald-300">{score}</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-black/40 px-1.5 py-1 text-center">
            <div className="text-[8px] font-bold tracking-[0.18em] text-zinc-400">{t.snake.best}</div>
            <div className="text-sm font-black leading-none tabular-nums text-amber-300">{storedBest}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-1 text-center">
            <div className="text-[8px] font-bold tracking-[0.18em] text-emerald-500/80">{t.snake.speed}</div>
            <div className="text-sm font-black leading-none tabular-nums text-emerald-300">×{speedLabel}</div>
          </div>
          <button
            type="button"
            onClick={togglePause}
            disabled={phase !== 'playing' && phase !== 'paused'}
            aria-label={t.racing.pauseAria}
            className={ICON_BTN}
          >
            {phase === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? t.racing.unmuteAria : t.racing.muteAria}
            className={ICON_BTN}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* --------------------------- canvas panel --------------------------- */}
      <div className="relative aspect-square w-full max-w-[440px] overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#050807] shadow-[0_0_55px_-16px_rgba(16,185,129,0.6)]">
        <div
          ref={wrapRef}
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
          onPointerCancel={() => (swipeRef.current = null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
        </div>

        {/* menu overlay */}
        {phase === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 rounded-2xl bg-black/70 p-6 text-center backdrop-blur-sm"
          >
            <h3 className="text-4xl font-black tracking-[0.12em] text-emerald-300 [text-shadow:0_0_24px_rgba(16,185,129,0.9),0_0_60px_rgba(16,185,129,0.45)]">
              {t.snake.title}
            </h3>
            <div className="w-full max-w-[280px] rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <div className="text-[10px] font-black tracking-[0.3em] text-emerald-400">
                {t.snake.howtoTitle}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">{t.snake.howto1}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">{t.snake.howto2}</p>
            </div>
            <Button
              onClick={startGame}
              className="h-12 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-10 text-base font-black tracking-[0.2em] text-stone-950 shadow-[0_0_35px_-8px_rgba(16,185,129,0.9)] hover:brightness-110 active:scale-95"
            >
              <Play className="mr-2 h-5 w-5 fill-stone-950" />
              {t.snake.start}
            </Button>
          </motion.div>
        )}

        {/* paused overlay */}
        {phase === 'paused' && (
          <motion.div
            key="paused"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-2xl bg-black/70 p-6 backdrop-blur-sm"
          >
            <h3 className="text-2xl font-black tracking-[0.25em] text-emerald-300 [text-shadow:0_0_20px_rgba(16,185,129,0.8)]">
              {t.snake.paused}
            </h3>
            <div className="flex w-full max-w-[220px] flex-col gap-2">
              <Button
                onClick={togglePause}
                className="h-11 bg-gradient-to-r from-emerald-400 to-teal-500 font-black tracking-widest text-stone-950 hover:brightness-110"
              >
                <Play className="mr-2 h-4 w-4 fill-stone-950" /> {t.snake.resume}
              </Button>
              <Button
                onClick={startGame}
                variant="outline"
                className="h-10 border-white/25 bg-black/40 font-bold tracking-wide text-white hover:bg-white/10"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> {t.snake.restart}
              </Button>
              <Button
                onClick={handleExit}
                variant="outline"
                className="h-10 border-white/25 bg-black/40 font-bold tracking-wide text-white hover:bg-white/10"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> {t.snake.exit}
              </Button>
            </div>
          </motion.div>
        )}

        {/* game over overlay */}
        {phase === 'gameover' && result && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/75 p-5 text-center backdrop-blur-sm"
          >
            <h3 className="text-2xl font-black tracking-[0.2em] text-red-400 [text-shadow:0_0_22px_rgba(239,68,68,0.75)]">
              {t.snake.gameOver}
            </h3>
            {result.record && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 16 }}
                className="flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-500/20 px-3 py-1 text-xs font-black tracking-wider text-amber-300"
              >
                <Trophy className="h-3.5 w-3.5" /> {t.racing.newRecord}
              </motion.div>
            )}
            <div className="text-[10px] font-bold tracking-[0.3em] text-zinc-400">{t.snake.score}</div>
            <div className="-mt-2 text-5xl font-black tabular-nums text-emerald-300 [text-shadow:0_0_26px_rgba(16,185,129,0.8)]">
              {result.score}
            </div>
            <div className="h-5 text-[11px] font-semibold">
              {sync?.status === 'synced' && (
                <span className="text-emerald-400">
                  {t.common.syncSynced}
                  {typeof sync.rank === 'number' ? ' ' + fmt(t.common.syncRank, { n: sync.rank }) : ''}
                </span>
              )}
              {sync?.status === 'queued' && <span className="text-amber-300">{t.common.syncQueued}</span>}
              {sync?.status === 'offline' && <span className="text-amber-300">{t.common.syncOffline}</span>}
            </div>
            <div className="mt-1 flex w-full max-w-[220px] flex-col gap-2">
              <Button
                onClick={startGame}
                className="h-11 bg-gradient-to-r from-emerald-400 to-teal-500 font-black tracking-widest text-stone-950 hover:brightness-110"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> {t.snake.playAgain}
              </Button>
              <Button
                onClick={goMenu}
                variant="outline"
                className="h-10 border-white/25 bg-black/40 font-bold tracking-wide text-white hover:bg-white/10"
              >
                {t.snake.mainMenu}
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ------------------- on-screen D-pad (touch only) ------------------- */}
      {hasTouch && (
        <div className="grid w-full max-w-[440px] grid-cols-3 justify-items-center gap-2 select-none">
          <span aria-hidden="true" />
          <button
            type="button"
            aria-label={t.snake.steerUpAria}
            onPointerDown={(e) => {
              e.preventDefault()
              steer(DIR_UP)
            }}
            className={PAD_BTN}
          >
            <ChevronUp className="h-6 w-6" />
          </button>
          <span aria-hidden="true" />
          <button
            type="button"
            aria-label={t.snake.steerLeftAria}
            onPointerDown={(e) => {
              e.preventDefault()
              steer(DIR_LEFT)
            }}
            className={PAD_BTN}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label={t.snake.steerDownAria}
            onPointerDown={(e) => {
              e.preventDefault()
              steer(DIR_DOWN)
            }}
            className={PAD_BTN}
          >
            <ChevronDown className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label={t.snake.steerRightAria}
            onPointerDown={(e) => {
              e.preventDefault()
              steer(DIR_RIGHT)
            }}
            className={PAD_BTN}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  )
}
