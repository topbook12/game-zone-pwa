'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  User,
  Trophy,
  Crown,
  Gamepad2,
  Copy,
  Check,
  Pencil,
  Users,
  RefreshCw,
} from 'lucide-react'
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
import { toast } from 'sonner'
import { ShareButton } from '@/components/share-button'
import {
  AVATARS,
  getAvatar,
  setAvatar,
  getRefCode,
  getProfileStats,
  getWeeklyWins,
  bumpWeeklyWin,
  getInvitedCount,
  type ProfileStats,
} from '@/lib/profile'
import { fetchTopScores, getPlayerName, setPlayerName, getDeviceId, type GameId } from '@/lib/leaderboard'
import { referralUrl } from '@/lib/share'
import { useI18n } from '@/lib/i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const GAME_LABEL: Record<GameId, { emoji: string; key: 'racing' | 'quiz' | 'g2048' | 'snake' | 'parking' }> = {
  racing: { emoji: '🏎️', key: 'racing' },
  quiz: { emoji: '🧠', key: 'quiz' },
  g2048: { emoji: '🎯', key: 'g2048' },
  snake: { emoji: '🐍', key: 'snake' },
  parking: { emoji: '🅿️', key: 'parking' },
}

/** Weekly tournament crowns — detected from the live weekly top-10 lists. */
function useWeeklyCrowns(open: boolean, refreshKey: number) {
  const [crowns, setCrowns] = useState<GameId[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const id = window.setTimeout(async () => {
      setLoading(true)
      try {
        const deviceId = getDeviceId()
        const games: GameId[] = ['racing', 'quiz', 'g2048', 'snake']
        const found: GameId[] = []
        const results = await Promise.all(games.map((g) => fetchTopScores(g, 10, 'weekly')))
        results.forEach((cache, i) => {
          const top = cache.rows[0]
          if (top && top.device === deviceId && top.score > 0) {
            found.push(games[i])
            bumpWeeklyWin(games[i])
          }
        })
        if (!cancelled) setCrowns(found)
      } catch {
        /* offline — crowns stay as-is */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [open, refreshKey])

  return { crowns, loading }
}

/** Player profile card — avatar, stats, weekly crowns, invite link. */
export function ProfileDialog({ open, onOpenChange }: Props) {
  const { t } = useI18n()
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [avatar, setAvatarState] = useState('🎮')
  const [name, setName] = useState('Player')
  const [editing, setEditing] = useState(false)
  const [invited, setInvited] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { crowns, loading: crownsLoading } = useWeeklyCrowns(open, refreshKey)

  /* Read client-only values after mount (hydration safe) */
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      setStats(getProfileStats())
      setAvatarState(getAvatar())
      setName(getPlayerName())
      setRefreshKey((k) => k + 1)
      void getInvitedCount().then(setInvited)
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  const pickAvatar = useCallback(
    (emoji: string) => {
      setAvatar(emoji)
      setAvatarState(emoji)
    },
    []
  )

  const saveName = () => {
    const clean = setPlayerName(name)
    setName(clean)
    setEditing(false)
    setStats(getProfileStats())
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl())
      setCopied(true)
      toast.success(t.profile.copied)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t.share.label)
    }
  }

  const statsSafe: ProfileStats =
    stats ?? {
      plays: 0,
      achievementsUnlocked: 0,
      achievementsTotal: 14,
      weeklyWins: getWeeklyWins(),
      bests: { racing: 0, quiz: 0, g2048: 0, snake: 0, parking: 0 },
    }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-stone-950 text-zinc-100 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <User className="h-5 w-5 text-amber-400" />
            {t.profile.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            {t.hub.tagline}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {/* Identity — avatar + name */}
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-3xl shadow-lg shadow-amber-900/40">
              <span role="img" aria-label={t.profile.avatarAria}>
                {avatar}
              </span>
            </div>
            {editing ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  autoFocus
                  value={name}
                  maxLength={16}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="h-9 border-zinc-700 bg-zinc-950 text-sm"
                  aria-label={t.profile.nameAria}
                  placeholder={t.profile.namePlaceholder}
                />
                <Button
                  size="sm"
                  className="h-9 shrink-0 bg-amber-500 text-stone-950 hover:bg-amber-400"
                  onClick={saveName}
                >
                  <Check className="h-4 w-4" />
                  <span className="sr-only">{t.profile.save}</span>
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="group flex flex-1 items-center gap-2 text-left"
                aria-label={t.board.editNameAria}
              >
                <span className="truncate text-base font-bold">{name}</span>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-amber-300" />
              </button>
            )}
          </div>

          {/* Avatar picker */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {t.profile.avatarAria}
            </p>
            <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label={t.profile.avatarAria}>
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="radio"
                  aria-checked={emoji === avatar}
                  onClick={() => pickAvatar(emoji)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors ${
                    emoji === avatar
                      ? 'bg-amber-500/25 ring-2 ring-amber-400'
                      : 'bg-zinc-900 hover:bg-zinc-800'
                  }`}
                >
                  <span role="img" aria-hidden="true">
                    {emoji}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-center">
              <Gamepad2 className="mb-0.5 h-4 w-4 text-teal-400" aria-hidden="true" />
              <span className="text-lg font-bold text-teal-300">{statsSafe.plays}</span>
              <span className="text-[10px] text-zinc-400">{t.profile.statPlays}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-center">
              <Trophy className="mb-0.5 h-4 w-4 text-amber-400" aria-hidden="true" />
              <span className="text-lg font-bold text-amber-300">
                {statsSafe.achievementsUnlocked}/{statsSafe.achievementsTotal}
              </span>
              <span className="text-[10px] text-zinc-400">{t.profile.statAch}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-center">
              <Crown className="mb-0.5 h-4 w-4 text-orange-400" aria-hidden="true" />
              <span className="text-lg font-bold text-orange-300">{statsSafe.weeklyWins}</span>
              <span className="text-[10px] text-zinc-400">{t.profile.statCrowns}</span>
            </div>
          </div>

          {/* This week's crowns */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Crown className="h-3.5 w-3.5 text-orange-400" aria-hidden="true" />
              {t.profile.weeklyTitle}
            </p>
            {crownsLoading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                …
              </div>
            ) : crowns.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {crowns.map((g) => (
                  <Badge
                    key={g}
                    className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    👑 {t.profile.weeklyChamp} {GAME_LABEL[g].emoji}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">{t.profile.weeklyNone}</p>
            )}
          </div>

          {/* Personal bests */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {t.profile.bestTitle}
            </p>
            <div className="flex flex-col gap-1">
              {(Object.keys(GAME_LABEL) as GameId[]).map((g) => (
                <div
                  key={g}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5"
                >
                  <span className="text-sm text-zinc-300">
                    {GAME_LABEL[g].emoji} {t.hub[`${GAME_LABEL[g].key}Title` as const]}
                  </span>
                  <span className="text-sm font-bold text-amber-300">
                    {statsSafe.bests[g].toLocaleString('en-US')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Invite friends */}
          <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-teal-300">
                <Users className="h-4 w-4" aria-hidden="true" />
                {t.profile.inviteTitle}
              </p>
              {typeof invited === 'number' && (
                <Badge className="border-teal-500/40 bg-teal-500/15 text-teal-300">
                  {t.profile.invited}: {invited}
                </Badge>
              )}
            </div>
            <p className="mb-2 text-[11px] leading-snug text-zinc-400">{t.profile.inviteDesc}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-950 px-2.5 py-1.5 text-[11px] text-zinc-400">
                {referralUrl()}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20"
                onClick={() => void copyLink()}
                aria-label={t.profile.copy}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {t.profile.copy}
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-500">
              {t.profile.codeLabel}: {getRefCode()}
            </p>
          </div>

          {/* Share profile */}
          <ShareButton
            size="default"
            className="w-full border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            title={t.hub.appName}
            text={fmtSafe(t.profile.shareText, statsSafe.plays)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function fmtSafe(template: string, n: number): string {
  return template.replace(/\{n\}/g, String(n))
}
