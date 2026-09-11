import {
  BufferTarget,
  canEncodeVideo,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
} from 'mediabunny'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  STORY_HEIGHT,
  STORY_WIDTH,
  renderCard,
} from './cardRenderer'

const VIDEO_WIDTH = STORY_WIDTH
const VIDEO_HEIGHT = STORY_HEIGHT
const CARD_CANVAS_WIDTH = CARD_WIDTH / 4
const CARD_CANVAS_HEIGHT = CARD_HEIGHT / 4
const VIDEO_DURATION = 8
const FRAME_RATE = 15
const MAX_ROTATION = 22
const CARD_SCALE = 0.86
const CARD_CENTER_Y = 925
const PERSPECTIVE = 1350
const PROJECTION_SLICES = 96
const FOIL_BAND_WIDTH = CARD_CANVAS_WIDTH
const STORY_FOOTER_CROP = { x: 100, y: 1640, width: 880, height: 230 }
const VIDEO_FOOTER = STORY_FOOTER_CROP
const FOIL_WORD = 'HERITAGE'
const WORDMARK_INSET = 72
const WORDMARK_TRACKING = 3
const WORDMARK_STRETCH = 1.2
const WORDMARK_ANGLE = -Math.atan2(
  CARD_CANVAS_HEIGHT - WORDMARK_INSET * 2,
  CARD_CANVAS_WIDTH - WORDMARK_INSET * 2,
)
const WORDMARK_LENGTH = Math.hypot(
  CARD_CANVAS_HEIGHT - WORDMARK_INSET * 2,
  CARD_CANVAS_WIDTH - WORDMARK_INSET * 2,
) - 90

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = source
  })
}

function loadAnimationFonts() {
  return Promise.all([
    document.fonts.load('400 280px "Archivo Black"', FOIL_WORD),
    document.fonts.load('400 690px Anton', 'HOMECOMING'),
    document.fonts.load('700 76px Arimo', 'ALUMNI 2026'),
  ])
}

function fitWordmark(context, text, maxWidth) {
  let fontSize = 280
  context.font = `400 ${fontSize}px "Archivo Black"`
  const trackingWidth = WORDMARK_TRACKING * Math.max(text.length - 1, 0)
  while (fontSize > 120 && context.measureText(text).width + trackingWidth > maxWidth) {
    fontSize -= 2
    context.font = `400 ${fontSize}px "Archivo Black"`
  }
}

function drawTrackedWord(context, text) {
  const letters = [...text]
  const widths = letters.map((letter) => context.measureText(letter).width)
  const totalWidth = widths.reduce((total, width) => total + width, 0)
    + WORDMARK_TRACKING * Math.max(letters.length - 1, 0)
  let cursor = -totalWidth / 2

  letters.forEach((letter, index) => {
    context.fillText(letter, cursor, 0)
    cursor += widths[index] + WORDMARK_TRACKING
  })
}

function createFoilGradient(context, sweepX, opacity = 1, flare = false) {
  const halfBandWidth = FOIL_BAND_WIDTH / 2
  const gradient = context.createLinearGradient(
    sweepX - halfBandWidth,
    CARD_CANVAS_HEIGHT * 1.12,
    sweepX + halfBandWidth,
    -CARD_CANVAS_HEIGHT * 0.12,
  )
  gradient.addColorStop(0, 'rgba(34, 211, 238, 0)')
  gradient.addColorStop(0.3, `rgba(34, 211, 238, ${(flare ? 0.58 : 0.22) * opacity})`)
  gradient.addColorStop(0.44, `rgba(244, 114, 182, ${(flare ? 0.76 : 0.2) * opacity})`)
  gradient.addColorStop(0.5, `rgba(255, 255, 255, ${(flare ? 1 : 0.48) * opacity})`)
  gradient.addColorStop(0.57, `rgba(250, 204, 21, ${(flare ? 0.78 : 0.22) * opacity})`)
  gradient.addColorStop(0.7, `rgba(74, 222, 128, ${(flare ? 0.52 : 0.18) * opacity})`)
  gradient.addColorStop(1, 'rgba(74, 222, 128, 0)')
  return gradient
}

function drawFoilLayer(canvas, wordmarkCanvas, rotation) {
  const context = canvas.getContext('2d')
  const wordmarkContext = wordmarkCanvas.getContext('2d')
  context.clearRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT)
  wordmarkContext.clearRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT)
  const normalizedRotation = (rotation + MAX_ROTATION) / (MAX_ROTATION * 2)
  const sweepX = -CARD_CANVAS_WIDTH * 0.65
    + (1 - normalizedRotation) * CARD_CANVAS_WIDTH * 2.3

  context.globalCompositeOperation = 'screen'
  context.fillStyle = createFoilGradient(context, sweepX)
  context.fillRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT)

  wordmarkContext.save()
  wordmarkContext.translate(CARD_CANVAS_WIDTH / 2, CARD_CANVAS_HEIGHT / 2)
  wordmarkContext.rotate(WORDMARK_ANGLE)
  fitWordmark(wordmarkContext, FOIL_WORD, WORDMARK_LENGTH)
  wordmarkContext.scale(1, WORDMARK_STRETCH)
  wordmarkContext.textAlign = 'left'
  wordmarkContext.textBaseline = 'middle'
  wordmarkContext.shadowColor = 'rgba(255, 255, 255, 0.78)'
  wordmarkContext.shadowBlur = 22
  wordmarkContext.fillStyle = '#ffffff'
  drawTrackedWord(wordmarkContext, FOIL_WORD)
  wordmarkContext.restore()

  wordmarkContext.globalCompositeOperation = 'source-in'
  wordmarkContext.fillStyle = createFoilGradient(wordmarkContext, sweepX, 1, true)
  wordmarkContext.fillRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT)
  wordmarkContext.globalCompositeOperation = 'source-over'
}

function traceProjectedCard(context, rotation) {
  const radians = (rotation * Math.PI) / 180
  const centerX = VIDEO_WIDTH / 2
  const points = []

  for (let slice = 0; slice <= PROJECTION_SLICES; slice += 1) {
    const sourceX = slice * CARD_CANVAS_WIDTH / PROJECTION_SLICES
    const localX = (sourceX - CARD_CANVAS_WIDTH / 2) * CARD_SCALE
    const depth = -localX * Math.sin(radians)
    const perspective = PERSPECTIVE / (PERSPECTIVE + depth)
    points.push({
      x: centerX + localX * Math.cos(radians) * perspective,
      top: CARD_CENTER_Y - CARD_CANVAS_HEIGHT * CARD_SCALE * perspective / 2,
      bottom: CARD_CENTER_Y + CARD_CANVAS_HEIGHT * CARD_SCALE * perspective / 2,
    })
  }

  context.beginPath()
  context.moveTo(points[0].x, points[0].top)
  points.forEach((point) => context.lineTo(point.x, point.top))
  points.reverse().forEach((point) => context.lineTo(point.x, point.bottom))
  context.closePath()
}

function drawCardEdgeGlow(context, rotation) {
  const tiltStrength = Math.abs(rotation / MAX_ROTATION)
  const glowDirection = rotation < 0 ? -1 : 1

  context.save()
  traceProjectedCard(context, rotation)
  context.fillStyle = 'rgba(5, 10, 15, 0.7)'
  context.shadowColor = `rgba(34, 211, 238, ${0.24 + tiltStrength * 0.3})`
  context.shadowBlur = 26 + tiltStrength * 24
  context.shadowOffsetX = glowDirection * (4 + tiltStrength * 8)
  context.fill()
  context.shadowColor = `rgba(244, 114, 182, ${0.16 + tiltStrength * 0.22})`
  context.shadowOffsetX *= -1
  context.fill()
  context.restore()
}

function projectCard(context, cardCanvas, rotation) {
  const radians = (rotation * Math.PI) / 180
  const sourceSliceWidth = CARD_CANVAS_WIDTH / PROJECTION_SLICES
  const centerX = VIDEO_WIDTH / 2

  for (let slice = 0; slice < PROJECTION_SLICES; slice += 1) {
    const sourceX = slice * sourceSliceWidth
    const localX1 = (sourceX - CARD_CANVAS_WIDTH / 2) * CARD_SCALE
    const localX2 = (sourceX + sourceSliceWidth - CARD_CANVAS_WIDTH / 2) * CARD_SCALE
    const depth1 = -localX1 * Math.sin(radians)
    const depth2 = -localX2 * Math.sin(radians)
    const perspective1 = PERSPECTIVE / (PERSPECTIVE + depth1)
    const perspective2 = PERSPECTIVE / (PERSPECTIVE + depth2)
    const destinationX1 = centerX + localX1 * Math.cos(radians) * perspective1
    const destinationX2 = centerX + localX2 * Math.cos(radians) * perspective2
    const destinationHeight = CARD_CANVAS_HEIGHT * CARD_SCALE * (perspective1 + perspective2) / 2
    const destinationY = CARD_CENTER_Y - destinationHeight / 2

    context.drawImage(
      cardCanvas,
      sourceX,
      0,
      sourceSliceWidth + 1,
      CARD_CANVAS_HEIGHT,
      destinationX1,
      destinationY,
      destinationX2 - destinationX1 + 1,
      destinationHeight,
    )
  }
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

  await loadAnimationFonts()

  const baseCanvas = document.createElement('canvas')
  const cardCanvas = document.createElement('canvas')
  const foilCanvas = document.createElement('canvas')
  const wordmarkCanvas = document.createElement('canvas')
  const frameCanvas = document.createElement('canvas')
  baseCanvas.width = cardCanvas.width = foilCanvas.width = wordmarkCanvas.width = CARD_CANVAS_WIDTH
  baseCanvas.height = cardCanvas.height = foilCanvas.height = wordmarkCanvas.height = CARD_CANVAS_HEIGHT
  frameCanvas.width = VIDEO_WIDTH
  frameCanvas.height = VIDEO_HEIGHT
  const [, storyTemplate] = await Promise.all([
    renderCard(baseCanvas, options),
    loadImage(options.school.storyCanvas),
  ])

  const context = frameCanvas.getContext('2d')
  const cardContext = cardCanvas.getContext('2d')
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
    const progress = frame / frameCount
    const rotation = Math.sin(progress * Math.PI * 2) * MAX_ROTATION
    cardContext.clearRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT)
    cardContext.drawImage(baseCanvas, 0, 0)
    drawFoilLayer(foilCanvas, wordmarkCanvas, rotation)
    cardContext.save()
    cardContext.globalCompositeOperation = 'screen'
    cardContext.drawImage(foilCanvas, 0, 0)
    cardContext.globalAlpha = 0.88
    cardContext.drawImage(wordmarkCanvas, 0, 0)
    cardContext.restore()

    context.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    context.drawImage(
      storyTemplate,
      STORY_FOOTER_CROP.x,
      STORY_FOOTER_CROP.y,
      STORY_FOOTER_CROP.width,
      STORY_FOOTER_CROP.height,
      VIDEO_FOOTER.x,
      VIDEO_FOOTER.y,
      VIDEO_FOOTER.width,
      VIDEO_FOOTER.height,
    )
    drawCardEdgeGlow(context, rotation)
    projectCard(context, cardCanvas, rotation)
    await videoSource.add(frame / FRAME_RATE, 1 / FRAME_RATE, {
      keyFrame: frame % (FRAME_RATE * 2) === 0,
    })
    onProgress?.((frame + 1) / frameCount)
  }

  videoSource.close()
  await output.finalize()
  return new Blob([target.buffer], { type: 'video/mp4' })
}