/** Shared types for the Turbo Rush pseudo-3D racing engine. */

export type GamePhase = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameover'

/** Emitted every rendered frame while a run is active. */
export interface HudData {
  speedKmh: number
  speedPercent: number
  score: number
  timeLeft: number
  distanceKm: number
  overtakes: number
  /** 0..1 */
  nitro: number
  nitroActive: boolean
  braking: boolean
  offRoad: boolean
}

export interface GameResult {
  score: number
  distanceKm: number
  overtakes: number
  topSpeedKmh: number
}

export type GameEvent =
  | { type: 'countdown'; value: number }
  | { type: 'checkpoint'; bonus: number }
  | { type: 'crash' }
  | { type: 'overtake' }
  | { type: 'nitrostart' }
  | { type: 'gameover'; result: GameResult }

export interface InputState {
  left: boolean
  right: boolean
  gas: boolean
  brake: boolean
  nitro: boolean
  /** Analog steering −1..1 (tilt / drag). Used when |value| > deadzone. */
  steerAnalog: number
}

export interface EngineOptions {
  onFrame?: (hud: HudData) => void
  onPhase?: (phase: GamePhase) => void
  onEvent?: (event: GameEvent) => void
}

/** Cosmetic skin spec (Phase 4 — pure client, no server cost). */
export interface CarCosmetics {
  /** player car paint color (#rrggbb) */
  carColor?: string
  /** exhaust trail — null/omitted = no trail */
  trail?: { color: string; glow?: string; rainbow?: boolean } | null
}
