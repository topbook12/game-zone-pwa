'use client'

import { useEffect } from 'react'
import { initLeaderboardSync } from '@/lib/leaderboard'

/**
 * App-wide client bootstrap:
 *  1. Registers the Service Worker (PWA offline support).
 *  2. Starts the leaderboard sync loop (flushes queued scores when online).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const stopSync = initLeaderboardSync()

    if ('serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .catch((err) => console.warn('SW registration failed:', err))
      }
      if (document.readyState === 'complete') {
        register()
      } else {
        window.addEventListener('load', register, { once: true })
      }
    }

    return stopSync
  }, [])

  return null
}
