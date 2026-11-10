'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Shown inside the fallback card (e.g. game name). */
  label?: string
}

interface State {
  hasError: boolean
}

/**
 * Keeps a crashed game from taking down the whole app:
 * shows a friendly reload card instead of a white screen.
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-red-500/30 bg-zinc-900/80 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400" aria-hidden="true" />
          <div>
            <p className="text-lg font-bold text-zinc-100">Something went wrong</p>
            <p className="mt-1 text-sm text-zinc-400">
              {this.props.label ? `${this.props.label} hit an unexpected error.` : 'An unexpected error occurred.'}{' '}
              Your saved scores are safe.
            </p>
          </div>
          <Button
            onClick={this.handleReload}
            className="bg-amber-500 font-bold text-stone-950 hover:bg-amber-400"
          >
            <RotateCcw className="h-4 w-4" />
            Reload app
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
