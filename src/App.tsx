import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Camera, Circle, Gauge, Hand, Music2, Play, Square, Waves } from 'lucide-react'
import './App.css'
import { AmbientSoundscape, type SoundscapeLoadReport } from './audio/ambientSoundscape'
import { useHandTracking } from './hooks/useHandTracking'
import { MelodyEngine, secondsForRhythm } from './music/melodyEngine'
import { DEFAULT_GESTURE, STYLE_PRESETS } from './music/presets'
import { GestureTriggerDetector } from './music/gestureTrigger'
import type { GestureFeatures, MelodyEvent, StyleId } from './music/types'

const styles = Object.values(STYLE_PRESETS)

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function gestureLabel(gesture: GestureFeatures) {
  const motion = gesture.direction === 'level' ? 'holding level' : `moving ${gesture.direction}`
  return `${gesture.handCount || 'No'} hand${gesture.handCount === 1 ? '' : 's'} - ${motion} - ${gesture.articulation}`
}

function displayRole(event: MelodyEvent | null, active: boolean) {
  if (!active) return 'blank page'
  if (!event) return 'wet brush'
  if (event.role === 'rest') return 'drying'
  if (event.role === 'pad' || event.role === 'chord') return 'wash'
  if (event.role === 'bell') return 'droplet'
  if (event.role === 'arp') return 'ripple'
  return 'ink line'
}

function recentMark(event: MelodyEvent | null) {
  if (!event) return 'waiting'
  if (event.role === 'rest') return 'drying'
  return event.note ?? 'soft mark'
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const soundscapeRef = useRef(new AmbientSoundscape())
  const timerRef = useRef<number | null>(null)
  const gestureRef = useRef<GestureFeatures>(DEFAULT_GESTURE)
  const centerRef = useRef({ x: 0.5, y: 0.5 })
  const tempoRef = useRef(68)
  const engineRef = useRef(new MelodyEngine(STYLE_PRESETS.peaceful))
  const triggerDetectorRef = useRef(new GestureTriggerDetector())
  const activeGestureRef = useRef<'swipe' | 'circle' | null>(null)
  const phraseEventsLeftRef = useRef(0)
  const [styleId, setStyleId] = useState<StyleId>('peaceful')
  const [tempo, setTempo] = useState(68)
  const [sensitivity, setSensitivity] = useState(0.72)
  const [isPerforming, setIsPerforming] = useState(false)
  const [isPhraseActive, setIsPhraseActive] = useState(false)
  const [currentEvent, setCurrentEvent] = useState<MelodyEvent | null>(null)
  const [audioStatus, setAudioStatus] = useState('Tap play to wet the page')
  const [loadReport, setLoadReport] = useState<SoundscapeLoadReport | null>(null)
  const preset = STYLE_PRESETS[styleId]
  const tracking = useHandTracking(videoRef, isPerforming)
  const scaledGesture = useMemo(
    () => ({
      ...tracking.gesture,
      speed: Math.min(1, (tracking.gesture.speed * 1.42) / Math.max(0.16, sensitivity * 0.86)),
      sharpness: Math.min(1, (tracking.gesture.sharpness * 1.65) / Math.max(0.16, sensitivity * 0.82)),
      size: Math.min(1, tracking.gesture.size * (0.95 + sensitivity * 0.75)),
    }),
    [sensitivity, tracking.gesture],
  )

  useEffect(() => {
    tempoRef.current = tempo
  }, [tempo])

  useEffect(() => {
    engineRef.current.setPreset(preset)
  }, [preset])

  useEffect(() => {
    gestureRef.current = scaledGesture
  }, [scaledGesture])

  useEffect(() => {
    centerRef.current = tracking.center
  }, [tracking.center])

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const context = canvas.getContext('2d')
    if (!context) return

    const width = video.clientWidth || 960
    const height = video.clientHeight || 540
    const pixelRatio = window.devicePixelRatio || 1
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.fillStyle = 'rgba(82, 137, 151, 0.44)'
    context.strokeStyle = 'rgba(80, 126, 137, 0.36)'
    context.lineWidth = 3

    const videoWidth = video.videoWidth || width
    const videoHeight = video.videoHeight || height
    const coverScale = Math.max(width / videoWidth, height / videoHeight)
    const renderedWidth = videoWidth * coverScale
    const renderedHeight = videoHeight * coverScale
    const offsetX = (width - renderedWidth) / 2
    const offsetY = (height - renderedHeight) / 2
    const toCanvasPoint = (point: { x: number; y: number }) => ({
      x: offsetX + point.x * renderedWidth,
      y: offsetY + point.y * renderedHeight,
    })

    tracking.landmarks.forEach((handLandmarks) => {
      handLandmarks.forEach((point) => {
        const canvasPoint = toCanvasPoint(point)
        const radius = 5 + tracking.gesture.size * 5
        const wash = context.createRadialGradient(canvasPoint.x, canvasPoint.y, 0, canvasPoint.x, canvasPoint.y, radius)
        wash.addColorStop(0, 'rgba(71, 132, 150, 0.42)')
        wash.addColorStop(1, 'rgba(71, 132, 150, 0)')
        context.fillStyle = wash
        context.beginPath()
        context.arc(canvasPoint.x, canvasPoint.y, radius, 0, Math.PI * 2)
        context.fill()
      })

      const palm = handLandmarks[9] ?? handLandmarks[0]
      if (palm) {
        const canvasPalm = toCanvasPoint(palm)
        context.beginPath()
        context.arc(canvasPalm.x, canvasPalm.y, 18 + tracking.gesture.size * 28, 0, Math.PI * 2)
        context.stroke()
      }
    })
  }, [tracking.gesture.size, tracking.landmarks])

  useEffect(() => {
    const soundscape = soundscapeRef.current
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      soundscape.dispose()
    }
  }, [])

  async function startPerformance() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setAudioStatus('Loading ambient instruments...')
    const report = await soundscapeRef.current.start(styleId)
    setLoadReport(report)
    setAudioStatus(report.ready ? 'Blank page - waiting for a brushstroke or ripple' : 'Some SoundFont samples are missing')
    setIsPerforming(true)
    triggerDetectorRef.current.reset()
    activeGestureRef.current = null
    phraseEventsLeftRef.current = 0
    setIsPhraseActive(false)

    const tick = () => {
      const gesture = gestureRef.current
      const trigger =
        triggerDetectorRef.current.update(gesture.handCount, centerRef.current) ??
        (gesture.handCount > 0 && gesture.speed > 0.46 && gesture.direction !== 'level'
          ? {
              type: 'swipe' as const,
              direction: gesture.direction,
              phraseLength: 1,
            }
          : null)

      if (trigger) {
        activeGestureRef.current = trigger.type
        phraseEventsLeftRef.current = trigger.type === 'circle' ? 8 : 3
        setIsPhraseActive(true)
        setAudioStatus(`${trigger.type === 'circle' ? 'Ripple wash' : 'Droplet stroke'} captured`)
      }

      if (phraseEventsLeftRef.current < 1) {
        timerRef.current = window.setTimeout(tick, 70)
        return
      }

      const gestureType = activeGestureRef.current
      const isFirstPhraseEvent = phraseEventsLeftRef.current === (gestureType === 'circle' ? 8 : 3)
      const intent =
        gestureType === 'circle' && isFirstPhraseEvent
          ? 'circle'
          : gestureType === 'swipe' && isFirstPhraseEvent
            ? 'swipe'
            : 'none'
      const ambientGesture: GestureFeatures = {
        ...gesture,
        handCount: Math.max(1, gesture.handCount),
        direction: trigger?.direction ?? gesture.direction,
        speed:
          gestureType === 'swipe'
            ? Math.max(gesture.speed, 0.9)
            : gestureType === 'circle'
              ? Math.max(0.38, Math.min(0.82, gesture.speed))
              : Math.min(0.74, gesture.speed),
        sharpness:
          gestureType === 'swipe'
            ? Math.max(gesture.sharpness, 0.88)
            : gestureType === 'circle'
              ? Math.max(gesture.sharpness, 0.28)
              : gesture.sharpness,
        articulation: gestureType === 'swipe' ? 'staccato' : gesture.speed < 0.2 ? 'legato' : gesture.articulation,
      }
      const event = engineRef.current.next(ambientGesture, intent)
      const seconds = secondsForRhythm(event.duration, tempoRef.current)
      soundscapeRef.current.play(event, seconds)
      setCurrentEvent(event)
      phraseEventsLeftRef.current -= 1
      if (event.role !== 'rest') {
        setAudioStatus(`${displayRole(event, true)} - ${event.chord.label}`)
      }
      if (phraseEventsLeftRef.current < 1) {
        activeGestureRef.current = null
        setIsPhraseActive(false)
        setAudioStatus('Dry page - silent until the next gesture')
      }
      timerRef.current = window.setTimeout(tick, Math.max(360, seconds * 1000))
    }

    tick()
  }

  async function stopPerformance() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    triggerDetectorRef.current.reset()
    activeGestureRef.current = null
    phraseEventsLeftRef.current = 0
    setIsPhraseActive(false)
    setIsPerforming(false)
    setAudioStatus('Fading out')
    await soundscapeRef.current.fadeOut(2.2)
    setAudioStatus('Soundscape closed')
  }

  async function handleStyleChange(nextStyle: StyleId) {
    setStyleId(nextStyle)
    engineRef.current.setPreset(STYLE_PRESETS[nextStyle])
    if (isPerforming) {
      setAudioStatus('Loading ambient instruments...')
      const report = await soundscapeRef.current.start(nextStyle)
      setLoadReport(report)
      setAudioStatus(
        report.ready
          ? `Switched to ${STYLE_PRESETS[nextStyle].name}`
          : `Switched to ${STYLE_PRESETS[nextStyle].name}; some samples are missing`,
      )
    }
  }

  return (
    <main className="app-shell">
      <section className="stage" aria-label="Gesture performance stage">
        <div className="video-wrap">
          <video ref={videoRef} className="camera-feed" playsInline muted aria-label="Live camera feed" />
          <canvas ref={canvasRef} className="landmark-layer" aria-hidden="true" />
          {!isPerforming && (
            <div className="camera-idle">
              <Camera aria-hidden="true" />
              <span>Blank Page</span>
            </div>
          )}
          <div className="stage-hud">
            <span className={`status-dot ${isPerforming ? 'on' : ''}`} />
            <span>{tracking.message}</span>
          </div>
        </div>

        <aside className="control-surface" aria-label="Performance controls">
          <div className="brand-row">
            <Music2 aria-hidden="true" />
            <div>
              <h1>Watercolor Gesture Soundtrack</h1>
              <p>{preset.mood}</p>
            </div>
          </div>

          <div className="transport-row">
            <button type="button" className="transport play" onClick={startPerformance} disabled={isPerforming}>
              <Play aria-hidden="true" />
              <span>Play</span>
            </button>
            <button type="button" className="transport stop" onClick={stopPerformance} disabled={!isPerforming}>
              <Square aria-hidden="true" />
              <span>Stop</span>
            </button>
          </div>

          <div className="field">
            <label htmlFor="style">Palette</label>
            <select
              id="style"
              value={styleId}
              onChange={(event) => void handleStyleChange(event.target.value as StyleId)}
            >
              {styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="tempo">
              <Gauge aria-hidden="true" />
              Flow <strong>{tempo}</strong>
            </label>
            <input
              id="tempo"
              type="range"
              min="45"
              max="90"
              value={tempo}
              onChange={(event) => setTempo(Number(event.target.value))}
            />
          </div>

          <div className="field">
            <label htmlFor="sensitivity">
              <Waves aria-hidden="true" />
              Absorb <strong>{Math.round(sensitivity * 100)}</strong>
            </label>
            <input
              id="sensitivity"
              type="range"
              min="0.35"
              max="1"
              step="0.01"
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
            />
          </div>

          <div className="readout-grid">
            <Readout icon={<Hand />} label="Gesture" value={gestureLabel(tracking.gesture)} />
            <Readout
              icon={<Circle />}
              label="Pigment"
              value={`${currentEvent?.chord.label ?? preset.chords[0].label} - ${preset.progressionName}`}
            />
            <Readout icon={<Waves />} label="Wash" value={displayRole(currentEvent, isPhraseActive)} />
            <Readout
              icon={<Music2 />}
              label="Mark"
              value={recentMark(currentEvent)}
            />
          </div>

          <div className="meter-bank" aria-label="Gesture feature meters">
            <Meter label="Lift" value={tracking.gesture.height} />
            <Meter label="Flow" value={scaledGesture.speed} />
            <Meter label="Bloom" value={tracking.gesture.size} />
            <Meter label="Edge" value={scaledGesture.sharpness} />
          </div>

          <div className="instrument-list">
            {preset.instruments.map((instrument) => (
              <span key={instrument}>{instrument}</span>
            ))}
          </div>

          <p className="audio-status">{audioStatus}</p>
          {loadReport && (
            <div className="sample-report" aria-label="SoundFont load report">
              {loadReport.instruments.map((instrument) => (
                <span className={instrument.missingProbes.length ? 'warn' : 'ok'} key={instrument.role}>
                  {instrument.role}: {instrument.sampleCount} samples
                </span>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}

function Readout({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="readout">
      <div className="readout-label">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  )
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="meter-track">
        <i style={{ width: percent(value) }} />
      </div>
      <b>{percent(value)}</b>
    </div>
  )
}

export default App
