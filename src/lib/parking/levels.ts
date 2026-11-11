/**
 * Car Parking puzzle — level data + rules (Phase 5, Day 71–90).
 *
 * Classic sliding-block "unblock the red car" puzzle on a 6×6 grid:
 * the VIP car X must reach the right edge of row 2. Sliding a vehicle any
 * distance in one direction counts as ONE move (same rule the par values
 * were computed with, so star ratings are fair).
 *
 * The 40 layouts are auto-generated (`scripts/tmp/parking-final.ts`):
 * solvability-verified via BFS with exact par values forming a smooth
 * difficulty curve (par 2 → 21). Do not hand-edit the data.
 */

export interface Vehicle {
  id: string
  x: number
  y: number
  len: number
  dir: 'h' | 'v'
}

export interface ParkingLevel {
  par: number
  vehicles: Vehicle[]
}

const v = (id: string, x: number, y: number, len: number, dir: 'h' | 'v'): Vehicle => ({ id, x, y, len, dir })



const LEVEL_DATA = [
  { par: 2, vehicles: [v('X',2,2,2,'h'), v('A',0,0,2,'v'), v('B',1,1,2,'h'), v('C',3,0,2,'v'), v('D',0,2,2,'h'), v('E',1,3,3,'v'), v('F',2,4,2,'h'), v('G',4,2,2,'v'), v('H',1,0,2,'h')] },
  { par: 2, vehicles: [v('X',2,2,2,'h'), v('A',0,0,2,'v'), v('B',1,1,2,'h'), v('C',3,0,2,'v'), v('D',0,2,2,'h'), v('E',1,3,3,'v'), v('F',2,4,2,'h'), v('G',4,1,2,'v'), v('H',1,0,2,'h')] },
  { par: 3, vehicles: [v('X',2,2,2,'h'), v('A',0,0,2,'v'), v('B',1,1,2,'h'), v('C',3,0,2,'v'), v('D',0,2,2,'h'), v('E',1,3,3,'v'), v('F',3,4,2,'h'), v('G',4,2,2,'v'), v('H',4,0,2,'h')] },
  { par: 3, vehicles: [v('X',2,2,2,'h'), v('A',0,0,2,'v'), v('B',1,1,2,'h'), v('C',3,0,2,'v'), v('D',0,2,2,'h'), v('E',1,3,3,'v'), v('F',4,4,2,'h'), v('G',4,2,2,'v'), v('H',4,0,2,'h')] },
  { par: 4, vehicles: [v('X',2,2,2,'h'), v('A',0,0,2,'v'), v('B',3,1,2,'h'), v('C',3,3,2,'v'), v('D',0,2,2,'h'), v('E',1,3,3,'v'), v('F',4,4,2,'h'), v('G',4,2,2,'v'), v('H',3,0,2,'h')] },
  { par: 4, vehicles: [v('X',2,2,2,'h'), v('A',0,0,2,'v'), v('B',3,1,2,'h'), v('C',3,3,2,'v'), v('D',0,2,2,'h'), v('E',1,3,3,'v'), v('F',4,4,2,'h'), v('G',4,2,2,'v'), v('H',4,0,2,'h')] },
  { par: 5, vehicles: [v('X',0,2,2,'h'), v('A',0,0,2,'v'), v('B',2,2,3,'v'), v('C',3,2,2,'v'), v('D',0,4,2,'h'), v('E',4,1,2,'v'), v('F',2,5,3,'h')] },
  { par: 5, vehicles: [v('X',0,2,2,'h'), v('A',0,0,2,'v'), v('B',2,2,3,'v'), v('C',3,2,2,'v'), v('D',0,4,2,'h'), v('E',4,1,2,'v'), v('F',1,5,3,'h')] },
  { par: 6, vehicles: [v('X',0,2,2,'h'), v('A',0,0,2,'v'), v('B',2,1,3,'v'), v('C',3,2,2,'v'), v('D',1,4,2,'h'), v('E',4,1,2,'v'), v('F',2,5,3,'h')] },
  { par: 6, vehicles: [v('X',0,2,2,'h'), v('A',0,0,2,'v'), v('B',2,1,3,'v'), v('C',3,2,2,'v'), v('D',1,4,2,'h'), v('E',4,1,2,'v'), v('F',1,5,3,'h')] },
  { par: 7, vehicles: [v('X',1,2,2,'h'), v('D',3,5,3,'h'), v('J',1,3,3,'v'), v('B',5,0,3,'v'), v('K',3,3,2,'h'), v('C',3,1,2,'v'), v('A',4,4,2,'h'), v('G',1,0,2,'h'), v('F',4,0,2,'v'), v('E',2,3,3,'v'), v('H',0,0,3,'v'), v('I',1,1,2,'h'), v('L',0,3,2,'v')] },
  { par: 7, vehicles: [v('X',2,2,2,'h'), v('H',0,1,2,'v'), v('C',4,1,2,'h'), v('F',3,5,2,'h'), v('K',1,3,2,'h'), v('D',1,1,3,'h'), v('J',5,2,2,'v'), v('E',3,4,2,'h'), v('A',4,2,2,'v'), v('G',2,0,2,'h'), v('B',0,4,2,'h'), v('I',5,4,2,'v'), v('L',0,5,2,'h')] },
  { par: 8, vehicles: [v('X',0,2,2,'h'), v('G',4,0,3,'v'), v('B',5,0,2,'v'), v('K',5,2,3,'v'), v('D',4,5,2,'h'), v('E',3,4,2,'v'), v('C',2,1,2,'h'), v('J',1,3,2,'v'), v('H',0,0,2,'v'), v('A',3,2,2,'v'), v('I',2,3,2,'v'), v('F',0,3,2,'v'), v('L',2,0,2,'h')] },
  { par: 8, vehicles: [v('X',1,2,2,'h'), v('L',2,4,3,'h'), v('F',3,2,2,'v'), v('E',0,0,3,'v'), v('D',5,1,2,'v'), v('G',5,4,2,'v'), v('J',1,3,2,'v'), v('I',2,0,2,'h'), v('K',4,0,2,'v'), v('H',1,1,2,'h'), v('C',1,5,3,'h'), v('A',0,4,2,'v'), v('B',4,2,2,'v')] },
  { par: 9, vehicles: [v('X',1,2,2,'h'), v('L',3,2,2,'v'), v('K',1,5,3,'h'), v('J',0,1,2,'v'), v('I',3,4,3,'h'), v('C',5,0,3,'v'), v('D',1,3,2,'v'), v('A',4,5,2,'h'), v('B',0,0,2,'h'), v('G',0,3,2,'v'), v('E',2,0,2,'v'), v('F',2,3,2,'v'), v('H',4,3,2,'h')] },
  { par: 9, vehicles: [v('X',0,2,2,'h'), v('C',2,0,3,'h'), v('G',2,2,2,'v'), v('F',1,1,2,'h'), v('E',0,3,3,'v'), v('B',1,4,2,'h'), v('D',3,3,3,'v'), v('J',5,2,2,'v'), v('K',4,3,3,'v'), v('H',3,1,3,'h'), v('L',0,0,2,'h'), v('I',5,4,2,'v'), v('A',1,5,2,'h')] },
  { par: 10, vehicles: [v('X',0,2,2,'h'), v('I',4,0,2,'h'), v('H',3,2,2,'v'), v('K',1,4,3,'h'), v('D',2,1,2,'v'), v('A',1,0,2,'v'), v('C',4,2,2,'v'), v('E',4,5,2,'h'), v('B',4,1,2,'h'), v('L',5,2,3,'v'), v('F',0,4,2,'v'), v('G',3,0,2,'v'), v('J',2,5,2,'h')] },
  { par: 10, vehicles: [v('X',0,2,2,'h'), v('I',1,3,3,'v'), v('F',5,1,3,'v'), v('L',1,0,2,'h'), v('C',3,0,2,'h'), v('J',3,2,2,'v'), v('D',0,1,2,'h'), v('G',4,1,3,'v'), v('H',0,3,3,'v'), v('E',4,4,2,'h'), v('K',2,5,2,'h'), v('A',2,1,2,'h'), v('B',2,3,2,'v')] },
  { par: 11, vehicles: [v('X',0,2,2,'h'), v('E',3,2,2,'v'), v('C',2,0,2,'v'), v('D',4,1,2,'v'), v('I',4,3,3,'v'), v('H',0,5,3,'h'), v('J',3,0,2,'v'), v('B',5,1,2,'v'), v('F',0,3,2,'v'), v('L',0,0,2,'v'), v('K',4,0,2,'h'), v('G',5,3,2,'v'), v('A',1,3,2,'h')] },
  { par: 11, vehicles: [v('X',0,2,2,'h'), v('K',3,1,3,'h'), v('G',2,5,2,'h'), v('J',0,4,2,'h'), v('B',4,2,2,'v'), v('A',0,3,2,'h'), v('I',4,0,2,'h'), v('E',1,0,2,'v'), v('C',4,4,2,'v'), v('L',5,3,2,'v'), v('H',2,0,2,'h'), v('F',2,3,2,'v'), v('D',0,0,2,'v')] },
  { par: 12, vehicles: [v('X',2,2,2,'h'), v('L',1,1,2,'h'), v('D',5,0,3,'v'), v('K',2,5,2,'h'), v('A',1,4,2,'v'), v('H',4,5,2,'h'), v('I',0,3,3,'v'), v('B',4,4,2,'h'), v('C',1,2,2,'v'), v('F',2,0,2,'h'), v('G',0,0,2,'h'), v('J',2,4,2,'h'), v('E',2,3,3,'h')] },
  { par: 12, vehicles: [v('X',1,2,2,'h'), v('H',5,0,2,'v'), v('F',2,3,2,'v'), v('D',3,0,2,'h'), v('L',0,4,2,'v'), v('E',0,0,2,'h'), v('C',4,3,2,'h'), v('I',1,3,2,'v'), v('G',3,3,2,'v'), v('K',4,1,2,'v'), v('A',3,1,2,'v'), v('B',1,1,2,'h'), v('J',2,5,3,'h')] },
  { par: 13, vehicles: [v('X',0,2,2,'h'), v('F',1,3,2,'h'), v('C',4,1,2,'v'), v('E',5,1,2,'v'), v('B',1,0,2,'v'), v('G',3,2,3,'v'), v('J',0,0,2,'v'), v('H',2,1,2,'v'), v('I',2,5,2,'h'), v('K',0,3,2,'v'), v('A',2,0,2,'h'), v('L',4,3,2,'h'), v('D',4,0,2,'h')] },
  { par: 13, vehicles: [v('X',3,2,2,'h'), v('F',2,3,2,'v'), v('A',3,4,3,'h'), v('D',0,1,2,'v'), v('J',0,3,2,'h'), v('L',1,1,3,'h'), v('I',2,0,3,'h'), v('G',1,5,3,'h'), v('C',3,3,2,'h'), v('K',1,2,2,'h'), v('B',5,0,3,'v'), v('E',4,5,2,'h'), v('H',0,4,2,'v')] },
  { par: 14, vehicles: [v('X',0,2,2,'h'), v('K',2,3,3,'v'), v('E',5,1,2,'v'), v('C',1,0,2,'v'), v('L',3,4,2,'h'), v('J',0,0,2,'v'), v('H',3,3,3,'h'), v('B',3,1,2,'v'), v('G',2,0,2,'h'), v('F',4,0,2,'v'), v('I',0,4,2,'v'), v('D',3,5,2,'h'), v('A',1,3,2,'v')] },
  { par: 14, vehicles: [v('X',0,2,2,'h'), v('J',2,3,3,'h'), v('I',5,2,3,'v'), v('B',0,4,2,'v'), v('D',1,0,2,'h'), v('K',2,1,2,'v'), v('H',4,5,2,'h'), v('A',4,1,2,'h'), v('L',2,5,2,'h'), v('G',0,0,2,'v'), v('C',2,4,3,'h'), v('E',4,0,2,'h'), v('F',0,3,2,'h')] },
  { par: 15, vehicles: [v('X',2,2,2,'h'), v('H',0,5,2,'h'), v('G',4,3,2,'h'), v('D',3,0,3,'h'), v('E',4,1,2,'v'), v('L',1,2,3,'v'), v('K',2,3,2,'v'), v('A',0,1,2,'h'), v('F',5,4,2,'v'), v('C',0,0,2,'h'), v('I',3,4,2,'h'), v('J',3,5,2,'h'), v('B',5,1,2,'v')] },
  { par: 15, vehicles: [v('X',0,2,2,'h'), v('G',1,0,3,'h'), v('A',2,1,2,'v'), v('C',2,4,2,'v'), v('J',5,2,3,'v'), v('F',3,5,3,'h'), v('L',0,4,2,'v'), v('D',3,1,2,'h'), v('B',4,2,3,'v'), v('I',1,3,3,'v'), v('K',3,3,2,'v'), v('H',0,0,2,'v'), v('E',5,0,2,'v')] },
  { par: 16, vehicles: [v('X',0,2,2,'h'), v('G',4,2,3,'v'), v('H',0,5,2,'h'), v('E',5,0,2,'v'), v('L',0,1,3,'h'), v('C',1,3,3,'h'), v('A',3,1,2,'v'), v('I',3,5,2,'h'), v('J',5,2,2,'v'), v('F',1,4,2,'h'), v('K',3,0,2,'h'), v('D',0,3,2,'v'), v('B',0,0,3,'h')] },
  { par: 16, vehicles: [v('X',2,2,2,'h'), v('C',3,3,2,'h'), v('L',3,4,2,'v'), v('J',0,4,2,'v'), v('F',2,1,3,'h'), v('A',0,3,2,'h'), v('D',4,4,2,'h'), v('K',4,0,2,'h'), v('I',2,4,2,'v'), v('G',0,1,2,'v'), v('H',1,0,3,'h'), v('B',4,5,2,'h'), v('E',5,1,3,'v')] },
  { par: 17, vehicles: [v('X',0,2,2,'h'), v('F',0,0,2,'v'), v('B',5,3,2,'v'), v('E',1,3,2,'h'), v('J',5,0,2,'v'), v('A',3,4,2,'h'), v('G',4,1,2,'v'), v('I',4,5,2,'h'), v('C',0,3,3,'v'), v('H',2,1,2,'v'), v('D',3,2,2,'v'), v('L',3,0,2,'v'), v('K',1,0,2,'h')] },
  { par: 17, vehicles: [v('X',1,2,2,'h'), v('K',0,3,2,'h'), v('D',1,5,3,'h'), v('L',1,1,2,'h'), v('C',3,2,2,'v'), v('B',5,1,3,'v'), v('G',4,1,3,'v'), v('I',2,3,2,'v'), v('E',3,4,3,'h'), v('A',0,1,2,'v'), v('F',0,0,2,'h'), v('J',3,0,2,'v'), v('H',4,0,2,'h')] },
  { par: 18, vehicles: [v('X',2,2,2,'h'), v('B',1,5,3,'h'), v('L',0,3,2,'h'), v('G',2,0,2,'v'), v('F',3,0,2,'h'), v('I',5,3,2,'v'), v('J',0,0,3,'v'), v('D',4,3,2,'v'), v('K',3,3,2,'v'), v('E',5,0,2,'v'), v('C',1,4,2,'h'), v('A',1,0,2,'v'), v('H',4,1,2,'v')] },
  { par: 18, vehicles: [v('X',1,2,2,'h'), v('D',3,5,3,'h'), v('I',2,3,2,'h'), v('A',1,1,2,'h'), v('L',2,4,2,'v'), v('F',3,0,2,'v'), v('K',5,1,3,'v'), v('J',4,2,3,'v'), v('C',0,3,2,'v'), v('G',0,0,2,'h'), v('H',1,3,3,'v'), v('E',4,0,2,'h')] },
  { par: 19, vehicles: [v('X',1,2,2,'h'), v('E',4,4,2,'v'), v('B',1,0,2,'v'), v('C',2,3,2,'h'), v('L',3,0,3,'h'), v('A',2,0,2,'v'), v('G',3,1,2,'v'), v('K',0,3,2,'h'), v('J',5,1,3,'v'), v('D',4,1,2,'v'), v('F',1,5,3,'h'), v('H',1,4,2,'h'), v('I',0,4,2,'v')] },
  { par: 19, vehicles: [v('X',3,2,2,'h'), v('F',0,5,2,'h'), v('E',1,2,3,'v'), v('K',4,5,2,'h'), v('C',2,2,2,'v'), v('A',2,0,2,'h'), v('H',4,4,2,'h'), v('L',0,0,2,'v'), v('G',0,3,2,'v'), v('J',3,3,2,'v'), v('I',5,0,3,'v'), v('B',1,1,2,'h'), v('D',2,4,2,'v')] },
  { par: 20, vehicles: [v('X',0,2,2,'h'), v('C',1,5,3,'h'), v('D',0,3,2,'h'), v('J',4,1,2,'h'), v('G',0,4,3,'h'), v('I',3,2,2,'v'), v('L',5,3,2,'v'), v('A',2,1,2,'v'), v('E',1,0,2,'h'), v('F',4,3,2,'v'), v('B',4,0,2,'h'), v('K',0,0,2,'v'), v('H',3,0,2,'v')] },
  { par: 20, vehicles: [v('X',0,2,2,'h'), v('J',1,4,2,'v'), v('B',4,2,2,'v'), v('L',2,2,2,'v'), v('K',3,3,3,'v'), v('H',4,5,2,'h'), v('I',2,1,3,'h'), v('A',1,0,2,'h'), v('F',5,2,2,'v'), v('E',0,3,3,'v'), v('D',0,1,2,'h'), v('C',5,0,2,'v'), v('G',2,4,2,'v')] },
  { par: 21, vehicles: [v('X',0,2,2,'h'), v('H',3,3,2,'h'), v('D',0,4,2,'v'), v('G',1,4,2,'v'), v('C',5,3,2,'v'), v('J',3,0,2,'v'), v('L',2,3,2,'v'), v('K',0,0,2,'h'), v('B',3,5,3,'h'), v('E',2,1,2,'v'), v('F',3,4,2,'h'), v('I',5,1,2,'v'), v('A',4,0,3,'v')] },
  { par: 21, vehicles: [v('X',0,2,2,'h'), v('B',1,3,2,'v'), v('E',2,5,3,'h'), v('C',5,3,2,'v'), v('F',3,1,2,'v'), v('L',2,1,2,'v'), v('K',3,3,2,'h'), v('J',1,0,2,'h'), v('G',3,4,2,'h'), v('D',4,0,3,'v'), v('H',0,4,2,'v'), v('A',5,1,2,'v'), v('I',2,3,2,'v')] },
]

export const LEVELS: ParkingLevel[] = LEVEL_DATA

export const LEVEL_COUNT = LEVELS.length

/* ------------------------------ rules ------------------------------ */

export function cellsOf(v: Vehicle): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let i = 0; i < v.len; i++) {
    out.push(v.dir === 'h' ? [v.x + i, v.y] : [v.x, v.y + i])
  }
  return out
}

function occupiedSet(vs: Vehicle[]): Set<string> {
  const s = new Set<string>()
  for (const v of vs) for (const [x, y] of cellsOf(v)) s.add(`${x},${y}`)
  return s
}

export function isSolved(vs: Vehicle[]): boolean {
  const x = vs.find((v) => v.id === 'X')
  if (!x) return false
  return x.x + x.len >= 6
}

/** Slide a vehicle to the given cell if legal — returns the new layout or null. */
export function slideVehicle(vs: Vehicle[], vi: number, toX: number, toY: number): Vehicle[] | null {
  const v = vs[vi]
  if (!v) return null
  if (v.dir === 'h' && toY !== v.y) return null
  if (v.dir === 'v' && toX !== v.x) return null

  const step = v.dir === 'h' ? toX - v.x : toY - v.y
  if (step === 0) return null

  const occ = occupiedSet(vs)
  for (const [cx, cy] of cellsOf(v)) occ.delete(`${cx},${cy}`) // free self

  const probe: Vehicle = { ...v, x: toX, y: toY }
  if (probe.x < 0 || probe.y < 0) return null
  // every cell of the final placement must be inside the grid + free
  for (const [cx, cy] of cellsOf(probe)) {
    if (cx > 5 || cy > 5) return null
    if (occ.has(`${cx},${cy}`)) return null
  }
  // every intermediate position along the path must also be inside + free
  const dirStep = Math.sign(step)
  for (let d = 1; d <= Math.abs(step); d++) {
    const mid: Vehicle = {
      ...v,
      x: v.dir === 'h' ? v.x + dirStep * d : v.x,
      y: v.dir === 'v' ? v.y + dirStep * d : v.y,
    }
    for (const [cx, cy] of cellsOf(mid)) {
      if (cx < 0 || cx > 5 || cy < 0 || cy > 5) return null
      if (occ.has(`${cx},${cy}`)) return null
    }
  }
  return vs.map((vv, i) => (i === vi ? probe : vv))
}

/** Star rating: 3 = par, 2 = par+2, 1 = solved at all. */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par) return 3
  if (moves <= par + 2) return 2
  return 1
}
