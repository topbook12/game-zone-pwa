'use client'

/**
 * Cosmetics Shop — Phase 4 (Day 46–70).
 * Pure-client skins paid with coins; everything works offline.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Check, Palette, Sparkles, Paintbrush } from 'lucide-react'
import { useI18n, fmt } from '@/lib/i18n'
import {
  COSMETICS,
  buyCosmetic,
  selectCosmetic,
  useCosmetics,
  type CosmeticCategory,
  type CosmeticItem,
} from '@/lib/cosmetics'
import { spendCoins, useCoins } from '@/lib/coins'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ItemPreview({ item }: { item: CosmeticItem }) {
  if (item.category === 'theme') {
    return (
      <div
        className="h-12 w-16 rounded-lg border border-zinc-700"
        style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
        aria-hidden="true"
      />
    )
  }
  if (item.category === 'trail') {
    return (
      <div className="flex h-12 w-16 items-center justify-center" aria-hidden="true">
        {item.glow || item.color ? (
          <div
            className="h-4 w-4 rounded-full"
            style={{
              background: item.rainbow
                ? 'conic-gradient(#f472b6, #facc15, #4ade80, #22d3ee, #a855f7, #f472b6)'
                : item.color,
              boxShadow: `0 0 12px 4px ${item.glow ?? item.color}`,
            }}
          />
        ) : (
          <div className="h-4 w-4 rounded-full bg-zinc-700" />
        )}
      </div>
    )
  }
  // car — simple stylized side-view swatch
  return (
    <div className="flex h-12 w-16 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 48 24" className="h-7 w-12">
        <path
          d="M6 17 L10 9 Q11 7 14 7 L30 7 Q33 7 35 9 L40 13 Q44 14 44 17 L44 19 L6 19 Z"
          fill={item.color}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
        />
        <path d="M14 8.5 L29 8.5 Q31.5 8.5 33 10 L35 12.5 L13 12.5 Z" fill="rgba(255,255,255,0.35)" />
        <circle cx="14" cy="19" r="3.4" fill="#0c0a09" stroke="#57534e" />
        <circle cx="35" cy="19" r="3.4" fill="#0c0a09" stroke="#57534e" />
      </svg>
    </div>
  )
}

export function ShopDialog({ open, onOpenChange }: Props) {
  const { t, lang } = useI18n()
  const cosmetics = useCosmetics()
  const coins = useCoins()
  const [tab, setTab] = useState<CosmeticCategory>('car')

  const buy = (item: CosmeticItem) => {
    const result = buyCosmetic(item.id, spendCoins)
    if (result.ok) {
      toast.success(t.shop.bought, {
        description: `${item.name} • ${fmt(t.coins.spent, { n: item.price })}`,
      })
    } else if (result.reason === 'funds') {
      toast.error(t.shop.needCoins)
    }
  }

  const select = (item: CosmeticItem) => {
    selectCosmetic(item.id)
  }

  const renderItem = (item: CosmeticItem) => {
    const owned = cosmetics.owned.includes(item.id)
    const selected = cosmetics[item.category] === item.id
    const label = lang === 'bn' ? item.nameBn : item.name
    return (
      <div
        key={item.id}
        className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
          selected ? 'border-amber-500/60 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/60'
        }`}
        aria-label={fmt(t.shop.itemAria, { name: label })}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{label}</p>
            <p className="text-[11px] text-zinc-400">
              {owned ? t.shop.owned : item.price === 0 ? t.shop.free : `🪙 ${item.price}`}
            </p>
          </div>
          <ItemPreview item={item} />
        </div>
        {selected ? (
          <Button size="sm" disabled className="h-8 border-amber-500/40 bg-amber-500/15 text-amber-300">
            <Check className="mr-1 h-3.5 w-3.5" />
            {t.shop.selected}
          </Button>
        ) : owned ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            onClick={() => select(item)}
          >
            {t.shop.select}
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
            onClick={() => buy(item)}
          >
            {item.price === 0 ? t.shop.buy : `${t.shop.buy} 🪙${item.price}`}
          </Button>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-hidden border-zinc-800 bg-stone-950 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Palette className="h-5 w-5 text-amber-400" aria-hidden="true" />
            {t.shop.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{t.shop.desc}</DialogDescription>
          <div className="mt-1 flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            <span className="text-xs font-semibold text-amber-200/80">{t.shop.balance}</span>
            <span className="text-lg font-black text-amber-300" aria-label={t.coins.balanceAria}>
              🪙 {coins.balance}
            </span>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as CosmeticCategory)} className="flex min-h-0 flex-col">
          <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
            <TabsTrigger value="car" className="gap-1 text-xs data-[state=active]:bg-zinc-800">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t.shop.tabCar}
            </TabsTrigger>
            <TabsTrigger value="trail" className="gap-1 text-xs data-[state=active]:bg-zinc-800">
              <Paintbrush className="h-3.5 w-3.5" aria-hidden="true" />
              {t.shop.tabTrail}
            </TabsTrigger>
            <TabsTrigger value="theme" className="gap-1 text-xs data-[state=active]:bg-zinc-800">
              <Palette className="h-3.5 w-3.5" aria-hidden="true" />
              {t.shop.tabTheme}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="car" className="mt-3 grid grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {COSMETICS.filter((c) => c.category === 'car').map(renderItem)}
          </TabsContent>
          <TabsContent value="trail" className="mt-3 grid grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {COSMETICS.filter((c) => c.category === 'trail').map(renderItem)}
          </TabsContent>
          <TabsContent value="theme" className="mt-3 grid grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {COSMETICS.filter((c) => c.category === 'theme').map(renderItem)}
          </TabsContent>
        </Tabs>

        <p className="pb-1 text-center text-[11px] text-zinc-500">{t.shop.earnMore}</p>
      </DialogContent>
    </Dialog>
  )
}
