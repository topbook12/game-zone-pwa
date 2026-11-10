/**
 * Share helpers — Web Share API with clipboard fallback (Phase 3 viral loop).
 * Free, no server cost: the shared URL carries the player's ?ref= code.
 */

import { toast } from 'sonner'
import { getLang } from '@/lib/i18n'
import { getRefCode } from '@/lib/profile'

const MESSAGES = {
  en: {
    copied: 'Copied — now challenge a friend! 🔗',
    ok: 'Thanks for sharing! 🎉',
    fail: 'Could not share on this device',
  },
  bn: {
    copied: 'কপি হয়েছে — এখন বন্ধুকে চ্যালেঞ্জ করুন! 🔗',
    ok: 'শেয়ার করার জন্য ধন্যবাদ! 🎉',
    fail: 'এই ডিভাইসে শেয়ার করা যায়নি',
  },
} as const

export type ShareResult = 'shared' | 'copied' | 'failed' | 'cancelled'

/** Absolute app URL (origin + '/'), '' when not in a browser. */
export function appUrl(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/`
}

/** Invite link that credits this player: https://…/?ref=code */
export function referralUrl(): string {
  const base = appUrl()
  if (!base) return ''
  return `${base}?ref=${getRefCode()}`
}

/**
 * Share `text` (+ link) via the native share sheet when available,
 * otherwise copy to clipboard. Toasts the outcome in the user's language.
 */
export async function shareText(opts: {
  title: string
  text: string
  url?: string
}): Promise<ShareResult> {
  const m = MESSAGES[getLang()]
  const url = opts.url ?? referralUrl()

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url })
      toast.success(m.ok)
      return 'shared'
    } catch (err) {
      // User closed the share sheet — not an error, stay silent
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Otherwise fall through to the clipboard fallback
    }
  }

  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('no clipboard')
    await navigator.clipboard.writeText(`${opts.text} ${url}`.trim())
    toast.success(m.copied)
    return 'copied'
  } catch {
    toast.error(m.fail)
    return 'failed'
  }
}
