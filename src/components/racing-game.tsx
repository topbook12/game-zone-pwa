'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  Octagon,
  ChevronLeft as SteerLeft,
  ChevronRight as SteerRight,
  Smartphone,
} from 'lucide-react'
import { ShareButton } from '@/components/share-button'
import { Button } from '@/components/ui/button'
import { RacingEngine } from '@/lib/racing/engine'
import { SoundEngine } from '@/lib/racing/audio'
import type { GameEvent, GamePhase, GameResult, HudData } from '@/lib/racing/types'
import { readStoredNumber, writeStoredNumber, useStoredNumber, STORAGE_KEYS } from '@/lib/game-store'
import { submitScore, type SubmitOutcome } from '@/lib/leaderboard'
import { completeDaily } from '@/lib/daily'
import { checkAchievements } from '@/lib/achievements'
import { fmt, useI18n, getLang } from '@/lib/i18n'

const RING_R = 42
const RING_C = 2 * Math.PI * RING_R
const RING_MAX_KMH = 200

interface ResultState extends GameResult {
  isBest: boolean
}

/** Reactive matchMedia hook (hydration safe). */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

export interface RacingGameProps {
  onExit: () => void
  /** When set, every run replays the same seeded daily circuit. */
  dailySeed?: number | null
  /** Date label for the daily circuit, e.g. "10 Nov". */
  dailyDate?: string
}

export function RacingGame({ onExit, dailySeed, dailyDate }: RacingGameProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<RacingEngine | null>(null)
  const soundRef = useRef<SoundEngine | null>(null)
  const phaseRef = useRef<GamePhase>('menu')
  const toastTimer = useRef<number | null>(null)

  const [phase, setPhase] = useState<GamePhase>('menu')
  const [countdown, setCountdown] = useState(3)
  const [goFlash, setGoFlash] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const [result, setResult] = useState<ResultState | null>(null)
  const [sync, setSync] = useState<SubmitOutcome | null>(null)
  const [muted, setMuted] = useState(false)
  const [userTouched, setUserTouched] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [tiltOn, setTiltOn] = useState(
    () => typeof window !== 'undefined' && readStoredNumber('gz-racing-tilt', 0) === 1
  )
  const [hasTouchApi] = useState(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  )

  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const portrait = useMediaQuery('(orientation: portrait)')
  const storedBest = useStoredNumber(STORAGE_KEYS.racingBest)
  const touchMode = coarsePointer || userTouched || hasTouchApi

  /* Auto-gas follows touch mode (writes to the engine, not React state) */
  useEffect(() => {
    const en = engineRef.current
    if (en) en.autoGas = touchMode
  }, [touchMode])

  /* -------- HUD refs (updated per-frame without re-render) -------- */
  const speedNumRef = useRef<HTMLSpanElement | null>(null)
  const ringRef = useRef<SVGCircleElement | null>(null)
  const timeNumRef = useRef<HTMLSpanElement | null>(null)
  const timeCardRef = useRef<HTMLDivElement | null>(null)
  const scoreRef = useRef<HTMLSpanElement | null>(null)
  const distRef = useRef<HTMLSpanElement | null>(null)
  const ovtRef = useRef<HTMLSpanElement | null>(null)
  const nitroFillRef = useRef<HTMLDivElement | null>(null)

  const onFrame = useCallback((h: HudData) => {
    if (speedNumRef.current) speedNumRef.current.textContent = Math.round(h.speedKmh).toString()
    if (ringRef.current) {
      const p = Math.min(1, h.speedKmh / RING_MAX_KMH)
      ringRef.current.style.strokeDashoffset = `${RING_C * (1 - p)}`
    }
    if (timeNumRef.current) {
      timeNumRef.current.textContent = Math.max(0, Math.ceil(h.timeLeft)).toString()
    }
    if (timeCardRef.current) {
      const low = h.timeLeft < 10
      timeCardRef.current.classList.toggle('tr-time-low', low)
    }
    if (scoreRef.current) scoreRef.current.textContent = h.score.toLocaleString('en-US')
    if (distRef.current) distRef.current.textContent = `${h.distanceKm.toFixed(2)} km`
    if (ovtRef.current) ovtRef.current.textContent = h.overtakes.toString()
    if (nitroFillRef.current) {
      nitroFillRef.current.style.height = `${Math.round(h.nitro * 100)}%`
      nitroFillRef.current.style.background = h.nitroActive
        ? 'linear-gradient(to top, #fef08a, #f97316)'
        : 'linear-gradient(to top, #fbbf24, #ea580c)'
    }
  }, [])

  const handlePhase = useCallback((p: GamePhase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const handleEvent = useCallback((ev: GameEvent) => {
    if (ev.type === 'countdown') {
      setCountdown(ev.value)
      if (ev.value === 0) {
        setGoFlash(true)
        window.setTimeout(() => setGoFlash(false), 800)
      }
    } else if (ev.type === 'checkpoint') {
      setToast(`+${ev.bonus}s  CHECKPOINT`)
      setToastKey((k) => k + 1)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 1400)
    } else if (ev.type === 'gameover') {
      const prevBest = readStoredNumber(STORAGE_KEYS.racingBest, 0)
      const isBest = ev.result.score > prevBest
      if (isBest) writeStoredNumber(STORAGE_KEYS.racingBest, ev.result.score)
      writeStoredNumber(STORAGE_KEYS.plays, readStoredNumber(STORAGE_KEYS.plays, 0) + 1)
      if (dailySeed != null) {
        completeDaily('racing', ev.result.score)
        checkAchievements(getLang())
      }
      setResult({ ...ev.result, isBest })
      setSync(null)
      submitScore('racing', ev.result.score)
        .then(setSync)
        .catch(() => setSync({ status: 'queued' }))
    } else if (ev.type === 'crash') {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60)
    }
  }, [dailySeed])

  /* -------- actions -------- */
  const handleStart = useCallback(() => {
    soundRef.current?.ensure()
    setResult(null)
    engineRef.current?.startGame()
  }, [])

  const togglePause = useCallback(() => {
    const en = engineRef.current
    if (!en) return
    const p = phaseRef.current
    if (p === 'playing' || p === 'countdown') {
      en.pause()
    } else if (p === 'paused') {
      soundRef.current?.ensure()
      en.resume()
      soundRef.current?.startEngine()
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      soundRef.current?.setMuted(next)
      return next
    })
  }, [])

  const toggleFullscreen = useCallback(() => {
    const doIt = async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen()
        } else {
          await document.documentElement.requestFullscreen()
        }
      } catch {
        /* not supported / denied */
      }
    }
    void doIt()
  }, [])

  /** Toggle tilt steering (requests iOS motion permission when needed). */
  const toggleTilt = useCallback(() => {
    setTiltOn((prev) => {
      const next = !prev
      writeStoredNumber('gz-racing-tilt', next ? 1 : 0)
      if (next) {
        const DOE = window.DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<string>
        }
        if (DOE && typeof DOE.requestPermission === 'function') {
          void DOE.requestPermission().catch(() => undefined)
        }
      }
      return next
    })
  }, [])

  /* -------- tilt steering → analog input -------- */
  useEffect(() => {
    if (!tiltOn) return
    const handler = (e: DeviceOrientationEvent) => {
      const en = engineRef.current
      if (!en || e.gamma == null || e.beta == null) return
      const so =
        typeof screen !== 'undefined' && screen.orientation
          ? screen.orientation.angle
          : ((window as unknown as { orientation?: number }).orientation ?? 0)
      let tilt: number
      if (so === 90) tilt = e.beta / 45
      else if (so === 270 || so === -90) tilt = -e.beta / 45
      else if (so === 180) tilt = -e.gamma / 45
      else tilt = e.gamma / 45
      en.input.steerAnalog = Math.max(-1, Math.min(1, tilt))
    }
    window.addEventListener('deviceorientation', handler)
    return () => {
      window.removeEventListener('deviceorientation', handler)
      if (engineRef.current) engineRef.current.input.steerAnalog = 0
    }
  }, [tiltOn])

  const backToMenu = useCallback(() => {
    setResult(null)
    engineRef.current?.toMenu()
  }, [])

  /* -------- engine bootstrap -------- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sound = new SoundEngine()
    soundRef.current = sound
    const engine = new RacingEngine(canvas, { onFrame, onPhase: handlePhase, onEvent: handleEvent }, sound)
    engineRef.current = engine
    engine.setDaily(dailySeed ?? null)
    engine.boot()

    const ro = new ResizeObserver(() => engine.resize())
    ro.observe(canvas)

    const onVis = () => {
      if (document.hidden) engine.pause()
    }
    document.addEventListener('visibilitychange', onVis)

    const fsHandler = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', fsHandler)

    const firstTouch = () => setUserTouched(true)
    window.addEventListener('touchstart', firstTouch, { once: true, passive: true })

    return () => {
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('fullscreenchange', fsHandler)
      window.removeEventListener('touchstart', firstTouch)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      engine.shutdown()
    }
  }, [onFrame, handlePhase, handleEvent, dailySeed])

  /* -------- keyboard -------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const en = engineRef.current
      if (!en) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
      }
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          en.input.left = true
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          en.input.right = true
          break
        case 'ArrowUp':
        case 'w':
        case 'W':
          en.input.gas = true
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          en.input.brake = true
          break
        case 'Shift':
        case 'n':
        case 'N':
          en.input.nitro = true
          break
        case 'p':
        case 'P':
        case 'Escape':
          if (!e.repeat) togglePause()
          break
        case 'm':
        case 'M':
          if (!e.repeat) toggleMute()
          break
        case 'Enter':
          if (!e.repeat && (phaseRef.current === 'menu' || phaseRef.current === 'gameover')) {
            handleStart()
          }
          break
        default:
          break
      }
    }
    const up = (e: KeyboardEvent) => {
      const en = engineRef.current
      if (!en) return
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          en.input.left = false
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          en.input.right = false
          break
        case 'ArrowUp':
        case 'w':
        case 'W':
          en.input.gas = false
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          en.input.brake = false
          break
        case 'Shift':
        case 'n':
        case 'N':
          en.input.nitro = false
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [handleStart, togglePause, toggleMute])

  /* -------- touch input binding -------- */
  const bind = (key: 'left' | 'right' | 'brake' | 'nitro') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      setUserTouched(true)
      const en = engineRef.current
      if (en) en.input[key] = true
    },
    onPointerUp: () => {
      const en = engineRef.current
      if (en) en.input[key] = false
    },
    onPointerCancel: () => {
      const en = engineRef.current
      if (en) en.input[key] = false
    },
    onLostPointerCapture: () => {
      const en = engineRef.current
      if (en) en.input[key] = false
    },
  })

  /* Invisible half-screen steering zones — press & hold anywhere */
  const zoneBind = (side: 'left' | 'right') => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      setUserTouched(true)
      const en = engineRef.current
      if (en) en.input[side] = true
    },
    onPointerEnter: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons > 0) {
        const en = engineRef.current
        if (en) en.input[side] = true
      }
    },
    onPointerUp: () => {
      const en = engineRef.current
      if (en) en.input[side] = false
    },
    onPointerCancel: () => {
      const en = engineRef.current
      if (en) en.input[side] = false
    },
    onPointerLeave: () => {
      const en = engineRef.current
      if (en) en.input[side] = false
    },
  })

  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/90 backdrop-blur-md transition hover:bg-black/60 active:scale-90'

  const showHud = phase === 'countdown' || phase === 'playing' || phase === 'gameover'

  return (
    <div
      className="fixed inset-0 z-50 touch-none select-none overflow-hidden bg-[#140b06]"
      onContextMenu={(e) => e.preventDefault()}
      role="application"
      aria-label={t.racing.appAria}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* ---------------- HUD ---------------- */}
      {showHud && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* top bar */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            {/* score */}
            <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur-md">
              <div className="text-[9px] font-bold tracking-[0.2em] text-white/60">{t.racing.hudScore}</div>
              <span ref={scoreRef} className="text-xl font-black tabular-nums text-amber-300">
                0
              </span>
              <div className="mt-0.5 text-[10px] font-semibold text-white/70">
                {t.racing.hudOvertakes} <span ref={ovtRef} className="text-white">0</span>
              </div>
            </div>

            {/* time */}
            <div
              ref={timeCardRef}
              className="rounded-xl border border-white/15 bg-black/40 px-5 py-1.5 text-center backdrop-blur-md"
            >
              <div className="text-[9px] font-bold tracking-[0.2em] text-white/60">{t.racing.hudTime}</div>
              <span ref={timeNumRef} className="text-2xl font-black tabular-nums text-white">
                60
              </span>
            </div>

            {/* buttons */}
            <div className="pointer-events-auto flex gap-2">
              <button onClick={togglePause} className={iconBtn} aria-label={t.racing.pauseAria}>
                <Pause className="h-5 w-5" />
              </button>
              <button onClick={toggleMute} className={iconBtn} aria-label={muted ? t.racing.unmuteAria : t.racing.muteAria}>
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button onClick={toggleFullscreen} className={iconBtn} aria-label={t.racing.fsAria}>
                {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* checkpoint toast */}
          <div className="absolute inset-x-0 top-[88px] flex justify-center">
            <AnimatePresence>
              {toast && (
                <motion.div
                  key={toastKey}
                  initial={{ opacity: 0, y: -14, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-full border border-amber-300/50 bg-amber-500/25 px-5 py-1.5 text-sm font-black tracking-widest text-amber-200 backdrop-blur-md"
                >
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* rotate hint on portrait phones */}
          {touchMode && portrait && phase === 'playing' && (
            <div className="absolute inset-x-0 top-[136px] flex justify-center">
              <div className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-md">
                <Smartphone className="h-3.5 w-3.5 animate-pulse" />
                {t.racing.rotate}
              </div>
            </div>
          )}

          {/* bottom-left stats */}
          <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 sm:left-5">
            <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur-md">
              <div className="text-[9px] font-bold tracking-[0.2em] text-white/60">{t.racing.hudDistance}</div>
              <span ref={distRef} className="text-sm font-bold tabular-nums text-white/90">
                0.00 km
              </span>
            </div>
            {!touchMode && (
              <div className="mt-2 hidden text-[10px] font-medium tracking-wide text-white/50 sm:block">
                {t.racing.kbHint}
              </div>
            )}
          </div>

          {/* bottom-right: speedometer + nitro */}
          <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 flex items-end gap-2 sm:right-5">
            <div className="flex flex-col items-center gap-1">
              <div className="relative h-6 w-3 overflow-hidden rounded-full border border-white/25 bg-black/40">
                <div
                  ref={nitroFillRef}
                  className="absolute bottom-0 left-0 w-full rounded-full"
                  style={{ height: '50%', background: 'linear-gradient(to top, #fbbf24, #ea580c)' }}
                />
              </div>
              <span className="text-[8px] font-black tracking-widest text-amber-300">{t.racing.hudNitro}</span>
            </div>
            <div className="relative h-[96px] w-[96px] sm:h-[116px] sm:w-[116px]">
              <svg viewBox="0 0 104 104" className="h-full w-full drop-shadow-lg">
                <circle cx="52" cy="52" r={RING_R} fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.14)" strokeWidth="8" />
                <circle
                  ref={ringRef}
                  cx="52"
                  cy="52"
                  r={RING_R}
                  fill="none"
                  stroke="url(#speedGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C}
                  transform="rotate(-90 52 52)"
                />
                <defs>
                  <linearGradient id="speedGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="70%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span ref={speedNumRef} className="text-2xl font-black tabular-nums text-white sm:text-3xl">
                  0
                </span>
                <span className="text-[8px] font-bold tracking-[0.2em] text-white/60">{t.racing.hudKmh}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- touch controls ---------------- */}
      {touchMode && phase === 'playing' && (
        <>
          {/* press-and-hold anywhere: left half / right half steer */}
          <div className="absolute inset-x-0 bottom-0 top-[24%] z-[15] flex" aria-hidden="true">
            <div {...zoneBind('left')} className="h-full w-1/2" />
            <div {...zoneBind('right')} className="h-full w-1/2" />
          </div>
          <div className="pointer-events-none absolute bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+5.25rem))] left-4 z-20 flex gap-3">
            <button
              {...bind('left')}
              aria-label={t.racing.steerLeftAria}
              className="pointer-events-auto flex h-[84px] w-[84px] items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg backdrop-blur-md transition active:scale-90 active:bg-white/25"
            >
              <SteerLeft className="h-10 w-10" />
            </button>
            <button
              {...bind('right')}
              aria-label={t.racing.steerRightAria}
              className="pointer-events-auto flex h-[84px] w-[84px] items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg backdrop-blur-md transition active:scale-90 active:bg-white/25"
            >
              <SteerRight className="h-10 w-10" />
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+5.25rem))] right-4 z-20 flex items-end gap-3">
            <button
              {...bind('brake')}
              aria-label={t.racing.brakeAria}
              className="pointer-events-auto flex h-16 w-[88px] items-center justify-center gap-1 rounded-2xl border border-red-300/40 bg-red-600/55 text-xs font-black tracking-widest text-white shadow-lg backdrop-blur-md transition active:scale-90 active:bg-red-500/70"
            >
              <Octagon className="h-4 w-4" />
              {t.racing.brake}
            </button>
            <button
              {...bind('nitro')}
              aria-label={t.racing.nitroAria}
              className="pointer-events-auto flex h-[88px] w-[88px] flex-col items-center justify-center gap-0.5 rounded-full border border-amber-300/50 bg-amber-500/60 text-xs font-black tracking-widest text-stone-950 shadow-lg shadow-amber-900/40 backdrop-blur-md transition active:scale-90 active:bg-amber-400/80"
            >
              <Zap className="h-6 w-6" />
              {t.racing.nitro}
            </button>
          </div>
        </>
      )}

      {/* ---------------- menu ---------------- */}
      <AnimatePresence>
        {phase === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-black/75 via-black/45 to-black/80 p-4"
          >
            <button
              onClick={onExit}
              className={iconBtn + ' absolute left-3 top-3 pt-[max(0px,env(safe-area-inset-top))]'}
              aria-label={t.racing.backAria}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
              <div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[10px] font-bold tracking-[0.25em] text-amber-300">
                  {dailySeed != null ? (
                    <>
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                      {t.racing.dailyBadge}
                      {dailyDate ? ` · ${dailyDate}` : ''}
                    </>
                  ) : (
                    t.racing.menuBadge
                  )}
                </div>
                <h1 className="text-5xl font-black italic tracking-tight sm:text-6xl">
                  <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 bg-clip-text text-transparent drop-shadow-[0_4px_18px_rgba(234,88,12,0.45)]">
                    TURBO RUSH
                  </span>
                </h1>
                <p className="mt-1.5 text-xs font-bold tracking-[0.35em] text-white/60">
                  {dailySeed != null && dailyDate ? `DAILY CIRCUIT · ${dailyDate}` : t.racing.circuit}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-sm text-white/85 backdrop-blur-md">
                <Trophy className="h-4 w-4 text-amber-400" />
                {t.racing.bestScore}{' '}
                <span className="font-black text-amber-300">
                  {storedBest.toLocaleString('en-US')}
                </span>
              </div>

              <Button
                onClick={handleStart}
                className="h-14 rounded-2xl bg-gradient-to-b from-orange-400 to-red-500 px-12 text-lg font-black tracking-[0.15em] text-white shadow-[0_12px_36px_-8px_rgba(234,88,12,0.8)] transition hover:brightness-110 active:scale-95"
              >
                <Play className="mr-2 h-5 w-5 fill-white" />
                {t.racing.startRace}
              </Button>

              <div className="grid w-full gap-2 text-left text-[11px] leading-relaxed text-white/65 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-sm">
                  <div className="mb-1 text-[10px] font-black tracking-[0.2em] text-amber-300">{t.racing.touchTitle}</div>
                  {t.racing.touchLine1}
                  <br />
                  {t.racing.touchLine2}
                </div>
                <div className="rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-sm">
                  <div className="mb-1 text-[10px] font-black tracking-[0.2em] text-amber-300">{t.racing.kbTitle}</div>
                  {t.racing.kbLine1}
                  <br /> {t.racing.kbLine2}
                </div>
              </div>

              <button
                onClick={toggleTilt}
                aria-pressed={tiltOn}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                  tiltOn
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                    : 'border-white/20 bg-black/40 text-white/70 hover:bg-white/10'
                }`}
              >
                <Smartphone className={`h-4 w-4 ${tiltOn ? 'animate-pulse' : ''}`} />
                {tiltOn ? t.racing.tiltOn : t.racing.tiltOff}
              </button>

              <p className="max-w-sm text-[11px] leading-relaxed text-white/50">
                {t.racing.menuDesc}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- countdown ---------------- */}
      {phase === 'countdown' && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span key={countdown} className="tr-pop text-[120px] font-black italic text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)] sm:text-[160px]">
            {countdown}
          </span>
        </div>
      )}
      {goFlash && phase === 'playing' && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="tr-pop text-[110px] font-black italic text-amber-300 drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)] sm:text-[150px]">
            GO!
          </span>
        </div>
      )}

      {/* ---------------- paused ---------------- */}
      <AnimatePresence>
        {phase === 'paused' && (
          <motion.div
            key="paused"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="flex w-full max-w-xs flex-col items-center gap-4 p-6 text-center">
              <h2 className="text-3xl font-black tracking-[0.2em] text-white">{t.racing.paused}</h2>
              <div className="flex w-full flex-col gap-2">
                <Button
                  onClick={togglePause}
                  className="h-12 bg-gradient-to-b from-orange-400 to-red-500 text-base font-black tracking-widest text-white hover:brightness-110"
                >
                  <Play className="mr-2 h-5 w-5 fill-white" /> {t.racing.resume}
                </Button>
                <Button
                  onClick={handleStart}
                  variant="outline"
                  className="h-11 border-white/25 bg-black/40 font-bold tracking-wide text-white hover:bg-white/10"
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> {t.racing.restart}
                </Button>
                <Button
                  onClick={onExit}
                  variant="outline"
                  className="h-11 border-white/25 bg-black/40 font-bold tracking-wide text-white hover:bg-white/10"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> {t.racing.exit}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- game over ---------------- */}
      <AnimatePresence>
        {phase === 'gameover' && result && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-black/80 via-black/65 to-black/85 p-4"
          >
            <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
              <h2 className="text-4xl font-black italic tracking-tight text-white">{t.racing.timeUp}</h2>
              {result.isBest && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 16 }}
                  className="flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-500/20 px-4 py-1.5 text-sm font-black tracking-wider text-amber-300"
                >
                  <Trophy className="h-4 w-4" /> {t.racing.newRecord}
                </motion.div>
              )}

              <div className="w-full rounded-2xl border border-white/15 bg-black/45 p-4 backdrop-blur-md">
                <div className="text-[10px] font-bold tracking-[0.25em] text-white/55">{t.racing.finalScore}</div>
                <div className="text-5xl font-black tabular-nums text-amber-300">
                  {result.score.toLocaleString('en-US')}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/5 p-2">
                    <div className="text-[9px] font-bold tracking-widest text-white/50">{t.racing.statDistance}</div>
                    <div className="text-sm font-black text-white">{result.distanceKm.toFixed(2)} km</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2">
                    <div className="text-[9px] font-bold tracking-widest text-white/50">{t.racing.statOvertakes}</div>
                    <div className="text-sm font-black text-white">{result.overtakes}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2">
                    <div className="text-[9px] font-bold tracking-widest text-white/50">{t.racing.statTopSpeed}</div>
                    <div className="text-sm font-black text-white">{Math.round(result.topSpeedKmh)}</div>
                  </div>
                </div>
              </div>

              {/* Global sync status */}
              <div className="h-5 text-[11px] font-semibold tracking-wide">
                {sync?.status === 'synced' && (
                  <span className="text-emerald-400">
                    {t.common.syncSynced}
                    {typeof sync.rank === 'number'
                      ? ' ' + fmt(t.common.syncRank, { n: sync.rank })
                      : ''}
                  </span>
                )}
                {sync?.status === 'queued' && (
                  <span className="text-amber-300">{t.common.syncQueued}</span>
                )}
                {sync?.status === 'offline' && (
                  <span className="text-amber-300">{t.common.syncOffline}</span>
                )}
                {sync?.status === 'rejected' && (
                  <span className="text-rose-400">{t.common.syncRejected}</span>
                )}
              </div>

              <div className="flex w-full flex-col gap-2">
                <Button
                  onClick={handleStart}
                  className="h-12 bg-gradient-to-b from-orange-400 to-red-500 text-base font-black tracking-widest text-white hover:brightness-110"
                >
                  <RotateCcw className="mr-2 h-5 w-5" /> {t.racing.raceAgain}
                </Button>
                <ShareButton
                  size="default"
                  title={t.hub.racingTitle}
                  text={fmt(t.common.shareScore, { n: result.score, game: t.hub.racingTitle })}
                  className="h-11 border-zinc-700 bg-zinc-900/80 font-bold tracking-wide text-zinc-200 hover:bg-zinc-800 hover:text-amber-300"
                />
                <Button
                  onClick={backToMenu}
                  variant="outline"
                  className="h-11 border-white/25 bg-black/40 font-bold tracking-wide text-white hover:bg-white/10"
                >
                  {t.racing.mainMenu}
                </Button>
                <Button
                  onClick={onExit}
                  variant="ghost"
                  className="h-10 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> {t.common.exitToHub}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
