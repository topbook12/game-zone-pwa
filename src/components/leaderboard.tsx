'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trophy, RefreshCw, CloudOff, Check, Pencil, Medal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  fetchTopScores,
  getPlayerName,
  setPlayerName,
  initLeaderboardSync,
  type GameId,
  type ScoreRow,
  type TopCache,
} from '@/lib/leaderboard'
import { useI18n } from '@/lib/i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const medalFor = (rank: number) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

function formatWhen(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TopList({ cache, emptyLabel }: { cache: TopCache | undefined; emptyLabel: string }) {
  if (!cache) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg bg-zinc-800" />
        ))}
      </div>
    )
  }
  const rows = cache.rows
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-zinc-400">{emptyLabel}</div>
  }
  return (
    <ol className="flex max-h-[46dvh] flex-col gap-1.5 overflow-y-auto py-1 pr-1 [scrollbar-width:thin]">
      {rows.map((row, i) => (
        <li
          key={`${row.player}-${row.at}-${i}`}
          className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2"
        >
          <span className="w-9 shrink-0 text-center text-sm font-bold text-amber-300">
            {medalFor(i + 1)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
            {row.player}
          </span>
          <span className="shrink-0 text-xs text-zinc-500">{formatWhen(row.at)}</span>
          <span className="shrink-0 text-sm font-bold text-amber-300">
            {row.score.toLocaleString('en-US')}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Global leaderboard dialog — reads through the offline cache when offline. */
export function Leaderboard({ open, onOpenChange }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<GameId>('racing')
  /** Scores per game — undefined = still loading (skeleton). */
  const [byGame, setByGame] = useState<Partial<Record<GameId, TopCache>>>({})
  const [reloadKey, setReloadKey] = useState(0)
  /** Lazy init is SSR-safe: the dialog content is never rendered server-side. */
  const [name, setName] = useState('Player')
  const [editing, setEditing] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  /* Flush queued scores once on mount + whenever the device comes back online */
  useEffect(() => initLeaderboardSync(), [])

  /* Read the stored player name only after mount (client-only value) */
  useEffect(() => {
    const id = window.setTimeout(() => setName(getPlayerName()), 0)
    return () => window.clearTimeout(id)
  }, [])

  /* Fetch top scores whenever the dialog opens / tab changes / refresh clicked */
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchTopScores(tab, 10).then((cache) => {
      if (!cancelled) setByGame((prev) => ({ ...prev, [tab]: cache }))
    })
    return () => {
      cancelled = true
    }
  }, [open, tab, reloadKey])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  const saveName = () => {
    const clean = setPlayerName(name)
    setName(clean)
    setEditing(false)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1500)
  }

  const cache = byGame[tab]
  const stale = cache?.stale ?? false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-stone-950 text-zinc-100 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <Trophy className="h-5 w-5 text-amber-400" />
            {t.board.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{t.board.desc}</DialogDescription>
        </DialogHeader>

        {/* Player name */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5">
          <Medal className="ml-1 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
          {editing ? (
            <>
              <Input
                autoFocus
                value={name}
                maxLength={16}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                className="h-8 border-zinc-700 bg-zinc-950 text-sm"
                aria-label={t.board.nameAria}
                placeholder={t.board.namePlaceholder}
              />
              <Button
                size="sm"
                className="h-8 bg-amber-500 text-stone-950 hover:bg-amber-400"
                onClick={saveName}
              >
                <Check className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 truncate text-sm font-semibold">{name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-zinc-400 hover:bg-zinc-800 hover:text-amber-300"
                onClick={() => setEditing(true)}
                aria-label={t.board.editNameAria}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {savedFlash && (
                <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                  {t.board.saved}
                </Badge>
              )}
            </>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as GameId)}>
          <TabsList className="grid w-full grid-cols-2 bg-zinc-900">
            <TabsTrigger
              value="racing"
              className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300"
            >
              {t.board.tabRacing}
            </TabsTrigger>
            <TabsTrigger
              value="quiz"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300"
            >
              {t.board.tabQuiz}
            </TabsTrigger>
            <TabsTrigger
              value="g2048"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300"
            >
              {t.board.tab2048}
            </TabsTrigger>
            <TabsTrigger
              value="snake"
              className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300"
            >
              {t.board.tabSnake}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="racing">
            <TopList cache={byGame.racing} emptyLabel={t.board.empty} />
          </TabsContent>
          <TabsContent value="quiz">
            <TopList cache={byGame.quiz} emptyLabel={t.board.empty} />
          </TabsContent>
          <TabsContent value="g2048">
            <TopList cache={byGame.g2048} emptyLabel={t.board.empty} />
          </TabsContent>
          <TabsContent value="snake">
            <TopList cache={byGame.snake} emptyLabel={t.board.empty} />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            {stale ? (
              <>
                <CloudOff className="h-3.5 w-3.5 text-zinc-500" /> {t.board.stale}
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" /> {t.board.live}
              </>
            )}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-zinc-400 hover:bg-zinc-800 hover:text-amber-300"
            onClick={refresh}
            aria-label={t.board.refreshAria}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${!cache ? 'animate-spin' : ''}`} />
            {t.board.refresh}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
