'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Home, RotateCcw, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmt, getDict } from '@/lib/i18n'

interface Props {
  children: ReactNode
  /** Shown inside the fallback card (e.g. game name). */
  label?: string
  /** One-tap recovery: return to the hub WITHOUT losing the session. */
  onBack?: () => void
}

interface State {
  hasError: boolean
}

/**
 * Keeps a crashed game from taking down the whole app: a friendly,
 * human card in the player's language — with two ways out
 * (reload the game, or hop back to the hub in one tap).
 */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Game crashed:', this.props.label ?? 'unknown', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleBack = () => {
    // One-tap recovery: reset the boundary and hand control back to the hub.
    this.setState({ hasError: false })
    this.props.onBack?.()
  }

  render() {
    if (this.state.hasError) {
      const t = getDict()
      const desc = this.props.label
        ? fmt(t.error.desc, { game: this.props.label })
        : t.error.descGeneric
      return (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-amber-500/30 bg-zinc-900/80 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15">
            <Wrench className="h-7 w-7 text-amber-400" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold text-zinc-100">{t.error.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{desc}</p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button
              onClick={this.handleReload}
              className="h-11 bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
            >
              <RotateCcw className="h-4 w-4" />
              {t.error.reload}
            </Button>
            {this.props.onBack && (
              <Button
                variant="outline"
                onClick={this.handleBack}
                className="h-11 border-zinc-700 bg-zinc-900 font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Home className="h-4 w-4" />
                {t.error.backHub}
              </Button>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">{t.error.hint}</p>
        </div>
      )
    }
    return this.props.children
  }
}
