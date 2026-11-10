'use client'

import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { shareText } from '@/lib/share'
import { useI18n } from '@/lib/i18n'

interface Props {
  title: string
  text: string
  url?: string
  className?: string
  label?: string
  size?: 'sm' | 'default' | 'lg'
}

/**
 * One-tap "I scored X, beat me!" — Web Share API on mobile,
 * clipboard + toast fallback on desktop. Free viral loop, zero backend.
 */
export function ShareButton({ title, text, url, className, label, size = 'sm' }: Props) {
  const { t } = useI18n()
  return (
    <Button
      size={size}
      variant="outline"
      className={
        className ??
        'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-amber-300'
      }
      onClick={() => void shareText({ title, text, url })}
      aria-label={label ?? t.share.aria}
    >
      <Share2 className="mr-1 h-4 w-4" aria-hidden="true" />
      {label ?? t.share.label}
    </Button>
  )
}
