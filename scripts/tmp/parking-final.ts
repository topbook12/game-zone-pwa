/**
 * FINAL parking level generator — merges:
 *  1. loose win-state space enumeration (pars 2–6, 2 boards each)
 *  2. random dense packing search (pars 7–20, 2 boards each)
 * Emits src/lib/parking/levels.ts
 */

interface Vehicle {
  id: string
  x: number
  y: number
  len: number
  dir: 'h' | 'v'
}

type Dir = 'h' | 'v'

/* ------------------------------ shared core ------------------------------ */

function cellsOf(v: Vehicle): Array<[number, number]> {
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

function isWin(vs: Vehicle[]): boolean {
  const x = vs.find((v) => v.id === 'X')!
  return x.x + x.len >= 6
}

function legalSlideMoves(vs: Vehicle[]): Array<{ vi: number; x: number; y: number }> {
  const occ = occupiedSet(vs)
  const moves: Array<{ vi: number; x: number; y: number }> = []
  for (let vi = 0; vi < vs.length; vi++) {
    const v = vs[vi]
    for (const step of [-1, 1]) {
      for (let dist = 1; dist < 6; dist++) {
        const leadX = v.dir === 'h' ? (step === 1 ? v.x + v.len - 1 + dist : v.x - dist) : v.x
        const leadY = v.dir === 'v' ? (step === 1 ? v.y + v.len - 1 + dist : v.y - dist) : v.y
        if (leadX < 0 || leadX > 5 || leadY < 0 || leadY > 5) break
        if (occ.has(`${leadX},${leadY}`)) break
        moves.push({
          vi,
          x: v.dir === 'h' ? v.x + step * dist : v.x,
          y: v.dir === 'v' ? v.y + step * dist : v.y,
        })
      }
    }
  }
  return moves
}

function encode(vs: Vehicle[]): string {
  return vs.map((v) => `${v.x}${v.y}`).join('')
}

function bfsPar(start: Vehicle[]): number | null {
  if (isWin(start)) return 0
  const visited = new Set<string>([encode(start)])
  let frontier = [start.map((v) => ({ ...v }))]
  let depth = 0
  while (frontier.length > 0 && depth < 80) {
    depth++
    const next: Vehicle[][] = []
    for (const state of frontier) {
      for (const m of legalSlideMoves(state)) {
        const moved = state.map((v, i) => (i === m.vi ? { ...v, x: m.x, y: m.y } : v))
        const key = encode(moved)
        if (visited.has(key)) continue
        if (isWin(moved)) return depth
        visited.add(key)
        next.push(moved)
      }
    }
    frontier = next
  }
  return null
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------ stage 1: loose spaces ------------------------------ */

function V(id: string, x: number, y: number, len: number, dir: Dir): Vehicle {
  return { id, x, y, len, dir }
}

const SEEDS: Vehicle[][] = [
  [
    V('X', 4, 2, 2, 'h'), V('A', 0, 0, 2, 'v'), V('B', 1, 1, 2, 'h'), V('C', 3, 1, 2, 'v'),
    V('D', 0, 2, 2, 'h'), V('E', 1, 3, 3, 'v'), V('F', 2, 4, 2, 'h'), V('G', 4, 4, 2, 'v'), V('H', 2, 0, 2, 'h'),
  ],
  [
    V('X', 4, 2, 2, 'h'), V('A', 0, 1, 2, 'v'), V('B', 2, 0, 3, 'v'), V('C', 3, 3, 2, 'v'),
    V('D', 0, 4, 2, 'h'), V('E', 4, 0, 2, 'v'), V('F', 1, 5, 3, 'h'),
  ],
  [
    V('X', 4, 2, 2, 'h'), V('A', 0, 0, 3, 'v'), V('B', 1, 2, 2, 'h'), V('C', 2, 3, 3, 'v'),
    V('D', 3, 0, 2, 'v'), V('E', 1, 4, 2, 'v'), V('F', 4, 3, 3, 'v'), V('G', 5, 3, 2, 'v'),
  ],
  [
    V('X', 4, 2, 2, 'h'), V('A', 1, 0, 3, 'v'), V('B', 2, 1, 2, 'h'), V('C', 0, 3, 3, 'h'),
    V('D', 3, 3, 2, 'v'), V('E', 4, 4, 2, 'v'), V('F', 0, 0, 2, 'v'), V('G', 2, 5, 2, 'h'),
  ],
]

function enumerateSpace(seedVs: Vehicle[]): Map<string, { depth: number; vs: Vehicle[] }> {
  const space = new Map<string, { depth: number; vs: Vehicle[] }>()
  const start = seedVs.map((v) => ({ ...v }))
  space.set(encode(start), { depth: 0, vs: start })
  let frontier = [start]
  let depth = 0
  while (frontier.length > 0) {
    depth++
    const next: Vehicle[][] = []
    for (const state of frontier) {
      for (const m of legalSlideMoves(state)) {
        const moved = state.map((v, i) => (i === m.vi ? { ...v, x: m.x, y: m.y } : v))
        const key = encode(moved)
        if (space.has(key)) continue
        space.set(key, { depth, vs: moved })
        next.push(moved)
      }
    }
    frontier = next
  }
  return space
}

function layoutValid(vs: Vehicle[]): boolean {
  const occ = new Map<string, string>()
  for (const v of vs) {
    for (const [x, y] of cellsOf(v)) {
      if (x < 0 || x > 5 || y < 0 || y > 5) return false
      const key = `${x},${y}`
      if (occ.has(key)) return false
      occ.set(key, v.id)
    }
  }
  const x = vs.find((v) => v.id === 'X')
  if (!x || x.dir !== 'h' || x.len !== 2 || x.y !== 2) return false
  return vs.length >= 5
}

/* ------------------------------ stage 2: dense randoms ------------------------------ */

const IDS = 'ABCDEFGHIJKL'

function randomDense(rng: () => number): Vehicle[] | null {
  const vs: Vehicle[] = []
  const occ = new Set<string>()
  const fits = (len: number, dir: Dir, x: number, y: number): boolean => {
    for (let i = 0; i < len; i++) {
      const cx = dir === 'h' ? x + i : x
      const cy = dir === 'h' ? y : y + i
      if (cx > 5 || cy > 5) return false
      if (occ.has(`${cx},${cy}`)) return false
    }
    return true
  }
  const place = (id: string, len: number, dir: Dir, x: number, y: number) => {
    const v: Vehicle = { id, x, y, len, dir }
    vs.push(v)
    for (const [cx, cy] of cellsOf(v)) occ.add(`${cx},${cy}`)
  }
  const xX = Math.floor(rng() * 4)
  place('X', 2, 'h', xX, 2)
  const letters = IDS.split('').filter((c) => c !== 'X')
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[letters[i], letters[j]] = [letters[j], letters[i]]
  }
  let placed = 0
  for (let attempt = 0; attempt < 300 && placed < letters.length; attempt++) {
    const id = letters[placed]
    const len = rng() < 0.45 ? 3 : 2
    const dir: Dir = rng() < 0.6 ? 'v' : 'h'
    const x = Math.floor(rng() * 6)
    const y = Math.floor(rng() * 6)
    if (dir === 'h' && y === 2 && x + len > xX) continue
    if (!fits(len, dir, x, y)) continue
    place(id, len, dir, x, y)
    placed++
  }
  if (placed < 9) return null
  return vs
}

/* ------------------------------ selection ------------------------------ */

const byPar = new Map<number, Vehicle[][]>()
const seenBoards = new Set<string>()
const addBoard = (par: number, vs: Vehicle[]) => {
  if (!layoutValid(vs) || isWin(vs)) return
  const key = encode(vs)
  if (seenBoards.has(key)) return
  seenBoards.add(key)
  const arr = byPar.get(par) ?? []
  arr.push(vs)
  byPar.set(par, arr)
}

// Stage 1 — loose spaces (any par)
for (const seed of SEEDS) {
  for (const item of enumerateSpace(seed).values()) {
    if (item.depth < 2) continue
    const par = bfsPar(item.vs)
    if (par === null || par < 2 || par > 8) continue
    addBoard(par, item.vs)
  }
}

// Stage 2 — dense randoms (par ≥ 7), bigger search
for (let i = 0; i < 40000; i++) {
  const rng = mulberry32(900_000 + i * 7919)
  const vs = randomDense(rng)
  if (!vs) continue
  const par = bfsPar(vs)
  if (par === null || par < 7) continue
  addBoard(par, vs)
}

console.error(
  'coverage:',
  [...byPar.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([p, arr]) => `${p}:${arr.length}`)
    .join(' ')
)

// Build the curve: 2 boards per par, 2..20 (40 levels)
const curve: Vehicle[][] = []
for (let par = 2; par <= 21 && curve.length < 40; par++) {
  const boards = (byPar.get(par) ?? []).slice(0, 2)
  curve.push(...boards)
}
// top up to 40 from whatever is left (highest pars first)
if (curve.length < 40) {
  for (const par of [...byPar.keys()].sort((a, b) => b - a)) {
    for (const vs of byPar.get(par)!) {
      if (curve.length >= 40) break
      if (encode(vs) === encode(curve[curve.length - 1])) continue
      curve.push(vs)
    }
    if (curve.length >= 40) break
  }
}

/* ------------------------------ emit ------------------------------ */

function emitVehicle(v: Vehicle): string {
  return `v('${v.id}',${v.x},${v.y},${v.len},'${v.dir === 'h' ? 'h' : 'v'}')`
}

console.log('// AUTO-GENERATED by scripts/tmp/parking-final.ts — do not edit by hand.')
console.log(`// ${curve.length} levels, pars: ${curve.map((vs) => bfsPar(vs)).join(',')}`)
console.log('')
console.log("const v = (id: string, x: number, y: number, len: number, dir: 'h' | 'v'): Vehicle => ({ id, x, y, len, dir })")
console.log('')
console.log('export const LEVELS: { par: number; vehicles: Vehicle[] }[] = [')
for (const vs of curve) {
  const par = bfsPar(vs)
  console.log(`  { par: ${par}, vehicles: [${vs.map(emitVehicle).join(', ')}] },`)
}
console.log(']')
