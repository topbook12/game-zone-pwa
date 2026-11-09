'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InstallPrompt } from '@/components/install-prompt'
import { RacingGame } from '@/components/racing-game'
import { QuizGame } from '@/components/quiz-game'
import { useStoredNumber } from '@/lib/game-store'

type View = 'hub' | 'racing' | 'quiz'

interface GameCardInfo {
  id: string
  title: string
  desc: string
  emoji: string
  banner: string
  best: number
  accent: string
  onClick: () => void
}

const COMING_SOON = [
  { emoji: '🎯', name: '2048' },
  { emoji: '🐍', name: 'Snake' },
  { emoji: '🎲', name: 'Ludo' },
]

export function GameHub() {
  const [view, setView] = useState<View>('hub')

  /** Reads localStorage reactively — updates instantly when a game finishes */
  const plays = useStoredNumber('gz-plays')
  const racingBest = useStoredNumber('gz-racing-best')
  const quizBest = useStoredNumber('gz-quiz-best-gk')

  const openRacing = () => setView('racing')
  const openQuiz = () => setView('quiz')

  const games: GameCardInfo[] = [
    {
      id: 'racing',
      title: 'Turbo Rush',
      desc: 'Pseudo-3D arcade racer — dodge traffic, hit checkpoints, fire the nitro!',
      emoji: '🏎️',
      banner: '/images/racing-banner.png',
      best: racingBest,
      accent: 'hover:border-amber-500/60',
      onClick: openRacing,
    },
    {
      id: 'quiz',
      title: 'Brain Quiz',
      desc: '6 categories, 60+ questions — test your knowledge and beat your best!',
      emoji: '🧠',
      banner: '/images/quiz-banner.png',
      best: quizBest,
      accent: 'hover:border-emerald-500/60',
      onClick: openQuiz,
    },
  ]

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
              <h1 className="text-lg font-extrabold leading-tight tracking-tight">Game Zone</h1>
              <p className="text-[11px] leading-tight text-zinc-400">Play. Win. Repeat.</p>
            </div>
          </div>
          <InstallPrompt />
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
                      backgroundImage: 'url(/images/racing-banner.png)',
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
                      Works offline too
                    </Badge>
                    <h2 className="text-xl font-extrabold sm:text-2xl">Play, win, have fun! 🎮</h2>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-zinc-400">
                      Install on Android and play anytime — even without internet. Your scores and
                      progress are saved right on your phone.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300">
                        🏎️ 3D Racing
                      </span>
                      <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300">
                        🧠 Quiz
                      </span>
                      <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300">
                        📶 Offline mode
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardContent className="flex flex-col items-center gap-0.5 p-3 text-center">
                    <Gauge className="mb-1 h-4 w-4 text-amber-400" aria-hidden="true" />
                    <span className="text-lg font-bold text-amber-300">{racingBest}</span>
                    <span className="text-[10px] text-zinc-400 sm:text-xs">Racing best</span>
                  </CardContent>
                </Card>
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardContent className="flex flex-col items-center gap-0.5 p-3 text-center">
                    <Brain className="mb-1 h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span className="text-lg font-bold text-emerald-300">{quizBest}</span>
                    <span className="text-[10px] text-zinc-400 sm:text-xs">Quiz best</span>
                  </CardContent>
                </Card>
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardContent className="flex flex-col items-center gap-0.5 p-3 text-center">
                    <Gamepad2 className="mb-1 h-4 w-4 text-teal-400" aria-hidden="true" />
                    <span className="text-lg font-bold text-teal-300">{plays}</span>
                    <span className="text-[10px] text-zinc-400 sm:text-xs">Total plays</span>
                  </CardContent>
                </Card>
              </div>

              {/* Games */}
              <section aria-label="Games">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                  <Gamepad2 className="h-5 w-5 text-amber-400" />
                  Games
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {games.map((game) => (
                    <motion.div
                      key={game.id}
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.18 }}
                    >
                      <Card
                        className={`cursor-pointer overflow-hidden border-zinc-800 bg-zinc-900/70 transition-colors ${game.accent}`}
                        onClick={game.onClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') game.onClick()
                        }}
                        aria-label={`Play ${game.title}`}
                      >
                        <div className="relative aspect-[16/8] w-full overflow-hidden">
                          <img
                            src={game.banner}
                            alt={`${game.title} banner`}
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                            loading="lazy"
                          />
                          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur-sm">
                            {game.emoji} Ready to play
                          </span>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-base font-bold">{game.title}</h4>
                            <span className="text-[11px] text-zinc-400">
                              Best: {game.best}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{game.desc}</p>
                          <Button
                            size="sm"
                            className="mt-3 w-full bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
                            onClick={(e) => {
                              e.stopPropagation()
                              game.onClick()
                            }}
                          >
                            <Play className="mr-1 h-4 w-4" />
                            Play now
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Coming soon */}
              <section aria-label="Coming soon">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-zinc-300">
                  <Lock className="h-4 w-4 text-zinc-500" />
                  Coming soon
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {COMING_SOON.map((g) => (
                    <div
                      key={g.name}
                      className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-3 text-center opacity-60"
                    >
                      <span className="text-2xl grayscale">{g.emoji}</span>
                      <span className="text-xs font-semibold text-zinc-400">{g.name}</span>
                      <span className="text-[10px] text-zinc-500">Soon</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* PWA info */}
              <Card className="border-teal-500/20 bg-teal-500/5">
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-teal-300">
                    <Smartphone className="h-4 w-4" />
                    How to install on Android
                  </div>
                  <ol className="list-inside list-decimal space-y-1 text-xs leading-relaxed text-zinc-400">
                    <li>Open this page in the Chrome browser</li>
                    <li>Tap the &quot;Install&quot; button above</li>
                    <li>Or open the menu (⋮) → &quot;Add to Home screen&quot;</li>
                    <li>Launch it like a real app from your home screen — works offline too!</li>
                  </ol>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <WifiOff className="h-3.5 w-3.5 text-teal-400" />
                    After the first load, all games run completely offline
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
              <QuizGame onExit={() => setView('hub')} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Racing is a full-screen overlay — keep it OUTSIDE animated wrappers so `fixed` works */}
        {view === 'racing' && <RacingGame onExit={() => setView('hub')} />}
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-stone-950/95">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-1 px-4 py-3 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-zinc-500">Game Zone © 2025 • Version 1.1</p>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <WifiOff className="h-3.5 w-3.5 text-teal-500" />
            Offline-ready PWA
          </div>
        </div>
      </footer>
    </div>
  )
}
