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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toBn, readStoredNumber, useStoredNumber, writeStoredNumber } from '@/lib/bn'
import {
  QUIZ_CATEGORIES,
  pickQuizQuestions,
  type QuizCategoryId,
  type QuizQuestion,
} from '@/lib/quiz-questions'

type Phase = 'select' | 'play' | 'result'

const QUESTION_TIME = 15

interface QuizGameProps {
  onExit: () => void
}

interface ResultState {
  score: number
  correct: number
  total: number
  isBest: boolean
}

export function QuizGame({ onExit }: QuizGameProps) {
  const [phase, setPhase] = useState<Phase>('select')
  const [category, setCategory] = useState<QuizCategoryId>('gk')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [answered, setAnswered] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const [gained, setGained] = useState(0)
  const [result, setResult] = useState<ResultState | null>(null)

  /** সেরা স্কোর — localStorage store থেকে প্রতিক্রিয়াশীলভাবে (হাইড্রেশন নিরাপদ) */
  const best = useStoredNumber(`gz-quiz-best-${category}`)

  /* প্রশ্ন শুরু */
  const startQuiz = useCallback((cat: QuizCategoryId) => {
    const picked = pickQuizQuestions(cat, 10)
    setQuestions(picked)
    setCategory(cat)
    setQIndex(0)
    setAnswered(null)
    setScore(0)
    setCorrectCount(0)
    setTimeLeft(QUESTION_TIME)
    setGained(0)
    setResult(null)
    setPhase('play')
  }, [])

  /* উত্তর নেওয়া */
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

  /* টাইমার (উত্তর দিলে থেমে যায়) — deadline ref এ রাখা, তাই প্রতি টিকে রি-সাবস্ক্রাইব হয় না */
  const deadlineRef = useRef(0)
  useEffect(() => {
    if (phase !== 'play' || answered !== null) return
    deadlineRef.current = Date.now() + QUESTION_TIME * 1000
    const id = setInterval(() => {
      const remain = (deadlineRef.current - Date.now()) / 1000
      if (remain <= 0) {
        setTimeLeft(0)
        setGained(0)
        setAnswered(-1) // -1 = সময় শেষ
        clearInterval(id)
      } else {
        setTimeLeft(remain)
      }
    }, 100)
    return () => clearInterval(id)
  }, [phase, answered, qIndex])

  /* উত্তরের পর পরবর্তী প্রশ্ন / ফলাফল */
  useEffect(() => {
    if (phase !== 'play' || answered === null) return
    const id = setTimeout(() => {
      if (qIndex + 1 >= questions.length) {
        const total = questions.length
        const prevBest = readStoredNumber(`gz-quiz-best-${category}`, 0)
        const isBest = score > prevBest
        if (isBest) writeStoredNumber(`gz-quiz-best-${category}`, score)
        // মোট খেলার হিসাব
        writeStoredNumber('gz-plays', readStoredNumber('gz-plays', 0) + 1)
        setResult({ score, correct: correctCount, total, isBest })
        setPhase('result')
      } else {
        setQIndex((i) => i + 1)
        setAnswered(null)
        setTimeLeft(QUESTION_TIME)
        setGained(0)
      }
    }, 1400)
    return () => clearTimeout(id)
  }, [answered, phase, qIndex, questions.length, category, score, correctCount])

  const current = questions[qIndex]
  const timePct = Math.max(0, (timeLeft / QUESTION_TIME) * 100)

  /* ---------------- ক্যাটাগরি সিলেক্ট ---------------- */
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
            হাবে ফিরুন
          </Button>
          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
            <Brain className="h-4 w-4 text-amber-400" />
            প্রশ্নব্যাংক: <span className="font-semibold text-amber-300">৬০+</span>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-amber-300">🧠 বাংলা কুইজ</h2>
          <p className="mt-1 text-sm text-zinc-400">
            ক্যাটাগরি বেছে নিন — প্রতি প্রশ্নে ১৫ সেকেন্ড, তাড়াতাড়ি উত্তরে বোনাস!
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-3 sm:grid-cols-3">
          {QUIZ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => startQuiz(cat.id)}
              className={`group flex flex-col items-center gap-1 rounded-2xl border-2 bg-zinc-900/80 p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-800/90 active:scale-[0.98] ${cat.accent}`}
              aria-label={`${cat.name} কুইজ খেলুন`}
            >
              <span className="text-3xl transition-transform duration-200 group-hover:scale-110">
                {cat.emoji}
              </span>
              <span className="text-sm font-bold text-zinc-100">{cat.name}</span>
              <span className="text-[11px] leading-tight text-zinc-400">
                {cat.description}
              </span>
              <BestScoreBadge catId={cat.id} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  /* ---------------- ফলাফল ---------------- */
  if (phase === 'result' && result) {
    const accuracy = Math.round((result.correct / result.total) * 100)
    const msg =
      accuracy >= 90
        ? 'অসাধারণ! আপনি তো জিনিয়স! 🌟'
        : accuracy >= 70
          ? 'দুর্দান্ত! খুব ভালো করেছেন! 🎉'
          : accuracy >= 50
            ? 'ভালো! আরেকটু চেষ্টা করলেই সেরা হবেন! 💪'
            : 'চিন্তা নেই, অনুশীলন করলেই উন্নতি হবে! 📚'

    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <div className="flex items-center justify-center">
          <div className="rounded-full border-2 border-amber-500/40 bg-amber-500/10 p-5">
            <Trophy className="h-10 w-10 text-amber-400" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-100">কুইজ শেষ!</h2>
          <p className="mt-1 text-sm text-zinc-400">{msg}</p>
        </div>

        {result.isBest && (
          <div className="rounded-full border border-amber-400/50 bg-amber-500/15 px-4 py-1.5 text-sm font-semibold text-amber-300">
            🎊 নতুন রেকর্ড!
          </div>
        )}

        <div className="grid w-full max-w-[380px] grid-cols-3 gap-2">
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400">
              <Star className="h-3 w-3 text-amber-400" />
              স্কোর
            </div>
            <div className="mt-1 text-2xl font-bold text-amber-300">
              {toBn(result.score)}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              সঠিক
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-300">
              {toBn(result.correct)}/{toBn(result.total)}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400">
              <Target className="h-3 w-3 text-teal-400" />
              নির্ভুলতা
            </div>
            <div className="mt-1 text-2xl font-bold text-teal-300">
              {toBn(accuracy)}%
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          সেরা স্কোর (এই ক্যাটাগরি):{' '}
          <span className="font-semibold text-amber-300">{toBn(Math.max(best, result.score))}</span>
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => startQuiz(category)}
            className="bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
          >
            <RotateCcw className="h-4 w-4" />
            আবার খেলুন
          </Button>
          <Button
            onClick={() => setPhase('select')}
            variant="outline"
            className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          >
            <ListChecks className="h-4 w-4" />
            ক্যাটাগরি বদলান
          </Button>
          <Button
            onClick={onExit}
            variant="outline"
            className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
            হাবে ফিরুন
          </Button>
        </div>
      </div>
    )
  }

  /* ---------------- খেলা চলছে ---------------- */
  if (!current) return null

  const catInfo = QUIZ_CATEGORIES.find((c) => c.id === current.category)

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      {/* প্রগ্রেস বার */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-zinc-300">
          প্রশ্ন {toBn(qIndex + 1)}/{toBn(questions.length)}
        </span>
        <span className="font-semibold text-amber-300">স্কোর: {toBn(score)}</span>
      </div>
      <Progress value={((qIndex + (answered !== null ? 1 : 0)) / questions.length) * 100} className="h-1.5 bg-zinc-800" />

      {/* টাইমার */}
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
          {toBn(Math.ceil(timeLeft))} সে
        </span>
      </div>

      {/* প্রশ্ন কার্ড */}
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

      {/* অপশন */}
      <div className="grid gap-2.5">
        {current.options.map((opt, idx) => {
          const isCorrect = idx === current.answer
          const isPicked = answered === idx
          const showCorrect = answered !== null && isCorrect
          const showWrong = answered !== null && isPicked && !isCorrect

          let cls =
            'border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:border-amber-500/60 hover:bg-zinc-800'
          if (showCorrect) cls = 'border-emerald-500 bg-emerald-600 text-white'
          else if (showWrong) cls = 'border-red-500 bg-red-600/90 text-white'
          else if (answered !== null)
            cls = 'border-zinc-800 bg-zinc-900/60 text-zinc-500'

          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={answered !== null}
              className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-default sm:text-base ${cls}`}
              aria-label={`উত্তর ${toBn(idx + 1)}: ${opt}`}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-500/40 text-xs opacity-80">
                  {['ক', 'খ', 'গ', 'ঘ'][idx]}
                </span>
                {opt}
              </span>
              {showCorrect && <CheckCircle2 className="h-5 w-5 shrink-0" />}
              {showWrong && <XCircle className="h-5 w-5 shrink-0" />}
            </button>
          )
        })}
      </div>

      {/* ফিডব্যাক */}
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
            ? `✅ সঠিক! +${toBn(gained)} পয়েন্ট`
            : answered === -1
              ? `⏰ সময় শেষ! সঠিক উত্তর: ${current.options[current.answer]}`
              : `❌ ভুল হয়েছে! সঠিক উত্তর: ${current.options[current.answer]}`}
        </div>
      )}
    </div>
  )
}

/** ক্যাটাগরি কার্ডের সেরা স্কোর ব্যাজ — আলাদা কম্পোনেন্ট, তাই map-এর ভেতরেও hooks-safe */
function BestScoreBadge({ catId }: { catId: QuizCategoryId }) {
  const best = useStoredNumber(`gz-quiz-best-${catId}`)
  return (
    <span className="mt-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
      সেরা: {toBn(best)}
    </span>
  )
}
