'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { initLeaderboardSync } from '@/lib/leaderboard'
import { initCoinSync } from '@/lib/coins'
import { initPremiumSync } from '@/lib/premium'
import { initCloudSync } from '@/lib/cloud'
import { APP_VERSION } from '@/lib/app-version'
import { useI18n } from '@/lib/i18n'

/**
 * App-wide client bootstrap:
 *  1. Registers the Service Worker (PWA offline support).
 *  2. Starts the leaderboard sync loop (flushes queued scores when online).
 *  3. Shows an offline banner (games keep working, scores queue).
 *  4. Shows a "new version" card when a updated SW is waiting (skipWaiting).
 */

/** Reactive navigator.onLine (hydration safe). */
function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

/** True when semantic version `a` is strictly newer than `b` ("2.5.0" > "2.4.0"). */
function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

export function PwaRegister() {
  const { t } = useI18n()
  const online = useOnline()
  const [updateReady, setUpdateReady] = useState(false)
  const waitingRef = useRef<ServiceWorker | null>(null)
  const updateRequestedRef = useRef(false)

  /* Flush queued scores + coin ledger events on load + whenever back online.
   * Phase 5: premium re-verification + cloud backup loop join the same rhythm. */
  useEffect(() => {
    const offScores = initLeaderboardSync()
    const offCoins = initCoinSync()
    const offPremium = initPremiumSync()
    const offCloud = initCloudSync()
    return () => {
      offScores()
      offCoins()
      offPremium()
      offCloud()
    }
  }, [])

  /* -------- Phase 1 version guard: stale pages self-heal --------
   * Asks the live server which build it serves and compares it with this
   * page's build. If the server is NEWER, this page is stale (old SW cache or
   * an old PWA instance) and the one-tap refresh card appears. Runs 10 s after
   * load, then every 30 min and on reconnect. Offline → silently skipped. */
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (cancelled || typeof navigator === 'undefined' || !navigator.onLine) return
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (res.status === 404) {
          // Older server than this page's build — nothing to do (deploy lag).
          return
        }
        if (!res.ok) return
        const data = (await res.json()) as { version?: string }
        if (!cancelled && data.version && isNewerVersion(data.version, APP_VERSION)) {
          setUpdateReady(true)
        }
      } catch {
        /* offline / network error — try again later */
      }
    }
    const initial = window.setTimeout(() => void check(), 10_000)
    const interval = window.setInterval(() => void check(), 30 * 60 * 1000)
    window.addEventListener('online', check)
    return () => {
      cancelled = true
      window.clearTimeout(initial)
      window.clearInterval(interval)
      window.removeEventListener('online', check)
    }
  }, [])

  /* Service worker registration + update detection */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const onControllerChange = () => {
      // Only reload when WE asked the waiting worker to take over
      if (updateRequestedRef.current) window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // A waiting worker means a newer version was already downloaded
          if (reg.waiting && navigator.serviceWorker.controller) {
            waitingRef.current = reg.waiting
            setUpdateReady(true)
          }
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing
            if (!installing) return
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                waitingRef.current = installing
                setUpdateReady(true)
              }
            })
          })
        })
        .catch((err) => console.warn('SW registration failed:', err))
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    updateRequestedRef.current = true
    if (waitingRef.current) {
      // A newer worker is downloaded but waiting — activate it, the
      // controllerchange listener above reloads the page.
      waitingRef.current.postMessage({ type: 'SKIP_WAITING' })
    } else {
      // Server is newer than this page (version guard) — a plain reload
      // fetches fresh HTML (navigation is network-first).
      window.location.reload()
    }
  }, [])

  return (
    <>
      {/* Offline banner */}
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs font-semibold text-amber-200 backdrop-blur-md [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <span className="inline-flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5" />
            {t.status.offline}
          </span>
        </div>
      )}

      {/* New-version card */}
      {updateReady && (
        <div
          role="alert"
          className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-stone-900/95 p-3 shadow-2xl backdrop-blur-md [margin-bottom:max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-emerald-300">{t.status.updateTitle}</p>
            <p className="truncate text-xs text-zinc-400">{t.status.updateDesc}</p>
          </div>
          <Button
            size="sm"
            onClick={applyUpdate}
            className="shrink-0 bg-emerald-500 font-bold text-stone-950 hover:bg-emerald-400"
          >
            <RefreshCw className="h-4 w-4" />
            {t.status.updateAction}
          </Button>
        </div>
      )}
    </>
  )
}
