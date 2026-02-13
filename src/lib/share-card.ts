// ── Share card PNG renderer (canvas-based, no deps) ─────────

export interface ShareCardInput {
  brand: string
  dateISO: string
  personaName: string
  personaEmoji: string
  vibeTag: string
  oneLiner: string
  signatureLine?: string
  movedUpTitle?: string
}

const W = 1080
const H = 1350
const PAD = 80
const FONT = '"system-ui", "-apple-system", "Segoe UI", "Roboto", sans-serif'
const BG = '#050608'
const TEXT_PRIMARY = 'rgba(255,255,255,0.92)'
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)'
const ACCENT = '#35F0C4'

/** Wrap text to fit within maxWidth, returns array of lines */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Draw sparse grain noise for texture */
function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const count = 5000
  ctx.save()
  ctx.globalAlpha = 0.06
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const brightness = Math.random() > 0.5 ? 255 : 0
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`
    ctx.fillRect(x, y, 1.5, 1.5)
  }
  ctx.restore()
}

export async function renderBriefingShareCardPNG(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ── Background ──
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // Radial vignette
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.9)
  grad.addColorStop(0, 'rgba(255,255,255,0.02)')
  grad.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Grain
  drawGrain(ctx, W, H)

  let y = PAD + 20

  // ── Top row: persona + brand ──
  // Persona circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(PAD + 32, y + 6, 32, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  // Persona emoji
  ctx.font = `28px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = TEXT_PRIMARY
  ctx.fillText(input.personaEmoji, PAD + 32, y + 8)

  // Persona name
  ctx.font = `600 22px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillStyle = TEXT_PRIMARY
  ctx.fillText(input.personaName, PAD + 76, y + 8)

  // Brand (right)
  ctx.font = `500 20px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillStyle = TEXT_SECONDARY
  ctx.fillText(input.brand, W - PAD, y + 8)
  ctx.textAlign = 'left'

  y += 90

  // ── Vibe tag chip ──
  ctx.font = `bold 18px ${FONT}`
  const tagWidth = ctx.measureText(input.vibeTag).width + 32
  ctx.fillStyle = 'rgba(53,240,196,0.12)'
  ctx.beginPath()
  ctx.roundRect(PAD, y - 14, tagWidth, 36, 18)
  ctx.fill()
  ctx.fillStyle = ACCENT
  ctx.fillText(input.vibeTag, PAD + 16, y + 6)

  y += 70

  // ── One-liner (hero text) ──
  ctx.font = `bold 48px ${FONT}`
  ctx.fillStyle = TEXT_PRIMARY
  const maxText = W - PAD * 2
  const lines = wrapText(ctx, input.oneLiner, maxText)
  for (const line of lines) {
    ctx.fillText(line, PAD, y)
    y += 62
  }

  y += 30

  // ── Signature line ──
  if (input.signatureLine) {
    ctx.font = `italic 26px ${FONT}`
    ctx.fillStyle = ACCENT
    const sigLines = wrapText(ctx, `"${input.signatureLine}"`, maxText)
    for (const sl of sigLines) {
      ctx.fillText(sl, PAD, y)
      y += 36
    }
    y += 20
  }

  // ── Moved up ──
  if (input.movedUpTitle) {
    ctx.font = `600 22px ${FONT}`
    ctx.fillStyle = 'rgba(255,176,32,0.9)'
    ctx.fillText('\u2191 Moved up:', PAD, y)
    y += 34
    ctx.font = `24px ${FONT}`
    ctx.fillStyle = TEXT_PRIMARY
    const muLines = wrapText(ctx, input.movedUpTitle, maxText)
    for (const ml of muLines) {
      ctx.fillText(ml, PAD, y)
      y += 34
    }
    y += 20
  }

  // ── Footer ──
  const footerY = H - PAD
  ctx.font = `500 22px ${FONT}`
  ctx.fillStyle = TEXT_SECONDARY
  ctx.fillText('Start in ten minutes.', PAD, footerY - 30)

  ctx.font = `400 18px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText(input.dateISO, PAD, footerY)

  // Accent line
  ctx.fillStyle = ACCENT
  ctx.fillRect(PAD, footerY - 60, 60, 3)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    )
  })
}
