'use client'

/**
 * Rewarded ad player — Phase 4 (Day 46–70).
 *
 * Currently drives the HONEST demo adapter: a clearly-labeled placeholder
 * interstitial with a 5-second countdown. Closing early = no reward (real
 * rewarded-ad behavior). When a real ad network is connected, this dialog
 * is replaced by the network's own renderer — see src/lib/ads.ts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useI18n, fmt } from '@/lib/i18n'
import { showRewardedAd, finishAdReward, _resolveDemoAd, type AdPlacement } from '@/lib/ads'
import { MAX_ADS_PER_DAY } from '@/lib/coins'

const DEMO_DURATION_S = 5

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  placement: AdPlacement
  /** play reward to double when placement === 'double' */
  doubleAmount?: number
  /** called with the granted coin amount after a completed ad */
  onCompleted?: (granted: number) => void
}

export function RewardedAdDialog({ open, onOpenChange, placement, doubleAmount = 0, onCompleted }: Props) {
  const { t, lang } = useI18n()
  const [phase, setPhase] = useState<'playing' | 'done' | 'capped'>('playing')
  const [secondsLeft, setSecondsLeft] = useState(DEMO_DURATION_S)
  const [granted, setGranted] = useState(0)
  const startedRef = useRef(false)

  const finish = useCallback(
    (completed: boolean) => {
      _resolveDemoAd(completed ? 'completed' : 'abandoned')
      if (completed) {
        const amount = finishAdReward(placement, doubleAmount)
        setGranted(amount)
        setPhase('done')
        onCompleted?.(amount)
      } else {
        onOpenChange(false)
      }
    },
    [placement, doubleAmount, onCompleted, onOpenChange]
  )

  /* Start the demo countdown each time the dialog opens (deferred one tick —
   * React 19 lint forbids synchronous setState inside effect bodies) */
  useEffect(() => {
    if (!open) {
      startedRef.current = false
      return
    }
    const id = window.setTimeout(() => {
      setGranted(0)
      setSecondsLeft(DEMO_DURATION_S)
      setPhase('playing')
      void showRewardedAd(placement).then((result) => {
        // 'completed' is driven by the countdown finish() — only handle caps
        if (result === 'capped') setPhase('capped')
      })
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, placement])

  /* Keep a stable handle to finish() so the countdown interval is never
   * restarted by unrelated re-renders (inline callbacks change identity). */
  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  }, [finish])

  /* Countdown tick while playing */
  useEffect(() => {
    if (!open || phase !== 'playing') return
    const started = Date.now()
    const id = window.setInterval(() => {
      const left = Math.max(0, DEMO_DURATION_S - Math.floor((Date.now() - started) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        window.clearInterval(id)
        finishRef.current(true)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [open, phase])

  const progress = ((DEMO_DURATION_S - secondsLeft) / DEMO_DURATION_S) * 100

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && phase === 'playing') finish(false)
        else onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-sm border-amber-500/30 bg-stone-900 text-zinc-100">
        {phase === 'capped' ? (
          <div className="flex flex-col gap-3 py-2 text-center">
            <span className="text-4xl" aria-hidden="true">🚫</span>
            <DialogTitle className="text-lg font-bold">{fmt(t.ads.capped, { n: MAX_ADS_PER_DAY })}</DialogTitle>
            <Button
              onClick={() => onOpenChange(false)}
              className="bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
            >
              OK
            </Button>
          </div>
        ) : phase === 'done' ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="text-5xl" aria-hidden="true">🪙</span>
            <DialogTitle className="text-xl font-black text-amber-300">
              {fmt(t.coins.earned, { n: granted })}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">{t.ads.rewardReady}</DialogDescription>
            <Button
              onClick={() => onOpenChange(false)}
              className="mt-1 w-full bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
            >
              OK
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-amber-300">
                {t.ads.demoBadge}
              </span>
              <span className="text-xs font-semibold text-zinc-400">
                {fmt(t.ads.countdown, { n: secondsLeft })}
              </span>
            </div>
            {/* Demo ad "creative" */}
            <div
              className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-gradient-to-br from-zinc-800 via-stone-900 to-zinc-800 text-center"
              role="img"
              aria-label={t.ads.demoTitle}
            >
              <span className="text-4xl" aria-hidden="true">🎬</span>
              <DialogTitle className="text-base font-bold">{t.ads.demoTitle}</DialogTitle>
              <DialogDescription className="max-w-[260px] text-xs leading-relaxed text-zinc-400">
                {t.ads.demoDesc}
              </DialogDescription>
            </div>
            <Progress value={progress} className="h-2" aria-label={t.ads.earn.replace('{n}', String(granted))} />
            <p className="text-center text-xs text-zinc-400">
              {fmt(t.ads.earn, { n: placement === 'double' ? doubleAmount : 25 })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => finish(false)}
              className="text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            >
              {t.ads.closeEarly}
            </Button>
            <span className="sr-only">{lang === 'bn' ? 'ডেমো বিজ্ঞাপন চলছে' : 'Demo ad playing'}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
