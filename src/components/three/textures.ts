import * as THREE from 'three'

/**
 * Canvas-generated textures — used instead of drei <Text> (which fetches a
 * font from a CDN at runtime) so the app works fully offline.
 */

export interface DisplayState {
  testing: boolean
  demo: boolean
  voltage: number | null
  current: number | null
  temperature: number | null
  /** recent normalised voltage values 0..1 for the mini waveform */
  waveform: number[]
  progress: number
}

const IDLE_STATE: DisplayState = {
  testing: false,
  demo: true,
  voltage: null,
  current: null,
  temperature: null,
  waveform: [],
  progress: 0,
}

export function createDisplayTexture(): { texture: THREE.CanvasTexture; update: (s: DisplayState) => void } {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 320
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const IVORY = '#FFF4EB'
  const TEAL = '#63D8C2'
  const COPPER = '#FF936B'
  const AMBER = '#F5B84C'

  function draw(s: DisplayState): void {
    if (!ctx) return
    // Screen background
    ctx.fillStyle = '#120a1c'
    ctx.fillRect(0, 0, 512, 320)

    // bezel frame
    ctx.strokeStyle = 'rgba(99,216,194,0.35)'
    ctx.lineWidth = 4
    ctx.strokeRect(8, 8, 496, 304)

    // header
    ctx.fillStyle = COPPER
    ctx.font = 'bold 30px "Space Grotesk", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('PUNARVA', 28, 56)
    ctx.font = '500 18px Inter, sans-serif'
    ctx.fillStyle = 'rgba(199,183,204,0.85)'
    ctx.fillText('BATTERY TESTER', 200, 54)

    // status tag
    ctx.textAlign = 'right'
    if (s.demo) {
      ctx.fillStyle = 'rgba(245,184,76,0.16)'
      ctx.fillRect(352, 24, 132, 30)
      ctx.strokeStyle = AMBER
      ctx.lineWidth = 2
      ctx.strokeRect(352, 24, 132, 30)
      ctx.fillStyle = AMBER
      ctx.font = 'bold 17px Inter, sans-serif'
      ctx.fillText(s.testing ? 'DEMO • LIVE' : 'DEMO', 474, 46)
    } else if (s.testing) {
      ctx.fillStyle = TEAL
      ctx.font = 'bold 17px Inter, sans-serif'
      ctx.fillText('LIVE', 474, 46)
    } else {
      ctx.fillStyle = 'rgba(199,183,204,0.7)'
      ctx.font = 'bold 17px Inter, sans-serif'
      ctx.fillText('STANDBY', 474, 46)
    }

    // readouts
    ctx.textAlign = 'left'
    const row = (y: number, label: string, value: string, unit: string, color: string) => {
      ctx.fillStyle = 'rgba(199,183,204,0.75)'
      ctx.font = '600 16px Inter, sans-serif'
      ctx.fillText(label, 28, y)
      ctx.fillStyle = color
      ctx.font = 'bold 44px "Space Grotesk", monospace'
      ctx.fillText(value, 130, y + 4)
      const valueWidth = ctx.measureText(value).width
      ctx.fillStyle = 'rgba(199,183,204,0.8)'
      ctx.font = '600 18px Inter, sans-serif'
      ctx.fillText(unit, 130 + valueWidth + 8, y + 2)
    }
    const fmt = (v: number | null, d: number) => (v === null ? '–.––' : v.toFixed(d))
    row(122, 'VOLT', fmt(s.voltage, 2), 'V', TEAL)
    row(186, 'CURR', fmt(s.current, 2), 'A', COPPER)
    row(250, 'TEMP', s.temperature === null ? '––.–' : s.temperature.toFixed(1), '°C', IVORY)

    // waveform strip
    ctx.strokeStyle = 'rgba(99,216,194,0.9)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    const wx = 330
    const wy = 130
    const ww = 150
    const wh = 130
    if (s.waveform.length > 1) {
      s.waveform.forEach((v, i) => {
        const x = wx + (i / (s.waveform.length - 1)) * ww
        const y = wy + wh - v * wh
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    } else {
      ctx.setLineDash([4, 6])
      ctx.moveTo(wx, wy + wh / 2)
      ctx.lineTo(wx + ww, wy + wh / 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.strokeStyle = 'rgba(199,183,204,0.25)'
    ctx.lineWidth = 1
    ctx.strokeRect(wx, wy, ww, wh)

    // progress bar
    ctx.fillStyle = 'rgba(199,183,204,0.18)'
    ctx.fillRect(28, 282, 240, 12)
    ctx.fillStyle = COPPER
    ctx.fillRect(28, 282, Math.round(240 * Math.min(1, s.progress)), 12)

    texture.needsUpdate = true
  }

  draw(IDLE_STATE)
  return { texture, update: draw }
}

/** Battery face label — conceptual concept-cell print. */
export function createBatteryLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const COPPER = '#FF936B'
  const TEAL = '#63D8C2'

  ctx.fillStyle = '#2A1B38'
  ctx.fillRect(0, 0, 512, 256)
  ctx.strokeStyle = 'rgba(255,244,235,0.25)'
  ctx.lineWidth = 3
  ctx.strokeRect(10, 10, 492, 236)

  ctx.fillStyle = COPPER
  ctx.font = 'bold 52px "Space Grotesk", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('PUNARVA', 28, 70)
  ctx.fillStyle = 'rgba(255,244,235,0.85)'
  ctx.font = '600 26px Inter, sans-serif'
  ctx.fillText('CONCEPT CELL — Li-ion 3.7 V', 28, 112)

  // charge bars
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < 4 ? TEAL : 'rgba(99,216,194,0.25)'
    ctx.fillRect(28 + i * 56, 140, 44, 26)
  }
  ctx.fillStyle = 'rgba(199,183,204,0.7)'
  ctx.font = '600 18px Inter, sans-serif'
  ctx.fillText('CONCEPTUAL RENDER — NOT A REAL PRODUCT LABEL', 28, 210)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Small engraved strip (tester nameplate). */
export function createStripTexture(text: string, accent = '#FF936B'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#1c1128'
  ctx.fillRect(0, 0, 512, 96)
  ctx.fillStyle = accent
  ctx.font = 'bold 44px "Space Grotesk", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 50)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
