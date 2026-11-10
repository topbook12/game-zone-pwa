'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gamepad2,
  Trophy,
  Brain,
  Play,
  WifiOff,
  Smartphone,
  Sparkles,
  Lock,
  Gauge,
  Award,
  Flame,
  Check,
  Palette,
  Crown,
} from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InstallPrompt } from '@/components/install-prompt'
import { LanguageToggle } from '@/components/language-toggle'
import { Leaderboard } from '@/components/leaderboard'
import { AchievementsDialog } from '@/components/achievements-dialog'
import { ProfileDialog } from '@/components/profile-dialog'
import { ShopDialog } from '@/components/shop-dialog'
import { PremiumDialog } from '@/components/premium-dialog'
import { PushReminderButton } from '@/components/push-reminder-button'
import { GameErrorBoundary } from '@/components/error-boundary'
import { useI18n } from '@/lib/i18n'
import { useStoredNumber } from '@/lib/game-store'
import { useCoins } from '@/lib/coins'
import { captureReferral, getAvatar } from '@/lib/profile'
import { todayKey, seedFromDate, readDaily, getStreak, type DailyProgress } from '@/lib/daily'
import { parkingFreeWindowPassed, usePremium } from '@/lib/premium'

/* Route-level code splitting (Phase 5 perf): each game lives in its own chunk
 * and is fetched only when the player opens it. */
const RacingGame = dynamic(() => import('@/components/racing-game').then((m) => m.RacingGame), {
  ssr: false,
  loading: () => <GameChunkLoader />, 
})
const QuizGame = dynamic(() => import('@/components/quiz-game').then((m) => m.QuizGame), {
  ssr: false,
  loading: () => <GameChunkLoader />,
})
const G2048Game = dynamic(() => import('@/components/g2048-game').then((m) => m.G2048Game), {
  ssr: false,
  loading: () => <GameChunkLoader />,
})
const SnakeGame = dynamic(() => import('@/components/snake-game').then((m) => m.SnakeGame), {
  ssr: false,
  loading: () => <GameChunkLoader />,
})
const ParkingGame = dynamic(() => import('@/components/parking-game').then((m) => m.ParkingGame), {
  ssr: false,
  loading: () => <GameChunkLoader />,
})

/** Lightweight placeholder shown while a game chunk downloads. */
function GameChunkLoader() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3" role="status">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
      <p className="text-xs font-semibold text-zinc-500">…</p>
    </div>
  )
}

type View = 'hub' | 'racing' | 'quiz' | 'g2048' | 'snake' | 'parking'

const COMING_SOON = [
  { emoji: '🎲', name: 'Ludo' },
  { emoji: '💎', name: 'Match 3' },
]

/** Daily challenge status — re-read whenever refreshKey changes (hydration safe). */
function useDailyStatus(refreshKey: number): { progress: DailyProgress | null; streak: number } {
  const [state, setState] = useState<{ progress: DailyProgress | null; streak: number }>({
    progress: null,
    streak: 0,
  })
  useEffect(() => {
    const id = window.setTimeout(() => {
      setState({ progress: readDaily(), streak: getStreak() })
    }, 0)
    return () => window.clearTimeout(id)
  }, [refreshKey])
  return state
}

export function GameHub() {
  const [view, setView] = useState<View>('hub')
  const [boardOpen, setBoardOpen] = useState(false)
  const [achOpen, setAchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [vipOpen, setVipOpen] = useState(false)
  const [avatar, setAvatar] = useState('🎮')
  const [daily, setDaily] = useState(false) // quiz opened in daily mode
  const [dailyStamp, setDailyStamp] = useState(0) // re-mount daily status card after a run
  const { t, lang } = useI18n()
  const premium = usePremium()

  /* Register incoming ?ref= invite links once per device (idempotent) */
  useEffect(() => {
    const id = window.setTimeout(() => {
      void captureReferral()
      setAvatar(getAvatar())
    }, 0)
    return () => window.clearTimeout(id)
  }, [profileOpen])

  /** Reads localStorage reactively — updates instantly when a game finishes */
  const plays = useStoredNumber('gz-plays')
  const coins = useCoins()
  const racingBest = useStoredNumber('gz-racing-best')
  const quizBest = useStoredNumber('gz-quiz-best-gk')
  const g2048Best = useStoredNumber('gz-g2048-best')
  const snakeBest = useStoredNumber('gz-snake-best')
  const parkingBest = useStoredNumber('gz-parking-best')
  const { progress: dailyProgress, streak } = useDailyStatus(dailyStamp)

  const openRacing = () => setView('racing')
  const openQuiz = (asDaily = false) => {
    setDaily(asDaily)
    setView('quiz')
  }

  const games = [
    {
      id: 'racing',
      title: t.hub.racingTitle,
      desc: t.hub.racingDesc,
      emoji: '🏎️',
      banner: '/images/racing-banner',
      best: racingBest,
      accent: 'hover:border-amber-500/60',
      aria: t.hub.racingAria,
      onClick: openRacing,
      vip: false,
    },
    {
      id: 'quiz',
      title: t.hub.quizTitle,
      desc: t.hub.quizDesc,
      emoji: '🧠',
      banner: '/images/quiz-banner',
      best: quizBest,
      accent: 'hover:border-emerald-500/60',
      aria: t.hub.quizAria,
      onClick: () => openQuiz(false),
      vip: false,
    },
    {
      id: 'g2048',
      title: t.hub.g2048Title,
      desc: t.hub.g2048Desc,
      emoji: '🎯',
      banner: '/images/2048-banner',
      best: g2048Best,
      accent: 'hover:border-orange-500/60',
      aria: t.hub.g2048Aria,
      onClick: () => setView('g2048'),
      vip: false,
    },
    {
      id: 'snake',
      title: t.hub.snakeTitle,
      desc: t.hub.snakeDesc,
      emoji: '🐍',
      banner: '/images/snake-banner',
      best: snakeBest,
      accent: 'hover:border-teal-500/60',
      aria: t.hub.snakeAria,
      onClick: () => setView('snake'),
      vip: false,
    },
    {
      id: 'parking',
      title: t.hub.parkingTitle,
      desc: t.hub.parkingDesc,
      emoji: '🅿️',
      banner: '/images/parking-banner',
      best: parkingBest,
      accent: 'hover:border-violet-500/60',
      aria: t.hub.parkingAria,
      onClick: () => setView('parking'),
      vip: true,
    },
  ]

  /** Today's date label like "10 Nov" for the daily circuit. */
  const now = new Date()
  const dailyDateLabel = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  const dailySeed = seedFromDate(todayKey())

  return (
    <div className="flex min-h-dvh flex-col bg-stone-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-stone-950/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-900/40">
              <Gamepad2 className="h-6 w-6 text-stone-950" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight tracking-tight">{t.hub.appName}</h1>
              <p className="text-[11px] leading-tight text-zinc-400">{t.hub.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVipOpen(true)}
              className={
                premium.active
                  ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/25 to-orange-500/25 px-2.5 font-black text-amber-300 hover:from-amber-500/40 hover:to-orange-500/40'
                  : 'border-zinc-700 bg-zinc-900 px-2.5 text-zinc-300 hover:bg-zinc-800 hover:text-amber-300'
              }
              aria-label={t.hub.vipAria}
            >
              <Crown className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t.hub.vipButton}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShopOpen(true)}
              className="border-amber-500/40 bg-amber-500/10 px-2.5 font-bold text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
              aria-label={t.coins.shopAria}
            >
              <Palette className="h-4 w-4" aria-hidden="true" />
              <span className="tabular-nums">🪙 {coins.balance}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setProfileOpen(true)
                setAvatar(getAvatar())
              }}
              className="border-zinc-700 bg-zinc-900 px-2.5 text-zinc-200 hover:bg-zinc-800 hover:text-amber-300"
              aria-label={t.profile.openAria}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {avatar}
              </span>
              <span className="hidden md:inline">{t.profile.title}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAchOpen(true)}
              className="border-zinc-700 bg-zinc-900 text-teal-300 hover:bg-zinc-800 hover:text-teal-200"
              aria-label={t.hub.achievementsAria}
            >
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">{t.ach.title}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBoardOpen(true)}
              className="border-zinc-700 bg-zinc-900 text-amber-300 hover:bg-zinc-800 hover:text-amber-200"
              aria-label={t.hub.leaderboardAria}
            >
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">{t.hub.leaderboard}</span>
            </Button>
            <InstallPrompt />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <AnimatePresence mode="wait">
          {view === 'hub' && (
            <motion.div
              key="hub"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col gap-6"
            >
              {/* Hero */}
              <Card className="overflow-hidden border-amber-500/25 bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900">
                <CardContent className="relative flex flex-col gap-3 p-5">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-25"
                    style={{
                      backgroundImage: 'url(/images/racing-banner.jpg)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/70 to-stone-950/40"
                    aria-hidden="true"
                  />
                  <div className="relative">
                    <Badge className="mb-2 border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25">
                      <Sparkles className="mr-1 h-3 w-3" />
                      {t.hub.worksOffline}
                    </Badge>
                    <h2 className="text-xl font-extrabold sm:text-2xl">{t.hub.heroTitle}</h2>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-zinc-400">
                      {t.hub.heroDesc}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300">
                        {t.hub.chipRacing}
                      </span>
                      <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300">
                        {t.hub.chipQuiz}
                      </span>
                      <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300">
                        {t.hub.chip2048}
                      </span>
                      <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300">
                        {t.hub.chipSnake}
                      </span>
                      <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300">
                        {t.hub.chipOffline}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Daily challenge */}
              <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-900/80">
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20">
                        <Flame className="h-5 w-5 animate-pulse text-amber-400" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-black text-amber-300">
                          {t.daily.title}
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold tracking-widest text-amber-300">
                            {t.daily.todayBadge}
                          </span>
                        </h3>
                        <p className="text-[11px] leading-tight text-zinc-400">{t.daily.desc}</p>
                      </div>
                    </div>
                    {streak > 0 && (
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-black text-orange-300">🔥 {streak}</div>
                        <div className="text-[9px] font-semibold text-zinc-500">{t.daily.streakLabel}</div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      onClick={() => openQuiz(true)}
                      variant={dailyProgress?.quizDone ? 'outline' : 'default'}
                      className={`h-11 justify-between gap-2 ${
                        dailyProgress?.quizDone
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'bg-amber-500 font-bold text-stone-950 hover:bg-amber-400'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-left text-xs">
                        <Brain className="h-4 w-4 shrink-0" />
                        {t.daily.taskQuiz}
                      </span>
                      {dailyProgress?.quizDone ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <Play className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </Button>
                    <Button
                      onClick={openRacing}
                      variant={dailyProgress?.racingDone ? 'outline' : 'default'}
                      className={`h-11 justify-between gap-2 ${
                        dailyProgress?.racingDone
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'bg-amber-500 font-bold text-stone-950 hover:bg-amber-400'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-left text-xs">
                        <Gauge className="h-4 w-4 shrink-0" />
                        {t.daily.taskRacing}
                      </span>
                      {dailyProgress?.racingDone ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <Play className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] leading-snug text-zinc-400">{t.push.desc}</p>
                    <PushReminderButton />
                  </div>
                </CardContent>
              </Card>
              {/* VIP upsell — only for free players */}
              {!premium.active && (
                <Card className="overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-900/80">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-900/40">
                        <Crown className="h-5 w-5 text-stone-950" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-amber-300">{t.premium.title}</h3>
                        <p className="mt-0.5 max-w-md text-xs leading-relaxed text-zinc-400">
                          {t.premium.b2} · {t.premium.b3} · {t.premium.b4}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setVipOpen(true)}
                      className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-stone-950 hover:from-amber-400 hover:to-orange-400"
                      aria-label={t.hub.vipAria}
                    >
                      <Crown className="mr-1 h-4 w-4" />
                      {t.hub.vipButton}
                    </Button>
                  </CardContent>
                </Card>
              )}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardContent className="flex flex-col items-center gap-0.5 p-3 text-center">
                    <Gauge className="mb-1 h-4 w-4 text-amber-400" aria-hidden="true" />
                    <span className="text-lg font-bold text-amber-300">{racingBest}</span>
                    <span className="text-[10px] text-zinc-400 sm:text-xs">{t.hub.statRacing}</span>
                  </CardContent>
                </Card>
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardContent className="flex flex-col items-center gap-0.5 p-3 text-center">
                    <Brain className="mb-1 h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span className="text-lg font-bold text-emerald-300">{quizBest}</span>
                    <span className="text-[10px] text-zinc-400 sm:text-xs">{t.hub.statQuiz}</span>
                  </CardContent>
                </Card>
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardContent className="flex flex-col items-center gap-0.5 p-3 text-center">
                    <Gamepad2 className="mb-1 h-4 w-4 text-teal-400" aria-hidden="true" />
                    <span className="text-lg font-bold text-teal-300">{plays}</span>
                    <span className="text-[10px] text-zinc-400 sm:text-xs">{t.hub.statPlays}</span>
                  </CardContent>
                </Card>
              </div>

              {/* Games */}
              <section aria-label={t.hub.gamesTitle}>
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                  <Gamepad2 className="h-5 w-5 text-amber-400" />
                  {t.hub.gamesTitle}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {games.map((game) => {
                    // hydration-safe: premium.active comes from the store hook
                    const parkingLocked =
                      game.id === 'parking' && !premium.active && !parkingFreeWindowPassed()
                    const openGame = () => {
                      if (parkingLocked) {
                        setVipOpen(true)
                        return
                      }
                      game.onClick()
                    }
                    return (
                    <motion.div
                      key={game.id}
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.18 }}
                    >
                      <Card
                        className={`cursor-pointer overflow-hidden border-zinc-800 bg-zinc-900/70 transition-colors ${game.accent}`}
                        onClick={openGame}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') openGame()
                        }}
                        aria-label={game.aria}
                      >
                        <div className="relative aspect-[16/8] w-full overflow-hidden">
                          {/* AVIF with JPG fallback — same art, ~45% smaller (Phase 5 perf) */}
                          <picture>
                            <source srcSet={`${game.banner}.avif`} type="image/avif" />
                            <img
                              src={`${game.banner}.jpg`}
                              alt={`${game.title} banner`}
                              className={`h-full w-full object-cover transition-transform duration-300 hover:scale-105 ${
                                parkingLocked ? 'opacity-60 saturate-50' : ''
                              }`}
                              loading="lazy"
                            />
                          </picture>
                          {game.id === 'parking' ? (
                            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/90 to-orange-600/90 px-2.5 py-0.5 text-[11px] font-black text-stone-950 backdrop-blur-sm">
                              <Crown className="h-3 w-3" aria-hidden="true" />
                              {parkingLocked ? t.hub.parkingVipBadge : t.parking.vipBadge}
                            </span>
                          ) : (
                            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur-sm">
                              {game.emoji} {t.hub.readyToPlay}
                            </span>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-base font-bold">{game.title}</h4>
                            <span className="text-[11px] text-zinc-400">
                              {t.common.best} {game.best}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{game.desc}</p>
                          <Button
                            size="sm"
                            className={
                              parkingLocked
                                ? 'mt-3 w-full border border-amber-500/40 bg-amber-500/10 font-bold text-amber-300 hover:bg-amber-500/20'
                                : 'mt-3 w-full bg-amber-500 font-bold text-stone-950 hover:bg-amber-400'
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              openGame()
                            }}
                          >
                            {parkingLocked ? (
                              <>
                                <Crown className="mr-1 h-4 w-4" />
                                {t.hub.vipButton}
                              </>
                            ) : (
                              <>
                                <Play className="mr-1 h-4 w-4" />
                                {t.common.playNow}
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                    )
                  })}
                </div>
              </section>

              {/* Coming soon */}
              <section aria-label={t.hub.comingSoon}>
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-zinc-300">
                  <Lock className="h-4 w-4 text-zinc-500" />
                  {t.hub.comingSoon}
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {COMING_SOON.map((g) => (
                    <div
                      key={g.name}
                      className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-3 text-center opacity-60"
                    >
                      <span className="text-2xl grayscale">{g.emoji}</span>
                      <span className="text-xs font-semibold text-zinc-400">{g.name}</span>
                      <span className="text-[10px] text-zinc-500">{t.hub.soon}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* PWA info */}
              <Card className="border-teal-500/20 bg-teal-500/5">
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-teal-300">
                    <Smartphone className="h-4 w-4" />
                    {t.hub.installTitle}
                  </div>
                  <ol className="list-inside list-decimal space-y-1 text-xs leading-relaxed text-zinc-400">
                    <li>{t.hub.installStep1}</li>
                    <li>{t.hub.installStep2}</li>
                    <li>{t.hub.installStep3}</li>
                    <li>{t.hub.installStep4}</li>
                  </ol>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <WifiOff className="h-3.5 w-3.5 text-teal-400" />
                    {t.hub.installNote}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === 'quiz' && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <GameErrorBoundary label={t.hub.quizTitle}>
                <QuizGame
                  onExit={() => {
                    setView('hub')
                    setDailyStamp((s) => s + 1)
                  }}
                  daily={daily}
                />
              </GameErrorBoundary>
            </motion.div>
          )}

          {view === 'g2048' && (
            <motion.div
              key="g2048"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <GameErrorBoundary label={t.hub.g2048Title}>
                <G2048Game onExit={() => setView('hub')} />
              </GameErrorBoundary>
            </motion.div>
          )}

          {view === 'snake' && (
            <motion.div
              key="snake"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <GameErrorBoundary label={t.hub.snakeTitle}>
                <SnakeGame onExit={() => setView('hub')} />
              </GameErrorBoundary>
            </motion.div>
          )}

          {view === 'parking' && (
            <motion.div
              key="parking"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <GameErrorBoundary label={t.hub.parkingTitle}>
                <ParkingGame onExit={() => setView('hub')} />
              </GameErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Racing is a full-screen overlay — keep it OUTSIDE animated wrappers so `fixed` works */}
        {view === 'racing' && (
          <GameErrorBoundary label={t.hub.racingTitle}>
            <RacingGame
              onExit={() => {
                setView('hub')
                setDailyStamp((s) => s + 1)
              }}
              dailySeed={dailySeed}
              dailyDate={dailyDateLabel}
            />
          </GameErrorBoundary>
        )}
      </main>

      {/* Global leaderboard + achievements + profile + shop + VIP dialogs */}
      <Leaderboard open={boardOpen} onOpenChange={setBoardOpen} />
      <AchievementsDialog open={achOpen} onOpenChange={setAchOpen} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ShopDialog open={shopOpen} onOpenChange={setShopOpen} />
      <PremiumDialog open={vipOpen} onOpenChange={setVipOpen} />

      {/* Achievement toasts */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1c1917',
            border: '1px solid #44403c',
            color: '#fafaf9',
          },
        }}
      />

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-stone-950/95">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-1 px-4 py-3 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-zinc-500">{t.hub.footerCopyright}</p>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <WifiOff className="h-3.5 w-3.5 text-teal-500" />
            {t.hub.footerOffline}
          </div>
        </div>
      </footer>
    </div>
  )
}
