'use client'

/**
 * Car Parking puzzle — Phase 5 (Day 71–90).
 *
 * Premium-exclusive sliding puzzle (free for everyone after PARKING_FREE_FROM).
 * 40 BFS-verified levels with exact par values; tap a car, tap a highlighted
 * destination (or use arrow keys). Stars, undo, level select, coins, global
 * leaderboard — everything works offline.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronLeft, Crown, Lock, RotateCcw, Star, Undo2, Grid3X3, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShareButton } from '@/components/share-button'
import { useI18n, fmt } from '@/lib/i18n'
import { LEVELS, LEVEL_COUNT, isSolved, slideVehicle, starsFor, type Vehicle } from '@/lib/parking/levels'
import { canPlayParking, isPremiumActive } from '@/lib/premium'
import { earnPlayCoins, computePlayCoins } from '@/lib/coins'
import { submitScore, type SubmitOutcome } from '@/lib/leaderboard'
import { readStoredNumber, writeStoredNumber, notifyStoreChange } from '@/lib/game-store'
import { checkAchievements } from '@/lib/achievements'
import { getLang } from '@/lib/i18n'
import { backupNow } from '@/lib/cloud'

/* ------------------------------ persistence ------------------------------ */

const STORE_KEY = 'gz-parking'
const BEST_KEY = 'gz-parking-best'

interface ParkingProgress {
  stars: Record<string, number>
  best: Record<string, number>
  unlocked: number
}

function readProgress(): ParkingProgress {
  if (typeof window === 'undefined') return { stars: {}, best: {}, unlocked: 1 }
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<ParkingProgress>) : {}
    return {
      stars: parsed.stars ?? {},
      best: parsed.best ?? {},
      unlocked: Math.max(1, Number(parsed.unlocked ?? 1)),
    }
  } catch {
    return { stars: {}, best: {}, unlocked: 1 }
  }
}

function writeProgress(p: ParkingProgress): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
  notifyStoreChange()
}

/** Total leaderboard score: solved levels ×100 + collected stars ×10. */
export function parkingTotalScore(progress: ParkingProgress): number {
  const solved = Object.keys(progress.stars).length
  const stars = Object.values(progress.stars).reduce((a, b) => a + b, 0)
  return solved * 100 + stars * 10
}

/* ------------------------------ visuals ------------------------------ */

const VEHICLE_STYLES: Record<string, string> = {
  A: 'from-sky-500 to-sky-700',
  B: 'from-emerald-500 to-emerald-700',
  C: 'from-violet-500 to-violet-700',
  D: 'from-orange-500 to-orange-700',
  E: 'from-teal-500 to-teal-700',
  F: 'from-rose-500 to-rose-700',
  G: 'from-yellow-500 to-yellow-700',
  H: 'from-fuchsia-500 to-fuchsia-700',
  I: 'from-lime-500 to-lime-700',
  J: 'from-cyan-600 to-cyan-800',
  K: 'from-indigo-500 to-indigo-700',
  L: 'from-amber-500 to-amber-700',
  M: 'from-pink-500 to-pink-700',
}

/* ------------------------------ component ------------------------------ */

interface Props {
  onExit: () => void
}

export function ParkingGame({ onExit }: Props) {
  const { t, lang } = useI18n()

  /* gate — re-evaluated on mount; premium flag change re-renders via hook */
  const gateAllowed = useMemo(() => canPlayParking(), [])
  const premium = isPremiumActive()

  const [view, setView] = useState<'select' | 'play'>('select')
  const [progress, setProgress] = useState<ParkingProgress>({ stars: {}, best: {}, unlocked: 1 })
  const [levelIdx, setLevelIdx] = useState(0)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)
  const [history, setHistory] = useState<Vehicle[][]>([])
  const [won, setWon] = useState(false)
  const [winStars, setWinStars] = useState(0)
  const [coinGrant, setCoinGrant] = useState<{ granted: number; base: number } | null>(null)
  const [sync, setSync] = useState<SubmitOutcome | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [newBestTotal, setNewBestTotal] = useState(false)

  const mountedRef = useRef(true)
  const finishedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /* Load progress after mount (hydration safe) */
  useEffect(() => {
    const id = window.setTimeout(() => setProgress(readProgress()), 0)
    return () => window.clearTimeout(id)
  }, [])

  const level = LEVELS[levelIdx]
  const par = level?.par ?? 0

  const loadLevel = useCallback((idx: number) => {
    setLevelIdx(idx)
    setVehicles(LEVELS[idx].vehicles.map((v) => ({ ...v })))
    setSelected(null)
    setMoves(0)
    setHistory([])
    setWon(false)
    setWinStars(0)
    setCoinGrant(null)
    setSync(null)
    setNewBestTotal(false)
    finishedRef.current = false
    setView('play')
  }, [])

  /* ------------------------------ destination dots ------------------------------ */

  const destinations = useMemo(() => {
    if (selected === null || !vehicles[selected]) return []
    const v = vehicles[selected]
    const out: Array<{ x: number; y: number; len: number; dir: string }> = []
    for (let c = 0; c < 6; c++) {
      const toX = v.dir === 'h' ? c : v.x
      const toY = v.dir === 'v' ? c : v.y
      if (toX === v.x && toY === v.y) continue
      if (slideVehicle(vehicles, selected, toX, toY)) {
        out.push({ x: toX, y: toY, len: v.len, dir: v.dir })
      }
    }
    return out
  }, [selected, vehicles])

  /* ------------------------------ move handling ------------------------------ */

  const doSlide = useCallback(
    (vi: number, toX: number, toY: number) => {
      if (won) return
      const next = slideVehicle(vehicles, vi, toX, toY)
      if (!next) return
      setHistory((h) => [...h.slice(-59), vehicles])
      setVehicles(next)
      setMoves((m) => m + 1)
      setSelected(null)

      if (isSolved(next)) {
        finishedRef.current = true
        const finalMoves = moves + 1
        const stars = starsFor(finalMoves, LEVELS[levelIdx].par)
        setWinStars(stars)
        setWon(true)

        // persist progress
        const prev = readProgress()
        const firstSolve = !(String(levelIdx + 1) in prev.stars)
        const nextProgress: ParkingProgress = {
          stars: { ...prev.stars, [String(levelIdx + 1)]: Math.max(prev.stars[String(levelIdx + 1)] ?? 0, stars) },
          best: {
            ...prev.best,
            [String(levelIdx + 1)]: Math.min(prev.best[String(levelIdx + 1)] ?? 999, finalMoves),
          },
          unlocked: Math.max(prev.unlocked, Math.min(LEVEL_COUNT, levelIdx + 2)),
        }
        writeProgress(nextProgress)
        setProgress(nextProgress)

        const total = parkingTotalScore(nextProgress)
        setTotalScore(total)
        const prevBest = readStoredNumber(BEST_KEY, 0)
        if (total > prevBest) {
          writeStoredNumber(BEST_KEY, total)
          setNewBestTotal(prevBest > 0)
        }

        // plays + achievements + coins (first solve grants a bonus)
        writeStoredNumber('gz-plays', readStoredNumber('gz-plays', 0) + 1)
        void checkAchievements(getLang())
        const base = computePlayCoins('parking', 150 * stars + (firstSolve ? 300 : 0))
        const granted = earnPlayCoins('parking', 150 * stars + (firstSolve ? 300 : 0))
        setCoinGrant({ granted, base })

        // leaderboard + premium cloud backup
        void submitScore('parking', total)
          .then((outcome) => {
            if (mountedRef.current) setSync(outcome)
          })
          .catch(() => {
            if (mountedRef.current) setSync({ status: 'queued' })
          })
        if (isPremiumActive()) void backupNow()
      }
    },
    [vehicles, won, moves, levelIdx]
  )

  /** Arrow keys: slide the selected vehicle as far as it will go. */
  const handleArrow = useCallback(
    (dx: number, dy: number) => {
      if (selected === null || won) return
      const v = vehicles[selected]
      if (!v) return
      if (v.dir === 'h' && dy !== 0) return
      if (v.dir === 'v' && dx !== 0) return
      const step = dx !== 0 ? dx : dy
      // find furthest legal destination in that direction
      let bestX = v.x
      let bestY = v.y
      for (let d = 1; d <= 6; d++) {
        const toX = v.dir === 'h' ? v.x + step * d : v.x
        const toY = v.dir === 'v' ? v.y + step * d : v.y
        if (!slideVehicle(vehicles, selected, toX, toY)) break
        bestX = toX
        bestY = toY
      }
      if (bestX !== v.x || bestY !== v.y) doSlide(selected, bestX, bestY)
    },
    [selected, vehicles, won, doSlide]
  )

  useEffect(() => {
    if (view !== 'play') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleArrow(-1, 0) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleArrow(1, 0) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); handleArrow(0, -1) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); handleArrow(0, 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, handleArrow])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0 || won) return h
      const prev = h[h.length - 1]
      setVehicles(prev)
      setMoves((m) => Math.max(0, m - 1))
      setSelected(null)
      return h.slice(0, -1)
    })
  }, [won])

  /* ------------------------------ locked card ------------------------------ */

  if (!gateAllowed) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-xl shadow-amber-900/40">
          <Crown className="h-8 w-8 text-stone-950" aria-hidden="true" />
        </div>
        <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-300">
          <Lock className="mr-1 h-3 w-3" />
          {t.parking.vipBadge}
        </Badge>
        <h2 className="text-xl font-black">{t.parking.lockedTitle}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">{t.parking.lockedDesc}</p>
        <Button onClick={onExit} variant="outline" className="mt-2 border-zinc-700 bg-zinc-900">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t.common.backToHub}
        </Button>
      </div>
    )
  }

  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0)
  const solvedCount = Object.keys(progress.stars).length

  /* ------------------------------ level select ------------------------------ */

  if (view === 'select') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex flex-col gap-4 pb-8"
      >
        {/* header */}
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onExit}
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            aria-label={t.common.backToHub}
          >
            <ChevronLeft className="h-4 w-4" />
            {t.common.backToHub}
          </Button>
          <div className="flex items-center gap-2">
            <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-300">
              <Crown className="mr-1 h-3 w-3" />
              VIP
            </Badge>
            <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300">
              ⭐ {totalStars}/{LEVEL_COUNT * 3}
            </Badge>
          </div>
        </div>

        <Card className="border-amber-500/25 bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900">
          <CardContent className="p-5">
            <h2 className="text-xl font-black">{t.parking.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{t.parking.selectDesc}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="rounded-full bg-zinc-800/80 px-3 py-1">{fmt(t.parking.statSolved, { n: solvedCount })}</span>
              <span className="rounded-full bg-zinc-800/80 px-3 py-1">
                {t.common.best} {readStoredNumber(BEST_KEY, 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* level grid */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3" role="grid" aria-label={t.parking.title}>
          {LEVELS.map((lv, i) => {
            const n = i + 1
            const stars = progress.stars[String(n)] ?? 0
            const locked = n > progress.unlocked
            return (
              <button
                key={n}
                onClick={() => !locked && loadLevel(i)}
                disabled={locked}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-bold transition-colors ${
                  locked
                    ? 'border-zinc-800 bg-zinc-900/40 text-zinc-600'
                    : stars > 0
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                }`}
                aria-label={`${t.parking.levelAria} ${n}${locked ? ' 🔒' : stars > 0 ? ' ⭐'.repeat(stars) : ''}`}
              >
                {locked ? <Lock className="h-4 w-4" aria-hidden="true" /> : n}
                {!locked && stars > 0 && (
                  <span className="absolute bottom-1 flex" aria-hidden="true">
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`h-2.5 w-2.5 ${s <= stars ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>
    )
  }

  /* ------------------------------ play view ------------------------------ */

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col gap-4 pb-8"
    >
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setView('select')}
          className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          aria-label={t.parking.levelsAria}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t.parking.levels}</span>
          <span className="tabular-nums"> {levelIdx + 1}</span>
        </Button>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
          <span className="rounded-full bg-zinc-800/80 px-3 py-1">
            {fmt(t.parking.movesLabel, { n: moves })} · {t.parking.parLabel} {par}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={undo}
            disabled={history.length === 0 || won}
            className="h-8 border-zinc-700 bg-zinc-900 px-2 text-zinc-200 hover:bg-zinc-800"
            aria-label={t.parking.undoAria}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadLevel(levelIdx)}
            className="h-8 border-zinc-700 bg-zinc-900 px-2 text-zinc-200 hover:bg-zinc-800"
            aria-label={t.parking.resetAria}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setView('select')}
            className="h-8 border-zinc-700 bg-zinc-900 px-2 text-zinc-200 hover:bg-zinc-800"
            aria-label={t.parking.levelsAria}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-center text-xs leading-relaxed text-zinc-500">{t.parking.howto}</p>

      {/* board */}
      <div className="relative mx-auto w-full max-w-[440px] select-none">
        <div
          className="relative aspect-square w-full overflow-hidden rounded-2xl border border-amber-500/20 bg-stone-900/80 shadow-2xl shadow-black/50"
          style={{
            /* exact cell math: 8px padding each side + 5×3px gaps */
            ['--cell' as string]: 'calc((100% - 31px) / 6)',
            ['--gap' as string]: '3px',
            ['--pad' as string]: '8px',
          }}
          role="application"
          aria-label={t.parking.title}
        >
          {/* parking slots */}
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-6" style={{ padding: 8, gap: 3 }} aria-hidden="true">
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} className="rounded-md border border-zinc-800/60 bg-stone-950/60" />
            ))
            }
          </div>

          {/* exit arrow on row 2 (y=2) */}
          <div
            className="pointer-events-none absolute flex items-center justify-end"
            style={{
              top: 'calc(var(--pad) + var(--gap) * 2 + var(--cell) * 2)',
              height: 'var(--cell)',
              right: 2,
              width: 'calc(var(--cell) * 0.55)',
              background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.22))',
              borderRadius: 6,
            }}
            aria-hidden="true"
          >
            <span className="text-base font-black text-amber-400">▶</span>
          </div>

          {/* destination dots */}
          {selected !== null &&
            destinations.map((d, i) => (
              <button
                key={`dot-${i}`}
                className="absolute z-10 flex items-center justify-center"
                style={{
                  left: `calc(var(--pad) + var(--gap) * ${d.x} + var(--cell) * ${d.x})`,
                  top: `calc(var(--pad) + var(--gap) * ${d.y} + var(--cell) * ${d.y})`,
                  width:
                    d.dir === 'h'
                      ? `calc(var(--cell) * ${d.len} + var(--gap) * ${d.len - 1})`
                      : 'var(--cell)',
                  height:
                    d.dir === 'v'
                      ? `calc(var(--cell) * ${d.len} + var(--gap) * ${d.len - 1})`
                      : 'var(--cell)',
                }}
                onClick={() => doSlide(selected, d.x, d.y)}
                aria-label={t.parking.moveHereAria}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" />
              </button>
            ))}

          {/* vehicles */}
          {vehicles.map((v, i) => {
            const isX = v.id === 'X'
            const isSelected = selected === i
            const w = v.dir === 'h' ? v.len : 1
            const h = v.dir === 'v' ? v.len : 1
            return (
              <button
                key={`${v.id}-${i}`}
                className={`absolute z-20 rounded-lg border transition-shadow ${
                  isX
                    ? 'border-red-300/60 bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-900/50'
                    : `border-white/20 bg-gradient-to-br ${VEHICLE_STYLES[v.id] ?? 'from-zinc-500 to-zinc-700'}`
                } ${isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-stone-900' : ''}`}
                style={{
                  left: `calc(var(--pad) + var(--gap) * ${v.x} + var(--cell) * ${v.x})`,
                  top: `calc(var(--pad) + var(--gap) * ${v.y} + var(--cell) * ${v.y})`,
                  width: `calc(var(--cell) * ${w} + var(--gap) * ${w - 1})`,
                  height: `calc(var(--cell) * ${h} + var(--gap) * ${h - 1})`,
                }}
                onClick={() => setSelected(isSelected ? null : i)}
                aria-label={`${isX ? t.parking.vipCarAria : t.parking.carAria} ${v.id}`}
              >
                {/* windshield strip */}
                <span
                  className="pointer-events-none absolute rounded-sm bg-white/25"
                  style={
                    v.dir === 'h'
                      ? { top: '18%', bottom: '18%', left: '30%', width: '14%' }
                      : { left: '18%', right: '18%', top: '30%', height: '14%' }
                  }
                  aria-hidden="true"
                />
                {isX && <span className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">👑</span>}
              </button>
            )
          })}
        </div>

        {/* win overlay — full-screen so it never collides with buttons below
            the board on small screens */}
        <AnimatePresence>
          {won && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/95 p-4 backdrop-blur-sm"
              role="dialog"
              aria-label={t.parking.solvedTitle}
            >
              <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
                <motion.div
                  initial={{ scale: 0.6, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-xl shadow-emerald-900/40"
                >
                  <Play className="h-7 w-7 text-stone-950" aria-hidden="true" />
                </motion.div>
                <h3 className="text-xl font-black text-emerald-300">{t.parking.solvedTitle}</h3>
                <div className="flex gap-1" aria-label={fmt(t.parking.starsEarned, { n: winStars })}>
                  {[1, 2, 3].map((s) => (
                    <motion.span
                      key={s}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15 + s * 0.15, type: 'spring', stiffness: 300, damping: 14 }}
                    >
                      <Star className={`h-7 w-7 ${s <= winStars ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`} />
                    </motion.span>
                  ))}
                </div>
                <p className="text-sm text-zinc-400">
                  {fmt(t.parking.movesVsPar, { n: moves, par })}
                </p>
                {coinGrant && (
                  <p className="text-sm font-bold text-amber-300">
                    🪙 +{coinGrant.granted} {premium ? '×2 VIP' : ''}
                  </p>
                )}
                {newBestTotal && <p className="text-xs font-bold text-emerald-300">{t.parking.newRecord}</p>}
                <p className="text-xs text-zinc-500">
                  {sync?.status === 'synced'
                    ? fmt(t.common.syncRank, { n: sync.rank ?? 0 }).trim()
                    : sync?.status === 'queued' || sync?.status === 'offline'
                      ? t.common.syncQueued
                      : sync?.status === 'rejected'
                        ? t.common.syncRejected
                        : parkingTotalScore(progress) > 0
                          ? fmt(t.parking.totalScore, { n: totalScore })
                          : ''}
                </p>
                <div className="mt-1 flex w-full flex-col gap-2">
                  {levelIdx + 1 < LEVEL_COUNT ? (
                    <Button
                      onClick={() => loadLevel(levelIdx + 1)}
                      className="h-11 bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
                    >
                      {t.parking.nextLevel}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setView('select')}
                      className="h-11 bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
                    >
                      {t.parking.allDone}
                    </Button>
                  )}
                  <Button
                    onClick={() => loadLevel(levelIdx)}
                    variant="outline"
                    className="h-10 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  >
                    {t.parking.replay}
                  </Button>
                  <div className="flex justify-center pt-1">
                    <ShareButton
                      text={fmt(t.common.shareScore, { n: totalScore, game: t.parking.title })}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Button
        onClick={onExit}
        variant="outline"
        className="mx-auto border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t.common.exitToHub}
      </Button>
    </motion.div>
  )
}
