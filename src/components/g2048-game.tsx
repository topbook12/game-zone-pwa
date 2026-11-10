'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, RotateCcw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { checkAchievements } from '@/lib/achievements'
import { readStoredNumber, STORAGE_KEYS, useStoredNumber, writeStoredNumber } from '@/lib/game-store'
import { submitScore, type SubmitOutcome } from '@/lib/leaderboard'
import { fmt, getLang, useI18n } from '@/lib/i18n'

/* ---------------------------------- types --------------------------------- */

type Dir = 'up' | 'down' | 'left' | 'right'
type Phase = 'playing' | 'won' | 'lost'

interface Tile {
  id: number
  value: number
  r: number
  c: number
}

interface Snapshot {
  tiles: Tile[]
  score: number
}

/** Slide result: `slid` renders the glide (merge pairs still doubled up), `final` + `spawn` commit after the transition. */
interface PendingMove {
  slid: Tile[]
  final: Tile[]
  spawn: Tile
  gained: number
  maxMerged: number
}

export interface G2048GameProps {
  onExit: () => void
}

/* ------------------------------- constants -------------------------------- */

const SWIPE_THRESHOLD = 24
const ANIM_MS = 110
const FLASH_MS = 900

/** Shared board geometry: 4x4 cells + 10px gap, resolved as percentages of the board. */
const BOARD_VARS = {
  '--gz-gap': '10px',
  '--gz-cell': 'calc((100% - 3 * var(--gz-gap)) / 4)',
} as CSSProperties

const KBD_CLASS = 'rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300'
const ARROW_KEYS = ['↑', '←', '↓', '→']
const WASD_KEYS = ['W', 'A', 'S', 'D']

const subscribeNoop = (): (() => void) => () => undefined

let TILE_SEQ = 0
function nextTileId(): number {
  TILE_SEQ += 1
  return TILE_SEQ
}

/* ----------------------------- pure game logic ---------------------------- */

function maxTileOf(tiles: Tile[]): number {
  let max = 0
  for (const tile of tiles) {
    if (tile.value > max) max = tile.value
  }
  return max
}

function hasMoves(tiles: Tile[]): boolean {
  if (tiles.length < 16) return true
  const values = new Map<number, number>()
  for (const tile of tiles) values.set(tile.r * 4 + tile.c, tile.value)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = values.get(r * 4 + c)
      if (v === undefined) return true
      if (c < 3 && values.get(r * 4 + c + 1) === v) return true
      if (r < 3 && values.get((r + 1) * 4 + c) === v) return true
    }
  }
  return false
}

function randomCellValue(): number {
  return Math.random() < 0.9 ? 2 : 4
}

function createInitialTiles(): Tile[] {
  const a = Math.floor(Math.random() * 16)
  const b = (a + 1 + Math.floor(Math.random() * 15)) % 16
  const make = (cell: number): Tile => ({
    id: nextTileId(),
    value: randomCellValue(),
    r: Math.floor(cell / 4),
    c: cell % 4,
  })
  return [make(a), make(b)]
}

function cellAt(dir: Dir, line: number, pos: number): { r: number; c: number } {
  if (dir === 'left') return { r: line, c: pos }
  if (dir === 'right') return { r: line, c: 3 - pos }
  if (dir === 'up') return { r: pos, c: line }
  return { r: 3 - pos, c: line }
}

/** Standard 2048 slide: tiles glide fully, equal pairs merge once per move. Returns null when nothing would move. */
function slideBoard(tiles: Tile[], dir: Dir): PendingMove | null {
  const grid: (Tile | null)[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => null as Tile | null),
  )
  for (const tile of tiles) grid[tile.r][tile.c] = tile

  const slid: Tile[] = []
  const finalTiles: Tile[] = []
  let gained = 0
  let maxMerged = 0
  let moved = false

  for (let line = 0; line < 4; line++) {
    const seq: Tile[] = []
    for (let pos = 0; pos < 4; pos++) {
      const cell = cellAt(dir, line, pos)
      const tile = grid[cell.r][cell.c]
      if (tile) seq.push(tile)
    }

    // Compact toward the wall; merge each equal pair at most once.
    const slots: { tile: Tile; eaten: Tile | null }[] = []
    for (const tile of seq) {
      const last = slots[slots.length - 1]
      if (last && last.eaten === null && last.tile.value === tile.value) {
        last.eaten = tile
      } else {
        slots.push({ tile, eaten: null })
      }
    }

    slots.forEach((slot, index) => {
      const cell = cellAt(dir, line, index)
      const survivor = { ...slot.tile, r: cell.r, c: cell.c }
      if (slot.tile.r !== cell.r || slot.tile.c !== cell.c) moved = true
      slid.push(survivor)
      if (slot.eaten) {
        moved = true
        // The eaten tile glides onto the survivor's cell; it disappears at commit.
        const eaten = { ...slot.eaten, r: cell.r, c: cell.c }
        slid.push(eaten)
        const value = survivor.value * 2
        gained += value
        if (value > maxMerged) maxMerged = value
        finalTiles.push({ ...survivor, value })
      } else {
        finalTiles.push(survivor)
      }
    })
  }

  if (!moved) return null

  // Spawn a new tile on the committed board.
  const occupied = new Set(finalTiles.map((tile) => tile.r * 4 + tile.c))
  const emptyCells: number[] = []
  for (let i = 0; i < 16; i++) {
    if (!occupied.has(i)) emptyCells.push(i)
  }
  if (emptyCells.length === 0) return null
  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)]
  const spawn: Tile = {
    id: nextTileId(),
    value: randomCellValue(),
    r: Math.floor(cell / 4),
    c: cell % 4,
  }
  return { slid, final: finalTiles, spawn, gained, maxMerged }
}

/* ------------------------------ visual helpers ---------------------------- */

function tilePalette(value: number): string {
  switch (value) {
    case 2:
      return 'bg-zinc-300 text-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]'
    case 4:
      return 'bg-zinc-100 text-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]'
    case 8:
      return 'bg-amber-400 text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]'
    case 16:
      return 'bg-amber-500 text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]'
    case 32:
      return 'bg-orange-400 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)]'
    case 64:
      return 'bg-orange-500 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_0_14px_rgba(234,88,12,0.35)]'
    case 128:
      return 'bg-orange-600 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_0_18px_rgba(234,88,12,0.45)]'
    case 256:
      return 'bg-orange-600 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_0_24px_rgba(234,88,12,0.6)]'
    case 512:
      return 'bg-red-500 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_0_24px_rgba(239,68,68,0.5)]'
    case 1024:
      return 'bg-red-600 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_0_28px_rgba(239,68,68,0.6)]'
    default:
      return 'bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-stone-900 shadow-[inset_0_1px_2px_rgba(120,53,15,0.25),0_0_30px_rgba(251,191,36,0.5)]'
  }
}

function tileFontSize(value: number): string {
  if (value >= 10000) return 'text-lg sm:text-xl'
  if (value >= 1000) return 'text-xl sm:text-2xl'
  if (value >= 100) return 'text-2xl sm:text-3xl'
  return 'text-3xl sm:text-4xl'
}

function tilePosStyle(tile: Tile): CSSProperties {
  return {
    left: `calc(${tile.c} * (var(--gz-cell) + var(--gz-gap)))`,
    top: `calc(${tile.r} * (var(--gz-cell) + var(--gz-gap)))`,
    width: 'var(--gz-cell)',
    height: 'var(--gz-cell)',
  }
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[72px] rounded-xl border border-zinc-700/60 bg-zinc-800/80 px-3 py-1 text-center">
      <div className="text-[10px] font-bold tracking-widest text-amber-400/90">{label}</div>
      <div className="text-base font-black leading-tight tabular-nums text-white">
        {value.toLocaleString('en-US')}
      </div>
    </div>
  )
}

/* ------------------------------- component -------------------------------- */

export function G2048Game({ onExit }: G2048GameProps) {
  const { t } = useI18n()

  /* Reactive state (render) + mirrored refs (logic) so every callback stays stable. */
  const [tiles, setTiles] = useState<Tile[]>(() => createInitialTiles())
  const tilesRef = useRef<Tile[]>(tiles)
  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState<Phase>('playing')
  const phaseRef = useRef<Phase>('playing')
  const [history, setHistory] = useState<Snapshot | null>(null)
  const historyRef = useRef<Snapshot | null>(null)
  const [sync, setSync] = useState<SubmitOutcome | null>(null)
  const [flash, setFlash] = useState<{ n: number; k: number } | null>(null)

  const wonRef = useRef(false)
  const finishedRef = useRef(false)
  const pendingRef = useRef<PendingMove | null>(null)
  const commitTimerRef = useRef<number | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  const flashSeqRef = useRef(0)
  const pointerStartRef = useRef<{ x: number; y: number; id: number } | null>(null)
  const mountedRef = useRef(true)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const best = useStoredNumber(STORAGE_KEYS.g2048Best)
  // Tiles are random, so render them only after hydration (SSR shows the empty board).
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false)

  /* ------------------------------ end-of-run ------------------------------ */

  const finishRun = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    const finalScore = scoreRef.current
    const topTile = maxTileOf(tilesRef.current)
    writeStoredNumber(STORAGE_KEYS.g2048Best, Math.max(readStoredNumber(STORAGE_KEYS.g2048Best, 0), finalScore))
    writeStoredNumber(STORAGE_KEYS.g2048Tile, Math.max(readStoredNumber(STORAGE_KEYS.g2048Tile, 0), topTile))
    writeStoredNumber(STORAGE_KEYS.plays, readStoredNumber(STORAGE_KEYS.plays, 0) + 1)
    void checkAchievements(getLang())
    submitScore('g2048', finalScore)
      .then((outcome) => {
        if (mountedRef.current) setSync(outcome)
      })
      .catch(() => {
        if (mountedRef.current) setSync({ status: 'queued' })
      })
  }, [])

  /* ------------------------------ move engine ----------------------------- */

  const applyPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  /** Commit the slide: remove eaten tiles, double survivors, spawn, check win/lose. */
  const flushCommit = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current)
      commitTimerRef.current = null
    }
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null

    const board = [...pending.final, pending.spawn]
    tilesRef.current = board
    setTiles(board)

    if (pending.gained > 0) {
      flashSeqRef.current += 1
      setFlash({ n: pending.gained, k: flashSeqRef.current })
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setFlash(null), FLASH_MS)
    }

    if (!wonRef.current && pending.maxMerged >= 2048) {
      wonRef.current = true
      applyPhase('won')
    } else if (!hasMoves(board)) {
      applyPhase('lost')
      finishRun()
    }
  }, [applyPhase, finishRun])

  const handleMove = useCallback(
    (dir: Dir) => {
      if (phaseRef.current !== 'playing') return
      flushCommit() // settle any in-flight animation before sliding again

      const current = tilesRef.current
      const result = slideBoard(current, dir)
      if (!result) return

      historyRef.current = { tiles: current, score: scoreRef.current }
      setHistory(historyRef.current)

      const nextScore = scoreRef.current + result.gained
      scoreRef.current = nextScore
      setScore(nextScore)

      tilesRef.current = result.slid
      setTiles(result.slid)
      pendingRef.current = result
      commitTimerRef.current = window.setTimeout(flushCommit, ANIM_MS)
    },
    [flushCommit],
  )

  /* -------------------------------- actions ------------------------------- */

  const handleUndo = useCallback(() => {
    const snap = historyRef.current
    if (!snap || phaseRef.current !== 'playing') return
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current)
      commitTimerRef.current = null
    }
    pendingRef.current = null
    setFlash(null)
    tilesRef.current = snap.tiles
    setTiles(snap.tiles)
    scoreRef.current = snap.score
    setScore(snap.score)
    historyRef.current = null
    setHistory(null)
  }, [])

  const resetRun = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current)
      commitTimerRef.current = null
    }
    pendingRef.current = null
    finishedRef.current = false
    wonRef.current = false
    const fresh = createInitialTiles()
    tilesRef.current = fresh
    setTiles(fresh)
    scoreRef.current = 0
    setScore(0)
    historyRef.current = null
    setHistory(null)
    setSync(null)
    setFlash(null)
    applyPhase('playing')
  }, [applyPhase])

  const handleNewGame = useCallback(() => {
    flushCommit()
    if (!finishedRef.current && scoreRef.current > 0) finishRun()
    resetRun()
  }, [finishRun, flushCommit, resetRun])

  const handleExit = useCallback(() => {
    flushCommit()
    if (!finishedRef.current && scoreRef.current > 0) finishRun()
    onExit()
  }, [finishRun, flushCommit, onExit])

  const keepGoing = useCallback(() => applyPhase('playing'), [applyPhase])

  /* -------------------------------- effects ------------------------------- */

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current)
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current)
    }
  }, [])

  /* Keyboard: arrows + WASD; arrows must never scroll the page. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      let dir: Dir | null = null
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dir = 'up'
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          dir = 'down'
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dir = 'left'
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          dir = 'right'
          break
        default:
          return
      }
      event.preventDefault()
      handleMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleMove])

  /* Hard block touch scrolling over the board (belt & suspenders for touch-none). */
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const block = (event: TouchEvent): void => {
      event.preventDefault()
    }
    board.addEventListener('touchmove', block, { passive: false })
    return () => board.removeEventListener('touchmove', block)
  }, [])

  /* ------------------------------ swipe input ------------------------------ */

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
  }, [])

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = pointerStartRef.current
      pointerStartRef.current = null
      if (!start || event.pointerId !== start.id) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)
      if (Math.max(adx, ady) < SWIPE_THRESHOLD) return
      handleMove(adx >= ady ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
    },
    [handleMove],
  )

  const handlePointerCancel = useCallback(() => {
    pointerStartRef.current = null
  }, [])

  /* ------------------------------ derived UI ------------------------------ */

  let syncLine: ReactNode = null
  if (sync?.status === 'synced') {
    syncLine = (
      <span className="text-emerald-400">
        {t.common.syncSynced}
        {typeof sync.rank === 'number' ? ` ${fmt(t.common.syncRank, { n: sync.rank })}` : ''}
      </span>
    )
  } else if (sync?.status === 'queued') {
    syncLine = <span className="text-amber-300">{t.common.syncQueued}</span>
  } else if (sync?.status === 'offline') {
    syncLine = <span className="text-amber-300">{t.common.syncOffline}</span>
  }

  return (
    <div className="flex w-full flex-col items-center gap-4 py-2" role="application" aria-label={t.g2048.appAria}>
      {/* HUD */}
      <div className="flex w-full max-w-[440px] flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label={t.g2048.backAria}
              onClick={handleExit}
              className="shrink-0 border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-2xl font-black tracking-tight text-transparent">
              {t.g2048.title}
            </h2>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <StatBox label={t.g2048.score} value={score} />
            <StatBox label={t.g2048.best} value={best} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            onClick={handleNewGame}
            className="bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
          >
            <RotateCcw className="h-4 w-4" />
            {t.g2048.newGame}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            disabled={history === null || phase !== 'playing'}
            className="border-zinc-700 bg-zinc-800/80 font-bold text-zinc-200 hover:bg-zinc-700"
          >
            <Undo2 className="h-4 w-4" />
            {t.g2048.undo}
          </Button>
        </div>

        {/* Global sync status (reserved slot, no layout shift) */}
        <div className="flex h-5 items-center justify-center text-center text-[11px] font-semibold tracking-wide">
          {syncLine}
        </div>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className="relative aspect-square w-full max-w-[440px] touch-none select-none rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-[0_0_50px_-16px_rgba(245,158,11,0.4)]"
        style={BOARD_VARS}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="relative h-full w-full">
          {/* Empty cell backdrops */}
          <div className="grid h-full w-full grid-cols-4 grid-rows-4" style={{ gap: 'var(--gz-gap)' }}>
            {Array.from({ length: 16 }, (_, index) => (
              <div key={index} className="rounded-lg bg-zinc-800/50" />
            ))}
          </div>

          {/* Tiles */}
          {hydrated &&
            tiles.map((tile) => (
              <div
                key={tile.id}
                className="absolute left-0 top-0 transition-all duration-100 ease-out"
                style={tilePosStyle(tile)}
              >
                <motion.div
                  key={`${tile.id}-${tile.value}`}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                  className={cn(
                    'flex h-full w-full items-center justify-center rounded-lg border border-black/10 font-black tabular-nums',
                    tilePalette(tile.value),
                    tileFontSize(tile.value),
                  )}
                >
                  {tile.value}
                </motion.div>
              </div>
            ))}

          {/* Merge score flash */}
          <AnimatePresence>
            {flash !== null && (
              <motion.div
                key={flash.k}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                className="pointer-events-none absolute inset-x-0 top-1 z-30 text-center"
              >
                <span className="inline-block rounded-full bg-amber-500/25 px-3 py-1 text-xs font-black tracking-wide text-amber-300">
                  {fmt(t.g2048.mergedToast, { n: flash.n })}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Win overlay (shown once per run) */}
          <AnimatePresence>
            {phase === 'won' && (
              <motion.div
                key="win"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-stone-950/85 p-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.85, y: 14 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                  className="w-full max-w-[300px] rounded-2xl border border-amber-500/40 bg-zinc-900/95 p-5 text-center shadow-[0_0_40px_rgba(245,158,11,0.3)]"
                >
                  <h3 className="text-lg font-black tracking-wide text-amber-300">{t.g2048.winTitle}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-300">{t.g2048.winText}</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button onClick={keepGoing} className="bg-amber-500 font-bold text-stone-950 hover:bg-amber-400">
                      {t.g2048.keepGoing}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleNewGame}
                      className="border-zinc-700 bg-zinc-800/80 font-bold text-zinc-200 hover:bg-zinc-700"
                    >
                      {t.g2048.newGame}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Lose overlay */}
            {phase === 'lost' && (
              <motion.div
                key="lost"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-stone-950/85 p-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.85, y: 14 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                  className="w-full max-w-[300px] rounded-2xl border border-zinc-700 bg-zinc-900/95 p-5 text-center"
                >
                  <h3 className="text-lg font-black tracking-wide text-red-400">{t.g2048.loseTitle}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/5 p-2">
                      <div className="text-[9px] font-bold tracking-widest text-white/50">{t.g2048.score}</div>
                      <div className="text-sm font-black text-white">{score.toLocaleString('en-US')}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2">
                      <div className="text-[9px] font-bold tracking-widest text-white/50">{t.g2048.maxTile}</div>
                      <div className="text-sm font-black text-amber-300">{maxTileOf(tiles)}</div>
                    </div>
                  </div>
                  {sync !== null && (
                    <div className="mt-3 text-[11px] font-semibold tracking-wide">{syncLine}</div>
                  )}
                  <Button
                    onClick={handleNewGame}
                    className="mt-4 w-full bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
                  >
                    {t.g2048.playAgain}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* How to play */}
      <div className="w-full max-w-[440px] rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="text-[11px] font-black tracking-widest text-amber-400">{t.g2048.howtoTitle}</div>
        <ul className="mt-2 space-y-1 text-xs text-zinc-400">
          <li className="flex gap-2">
            <span className="text-amber-500">•</span>
            <span>{t.g2048.howto1}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500">•</span>
            <span>{t.g2048.howto2}</span>
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-3" aria-hidden="true">
          {ARROW_KEYS.map((glyph) => (
            <kbd key={glyph} className={KBD_CLASS}>
              {glyph}
            </kbd>
          ))}
          <span className="mx-1 text-[10px] text-zinc-600">/</span>
          {WASD_KEYS.map((glyph) => (
            <kbd key={glyph} className={KBD_CLASS}>
              {glyph}
            </kbd>
          ))}
        </div>
      </div>
    </div>
  )
}
