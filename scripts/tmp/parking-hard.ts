/**
 * HARD parking level generator — random dense packing + exact-par filter.
 * Complements the loose seeds (pars 2–8) with pars 7–20+.
 */

interface Vehicle {
  id: string
  x: number
  y: number
  len: number
  dir: 'h' | 'v'
}

type Dir = 'h' | 'v'

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

/* ------------------------------ random dense layouts ------------------------------ */

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
    vs.push({ id, x, y, len, dir })
    for (const [cx, cy] of cellsOf(vs[vs.length - 1])) occ.add(`${cx},${cy}`)
  }

  // X on row 2, random x 0..3 (leave room to the right)
  const xX = Math.floor(rng() * 4)
  place('X', 2, 'h', xX, 2)

  const letters = IDS.split('').filter((c) => c !== 'X')
  // shuffle letters
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
    // never place a horizontal car on row 2 to the RIGHT of X (permanent blocker)
    if (dir === 'h' && y === 2 && x + len > xX) continue
    if (!fits(len, dir, x, y)) continue
    place(id, len, dir, x, y)
    placed++
  }
  if (placed < 9) return null // too loose
  return vs
}

const parCount = new Map<number, Vehicle[]>()
const seenBoards = new Set<string>()
let hard = 0
let total = 0

for (let i = 0; i < 6000; i++) {
  const rng = mulberry32(900_000 + i * 7919)
  const vs = randomDense(rng)
  if (!vs) continue
  const key = encode(vs)
  if (seenBoards.has(key)) continue
  seenBoards.add(key)
  total++
  const par = bfsPar(vs)
  if (par === null || par < 7) continue
  hard++
  if (!parCount.has(par)) parCount.set(par, vs)
}

console.log(`dense boards: ${total} unique, hard (par≥7): ${hard}`)
console.log('par coverage:', [...parCount.keys()].sort((a, b) => a - b).join(','))
for (const [par, vs] of [...parCount.entries()].sort((a, b) => a[0] - b[0]).slice(0, 20)) {
  const emit = vs
    .map((v) => `v('${v.id}',${v.x},${v.y},${v.len},'${v.dir === 'h' ? 'h' : 'v'}')`)
    .join(', ')
  console.log(`par ${par}: [${emit}]`)
}
