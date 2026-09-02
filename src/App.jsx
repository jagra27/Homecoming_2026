import { ArrowLeft, ArrowRight, Send, Share2, Upload, X } from 'lucide-react'
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

const PUBLIC_APP_URL = 'https://jagra27.github.io/Homecoming_2026/'

function App() {
  const carouselRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [detailIndex, setDetailIndex] = useState(0)
  const [detailTransition, setDetailTransition] = useState('idle')
  const [selectedSchool, setSelectedSchool] = useState(schools[0])
  const [stage, setStage] = useState('school')
  const [cardDetails, setCardDetails] = useState(initialCardDetails)
  const [photoUrl, setPhotoUrl] = useState('')
  const [crop, setCrop] = useState({ zoom: 100, x: 0, y: 0 })
  const [resultFormat, setResultFormat] = useState('card')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError, setExportError] = useState('')
  const [resultArtifact, setResultArtifact] = useState(null)
  const [saveSurface, setSaveSurface] = useState(null)
  const [friendCardBlob, setFriendCardBlob] = useState(null)
  const [shareStatus, setShareStatus] = useState('')

  const showSchool = (index) => {
    const nextIndex = Math.min(Math.max(index, 0), schools.length - 1)
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

    const center = carousel.scrollLeft + carousel.clientWidth / 2
    const closestIndex = Array.from(carousel.children).reduce(
      (bestIndex, card, index, cards) =>
        Math.abs(card.offsetLeft + card.clientWidth / 2 - center) <
        Math.abs(
          cards[bestIndex].offsetLeft + cards[bestIndex].clientWidth / 2 - center,
        )
          ? index
          : bestIndex,
      0,
    )
    setActiveIndex(closestIndex)
  }

  const activeSchool = schools[activeIndex]
  const detailSchool = schools[detailIndex]
  const stageNumber = { school: 1, editor: 2, results: 3 }[stage]

  useEffect(() => {
    if (activeIndex === detailIndex) return undefined

    setDetailTransition('out')
    const swapTimer = window.setTimeout(() => {
      setDetailIndex(activeIndex)
      setDetailTransition('in')
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setDetailTransition('idle'))
      })
    }, 140)

    return () => window.clearTimeout(swapTimer)
  }, [activeIndex, detailIndex])

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
        const extension = isAnimated ? 'gif' : 'png'
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

  useEffect(() => {
    if (stage !== 'results') return undefined

    let cancelled = false
    const prepareFriendCard = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = CARD_WIDTH
      canvas.height = CARD_HEIGHT
      await renderCard(canvas, {
        school: selectedSchool,
        details: cardDetails,
        photoUrl,
        crop,
      })
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!cancelled) setFriendCardBlob(blob)
    }

    setFriendCardBlob(null)
    prepareFriendCard().catch((error) => {
      if (!cancelled) console.error('Unable to prepare friend share card', error)
    })
    return () => {
      cancelled = true
    }
  }, [stage, selectedSchool, cardDetails, photoUrl, crop])

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

  const goBack = () => {
    setStage((current) => (current === 'results' ? 'editor' : 'school'))
  }

  const saveArtwork = async () => {
    if (!resultArtifact || resultArtifact.format !== resultFormat) return
    try {
      const file = new File([resultArtifact.blob], resultArtifact.fileName, {
        type: resultArtifact.blob.type,
      })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${selectedSchool.name} Homecoming 2026`,
        })
      } else {
        setSaveSurface(resultArtifact)
      }
    } catch (error) {
      if (error.name === 'AbortError') return
      console.error('Unable to export artwork', error)
      setExportError('Export failed. Please try again.')
    }
  }

  const shareWithFriend = async () => {
    if (!friendCardBlob) return
    const firstName = cardDetails.firstName.trim() || 'A friend'
    const text = `${firstName} wants you to create your trading card for Homecoming! Powered by Desires By Saint.`
    const file = new File(
      [friendCardBlob],
      `${selectedSchool.abbreviation.toLowerCase()}-homecoming-card-${cardDetails.lastName.toLowerCase()}.png`,
      { type: 'image/png' },
    )

    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: PUBLIC_APP_URL })
        setShareStatus('Shared successfully.')
      } else if (navigator.share) {
        await navigator.share({ text, url: PUBLIC_APP_URL })
        setShareStatus('Link shared. Personalized image sharing requires the secure live site.')
      } else {
        await navigator.clipboard.writeText(`${text} ${PUBLIC_APP_URL}`)
        setShareStatus('Invitation link copied.')
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Unable to share invitation', error)
        setShareStatus('Sharing is unavailable here. Try again from the secure live site.')
      }
    }
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="header-identity">
          {stage !== 'school' && (
            <button className="header-back" type="button" onClick={goBack} aria-label="Go back">
              <ArrowLeft aria-hidden="true" />
            </button>
          )}
          <p className="wordmark">Eternal Heritage</p>
        </div>
        <p className="edition">Homecoming 2026</p>
      </header>

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
                  <img src={school.cardCanvas} alt="" draggable="false" />
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
            <div className={`school-details-content is-${detailTransition}`}>
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
            <p className="step-label">Step {stageNumber} of 3 / {selectedSchool.abbreviation}</p>
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
              onSubmit={(event) => {
                event.preventDefault()
                setStage('results')
              }}
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
                    <option>Student</option>
                  </select>
                </label>
              </div>

              <button className="primary-button form-submit" type="submit">
                Review my set
                <ArrowRight aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      )}

      {stage === 'results' && (
        <section className="results-view" aria-labelledby="results-title">
          <div className="view-heading">
            <p className="step-label">Step {stageNumber} of 3 / {selectedSchool.abbreviation}</p>
            <h1 id="results-title">Your homecoming set</h1>
          </div>

          <div className="format-tabs" role="tablist" aria-label="Output format">
            {[
              ['card', 'Trading card'],
              ['story', 'Instagram story'],
              ['animated', 'Animated card'],
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
            className={`result-preview${resultFormat === 'story' ? ' is-story' : ''}${resultFormat === 'animated' ? ' is-animated' : ''}`}
          >
            {resultFormat === 'animated' && resultArtifact?.format === 'animated' ? (
              <img
                className="animated-artwork"
                src={resultArtifact.url}
                alt={`${selectedSchool.name} animated card preview`}
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
              : `Save ${resultFormat === 'animated' ? 'Animated GIF' : resultFormat === 'story' ? 'Story Image' : 'Card Image'}`}
          </button>
          <button
            className="secondary-button friend-share-button"
            type="button"
            onClick={shareWithFriend}
            disabled={!friendCardBlob}
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
          <img src={saveSurface.url} alt="Personalized artwork ready to save" />
          <p>Press and hold the image to save it.</p>
        </div>
      )}
    </main>
  )
}

export default App