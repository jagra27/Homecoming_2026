import { useEffect, useRef } from 'react'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  renderCard,
  renderStory,
  STORY_HEIGHT,
  STORY_WIDTH,
} from '../lib/cardRenderer'

function CardCanvas({ school, details, photoUrl, crop, format = 'card', className = '', onLoadingChange }) {
  const canvasRef = useRef(null)
  const loadedTemplateRef = useRef('')

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    const buffer = document.createElement('canvas')
    buffer.width = canvas.width
    buffer.height = canvas.height
    const templateSource = format === 'story' ? school.storyCanvas : school.cardCanvas
    const shouldReportLoading = Boolean(
      onLoadingChange && loadedTemplateRef.current !== templateSource,
    )

    const draw = async () => {
      const renderer = format === 'story' ? renderStory : renderCard
      await renderer(buffer, { school, details, photoUrl, crop })
      if (cancelled) return

      const context = canvas.getContext('2d')
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(buffer, 0, 0)
    }

    if (shouldReportLoading) onLoadingChange(true)
    draw()
      .then(() => {
        if (!cancelled && shouldReportLoading) {
          loadedTemplateRef.current = templateSource
          onLoadingChange(false)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if (shouldReportLoading) onLoadingChange(false)
          console.error('Unable to render card preview', error)
        }
      })

    return () => {
      cancelled = true
    }
  }, [school, details, photoUrl, crop, format, onLoadingChange])

  const isStory = format === 'story'

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={isStory ? STORY_WIDTH / 2 : CARD_WIDTH / 4}
      height={isStory ? STORY_HEIGHT / 2 : CARD_HEIGHT / 4}
      aria-label={`${school.name} personalized card preview`}
      role="img"
    />
  )
}

export default CardCanvas