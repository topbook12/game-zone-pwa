/**
 * Prerendered canvas art for Turbo Rush.
 * Every sprite is drawn once to an offscreen canvas at load, then blitted
 * with per-frame scaling — fast and consistent across devices.
 */

export interface SpriteAsset {
  img: HTMLCanvasElement
  /** Width in world units (roadWidth = 2200, road spans offset -1..1). */
  worldW: number
  /** Collision half-relevance in offset units. Omit for non-collidable. */
  collide?: number
}

export type SpriteAssets = Record<string, SpriteAsset>

export interface PlayerCarImages {
  normal: HTMLCanvasElement
  brake: HTMLCanvasElement
}

/* ---------------- helpers ---------------- */

function mk(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')!
  return { c, x }
}

function rr(
  x: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w / 2, h / 2)
  x.beginPath()
  x.moveTo(px + rad, py)
  x.arcTo(px + w, py, px + w, py + h, rad)
  x.arcTo(px + w, py + h, px, py + h, rad)
  x.arcTo(px, py + h, px, py, rad)
  x.arcTo(px, py, px + w, py, rad)
  x.closePath()
}

function fillRR(
  x: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  r: number,
  color: string | CanvasGradient
): void {
  rr(x, px, py, w, h, r)
  x.fillStyle = color
  x.fill()
}

/** Darken/lighten a hex color by percent (-100..100). */
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const t = pct < 0 ? 0 : 255
  const p = Math.abs(pct) / 100
  const mix = (c: number) => Math.round((t - c) * p + c)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

function vGrad(x: CanvasRenderingContext2D, y0: number, y1: number, top: string, bottom: string) {
  const g = x.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  return g
}

/* ---------------- scenery ---------------- */

function drawPalm(lean: -1 | 1): HTMLCanvasElement {
  const { c, x } = mk(320, 540)
  const baseX = 160
  const topX = baseX + lean * 55
  const topY = 170

  // trunk
  x.strokeStyle = '#6f4a2d'
  x.lineCap = 'round'
  x.lineWidth = 22
  x.beginPath()
  x.moveTo(baseX, 540)
  x.quadraticCurveTo(baseX + lean * 12, 360, topX, topY)
  x.stroke()
  x.strokeStyle = 'rgba(0,0,0,0.18)'
  x.lineWidth = 7
  for (let i = 1; i <= 5; i++) {
    const t = i / 6
    const px = baseX + (topX - baseX) * (t * t * 0.6 + t * 0.4)
    const py = 540 + (topY - 540) * t
    x.beginPath()
    x.moveTo(px - 10, py)
    x.lineTo(px + 10, py - 4)
    x.stroke()
  }

  // fronds
  const frond = (angle: number, len: number, color: string) => {
    const tipX = topX + Math.cos(angle) * len * lean
    const tipY = topY + Math.sin(angle) * len
    x.strokeStyle = color
    x.lineWidth = 13
    x.beginPath()
    x.moveTo(topX, topY)
    x.quadraticCurveTo(topX + Math.cos(angle) * len * 0.6 * lean, topY + Math.sin(angle) * len * 0.5 - 26, tipX, tipY + 14)
    x.stroke()
    x.lineWidth = 7
    x.beginPath()
    x.moveTo(topX, topY)
    x.quadraticCurveTo(topX + Math.cos(angle) * len * 0.6 * lean, topY + Math.sin(angle) * len * 0.5 - 18, tipX, tipY + 10)
    x.stroke()
  }
  const angles = [-2.6, -2.2, -1.75, -1.35, -0.95, -0.55, -0.2]
  angles.forEach((a, i) => frond(a, 120 + (i % 2) * 26, i % 2 === 0 ? '#2d6a4f' : '#40916c'))

  // coconuts
  x.fillStyle = '#5c4033'
  for (const [ox, oy] of [[-12, 8], [10, 12], [0, -4]]) {
    x.beginPath()
    x.arc(topX + ox, topY + oy, 9, 0, Math.PI * 2)
    x.fill()
  }
  return c
}

function drawRock(): HTMLCanvasElement {
  const { c, x } = mk(260, 170)
  x.beginPath()
  x.moveTo(12, 160)
  x.lineTo(52, 62)
  x.lineTo(112, 92)
  x.lineTo(168, 28)
  x.lineTo(246, 160)
  x.closePath()
  x.fillStyle = '#9a826a'
  x.fill()
  x.beginPath()
  x.moveTo(52, 62)
  x.lineTo(112, 92)
  x.lineTo(150, 160)
  x.lineTo(60, 160)
  x.closePath()
  x.fillStyle = 'rgba(84,66,50,0.55)'
  x.fill()
  x.beginPath()
  x.moveTo(168, 28)
  x.lineTo(214, 86)
  x.lineTo(168, 96)
  x.closePath()
  x.fillStyle = 'rgba(255,235,200,0.28)'
  x.fill()
  return c
}

function drawBush(): HTMLCanvasElement {
  const { c, x } = mk(220, 130)
  x.fillStyle = '#3a5a40'
  x.beginPath()
  x.ellipse(110, 112, 92, 18, 0, 0, Math.PI * 2)
  x.fill()
  const blob = (px: number, py: number, r: number, color: string) => {
    x.fillStyle = color
    x.beginPath()
    x.arc(px, py, r, 0, Math.PI * 2)
    x.fill()
  }
  blob(62, 86, 38, '#588157')
  blob(112, 66, 46, '#588157')
  blob(162, 88, 34, '#588157')
  blob(86, 78, 26, '#6b9080')
  blob(138, 72, 24, '#6b9080')
  return c
}

function drawBillboard(bgTop: string, bgBottom: string, text: string, textColor: string): HTMLCanvasElement {
  const { c, x } = mk(440, 380)
  // posts
  x.fillStyle = '#5e5142'
  x.fillRect(64, 236, 26, 140)
  x.fillRect(350, 236, 26, 140)
  x.fillStyle = 'rgba(0,0,0,0.2)'
  x.fillRect(84, 236, 6, 140)
  x.fillRect(370, 236, 6, 140)
  // panel
  const g = vGrad(x, 20, 250, bgTop, bgBottom)
  fillRR(x, 10, 20, 420, 230, 12, g)
  x.strokeStyle = '#fff8ec'
  x.lineWidth = 8
  rr(x, 10, 20, 420, 230, 12)
  x.stroke()
  // text
  x.fillStyle = textColor
  x.font = '900 62px system-ui, -apple-system, sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.shadowColor = 'rgba(0,0,0,0.35)'
  x.shadowBlur = 8
  x.fillText(text, 220, 138)
  x.shadowBlur = 0
  return c
}

function drawPole(): HTMLCanvasElement {
  const { c, x } = mk(90, 430)
  fillRR(x, 28, 0, 34, 430, 8, '#edebe6')
  x.fillStyle = '#e76f51'
  for (let i = 0; i < 4; i++) x.fillRect(28, 42 + i * 100, 34, 34)
  x.fillStyle = 'rgba(0,0,0,0.18)'
  x.fillRect(52, 0, 10, 430)
  return c
}

function drawGantry(text: string, bg: string, border: string, textColor: string): HTMLCanvasElement {
  const { c, x } = mk(1500, 330)
  // columns with cross braces
  const col = (px: number) => {
    fillRR(x, px, 60, 62, 270, 8, '#3d3a34')
    x.strokeStyle = '#57534a'
    x.lineWidth = 7
    for (let i = 0; i < 3; i++) {
      x.beginPath()
      x.moveTo(px + 4, 90 + i * 80)
      x.lineTo(px + 58, 150 + i * 80)
      x.stroke()
      x.beginPath()
      x.moveTo(px + 58, 90 + i * 80)
      x.lineTo(px + 4, 150 + i * 80)
      x.stroke()
    }
  }
  col(40)
  col(1398)
  // banner
  fillRR(x, 0, 40, 1500, 112, 16, bg)
  x.strokeStyle = border
  x.lineWidth = 9
  rr(x, 0, 40, 1500, 112, 16)
  x.stroke()
  // chevrons
  x.fillStyle = border
  for (const cxp of [70, 1430]) {
    const dir = cxp < 750 ? 1 : -1
    x.beginPath()
    x.moveTo(cxp - 22 * dir, 70)
    x.lineTo(cxp + 18 * dir, 96)
    x.lineTo(cxp - 22 * dir, 122)
    x.lineTo(cxp - 8 * dir, 96)
    x.closePath()
    x.fill()
  }
  x.fillStyle = textColor
  x.font = '900 74px system-ui, -apple-system, sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  if ('letterSpacing' in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '10px'
  x.fillText(text, 750, 99)
  if ('letterSpacing' in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'
  return c
}

/* ---------------- traffic cars (rear view) ---------------- */

function drawTrafficCar(color: string): HTMLCanvasElement {
  const { c, x } = mk(300, 200)
  // wheels
  x.fillStyle = '#17181c'
  fillRR(x, 16, 148, 56, 42, 9, '#17181c')
  fillRR(x, 228, 148, 56, 42, 9, '#17181c')
  x.fillStyle = '#33363d'
  x.fillRect(24, 158, 40, 5)
  x.fillRect(236, 158, 40, 5)
  // body
  fillRR(x, 28, 58, 244, 134, 26, vGrad(x, 58, 192, shade(color, 22), shade(color, -26)))
  // cabin
  fillRR(x, 60, 16, 180, 74, 20, shade(color, -38))
  // rear window
  fillRR(x, 78, 28, 144, 48, 12, '#141b22')
  fillRR(x, 86, 33, 58, 9, 4, 'rgba(255,255,255,0.16)')
  // taillights
  x.shadowColor = '#ff5a4f'
  x.shadowBlur = 14
  fillRR(x, 44, 96, 52, 16, 7, '#ff3b30')
  fillRR(x, 204, 96, 52, 16, 7, '#ff3b30')
  x.shadowBlur = 0
  // bumper
  fillRR(x, 34, 148, 232, 28, 10, '#20232a')
  // plate
  fillRR(x, 128, 140, 44, 22, 4, '#e9e9e9')
  return c
}

/* ---------------- player car (rear view, big) ---------------- */

const DEFAULT_CAR_COLOR = '#d92328'

function drawPlayerCar(braking: boolean, body: string = DEFAULT_CAR_COLOR): HTMLCanvasElement {
  const { c, x } = mk(460, 300)
  // wheels
  fillRR(x, 26, 210, 76, 80, 12, '#101013')
  fillRR(x, 358, 210, 76, 80, 12, '#101013')
  x.fillStyle = '#2c2c31'
  x.fillRect(36, 228, 56, 6)
  x.fillRect(368, 228, 56, 6)
  // spoiler wing + struts (tinted to match the paint)
  fillRR(x, 64, 24, 332, 20, 9, shade(body, -55))
  x.fillStyle = shade(body, -62)
  x.fillRect(146, 42, 18, 22)
  x.fillRect(296, 42, 18, 22)
  // roof / cabin
  fillRR(x, 96, 44, 268, 90, 26, shade(body, -42))
  // rear window
  fillRR(x, 116, 58, 228, 58, 14, '#101820')
  fillRR(x, 126, 64, 84, 11, 5, 'rgba(255,255,255,0.14)')
  // mirrors
  fillRR(x, 28, 112, 26, 16, 6, shade(body, -25))
  fillRR(x, 406, 112, 26, 16, 6, shade(body, -25))
  // main body
  fillRR(x, 36, 96, 388, 172, 34, vGrad(x, 96, 268, shade(body, 14), shade(body, -34)))
  // taillight bar
  if (braking) {
    x.shadowColor = '#ff2b2b'
    x.shadowBlur = 36
    fillRR(x, 54, 120, 100, 22, 10, '#ff2222')
    fillRR(x, 306, 120, 100, 22, 10, '#ff2222')
    fillRR(x, 162, 122, 136, 16, 7, '#ff3b3b')
  } else {
    x.shadowColor = '#ff4d4d'
    x.shadowBlur = 16
    fillRR(x, 54, 120, 100, 20, 9, '#e05252')
    fillRR(x, 306, 120, 100, 20, 9, '#e05252')
    fillRR(x, 176, 122, 108, 12, 6, '#8e2428')
  }
  x.shadowBlur = 0
  // plate
  fillRR(x, 196, 192, 68, 28, 5, '#dedede')
  x.fillStyle = '#333'
  x.font = '900 17px system-ui, sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText('RUSH', 230, 207)
  // diffuser
  fillRR(x, 52, 228, 356, 46, 14, '#141414')
  // exhausts
  x.fillStyle = '#0a0a0a'
  x.beginPath()
  x.arc(96, 254, 12, 0, Math.PI * 2)
  x.fill()
  x.beginPath()
  x.arc(364, 254, 12, 0, Math.PI * 2)
  x.fill()
  x.strokeStyle = '#3a3a3a'
  x.lineWidth = 3
  x.beginPath()
  x.arc(96, 254, 12, 0, Math.PI * 2)
  x.stroke()
  x.beginPath()
  x.arc(364, 254, 12, 0, Math.PI * 2)
  x.stroke()
  return c
}

/* ---------------- asset registry ---------------- */

export function createSpriteAssets(): SpriteAssets {
  const assets: SpriteAssets = {
    palmA: { img: drawPalm(1), worldW: 950, collide: 0.17 },
    palmB: { img: drawPalm(-1), worldW: 950, collide: 0.17 },
    rock: { img: drawRock(), worldW: 780, collide: 0.3 },
    bush: { img: drawBush(), worldW: 600 },
    pole: { img: drawPole(), worldW: 200, collide: 0.06 },
    gantryStart: { img: drawGantry('TURBO RUSH', '#b3541e', '#ffe8c2', '#fff3dc'), worldW: 5400 },
    gantryCp: { img: drawGantry('CHECKPOINT', '#1f1d1a', '#ffb703', '#ffe8c2'), worldW: 5400 },
    board0: { img: drawBillboard('#bc6c25', '#dda15e', 'SUNSET GP', '#fff8ec'), worldW: 1500, collide: 0.36 },
    board1: { img: drawBillboard('#212529', '#495057', 'NITRO+', '#ffba08'), worldW: 1500, collide: 0.36 },
    board2: { img: drawBillboard('#9b2226', '#ae2012', 'TURBO', '#fff8ec'), worldW: 1500, collide: 0.36 },
    board3: { img: drawBillboard('#3a5a40', '#a3b18a', 'DRIFT KING', '#14201a'), worldW: 1500, collide: 0.36 },
  }
  const trafficColors = ['#e76f51', '#2a9d8f', '#eae2b7', '#343a40', '#8ab17d']
  trafficColors.forEach((col, i) => {
    assets[`car${i}`] = { img: drawTrafficCar(col), worldW: 640 }
  })
  return assets
}

export function createPlayerCar(bodyColor: string = DEFAULT_CAR_COLOR): PlayerCarImages {
  return { normal: drawPlayerCar(false, bodyColor), brake: drawPlayerCar(true, bodyColor) }
}
