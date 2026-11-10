/**
 * Daily-reminder Web Push opt-in (Phase 3, Day 26–45).
 *
 * 100% free tier: VAPID keys + Vercel cron hitting /api/push/daily once a day.
 * No accounts — the push subscription endpoint IS the identity.
 */

const OPTIN_KEY = 'gz-push-optin'

export type EnableResult = 'on' | 'denied' | 'unsupported' | 'error'

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Whether the user currently opted in (permission + local flag). */
export function getReminderState(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      window.localStorage.getItem(OPTIN_KEY) === '1' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    )
  } catch {
    return false
  }
}

/** VAPID public key as the bytes pushManager expects. */
function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  // Explicit ArrayBuffer keeps the buffer type compatible with BufferSource
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Ask permission, subscribe, register on the server. Idempotent. */
export async function enableReminder(): Promise<EnableResult> {
  if (!isPushSupported()) return 'unsupported'
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return 'unsupported'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        tz: new Date().getTimezoneOffset(),
      }),
    })
    if (!res.ok) throw new Error('subscribe failed')

    window.localStorage.setItem(OPTIN_KEY, '1')
    return 'on'
  } catch {
    return 'error'
  }
}

/** Unsubscribe locally + remove from the server (best effort). */
export async function disableReminder(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      void fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined)
      await sub.unsubscribe().catch(() => undefined)
    }
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(OPTIN_KEY, '0')
  } catch {
    /* ignore */
  }
}
