/**
 * Verify the SHIPPED game level data: every level solvable + par matches.
 * Uses an independent BFS (not the generator's) via slideVehicle semantics.
 */
import { LEVELS, slideVehicle, isSolved, starsFor, type Vehicle } from '../../src/lib/parking/levels'

interface QState {
  vs: Vehicle[]
  d: number
}

function bfsPar(start: Vehicle[]): number | null {
  if (isSolved(start)) return 0
  const key = (vs: Vehicle[]) => vs.map((v) => `${v.x}${v.y}`).join('')
  const visited = new Set([key(start)])
  let frontier: QState[] = [{ vs: start, d: 0 }]
  let d = 0
  while (frontier.length > 0 && d < 80) {
    d++
    const next: QState[] = []
    for (const st of frontier) {
      for (let vi = 0; vi < st.vs.length; vi++) {
        const v = st.vs[vi]
        // try all reachable destinations along its axis
        for (let t = 0; t < 6; t++) {
          const toX = v.dir === 'h' ? t : v.x
          const toY = v.dir === 'v' ? t : v.y
          const moved = slideVehicle(st.vs, vi, toX, toY)
          if (!moved) continue
          const k = key(moved)
          if (visited.has(k)) continue
          if (isSolved(moved)) return d
          visited.add(k)
          next.push({ vs: moved, d })
        }
      }
    }
    frontier = next
  }
  return null
}

let ok = 0
let bad = 0
LEVELS.forEach((lv, i) => {
  const par = bfsPar(lv.vehicles)
  if (par === lv.par) {
    ok++
  } else {
    bad++
    console.log(`L${i + 1}: shipped par=${lv.par} but verified=${par} ❌`)
  }
  // sanity: stars mapping
  const s = starsFor(lv.par, lv.par)
  if (s !== 3) console.log(`L${i + 1}: stars broken (${s})`)
})
console.log(`${ok}/${LEVELS.length} levels verified with exact pars ✅ (${bad} bad)`)
