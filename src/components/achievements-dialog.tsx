'use client'

import { useEffect, useState } from 'react'
import { Award, Trophy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getAchievements, type Achievement } from '@/lib/achievements'
import { useI18n } from '@/lib/i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Achievements dialog — badges with progress bars, saved in localStorage. */
export function AchievementsDialog({ open, onOpenChange }: Props) {
  const { t, lang } = useI18n()
  const [list, setList] = useState<Achievement[]>([])

  /* Read badges after mount — they live in localStorage (client-only) */
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      setList(getAchievements(lang))
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, lang])

  const unlocked = list.filter((a) => a.unlockedAt !== null).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-stone-950 text-zinc-100 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <Award className="h-5 w-5 text-amber-400" />
            {t.ach.title}
            {list.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                {unlocked}/{list.length}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{t.ach.desc}</DialogDescription>
        </DialogHeader>

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Trophy className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-400">{t.ach.empty}</p>
          </div>
        ) : (
          <div className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {list.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  a.unlockedAt !== null
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-zinc-800 bg-zinc-900/60'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${
                    a.unlockedAt !== null ? 'bg-amber-500/20' : 'bg-zinc-800 grayscale opacity-50'
                  }`}
                  aria-hidden="true"
                >
                  {a.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm font-bold ${
                        a.unlockedAt !== null ? 'text-amber-300' : 'text-zinc-400'
                      }`}
                    >
                      {a.title}
                    </span>
                    {a.goal > 0 && a.unlockedAt === null && (
                      <span className="shrink-0 text-[10px] font-semibold text-zinc-500">
                        {Math.min(a.current, a.goal)}/{a.goal}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-zinc-500">{a.desc}</p>
                  {a.goal > 0 && a.unlockedAt === null && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-amber-500/70 transition-all"
                        style={{ width: `${Math.round(a.progress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                {a.unlockedAt !== null && (
                  <span className="shrink-0 text-[10px] font-bold text-emerald-400">
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
