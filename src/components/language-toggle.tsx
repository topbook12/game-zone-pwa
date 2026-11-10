'use client'

import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLang, setLang, useI18n, type Lang } from '@/lib/i18n'

const OPTIONS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'bn', label: 'বাংলা' },
]

/** EN / বাংলা segmented toggle — persists to localStorage. */
export function LanguageToggle() {
  const { lang, t } = useI18n()

  return (
    <div
      className="flex items-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
      role="group"
      aria-label={t.common.langAria}
    >
      <Languages className="ml-2 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
      {OPTIONS.map((opt) => (
        <Button
          key={opt.id}
          size="sm"
          variant="ghost"
          onClick={() => setLang(opt.id)}
          aria-pressed={lang === opt.id}
          className={`h-8 rounded-none px-2.5 text-xs font-bold ${
            lang === opt.id
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/25 hover:text-amber-200'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          }`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}

export { getLang }
