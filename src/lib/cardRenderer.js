export const CARD_WIDTH = 3712
export const CARD_HEIGHT = 5248
export const STORY_WIDTH = 1080
export const STORY_HEIGHT = 1920

const imageCache = new Map()

function loadImage(source) {
  if (!source) return Promise.resolve(null)
  if (!imageCache.has(source)) {
    imageCache.set(
      source,
      new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = source
      }),
    )
  }
  return imageCache.get(source)
}

function fitText(context, text, maxWidth, startingSize, family, style = '') {
  let size = startingSize
  context.font = `${style}${size}px ${family}`
  while (size > startingSize * 0.55 && context.measureText(text).width > maxWidth) {
    size -= 8
    context.font = `${style}${size}px ${family}`
  }
  return size
}

function drawSpacedText(context, text, x, y, spacing) {
  let cursor = x
  for (const character of text) {
    context.fillText(character, cursor, y)
    cursor += context.measureText(character).width + spacing
  }
}

function drawPortrait(context, image, crop) {
  const portraitArea = { x: 0, y: 0, width: CARD_WIDTH, height: 3900 }

  if (!image) {
    context.fillStyle = '#10151a'
    context.fillRect(portraitArea.x, portraitArea.y, portraitArea.width, portraitArea.height)
    return
  }

  const coverScale = Math.max(
    portraitArea.width / image.width,
    portraitArea.height / image.height,
  )
  const zoom = (crop.zoom / 100) * 1.08
  const width = image.width * coverScale * zoom
  const height = image.height * coverScale * zoom
  const overflowX = Math.max(0, width - portraitArea.width)
  const overflowY = Math.max(0, height - portraitArea.height)
  const x = portraitArea.x - overflowX / 2 + (crop.x / 100) * (overflowX / 2)
  const y = portraitArea.y - overflowY / 2 + (crop.y / 100) * (overflowY / 2)
  context.drawImage(image, x, y, width, height)
}

function drawCardText(context, details) {
  const firstName = details.firstName.trim().toUpperCase()
  const lastName = details.lastName.trim().toUpperCase()

  context.textBaseline = 'alphabetic'
  context.fillStyle = '#ffffff'
  context.shadowColor = 'rgba(0, 0, 0, 0.45)'
  context.shadowBlur = 18
  context.shadowOffsetY = 8

  if (firstName) {
    const firstNameSpacing = 20
    const spacedWidth = firstNameSpacing * Math.max(firstName.length - 1, 0)
    fitText(context, firstName, 1320 - spacedWidth, 290, 'Anton')
    drawSpacedText(context, firstName, 255, 3970, firstNameSpacing)
  }

  if (lastName) {
    fitText(context, lastName, 1820, 690, 'Anton', 'italic ')
    context.fillText(lastName, 235, 4590)
  }

  context.shadowColor = 'transparent'
  context.fillStyle = '#ffffff'
  context.font = '700 76px Arimo'
  context.textBaseline = 'middle'
  context.fillText(details.occupation.trim().toUpperCase(), 275, 5048, 710)
  context.fillText(details.classYear.trim(), 1165, 5048, 360)
  context.fillText(details.status.trim().toUpperCase(), 1790, 5048, 1050)
}

export async function renderCard(canvas, { school, details, photoUrl, crop }) {
  const context = canvas.getContext('2d')
  const scale = canvas.width / CARD_WIDTH
  const [template, portrait] = await Promise.all([
    loadImage(school.cardCanvas),
    loadImage(photoUrl),
    document.fonts.ready,
  ])

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.scale(scale, scale)
  drawPortrait(context, portrait, crop)
  context.drawImage(template, 0, 0, CARD_WIDTH, CARD_HEIGHT)
  drawCardText(context, details)
  context.restore()
}

export async function renderStory(canvas, options) {
  const context = canvas.getContext('2d')
  const scale = canvas.width / STORY_WIDTH
  const cardCanvas = document.createElement('canvas')
  cardCanvas.width = 1040
  cardCanvas.height = 1470

  const storyTemplate = await loadImage(options.school.storyCanvas)
  await renderCard(cardCanvas, options)

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.scale(scale, scale)
  context.fillStyle = '#f7f5ef'
  context.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT)
  context.drawImage(storyTemplate, 0, 0, STORY_WIDTH, STORY_HEIGHT)
  context.drawImage(cardCanvas, 20, 123, 1040, 1470)
  context.restore()
}