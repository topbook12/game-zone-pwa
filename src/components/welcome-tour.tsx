'use client'

/**
 * First-visit welcome tour (Phase 2, Day 11–12).
 * 3 steps — pick language → install PWA → play. Dismissible, remembered
 * in localStorage (`gz-welcome`), so it never nags a returning player.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Gamepad2, Languages, Play, Rocket, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setLang, useI18n, type Lang } from '@/lib/i18n'

const DONE_KEY = 'gz-welcome'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Module-level capture — beforeinstallprompt can fire before the tour mounts. */
let capturedInstall: BeforeInstallPromptEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener(
    'beforeinstallprompt',
    ((e: Event) => {
      e.preventDefault()
      capturedInstall = e as BeforeInstallPromptEvent
    }) as EventListener,
    { once: true }
  )
}

function readDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === 'done'
  } catch {
    return true // storage blocked → never nag
  }
}

export function WelcomeTour() {
  const { lang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<Lang | null>(null)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(capturedInstall)
  const [installed, setInstalled] = useState(false)

  /* Hydration-safe: decide after mount, then listen for late install events. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!readDone()) setOpen(true)
    }, 350)
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const finish = () => {
    try {
      window.localStorage.setItem(DONE_KEY, 'done')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  const pickLanguage = (l: Lang) => {
    setPicked(l)
    setLang(l)
    window.setTimeout(() => setStep(1), 260)
  }

  const handleInstall = async () => {
    if (!installEvent) return
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setInstallEvent(null)
      setStep(2)
    } catch {
      /* dismissed — stay on step */
    }
  }

  if (!open) return null

  const steps = 3

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-stone-950/85 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t.welcome.pickTitle}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-sm rounded-2xl border border-amber-500/30 bg-stone-900 p-6 shadow-2xl shadow-amber-950/30"
        >
          <button
            type="button"
            onClick={finish}
            aria-label={t.welcome.skip}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-900/40">
              <Gamepad2 className="h-5 w-5 text-stone-950" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300/90">
              {t.welcome.stepOf.replace('{n}', String(step + 1)).replace('{m}', String(steps))}
            </span>
          </div>

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-zinc-100">
                  <Languages className="h-5 w-5 text-amber-400" aria-hidden="true" />
                  {t.welcome.pickTitle}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{t.welcome.pickDesc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: 'en' as Lang, label: t.welcome.langEn, sub: 'English', active: lang === 'en' || picked === 'en' },
                    { id: 'bn' as Lang, label: t.welcome.langBn, sub: 'বাংলা', active: lang === 'bn' || picked === 'bn' },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => pickLanguage(opt.id)}
                    aria-pressed={opt.active}
                    className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 p-4 text-center transition ${
                      opt.active
                        ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="text-xl font-extrabold">{opt.label}</span>
                    <span className="text-xs text-zinc-400">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-zinc-100">
                  <Download className="h-5 w-5 text-amber-400" aria-hidden="true" />
                  {t.welcome.installTitle}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{t.welcome.installDesc}</p>
              </div>
              {installed ? (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-sm font-bold text-emerald-300">
                  {t.welcome.installed}
                </div>
              ) : (
                <>
                  {installEvent && (
                    <Button
                      onClick={() => void handleInstall()}
                      className="h-12 bg-amber-500 text-base font-bold text-stone-950 hover:bg-amber-400"
                    >
                      <Download className="mr-2 h-5 w-5" />
                      {t.welcome.installNow}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="h-11 border-zinc-700 bg-zinc-900 font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    {t.welcome.installLater}
                  </Button>
                  <p className="text-[11px] leading-relaxed text-zinc-400">{t.welcome.installHint}</p>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-xl shadow-amber-900/40">
                <Rocket className="h-8 w-8 text-stone-950" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-zinc-100">{t.welcome.playTitle}</h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{t.welcome.playDesc}</p>
              </div>
              <Button
                onClick={finish}
                className="h-12 bg-amber-500 text-base font-bold text-stone-950 hover:bg-amber-400"
              >
                <Play className="mr-2 h-5 w-5 fill-stone-950" />
                {t.welcome.start}
              </Button>
            </div>
          )}

          {/* step dots */}
          <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
            {Array.from({ length: steps }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-amber-400' : 'w-1.5 bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
