'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** "Install app" button — hooks into Android Chrome's beforeinstallprompt event. */
export function InstallPrompt() {
  const { t } = useI18n()
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
      /* user dismissed — nothing to do */
    }
  }

  return (
    <Button
      onClick={handleInstall}
      size="sm"
      className="bg-amber-500 font-semibold text-stone-950 hover:bg-amber-400"
      aria-label={t.install.aria}
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">{t.install.label}</span>
    </Button>
  )
}
