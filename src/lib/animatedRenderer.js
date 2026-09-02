import {
  BufferTarget,
  canEncodeVideo,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
} from 'mediabunny'
import { CARD_HEIGHT, CARD_WIDTH, renderCard } from './cardRenderer'

const VIDEO_WIDTH = CARD_WIDTH / 4
const VIDEO_HEIGHT = CARD_HEIGHT / 4
const VIDEO_DURATION = 8
const FRAME_RATE = 15

function drawFoilSweep(context, progress) {
  const loopProgress = (progress * 2) % 1
  const sweepX = -VIDEO_WIDTH * 0.55 + loopProgress * VIDEO_WIDTH * 2.1
  const gradient = context.createLinearGradient(
    sweepX - 260,
    VIDEO_HEIGHT,
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
  context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
  context.restore()
}

export async function renderAnimatedCard(options, onProgress) {
  const quality = new Quality('high')
  const canEncodeH264 = await canEncodeVideo('avc', {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    quality,
  })
  if (!canEncodeH264) {
    throw new Error('This browser cannot create an H.264 video')
  }

  const baseCanvas = document.createElement('canvas')
  const frameCanvas = document.createElement('canvas')
  baseCanvas.width = frameCanvas.width = VIDEO_WIDTH
  baseCanvas.height = frameCanvas.height = VIDEO_HEIGHT
  await renderCard(baseCanvas, options)

  const context = frameCanvas.getContext('2d')
  const target = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat(), target })
  const videoSource = new CanvasSource(frameCanvas, {
    codec: 'avc',
    quality,
    keyFrameInterval: 2,
    hardwareAcceleration: 'prefer-hardware',
  })
  output.addVideoTrack(videoSource)
  await output.start()

  const frameCount = VIDEO_DURATION * FRAME_RATE
  for (let frame = 0; frame < frameCount; frame += 1) {
    context.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    context.drawImage(baseCanvas, 0, 0)
    drawFoilSweep(context, frame / frameCount)
    await videoSource.add(frame / FRAME_RATE, 1 / FRAME_RATE, {
      keyFrame: frame % (FRAME_RATE * 2) === 0,
    })
    onProgress?.((frame + 1) / frameCount)
  }

  videoSource.close()
  await output.finalize()
  return new Blob([target.buffer], { type: 'video/mp4' })
}