/**
 * Universal press / slide / swipe input helpers.
 *
 * WHY THIS EXISTS: several mobile browsers popular in South Asia (UC Browser,
 * old Android WebView, some Firefox Focus builds) never fire Pointer Events,
 * yet every game in this app bound its controls to `onPointer*` only — so on
 * those phones NOTHING was playable (racing steering, snake d-pad/swipe, 2048
 * swipe all dead while plain taps/clicks still worked).
 *
 * These helpers bind Pointer Events AND Touch Events for the same gesture.
 * Browsers that support both fire pointerdown + touchstart together; the
 * "active token" logic makes the gesture tracked exactly once and lets the
 * other family take over cleanly when the first one never fires.
 *
 * NOTE: React attaches touchstart/touchmove listeners as passive — never call
 * e.preventDefault() inside the touch handlers here. Scroll/zoom blocking is
 * handled by CSS `touch-action: none` (`touch-none` class) on game surfaces.
 */
import type React from 'react'

/** Robust touch-device detection (covers old WebKit exposing only msMaxTouchPoints). */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { msMaxTouchPoints?: number }
  return (
    'ontouchstart' in window ||
    (nav.maxTouchPoints ?? 0) > 0 ||
    (nav.msMaxTouchPoints ?? 0) > 0
  )
}

/** Opaque active-gesture token ("p" + pointerId or "t" + touch identifier). */
type Token = string

function claim(active: { token: Token | null }, token: Token): boolean {
  if (active.token !== null) return false
  active.token = token
  return true
}

function release(active: { token: Token | null }, token: Token): boolean {
  if (active.token !== token) return false
  active.token = null
  return true
}

interface HoldCallbacks {
  /** Called once when the press starts (finger down / mouse down). */
  onDown: () => void
  /** Called once when the press ends (finger lift / cancel). Omit for tap-style buttons. */
  onUp?: () => void
}

/**
 * Press-and-hold button props: works for mouse (Pointer Events on desktop),
 * modern touch (Pointer Events) and legacy touch (Touch Events only).
 * Touch events target the element where the touch STARTED, so sliding off a
 * button still delivers touchend here — no stuck inputs on old browsers.
 */
export function holdProps({ onDown, onUp }: HoldCallbacks): React.ComponentProps<'button'> {
  const state = { token: null as Token | null }
  return {
    onPointerDown: (e) => {
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* legacy browser without pointer capture */
      }
      /* A stale pointer token (mouse released off-element) must never block a
         new gesture — same-family takeover is always allowed. */
      if (state.token !== null && !state.token.startsWith('p')) return
      state.token = 'p' + e.pointerId
      onDown()
    },
    onPointerUp: (e) => {
      if (release(state, 'p' + e.pointerId)) onUp?.()
    },
    onPointerCancel: (e) => {
      if (release(state, 'p' + e.pointerId)) onUp?.()
    },
    onLostPointerCapture: (e) => {
      if (release(state, 'p' + e.pointerId)) onUp?.()
    },
    onTouchStart: (e) => {
      const t = e.changedTouches[0]
      if (t && claim(state, 't' + t.identifier)) onDown()
    },
    onTouchEnd: (e) => {
      const t = e.changedTouches[0]
      if (t && release(state, 't' + t.identifier)) onUp?.()
    },
    onTouchCancel: (e) => {
      const t = e.changedTouches[0]
      if (t && release(state, 't' + t.identifier)) onUp?.()
    },
  }
}

/**
 * Slide-tracking surface props (racing steering zone): while the finger/mouse
 * is down anywhere on the element, reports its latest clientX; reports null
 * once on release. Sliding across the element keeps reporting (touch events
 * fire on the start element, pointer capture keeps mouse events here).
 */
export function slideProps(
  onX: (clientX: number | null) => void
): React.ComponentProps<'div'> {
  const state = { token: null as Token | null }
  return {
    onPointerDown: (e) => {
      e.preventDefault()
      if (state.token !== null && !state.token.startsWith('p')) return
      state.token = 'p' + e.pointerId
      onX(e.clientX)
    },
    onPointerMove: (e) => {
      if (state.token === 'p' + e.pointerId) onX(e.clientX)
    },
    onPointerUp: (e) => {
      if (release(state, 'p' + e.pointerId)) onX(null)
    },
    onPointerCancel: (e) => {
      if (release(state, 'p' + e.pointerId)) onX(null)
    },
    onLostPointerCapture: (e) => {
      if (release(state, 'p' + e.pointerId)) onX(null)
    },
    onTouchStart: (e) => {
      const t = e.changedTouches[0]
      if (t && claim(state, 't' + t.identifier)) onX(t.clientX)
    },
    onTouchMove: (e) => {
      if (state.token === null || !state.token.startsWith('t')) return
      const id = Number(state.token.slice(1))
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        if (t.identifier === id) {
          onX(t.clientX)
          return
        }
      }
    },
    onTouchEnd: (e) => {
      if (state.token === null || !state.token.startsWith('t')) return
      const id = Number(state.token.slice(1))
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === id) {
          release(state, state.token)
          onX(null)
          return
        }
      }
    },
    onTouchCancel: (e) => {
      if (state.token === null || !state.token.startsWith('t')) return
      const id = Number(state.token.slice(1))
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === id) {
          release(state, state.token)
          onX(null)
          return
        }
      }
    },
  }
}

export type SwipeDir = 'left' | 'right' | 'up' | 'down'

export interface SwipeCallbacks {
  /** Fired when a horizontal/vertical swipe exceeds the threshold. */
  onSwipe: (dir: SwipeDir) => void
  /** Minimum gesture distance in px (default 24). */
  threshold?: number
}

/**
 * Swipe gesture props for a surface (2048 board, snake canvas): pointer-based
 * on modern browsers, touch-based on legacy browsers — tracked exactly once.
 */
export function swipeProps({ onSwipe, threshold = 24 }: SwipeCallbacks): React.ComponentProps<'div'> {
  const state = { token: null as Token | null, x: 0, y: 0 }
  const finish = (clientX: number, clientY: number): void => {
    const dx = clientX - state.x
    const dy = clientY - state.y
    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    state.token = null
    if (Math.max(ax, ay) < threshold) return
    onSwipe(ax >= ay ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }
  return {
    onPointerDown: (e) => {
      if (state.token !== null && !state.token.startsWith('p')) return
      state.token = 'p' + e.pointerId
      state.x = e.clientX
      state.y = e.clientY
    },
    onPointerUp: (e) => {
      if (state.token === 'p' + e.pointerId) finish(e.clientX, e.clientY)
    },
    onPointerCancel: () => {
      if (state.token !== null && state.token.startsWith('p')) state.token = null
    },
    onTouchStart: (e) => {
      if (state.token !== null && !state.token.startsWith('t')) return
      const t = e.changedTouches[0]
      if (!t) return
      state.token = 't' + t.identifier
      state.x = t.clientX
      state.y = t.clientY
    },
    onTouchEnd: (e) => {
      if (state.token === null || !state.token.startsWith('t')) return
      const id = Number(state.token.slice(1))
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        if (t.identifier === id) {
          finish(t.clientX, t.clientY)
          return
        }
      }
    },
    onTouchCancel: () => {
      if (state.token !== null && state.token.startsWith('t')) state.token = null
    },
  }
}
