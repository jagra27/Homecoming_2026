import { ArrowLeft, ArrowRight, Download, LoaderCircle, Send, Share2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import CardCanvas from './components/CardCanvas'
import { schools } from './data/schools'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  renderCard,
  renderStory,
  STORY_HEIGHT,
  STORY_WIDTH,
} from './lib/cardRenderer'
import { renderAnimatedCard } from './lib/animatedRenderer'

const initialCardDetails = {
  firstName: '',
  lastName: '',
  occupation: '',
  classYear: '',
  status: 'Alumni',
  photoName: '',
}

const PUBLIC_APP_URL = 'https://externalheritage.com/pages/2026-homecoming-trading-cards'

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    const copied = document.execCommand('copy')
    textArea.remove()
    if (!copied) throw new Error('Unable to copy invitation link')
  }
}

function App() {
  const carouselRef = useRef(null)
  const backgroundRefs = useRef([])
  const scrollEndTimerRef = useRef(null)
  const scrollTargetIndexRef = useRef(null)
  const isRestoringCarouselRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [detailIndex, setDetailIndex] = useState(0)
  const [detailTransition, setDetailTransition] = useState('idle')
  const [selectedSchool, setSelectedSchool] = useState(schools[0])
  const [stage, setStage] = useState('school')
  const [cardDetails, setCardDetails] = useState(initialCardDetails)
  const [photoUrl, setPhotoUrl] = useState('')
  const [crop, setCrop] = useState({ zoom: 100, x: 0, y: 0 })
  const [resultFormat, setResultFormat] = useState('story')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError, setExportError] = useState('')
  const [resultArtifact, setResultArtifact] = useState(null)
  const [saveSurface, setSaveSurface] = useState(null)
  const [shareStatus, setShareStatus] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)

  const showSchool = (index) => {
    const nextIndex = Math.min(Math.max(index, 0), schools.length - 1)
    if (nextIndex === detailIndex) return

    window.clearTimeout(scrollEndTimerRef.current)
    scrollTargetIndexRef.current = nextIndex
    setDetailTransition('out')
    carouselRef.current?.children[nextIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
    setActiveIndex(nextIndex)
  }

  const updateActiveSchool = () => {
    const carousel = carouselRef.current
    if (!carousel) return

    const cards = Array.from(carousel.children)
    const cardStep = cards.length > 1
      ? cards[1].offsetLeft - cards[0].offsetLeft
      : 1
    const progress = Math.min(
      schools.length - 1,
      Math.max(0, carousel.scrollLeft / cardStep),
    )
    backgroundRefs.current.forEach((background, index) => {
      if (background) background.style.opacity = Math.max(0, 1 - Math.abs(index - progress))
    })

    if (isRestoringCarouselRef.current) return

    const closestIndex = Math.round(progress)
    setDetailTransition('out')
    window.clearTimeout(scrollEndTimerRef.current)
    scrollEndTimerRef.current = window.setTimeout(() => {
      const settledIndex = scrollTargetIndexRef.current ?? closestIndex
      scrollTargetIndexRef.current = null
      setActiveIndex(settledIndex)
      setDetailIndex(settledIndex)
      setDetailTransition('idle')
    }, 120)
  }

  const detailSchool = schools[detailIndex]
  const stageNumber = { school: 1, editor: 2, results: 3 }[stage]
  const isFormComplete = Boolean(
    photoUrl
    && cardDetails.firstName.trim()
    && cardDetails.lastName.trim()
    && cardDetails.occupation.trim()
    && cardDetails.classYear.trim(),
  )

  useEffect(() => {
    window.clearTimeout(scrollEndTimerRef.current)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    if (stage === 'school') {
      const restoreFrame = window.requestAnimationFrame(() => {
        const carousel = carouselRef.current
        const activeSlide = carousel?.children[activeIndex]
        if (carousel && activeSlide) {
          isRestoringCarouselRef.current = true
          carousel.style.scrollBehavior = 'auto'
          carousel.scrollLeft = activeSlide.offsetLeft - carousel.offsetLeft
          carousel.style.removeProperty('scroll-behavior')
          window.requestAnimationFrame(() => {
            isRestoringCarouselRef.current = false
          })
        }
      })
      return () => window.cancelAnimationFrame(restoreFrame)
    }

    return undefined
  }, [stage])

  useEffect(() => {
    if (stage !== 'results') return undefined

    let cancelled = false
    let artifactUrl = ''

    const prepareArtwork = async () => {
      const isStory = resultFormat === 'story'
      const isAnimated = resultFormat === 'animated'
      const canvas = document.createElement('canvas')
      canvas.width = isStory ? STORY_WIDTH : CARD_WIDTH
      canvas.height = isStory ? STORY_HEIGHT : CARD_HEIGHT
      const renderOptions = {
        school: selectedSchool,
        details: cardDetails,
        photoUrl,
        crop,
      }

      setIsExporting(true)
      setExportProgress(0)
      setExportError('')
      setResultArtifact(null)

      try {
        let blob
        if (isAnimated) {
          blob = await renderAnimatedCard(renderOptions, (progress) => {
            if (!cancelled) setExportProgress(progress)
          })
        } else {
          const renderer = isStory ? renderStory : renderCard
          await renderer(canvas, renderOptions)
          blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        }
        if (!blob) throw new Error('Unable to encode artwork')
        if (cancelled) return

        const formatName = isAnimated ? 'animated-card' : isStory ? 'story' : 'card'
        const extension = isAnimated ? 'mp4' : 'png'
        artifactUrl = URL.createObjectURL(blob)
        setResultArtifact({
          blob,
          url: artifactUrl,
          format: resultFormat,
          fileName: `${selectedSchool.abbreviation.toLowerCase()}-${formatName}-${cardDetails.lastName.toLowerCase()}.${extension}`,
        })
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to export artwork', error)
          setExportError('Export failed. Please try again.')
        }
      } finally {
        if (!cancelled) setIsExporting(false)
      }
    }

    prepareArtwork()
    return () => {
      cancelled = true
      if (artifactUrl) URL.revokeObjectURL(artifactUrl)
    }
  }, [stage, resultFormat, selectedSchool, cardDetails, photoUrl, crop])

  const chooseSchool = () => {
    setSelectedSchool(detailSchool)
    setStage('editor')
  }

  const updateCardDetails = (event) => {
    const { name, value } = event.target
    setCardDetails((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const updatePhoto = (event) => {
    const [file] = event.target.files
    if (!file) return

    setPhotoUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return URL.createObjectURL(file)
    })
    setCardDetails((current) => ({ ...current, photoName: file.name }))
    setCrop({ zoom: 100, x: 0, y: 0 })
  }

  const updateCrop = (event) => {
    const { name, value } = event.target
    setCrop((current) => ({ ...current, [name]: Number(value) }))
  }

  const reviewSet = (event) => {
    event.preventDefault()
    if (isReviewing) return

    setIsReviewing(true)
    setResultFormat('story')
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setStage('results'))
    })
  }

  const goBack = () => {
    setIsReviewing(false)
    setStage((current) => (current === 'results' ? 'editor' : 'school'))
  }

  const openSaveSurface = async () => {
    const previewUrl = resultArtifact.blob.type.startsWith('image/')
      ? await blobToDataUrl(resultArtifact.blob)
      : resultArtifact.url
    setSaveSurface({ ...resultArtifact, previewUrl })
  }

  const saveArtwork = async () => {
    if (!resultArtifact || resultArtifact.format !== resultFormat) return
    setExportError('')

    try {
      const file = new File([resultArtifact.blob], resultArtifact.fileName, {
        type: resultArtifact.blob.type,
      })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${selectedSchool.name} Homecoming 2026`,
          })
          return
        } catch (error) {
          if (error.name === 'AbortError') return
          console.warn('Native file sharing unavailable; opening save view', error)
        }
      }

      await openSaveSurface()
    } catch (error) {
      console.error('Unable to export artwork', error)
      setExportError('Export failed. Please try again.')
    }
  }

  const shareWithFriend = async () => {
    const firstName = cardDetails.firstName.trim() || 'A friend'
    const text = `${firstName} wants you to create your trading card for Homecoming with External Heritage.`
    const invitation = `${text} ${PUBLIC_APP_URL}`

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'External Heritage | Homecoming 2026',
            text,
            url: PUBLIC_APP_URL,
          })
          setShareStatus('Invitation shared.')
          return
        } catch (error) {
          if (error.name === 'AbortError') return
          console.warn('Native sharing unavailable; copying invitation instead', error)
        }
      }

      await copyText(invitation)
      setShareStatus('Invitation link copied.')
    } catch (error) {
      console.error('Unable to share invitation', error)
      setShareStatus(`Copy this link to share: ${PUBLIC_APP_URL}`)
    }
  }

  return (
    <main className="app-shell">
      <div className="school-backgrounds" aria-hidden="true">
        {schools.map((school, index) => (
          <div
            className="school-background"
            key={school.id}
            ref={(background) => {
              backgroundRefs.current[index] = background
            }}
            style={{
              backgroundImage: `linear-gradient(135deg, ${school.colors[0]}, ${school.colors[1]})`,
            }}
          />
        ))}
      </div>
      {stage !== 'school' && (
        <div className="view-navigation">
          <button className="header-back" type="button" onClick={goBack} aria-label="Go back">
            <ArrowLeft aria-hidden="true" />
          </button>
        </div>
      )}

      {stage === 'school' && (
        <section className="school-selection" aria-labelledby="selection-title">
          <p className="step-label">Step {stageNumber} of 3</p>
          <h1 id="selection-title">Choose your school</h1>
        <p className="selection-intro">
          Start with your alma mater. Your choice sets the look of every format.
        </p>

        <div className="selector-layout">
          <div className="carousel-frame">
            <div
              className="school-carousel"
              ref={carouselRef}
              onScroll={updateActiveSchool}
              aria-label="School previews"
            >
              {schools.map((school, index) => (
                <article
                  className="school-slide"
                  key={school.id}
                  aria-hidden={index !== activeIndex}
                >
                  <img src={school.cardPreview} alt="" draggable="false" />
                </article>
              ))}
            </div>

            <div className="carousel-controls">
              <button
                className="icon-button"
                type="button"
                onClick={() => showSchool(activeIndex - 1)}
                disabled={activeIndex === 0}
                aria-label="Previous school"
              >
                <ArrowLeft aria-hidden="true" />
              </button>
              <div className="pagination" aria-label={`${activeIndex + 1} of ${schools.length}`}>
                {schools.map((school, index) => (
                  <button
                    className={index === activeIndex ? 'page-dot is-active' : 'page-dot'}
                    key={school.id}
                    type="button"
                    onClick={() => showSchool(index)}
                    aria-label={`Show ${school.name}`}
                    aria-current={index === activeIndex ? 'true' : undefined}
                  />
                ))}
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => showSchool(activeIndex + 1)}
                disabled={activeIndex === schools.length - 1}
                aria-label="Next school"
              >
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="school-details" aria-live="polite" aria-atomic="true">
            <div
              className={`school-details-content is-${detailTransition}`}
              key={detailSchool.id}
            >
              <p className="school-abbreviation">{detailSchool.abbreviation}</p>
              <h2>{detailSchool.name}</h2>
              <div className="school-meta">
                <span>2026 edition / No. {detailSchool.number}</span>
                <span className="color-swatches" aria-label="School colors">
                  {detailSchool.colors.map((color) => (
                    <span key={color} style={{ backgroundColor: color }} />
                  ))}
                </span>
              </div>
              <button className="primary-button" type="button" onClick={chooseSchool}>
                Continue with {detailSchool.abbreviation}
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        </section>
      )}

      {stage === 'editor' && (
        <section className="editor-view" aria-labelledby="editor-title">
          <div className="view-heading">
            <p className="step-label">Step {stageNumber} of 3 / {selectedSchool.name}</p>
            <h1 id="editor-title">Make it yours</h1>
          </div>

          <div className="editor-layout">
            <div className="editor-preview">
              <CardCanvas
                school={selectedSchool}
                details={cardDetails}
                photoUrl={photoUrl}
                crop={crop}
              />
            </div>

            <form
              className="card-form"
              onSubmit={reviewSet}
            >
              <label className="upload-field">
                <Upload aria-hidden="true" />
                <span>{cardDetails.photoName || 'Choose your portrait'}</span>
                <input
                  name="photoName"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={updatePhoto}
                  required={!photoUrl}
                />
              </label>

              {photoUrl && (
                <fieldset className="photo-controls">
                  <legend>Position portrait</legend>
                  <label>
                    Zoom
                    <input name="zoom" type="range" min="100" max="220" value={crop.zoom} onChange={updateCrop} />
                  </label>
                  <label>
                    Horizontal
                    <input name="x" type="range" min="-100" max="100" value={crop.x} onChange={updateCrop} />
                  </label>
                  <label>
                    Vertical
                    <input name="y" type="range" min="-100" max="100" value={crop.y} onChange={updateCrop} />
                  </label>
                </fieldset>
              )}

              <div className="form-grid">
                <label>
                  First name
                  <input name="firstName" value={cardDetails.firstName} onChange={updateCardDetails} required />
                </label>
                <label>
                  Last name
                  <input name="lastName" value={cardDetails.lastName} onChange={updateCardDetails} required />
                </label>
                <label>
                  Occupation
                  <input name="occupation" value={cardDetails.occupation} onChange={updateCardDetails} required />
                </label>
                <label>
                  Class year
                  <input
                    name="classYear"
                    value={cardDetails.classYear}
                    onChange={updateCardDetails}
                    inputMode="numeric"
                    maxLength="4"
                    placeholder="2026"
                    required
                  />
                </label>
                <label className="full-field">
                  Status
                  <select name="status" value={cardDetails.status} onChange={updateCardDetails}>
                    <option>Alumni</option>
                    <option>Faculty</option>
                    <option>Future Student</option>
                    <option>Legacy Mom</option>
                    <option>Legacy Dad</option>
                    <option>Student</option>
                  </select>
                </label>
              </div>

              <button
                className={`primary-button form-submit${isFormComplete ? ' is-ready' : ''}${isReviewing ? ' is-reviewing' : ''}`}
                type="submit"
                disabled={isReviewing}
                aria-busy={isReviewing}
              >
                {isReviewing ? (
                  <>
                    Preparing your set
                    <LoaderCircle className="loading-icon" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Review my set
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      )}

      {stage === 'results' && (
        <section className="results-view" aria-labelledby="results-title">
          <div className="view-heading">
            <p className="step-label">Step {stageNumber} of 3 / {selectedSchool.name}</p>
            <h1 id="results-title">Your homecoming set</h1>
          </div>

          <div className="format-tabs" role="tablist" aria-label="Output format">
            {[
              ['story', 'Instagram story'],
              ['animated', 'Animated card'],
              ['card', 'Trading card'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={resultFormat === id}
                className={resultFormat === id ? 'format-tab is-active' : 'format-tab'}
                onClick={() => setResultFormat(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className={`result-preview${resultFormat === 'story' ? ' is-story' : ''}${resultFormat === 'animated' ? ' is-animated' : ''}${resultFormat === 'animated' && isExporting ? ' is-loading' : ''}`}
          >
            {resultFormat === 'animated' && resultArtifact?.format === 'animated' ? (
              <video
                className="animated-artwork"
                src={resultArtifact.url}
                aria-label={`${selectedSchool.name} animated card preview`}
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <CardCanvas
                school={selectedSchool}
                details={cardDetails}
                photoUrl={photoUrl}
                crop={crop}
                format={resultFormat === 'story' ? 'story' : 'card'}
              />
            )}
            {resultFormat === 'animated' && isExporting && (
              <div className="preview-loading" role="status" aria-live="polite">
                <LoaderCircle aria-hidden="true" />
                <span>Preparing animation</span>
                <strong>{Math.round(exportProgress * 100)}%</strong>
              </div>
            )}
          </div>

          <button
            className="primary-button download-button"
            type="button"
            onClick={saveArtwork}
            disabled={isExporting || resultArtifact?.format !== resultFormat}
          >
            <Share2 aria-hidden="true" />
            {isExporting
              ? `Preparing file${resultFormat === 'animated' ? ` ${Math.round(exportProgress * 100)}%` : '...'}`
              : `Save ${resultFormat === 'animated' ? 'Animated Video' : resultFormat === 'story' ? 'Story Image' : 'Card Image'}`}
          </button>
          <button
            className="secondary-button friend-share-button"
            type="button"
            onClick={shareWithFriend}
          >
            <Send aria-hidden="true" />
            Share with a friend
          </button>
          {shareStatus && <p className="share-status" role="status">{shareStatus}</p>}
          {exportError && <p className="export-error" role="alert">{exportError}</p>}
        </section>
      )}

      {saveSurface && (
        <div className="save-surface" role="dialog" aria-modal="true" aria-label="Save artwork">
          <button
            className="save-surface-close"
            type="button"
            onClick={() => setSaveSurface(null)}
            aria-label="Close save view"
          >
            <X aria-hidden="true" />
          </button>
          {saveSurface.blob.type === 'video/mp4' ? (
            <video src={saveSurface.previewUrl} controls autoPlay loop muted playsInline />
          ) : (
            <img src={saveSurface.previewUrl} alt="Personalized artwork ready to save" />
          )}
          <div className="save-surface-actions">
            <a
              className="secondary-button"
              href={saveSurface.url}
              download={saveSurface.fileName}
            >
              <Download aria-hidden="true" />
              Download {saveSurface.blob.type === 'video/mp4' ? 'Video' : 'Image'}
            </a>
            <p>
              {saveSurface.blob.type === 'video/mp4'
                ? 'The video downloads to Files. From there, use Share, then Save Video to add it to Photos.'
                : 'On a phone, press and hold the image above, then choose Save to Photos. You can also use Download Image.'}
            </p>
          </div>
        </div>
      )}
    </main>
  )
}

export default App