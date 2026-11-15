'use client'

/**
 * Per-game "How to play" card (Phase 2, Day 13–14).
 * One illustrated step list per game, EN + বাংলা, reachable from the hub
 * cards AND each game's own header. Zero image assets — emoji illustrations.
 */

import { useState } from 'react'
import { CircleHelp, Lightbulb, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fmt, useI18n } from '@/lib/i18n'

export type GameId = 'racing' | 'quiz' | 'g2048' | 'snake' | 'parking'

const GAME_META: Record<GameId, { emoji: string; accent: string; ring: string }> = {
  racing: { emoji: '🏎️', accent: 'text-amber-300', ring: 'border-amber-500/40' },
  quiz: { emoji: '🧠', accent: 'text-emerald-300', ring: 'border-emerald-500/40' },
  g2048: { emoji: '🎯', accent: 'text-orange-300', ring: 'border-orange-500/40' },
  snake: { emoji: '🐍', accent: 'text-teal-300', ring: 'border-teal-500/40' },
  parking: { emoji: '🅿️', accent: 'text-violet-300', ring: 'border-violet-500/40' },
}

interface Props {
  game: GameId
  /** `icon` = compact icon for game HUDs, `card` = labelled link for hub cards */
  variant?: 'icon' | 'card'
}

export function HowToPlayButton({ game, variant = 'icon' }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const meta = GAME_META[game]
  const content = t.howto[game]
  const steps = [content.s1, content.s2, content.s3, content.s4]

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          aria-label={fmt(t.howto.openAria, { game: content.title })}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-white/15 bg-black/40 text-zinc-200 transition hover:bg-black/60 active:scale-90"
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          aria-label={fmt(t.howto.openAria, { game: content.title })}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold text-zinc-400 transition hover:text-amber-300"
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          {t.howto.open}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-zinc-800 bg-stone-900 p-0 text-zinc-100">
          <DialogHeader className="p-5 pb-0 text-left">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-extrabold">
              <span className="text-2xl" aria-hidden="true">
                {meta.emoji}
              </span>
              <span className={meta.accent}>{content.title}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              {fmt(t.howto.openAria, { game: content.title })}
            </DialogDescription>
          </DialogHeader>

          <ol className="flex flex-col gap-2.5 px-5 py-4">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-zinc-900 text-[11px] font-black ${meta.ring} ${meta.accent}`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-zinc-300">{s}</span>
              </li>
            ))}
          </ol>

          <div className="mx-5 mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-amber-200/90">
              <span className="font-bold">{t.howto.tip}: </span>
              {content.tip}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.howto.close}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}
