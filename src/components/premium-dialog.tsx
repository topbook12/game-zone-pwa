'use client'

/**
 * VIP / Premium dialog — Phase 5 (Day 71–90).
 *
 * Two states:
 *  - Free: benefits pitch + manual VIP code redemption (zero-fee bKash/Nagad
 *    flow — the admin issues codes with `bun run vip:new`).
 *  - Premium: status + cloud backup controls (restore code, manual backup,
 *    restore from another device).
 */

import { useState } from 'react'
import { toast } from 'sonner'
import {
  BadgePercent,
  Car,
  Check,
  CloudUpload,
  Copy,
  Crown,
  Download,
  Puzzle,
  Wallet,
  Zap,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useI18n, fmt } from '@/lib/i18n'
import { usePremium, redeemPremium, VIP_PAYMENT_NOTE } from '@/lib/premium'
import { backupNow, restoreByCloudCode, type RestoreSummary } from '@/lib/cloud'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PremiumDialog({ open, onOpenChange }: Props) {
  const { t, lang } = useI18n()
  const premium = usePremium()

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreCode, setRestoreCode] = useState('')
  const [restoring, setRestoring] = useState(false)

  const redeem = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await redeemPremium(code)
    setBusy(false)
    if (result.ok) {
      toast.success(t.premium.success)
      setCode('')
      onOpenChange(false)
    } else {
      const map: Record<string, string> = {
        invalid: t.premium.errInvalid,
        limit: t.premium.errLimit,
        offline: t.premium.errOffline,
        error: t.premium.errError,
      }
      setError(map[result.reason] ?? t.premium.errError)
    }
  }

  const doBackup = async () => {
    if (backupBusy) return
    setBackupBusy(true)
    const ts = await backupNow()
    setBackupBusy(false)
    if (ts) {
      toast.success(t.premium.backedUp)
    } else {
      toast.error(t.premium.backupFailed)
    }
  }

  const doRestore = async () => {
    if (restoring) return
    setRestoring(true)
    const result: RestoreSummary = await restoreByCloudCode(restoreCode)
    setRestoring(false)
    if (result.ok) {
      toast.success(t.premium.restoreDone)
      setRestoreCode('')
      onOpenChange(false)
    } else {
      const map: Record<string, string> = {
        invalid: t.premium.restoreInvalid,
        'not-found': t.premium.restoreNotFound,
        offline: t.premium.restoreOffline,
        error: t.premium.restoreError,
      }
      toast.error(map[result.reason ?? 'error'] ?? t.premium.restoreError)
    }
  }

  const copyCloudCode = async () => {
    if (!premium.cloudCode) return
    try {
      await navigator.clipboard.writeText(premium.cloudCode)
      toast.success(t.premium.copied)
    } catch {
      toast.error(t.premium.restoreError)
    }
  }

  const benefits = [
    { icon: Zap, text: t.premium.b1 },
    { icon: BadgePercent, text: t.premium.b2 },
    { icon: Car, text: t.premium.b3 },
    { icon: Puzzle, text: t.premium.b4 },
    { icon: CloudUpload, text: t.premium.b5 },
  ]

  const backupDate = premium.lastBackupAt
    ? new Date(premium.lastBackupAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto border-zinc-800 bg-stone-950 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shadow-md shadow-amber-900/40">
              <Crown className="h-5 w-5 text-stone-950" aria-hidden="true" />
            </span>
            {t.premium.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{t.premium.desc}</DialogDescription>
        </DialogHeader>

        {premium.active ? (
          /* ---------------------------- PREMIUM STATE ---------------------------- */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-amber-300">{t.premium.statusActive}</p>
                  {premium.since && (
                    <p className="text-[11px] text-zinc-400">
                      {fmt(t.premium.since, { d: new Date(premium.since).toLocaleDateString() })}
                    </p>
                  )}
                </div>
              </div>
              <Badge className="border-amber-500/40 bg-amber-500/20 text-amber-300">VIP</Badge>
            </div>

            {/* Cloud backup */}
            <section aria-label={t.premium.cloudTitle} className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-teal-300">
                <CloudUpload className="h-4 w-4" aria-hidden="true" />
                {t.premium.cloudTitle}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-400">{t.premium.cloudDesc}</p>

              <div className="mt-3 rounded-lg border border-teal-500/25 bg-stone-950/60 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
                  {t.premium.cloudCodeLabel}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="text-sm font-black tracking-widest text-teal-200">{premium.cloudCode ?? '—'}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-teal-500/40 bg-teal-500/10 px-2 text-teal-300 hover:bg-teal-500/20"
                    onClick={copyCloudCode}
                    aria-label={t.premium.copy}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">{t.premium.cloudCodeDesc}</p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-zinc-400">
                  {backupDate ? fmt(t.premium.lastBackup, { d: backupDate }) : t.premium.neverBackedUp}
                </p>
                <Button
                  size="sm"
                  onClick={doBackup}
                  disabled={backupBusy}
                  className="h-8 shrink-0 bg-teal-500 font-bold text-stone-950 hover:bg-teal-400"
                >
                  <CloudUpload className="mr-1 h-3.5 w-3.5" />
                  {backupBusy ? t.premium.backingUp : t.premium.backupNow}
                </Button>
              </div>
            </section>

            {/* Restore */}
            <section aria-label={t.premium.restoreTitle} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-200">
                <Download className="h-4 w-4 text-teal-400" aria-hidden="true" />
                {t.premium.restoreTitle}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={restoreCode}
                  onChange={(e) => setRestoreCode(e.target.value.toUpperCase())}
                  placeholder={t.premium.restorePlaceholder}
                  className="h-10 flex-1 border-zinc-700 bg-stone-950 font-mono tracking-widest text-teal-200 placeholder:text-zinc-600"
                  aria-label={t.premium.restoreTitle}
                />
                <Button
                  onClick={doRestore}
                  disabled={restoring || restoreCode.trim().length < 6}
                  className="h-10 bg-teal-500 font-bold text-stone-950 hover:bg-teal-400"
                >
                  {restoring ? t.premium.restoring : t.premium.restore}
                </Button>
              </div>
            </section>

            {/* benefits recap */}
            <ul className="grid gap-1.5 text-xs text-zinc-300">
              {benefits.map((b) => (
                <li key={b.text} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  {b.text}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          /* ---------------------------- FREE STATE ---------------------------- */
          <div className="flex flex-col gap-4">
            <section aria-label={t.premium.benefitsTitle}>
              <h3 className="text-sm font-bold text-amber-300">{t.premium.benefitsTitle}</h3>
              <ul className="mt-2 grid gap-2">
                {benefits.map((b) => (
                  <li
                    key={b.text}
                    className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200"
                  >
                    <b.icon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                    {b.text}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label={t.premium.howTitle} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                {t.premium.howTitle}
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-xs leading-relaxed text-zinc-300">
                <li>{t.premium.how1}</li>
                <li>{t.premium.how2}</li>
                <li>{t.premium.how3}</li>
              </ol>
              <p className="mt-2 text-[11px] text-zinc-400">
                <span className="font-semibold text-amber-300/90">{t.premium.payLabel}</span>{' '}
                {VIP_PAYMENT_NOTE}
              </p>
            </section>

            <section aria-label={t.premium.codeLabel}>
              <label htmlFor="vip-code-input" className="mb-1 block text-xs font-semibold text-zinc-300">
                {t.premium.codeLabel}
              </label>
              <div className="flex gap-2">
                <Input
                  id="vip-code-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t.premium.codePlaceholder}
                  className="h-11 flex-1 border-zinc-700 bg-stone-950 font-mono tracking-widest text-amber-200 placeholder:text-zinc-600"
                  aria-label={t.premium.codeAria}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code.trim().length >= 8) void redeem()
                  }}
                />
                <Button
                  onClick={() => void redeem()}
                  disabled={busy || code.trim().length < 8}
                  className="h-11 bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-stone-950 hover:from-amber-400 hover:to-orange-400"
                >
                  <Crown className="mr-1 h-4 w-4" />
                  {busy ? t.premium.redeeming : t.premium.redeem}
                </Button>
              </div>
              {error && (
                <p role="alert" className="mt-2 text-xs font-semibold text-red-400">
                  {error}
                </p>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
