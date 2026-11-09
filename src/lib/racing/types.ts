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
}

export interface EngineOptions {
  onFrame?: (hud: HudData) => void
  onPhase?: (phase: GamePhase) => void
  onEvent?: (event: GameEvent) => void
}
