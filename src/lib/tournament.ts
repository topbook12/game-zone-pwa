/**
 * Weekly tournament helpers — shared by client + server (zero deps).
 *
 * Tournament weeks reset Monday 00:00 UTC so every player worldwide
 * competes in the same window (Phase 3, Day 26–45).
 */

/** Millis timestamp of this week's Monday 00:00 UTC. */
export function weekStartUtcMs(d: Date = new Date()): number {
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const day = new Date(utcMidnight).getUTCDay() // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7
  return utcMidnight - daysSinceMonday * 86_400_000
}

/** ISO-8601 week key like "2026-W07" — stable identifier for a tournament week. */
export function weekKey(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7 // Sunday → 7
  t.setUTCDate(t.getUTCDate() + 4 - day) // jump to this week's Thursday
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
