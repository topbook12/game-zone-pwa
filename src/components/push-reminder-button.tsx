'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  enableReminder,
  disableReminder,
  isPushSupported,
  getReminderState,
} from '@/lib/push'
import { useI18n } from '@/lib/i18n'

/**
 * Daily-reminder opt-in toggle (Web Push, VAPID — free tier).
 * Sits inside the daily-challenge card on the hub.
 */
export function PushReminderButton() {
  const { t } = useI18n()
  const [on, setOn] = useState(false)
  const [supported, setSupported] = useState(true)
  const [busy, setBusy] = useState(false)

  /* Read client-only state after mount (hydration safe) */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSupported(isPushSupported())
      setOn(getReminderState())
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (on) {
        await disableReminder()
        setOn(false)
        toast(t.push.off)
      } else {
        const res = await enableReminder()
        if (res === 'on') {
          setOn(true)
          toast.success(t.push.on)
        } else if (res === 'denied') {
          toast.error(t.push.denied)
        } else if (res === 'unsupported') {
          setSupported(false)
          toast(t.push.unsupported)
        } else {
          toast.error(t.push.off)
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void toggle()}
      disabled={busy || !supported}
      className={`h-9 w-full border-amber-500/40 sm:w-auto ${
        on
          ? 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
          : 'bg-stone-950/60 text-amber-300 hover:bg-amber-500/15'
      }`}
      aria-pressed={on}
      aria-label={on ? t.push.ctaOn : t.push.cta}
    >
      {busy ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : on ? (
        <BellRing className="mr-1.5 h-4 w-4" aria-hidden="true" />
      ) : (
        <Bell className="mr-1.5 h-4 w-4" aria-hidden="true" />
      )}
      {on ? t.push.ctaOn : t.push.cta}
    </Button>
  )
}
