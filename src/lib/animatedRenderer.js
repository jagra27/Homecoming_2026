import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { CARD_HEIGHT, CARD_WIDTH, renderCard } from './cardRenderer'

const ANIMATION_WIDTH = CARD_WIDTH / 4
const ANIMATION_HEIGHT = CARD_HEIGHT / 4
const FRAME_COUNT = 12
const FRAME_DELAY = 160

function drawFoilSweep(context, progress) {
  const sweepX = -ANIMATION_WIDTH * 0.55 + progress * ANIMATION_WIDTH * 2.1
  const gradient = context.createLinearGradient(
    sweepX - 260,
    ANIMATION_HEIGHT,
    sweepX + 260,
    0,
  )
  gradient.addColorStop(0, 'rgba(61, 197, 255, 0)')
  gradient.addColorStop(0.38, 'rgba(61, 197, 255, 0.12)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.38)')
  gradient.addColorStop(0.62, 'rgba(255, 198, 66, 0.12)')
  gradient.addColorStop(1, 'rgba(255, 198, 66, 0)')

  context.save()
  context.globalCompositeOperation = 'screen'
  context.fillStyle = gradient
  context.fillRect(0, 0, ANIMATION_WIDTH, ANIMATION_HEIGHT)
  context.restore()
}

export async function renderAnimatedCard(options, onProgress) {
  const baseCanvas = document.createElement('canvas')
  const frameCanvas = document.createElement('canvas')
  baseCanvas.width = frameCanvas.width = ANIMATION_WIDTH
  baseCanvas.height = frameCanvas.height = ANIMATION_HEIGHT
  await renderCard(baseCanvas, options)

  const context = frameCanvas.getContext('2d', { willReadFrequently: true })
  const gif = GIFEncoder()

  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    context.clearRect(0, 0, ANIMATION_WIDTH, ANIMATION_HEIGHT)
    context.drawImage(baseCanvas, 0, 0)
    drawFoilSweep(context, frame / (FRAME_COUNT - 1))

    const { data } = context.getImageData(0, 0, ANIMATION_WIDTH, ANIMATION_HEIGHT)
    const palette = quantize(data, 256, { format: 'rgb565' })
    const index = applyPalette(data, palette, 'rgb565')
    gif.writeFrame(index, ANIMATION_WIDTH, ANIMATION_HEIGHT, {
      palette,
      delay: FRAME_DELAY,
      repeat: 0,
    })
    onProgress?.((frame + 1) / FRAME_COUNT)
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
  }

  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}