'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  Trophy,
  CheckCircle2,
  XCircle,
  Timer,
  Target,
  Brain,
  RotateCcw,
  ListChecks,
  Star,
  Flame,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { fmt, useI18n, getLang } from '@/lib/i18n'
import { readStoredNumber, useStoredNumber, writeStoredNumber, STORAGE_KEYS } from '@/lib/game-store'
import { submitScore, type SubmitOutcome } from '@/lib/leaderboard'
import { completeDaily, todaySeed } from '@/lib/daily'
import { checkAchievements } from '@/lib/achievements'
import {
  QUIZ_CATEGORIES,
  QUIZ_QUESTIONS,
  pickQuizQuestions,
  pickDailyQuizQuestions,
  type QuizCategoryId,
  type QuizQuestion,
} from '@/lib/quiz-questions'

type Phase = 'select' | 'play' | 'result'

const QUESTION_TIME = 15

interface QuizGameProps {
  onExit: () => void
  /** When true, the seeded daily challenge auto-starts. */
  daily?: boolean
}

interface ResultState {
  score: number
  correct: number
  total: number
  isBest: boolean
}

export function QuizGame({ onExit, daily }: QuizGameProps) {
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>('select')
  const [category, setCategory] = useState<QuizCategoryId>('gk')
  const [mode, setMode] = useState<'normal' | 'daily'>('normal')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [answered, setAnswered] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const [gained, setGained] = useState(0)
  const [result, setResult] = useState<ResultState | null>(null)
  const [sync, setSync] = useState<SubmitOutcome | null>(null)

  /** Best score — reactive localStorage store (hydration safe) */
  const best = useStoredNumber(STORAGE_KEYS.quizBest(category))

  /* Start quiz (random per category) */
  const startQuiz = useCallback((cat: QuizCategoryId) => {
    const picked = pickQuizQuestions(cat, 10)
    setQuestions(picked)
    setCategory(cat)
    setMode('normal')
    setQIndex(0)
    setAnswered(null)
    setScore(0)
    setCorrectCount(0)
    setTimeLeft(QUESTION_TIME)
    setGained(0)
    setResult(null)
    setSync(null)
    setPhase('play')
  }, [])

  /* Start the seeded daily challenge — same 10 questions for everyone today */
  const startDaily = useCallback(() => {
    const picked = pickDailyQuizQuestions(todaySeed(), 10)
    setQuestions(picked)
    setCategory('mixed')
    setMode('daily')
    setQIndex(0)
    setAnswered(null)
    setScore(0)
    setCorrectCount(0)
    setTimeLeft(QUESTION_TIME)
    setGained(0)
    setResult(null)
    setSync(null)
    setPhase('play')
  }, [])

  /* Auto-start when opened as the daily challenge */
  useEffect(() => {
    if (!daily) return
    const id = setTimeout(() => startDaily(), 0)
    return () => clearTimeout(id)
  }, [daily, startDaily])

  /* Answer */
  const handleAnswer = useCallback(
    (idx: number) => {
      if (answered !== null || questions.length === 0) return
      const q = questions[qIndex]
      if (!q) return
      const isCorrect = idx === q.answer
      const pts = isCorrect ? 10 + Math.floor(timeLeft / 3) : 0
      if (isCorrect) {
        setScore((s) => s + pts)
        setCorrectCount((c) => c + 1)
      }
      setGained(pts)
      setAnswered(idx)
    },
    [answered, questions, qIndex, timeLeft]
  )

  /* Timer (stops once answered) — deadline kept in a ref so ticks don't re-subscribe */
  const deadlineRef = useRef(0)
  useEffect(() => {
    if (phase !== 'play' || answered !== null) return
    deadlineRef.current = Date.now() + QUESTION_TIME * 1000
    const id = setInterval(() => {
      const remain = (deadlineRef.current - Date.now()) / 1000
      if (remain <= 0) {
        setTimeLeft(0)
        setGained(0)
        setAnswered(-1) // -1 = time up
        clearInterval(id)
      } else {
        setTimeLeft(remain)
      }
    }, 100)
    return () => clearInterval(id)
  }, [phase, answered, qIndex])

  /* Advance to next question / result */
  useEffect(() => {
    if (phase !== 'play' || answered === null) return
    const id = setTimeout(() => {
      if (qIndex + 1 >= questions.length) {
        const total = questions.length
        if (mode === 'normal') {
          const bestKey = STORAGE_KEYS.quizBest(category)
          const prevBest = readStoredNumber(bestKey, 0)
          const isBest = score > prevBest
          if (isBest) writeStoredNumber(bestKey, score)
          setResult({ score, correct: correctCount, total, isBest })
        } else {
          completeDaily('quiz', score)
          checkAchievements(getLang())
          setResult({ score, correct: correctCount, total, isBest: false })
        }
        writeStoredNumber(STORAGE_KEYS.plays, readStoredNumber(STORAGE_KEYS.plays, 0) + 1)
        setSync(null)
        submitScore('quiz', score)
          .then(setSync)
          .catch(() => setSync({ status: 'queued' }))
        setPhase('result')
      } else {
        setQIndex((i) => i + 1)
        setAnswered(null)
        setTimeLeft(QUESTION_TIME)
        setGained(0)
      }
    }, 1400)
    return () => clearTimeout(id)
  }, [answered, phase, qIndex, questions.length, category, score, correctCount, mode])

  const current = questions[qIndex]
  const timePct = Math.max(0, (timeLeft / QUESTION_TIME) * 100)

  /* ---------------- category select ---------------- */
  if (phase === 'select') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onExit}
            className="border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800 hover:text-amber-300"
          >
            <ChevronLeft className="h-4 w-4" />
            {t.common.backToHub}
          </Button>
          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
            <Brain className="h-4 w-4 text-amber-400" />
            {t.quiz.bankLabel} <span className="font-semibold text-amber-300">{QUIZ_QUESTIONS.length}+</span>
          </div>
        </div>

        {/* Daily challenge card */}
        <DailyQuizCard onStart={startDaily} />

        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-amber-300">🧠 {t.hub.quizTitle}</h2>
          <p className="mt-1 text-sm text-zinc-400">{t.quiz.selectDesc}</p>
        </div>

        <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-3 sm:grid-cols-3">
          {QUIZ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => startQuiz(cat.id)}
              className={`group flex flex-col items-center gap-1 rounded-2xl border-2 bg-zinc-900/80 p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-800/90 active:scale-[0.98] ${cat.accent}`}
              aria-label={fmt(t.quiz.playCatAria, { name: cat.name })}
            >
              <span className="text-3xl transition-transform duration-200 group-hover:scale-110">
                {cat.emoji}
              </span>
              <span className="text-sm font-bold text-zinc-100">{cat.name}</span>
              <span className="text-[11px] leading-tight text-zinc-400">{cat.description}</span>
              <BestScoreBadge catId={cat.id} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  /* ---------------- result ---------------- */
  if (phase === 'result' && result) {
    const accuracy = Math.round((result.correct / result.total) * 100)
    const msg =
      accuracy >= 90
        ? t.quiz.msgOutstanding
        : accuracy >= 70
          ? t.quiz.msgExcellent
          : accuracy >= 50
            ? t.quiz.msgGood
            : t.quiz.msgPractice

    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <div className="flex items-center justify-center">
          <div className="rounded-full border-2 border-amber-500/40 bg-amber-500/10 p-5">
            <Trophy className="h-10 w-10 text-amber-400" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-100">{t.quiz.complete}</h2>
          <p className="mt-1 text-sm text-zinc-400">{msg}</p>
        </div>

        {result.isBest && (
          <div className="rounded-full border border-amber-400/50 bg-amber-500/15 px-4 py-1.5 text-sm font-semibold text-amber-300">
            {t.quiz.newRecord}
          </div>
        )}

        <div className="grid w-full max-w-[380px] grid-cols-3 gap-2">
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400">
              <Star className="h-3 w-3 text-amber-400" />
              {t.common.score}
            </div>
            <div className="mt-1 text-2xl font-bold text-amber-300">{result.score}</div>
          </div>
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              {t.quiz.correct}
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-300">
              {result.correct}/{result.total}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400">
              <Target className="h-3 w-3 text-teal-400" />
              {t.quiz.accuracy}
            </div>
            <div className="mt-1 text-2xl font-bold text-teal-300">{accuracy}%</div>
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          {t.quiz.bestCat}{' '}
          <span className="font-semibold text-amber-300">{Math.max(best, result.score)}</span>
        </p>

        <div className="h-5 text-xs font-semibold">
          {sync?.status === 'synced' && (
            <span className="text-emerald-400">
              {t.common.syncSynced}
              {typeof sync.rank === 'number' ? ' ' + fmt(t.common.syncRank, { n: sync.rank }) : ''}
            </span>
          )}
          {sync?.status === 'queued' && (
            <span className="text-amber-300">{t.common.syncQueued}</span>
          )}
          {sync?.status === 'offline' && (
            <span className="text-amber-300">{t.common.syncOffline}</span>
          )}
        </div>

        {mode === 'daily' && (
          <div className="rounded-full border border-amber-400/50 bg-amber-500/15 px-4 py-1.5 text-sm font-semibold text-amber-300">
            {t.quiz.dailyDone}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => (mode === 'daily' ? startDaily() : startQuiz(category))}
            className="bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
          >
            <RotateCcw className="h-4 w-4" />
            {t.quiz.playAgain}
          </Button>
          <Button
            onClick={() => setPhase('select')}
            variant="outline"
            className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          >
            <ListChecks className="h-4 w-4" />
            {t.quiz.changeCategory}
          </Button>
          <Button
            onClick={onExit}
            variant="outline"
            className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
            {t.common.backToHub}
          </Button>
        </div>
      </div>
    )
  }

  /* ---------------- playing ---------------- */
  if (!current) return null

  const catInfo = QUIZ_CATEGORIES.find((c) => c.id === current.category)

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      {/* progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-zinc-300">
          {fmt(t.quiz.questionOf, { a: qIndex + 1, b: questions.length })}
        </span>
        <span className="font-semibold text-amber-300">
          {t.quiz.scoreLabel} {score}
        </span>
      </div>
      <Progress
        value={((qIndex + (answered !== null ? 1 : 0)) / questions.length) * 100}
        className="h-1.5 bg-zinc-800"
      />

      {/* timer */}
      <div className="flex items-center gap-3">
        <Timer
          className={`h-5 w-5 shrink-0 ${timeLeft <= 5 ? 'animate-pulse text-red-400' : 'text-emerald-400'}`}
        />
        <Progress
          value={timePct}
          className="h-2 bg-zinc-800"
          indicatorClassName={
            timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 8 ? 'bg-amber-500' : 'bg-emerald-500'
          }
        />
        <span
          className={`w-12 shrink-0 text-right text-sm font-bold tabular-nums ${
            timeLeft <= 5 ? 'text-red-400' : 'text-zinc-300'
          }`}
        >
          {Math.ceil(timeLeft)}s
        </span>
      </div>

      {/* playing badge */}
      {mode === 'daily' && (
        <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/15 px-3 py-1 text-[11px] font-black tracking-[0.2em] text-amber-300">
          <Flame className="h-3.5 w-3.5 animate-pulse" />
          {t.quiz.dailyBadge}
        </div>
      )}

      {/* question card */}
      <div className="rounded-2xl border border-zinc-700/70 bg-zinc-900/90 p-5 shadow-xl">
        {catInfo && (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
            <span>{catInfo.emoji}</span>
            {catInfo.name}
          </div>
        )}
        <h2 className="text-lg font-bold leading-relaxed text-zinc-100 sm:text-xl">
          {current.question}
        </h2>
      </div>

      {/* options */}
      <div className="grid gap-2.5">
        {current.options.map((opt, idx) => {
          const isCorrect = idx === current.answer
          const isPicked = answered === idx
          const showCorrect = answered !== null && isCorrect
          const showWrong = answered !== null && isPicked && !isCorrect

          let cls = 'border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:border-amber-500/60 hover:bg-zinc-800'
          if (showCorrect) cls = 'border-emerald-500 bg-emerald-600 text-white'
          else if (showWrong) cls = 'border-red-500 bg-red-600/90 text-white'
          else if (answered !== null) cls = 'border-zinc-800 bg-zinc-900/60 text-zinc-500'

          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={answered !== null}
              className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-default sm:text-base ${cls}`}
              aria-label={fmt(t.quiz.answerAria, { n: idx + 1, opt })}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-500/40 text-xs opacity-80">
                  {['A', 'B', 'C', 'D'][idx]}
                </span>
                {opt}
              </span>
              {showCorrect && <CheckCircle2 className="h-5 w-5 shrink-0" />}
              {showWrong && <XCircle className="h-5 w-5 shrink-0" />}
            </button>
          )
        })}
      </div>

      {/* feedback */}
      {answered !== null && (
        <div
          className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold ${
            answered === current.answer
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
              : answered === -1
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : 'border-red-500/50 bg-red-500/10 text-red-300'
          }`}
        >
          {answered === current.answer
            ? fmt(t.quiz.correctPts, { n: gained })
            : answered === -1
              ? fmt(t.quiz.timeUp, { ans: current.options[current.answer] })
              : fmt(t.quiz.wrong, { ans: current.options[current.answer] })}
        </div>
      )}
    </div>
  )
}

/** Best-score badge for a category card — separate component so map stays hooks-safe */
function BestScoreBadge({ catId }: { catId: QuizCategoryId }) {
  const { t } = useI18n()
  const best = useStoredNumber(STORAGE_KEYS.quizBest(catId))
  return (
    <span className="mt-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
      {t.quiz.bestBadge} {best}
    </span>
  )
}

/** Daily challenge entry card on the quiz select screen. */
function DailyQuizCard({ onStart }: { onStart: () => void }) {
  const { t } = useI18n()
  const [progress, setProgress] = useState<{ quizDone: boolean } | null>(null)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => {
      // read after mount (hydration-safe pattern)
      void import('@/lib/daily').then(({ readDaily, getStreak }) => {
        const p = readDaily()
        setProgress({ quizDone: p.quizDone })
        setStreak(getStreak())
      })
    }, 0)
    return () => clearTimeout(id)
  }, [])

  const done = progress?.quizDone === true

  return (
    <button
      onClick={onStart}
      className={`mx-auto flex w-full max-w-[560px] items-center justify-between gap-3 rounded-2xl border-2 bg-gradient-to-r from-amber-500/15 via-zinc-900 to-zinc-900 p-4 text-left transition-all hover:border-amber-400 hover:from-amber-500/25 active:scale-[0.99] ${
        done ? 'border-emerald-500/40' : 'border-amber-500/50'
      }`}
      aria-label={t.daily.title}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            done ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`}
        >
          {done ? (
            <Check className="h-6 w-6 text-emerald-400" />
          ) : (
            <Flame className="h-6 w-6 text-amber-400" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-amber-300">{t.daily.title}</span>
            {streak > 0 && (
              <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                🔥 {fmt(streak === 1 ? t.daily.streakOne : t.daily.streakDays, { n: streak })}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-tight text-zinc-400">{t.daily.taskQuiz}</p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
          done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500 text-stone-950'
        }`}
      >
        {done ? t.daily.done : t.daily.play}
      </span>
    </button>
  )
}
