'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * "অ্যাপ ইনস্টল করুন" বাটন — Android Chrome এর beforeinstallprompt ধরে কাজ করে
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  if (!deferred || installed) return null

  const handleInstall = async () => {
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setDeferred(null)
    } catch {
      /* ইউজার বাতিল করলে কিছু করার দরকার নেই */
    }
  }

  return (
    <Button
      onClick={handleInstall}
      size="sm"
      className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold"
      aria-label="অ্যাপ ইনস্টল করুন"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">ইনস্টল করুন</span>
    </Button>
  )
}
