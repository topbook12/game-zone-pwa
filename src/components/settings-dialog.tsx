'use client'

/**
 * Settings Center (Phase 2, Day 16–17) — one dialog, every game:
 * sound, vibration, data-saver (low graphics), language, reset progress.
 * State lives in `src/lib/settings.ts`; games read it live.
 */

import { useState } from 'react'
import { Eraser, Languages, Leaf, Settings, Volume2, Vibrate } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getLang, setLang, useI18n, type Lang } from '@/lib/i18n'
import { resetProgress, updateSettings, useSettings } from '@/lib/settings'

/** Gear trigger for the hub header. */
export function SettingsButton() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-zinc-700 bg-zinc-900 px-2.5 text-zinc-300 hover:bg-zinc-800 hover:text-amber-300"
        aria-label={t.settings.open}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t.settings.title}</span>
      </Button>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useI18n()
  const settings = useSettings()
  const lang = getLang()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const langOptions: { id: Lang; label: string }[] = [
    { id: 'en', label: 'EN' },
    { id: 'bn', label: 'বাংলা' },
  ]

  const handleReset = () => {
    resetProgress()
    setConfirmOpen(false)
    onOpenChange(false)
    toast.success(t.settings.resetDone)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm rounded-2xl border-zinc-800 bg-stone-900 p-0 text-zinc-100">
          <DialogHeader className="px-5 pb-1 pt-5 text-left">
            <DialogTitle className="text-lg font-extrabold">{t.settings.title}</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-zinc-400">
              {t.settings.desc}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 px-3 pb-5">
            {/* Sound */}
            <Row
              icon={<Volume2 className="h-4 w-4" aria-hidden="true" />}
              label={t.settings.sound}
              desc={t.settings.soundDesc}
            >
              <Switch
                checked={settings.sound}
                onCheckedChange={(v) => updateSettings({ sound: v })}
                aria-label={t.settings.sound}
              />
            </Row>

            {/* Haptics */}
            <Row
              icon={<Vibrate className="h-4 w-4" aria-hidden="true" />}
              label={t.settings.haptics}
              desc={t.settings.hapticsDesc}
            >
              <Switch
                checked={settings.haptics}
                onCheckedChange={(v) => updateSettings({ haptics: v })}
                aria-label={t.settings.haptics}
              />
            </Row>

            {/* Data saver */}
            <Row
              icon={<Leaf className="h-4 w-4" aria-hidden="true" />}
              label={t.settings.dataSaver}
              desc={t.settings.dataSaverDesc}
            >
              <Switch
                checked={settings.dataSaver}
                onCheckedChange={(v) => updateSettings({ dataSaver: v })}
                aria-label={t.settings.dataSaver}
              />
            </Row>

            {/* Language */}
            <Row
              icon={<Languages className="h-4 w-4" aria-hidden="true" />}
              label={t.settings.language}
              desc={null}
            >
              <div
                className="flex items-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950"
                role="group"
                aria-label={t.settings.language}
              >
                {langOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLang(opt.id)}
                    aria-pressed={lang === opt.id}
                    className={`min-h-9 px-3 text-xs font-bold transition ${
                      lang === opt.id
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Row>

            {/* Reset progress */}
            <div className="mt-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-300">
                <Eraser className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t.settings.reset}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{t.settings.resetDesc}</p>
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                className="mt-2.5 min-h-10 w-full border-red-500/40 bg-transparent text-xs font-bold text-red-300 hover:bg-red-500/15 hover:text-red-200"
              >
                {t.settings.reset}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm rounded-2xl border-zinc-800 bg-stone-900 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-extrabold text-red-300">
              {t.settings.resetConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-zinc-400">
              {t.settings.resetConfirmDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800">
              {t.settings.resetCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-red-600 font-bold text-white hover:bg-red-500"
            >
              {t.settings.resetConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Row({
  icon,
  label,
  desc,
  children,
}: {
  icon: React.ReactNode
  label: string
  desc: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-amber-300">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-100">{label}</div>
          {desc && <div className="text-[11px] leading-snug text-zinc-400">{desc}</div>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
