import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  BlinkDetector,
  CALIBRATION_MS,
  DEMO,
  LOW_LIGHT_BRIGHTNESS,
  MIN_BASELINE,
  MIN_CAL_SAMPLES,
  NORMAL,
  NO_FACE_MS,
  UNDER_BLINK_PER_MIN,
  averageEar,
  openEyeBaseline,
} from './blink'
import type { BlinkKind } from './blink'

export type Phase = 'idle' | 'loading' | 'calibrating' | 'tracking' | 'error'
export type ErrorKind = 'camera-denied' | 'no-camera' | 'camera-failed' | 'model-failed'

export interface Snapshot {
  phase: Phase
  error: { kind: ErrorKind; detail: string } | null
  calibration: number // 0..1
  calibrationNote: string | null
  baseline: number | null
  ear: number | null
  faceVisible: boolean
  noFace: boolean // no face for 3 seconds or more
  lowLight: boolean
  rate: number | null // blinks per minute, null while the window fills or the face is gone
  warmupSec: number
  windowSec: number
  complete: number
  incomplete: number
  underBlinking: boolean
  vignette: number // 0..1
  screenSec: number
  nudge: boolean
}

const EMPTY: Snapshot = {
  phase: 'idle',
  error: null,
  calibration: 0,
  calibrationNote: null,
  baseline: null,
  ear: null,
  faceVisible: false,
  noFace: false,
  lowLight: false,
  rate: null,
  warmupSec: 0,
  windowSec: NORMAL.windowSec,
  complete: 0,
  incomplete: 0,
  underBlinking: false,
  vignette: 0,
  screenSec: 0,
  nudge: false,
}

// Mutable engine state. Lives in a ref-like object so the 30fps loop never triggers React renders.
function createEngine() {
  return {
    session: 0, // bumped on stop so slow async startup can notice it was cancelled
    phase: 'idle' as Phase,
    error: null as Snapshot['error'],
    stream: null as MediaStream | null,
    landmarker: null as FaceLandmarker | null,
    raf: 0,
    lastVideoTime: -1,
    detector: new BlinkDetector(),
    calStart: null as number | null,
    calSamples: [] as number[],
    calNote: null as string | null,
    baseline: null as number | null,
    ear: null as number | null,
    faceVisible: false,
    faceLostSince: null as number | null,
    events: [] as { t: number; kind: BlinkKind }[],
    trackStart: 0,
    screenStart: null as number | null,
    snoozeUntil: 0,
    nudge: false,
    brightness: null as number | null,
    lastBrightT: 0,
    canvas: null as HTMLCanvasElement | null,
  }
}

type Engine = ReturnType<typeof createEngine>

async function createLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
  const options = {
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
  }
  try {
    return await FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
    })
  } catch (gpuError) {
    console.warn('GPU delegate failed, using CPU', gpuError)
    return await FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
    })
  }
}

function blinkBlend(shapes: Classifications | undefined) {
  if (!shapes) return null
  const get = (name: string) => shapes.categories.find((c) => c.categoryName === name)?.score
  const l = get('eyeBlinkLeft')
  const r = get('eyeBlinkRight')
  return l === undefined || r === undefined ? null : (l + r) / 2
}

export function useEyeTracker(videoRef: RefObject<HTMLVideoElement | null>, demo: boolean) {
  const engine = useRef<Engine | null>(null)
  engine.current ??= createEngine()
  const m = engine.current
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const demoRef = useRef(demo)

  const config = () => (demoRef.current ? DEMO : NORMAL)

  const publish = useCallback(() => {
    const now = performance.now()
    const cfg = config()
    const tracking = m.phase === 'tracking'

    const cutoff = now - 60_000
    while (m.events.length && m.events[0].t < cutoff) m.events.shift()

    const noFace = m.faceLostSince !== null && now - m.faceLostSince >= NO_FACE_MS
    const inWindow = m.events.filter((e) => e.t >= now - cfg.windowSec * 1000)
    const complete = inWindow.filter((e) => e.kind === 'complete').length
    const incomplete = inWindow.length - complete

    const warmupSec = tracking ? Math.max(0, Math.ceil(cfg.windowSec - (now - m.trackStart) / 1000)) : cfg.windowSec
    const rate = tracking && !noFace && warmupSec === 0 ? (inWindow.length * 60) / cfg.windowSec : null
    const underBlinking = rate !== null && rate < UNDER_BLINK_PER_MIN
    const screenSec = tracking && m.screenStart !== null ? (now - m.screenStart) / 1000 : 0

    if (underBlinking && !noFace && screenSec >= cfg.nudgeAfterSec && now >= m.snoozeUntil) m.nudge = true
    if (!tracking) m.nudge = false

    setSnap({
      phase: m.phase,
      error: m.error,
      calibration: m.calStart === null ? 0 : Math.min(1, (now - m.calStart) / CALIBRATION_MS),
      calibrationNote: m.calNote,
      baseline: m.baseline,
      ear: m.ear,
      faceVisible: m.faceVisible,
      noFace,
      lowLight: m.brightness !== null && m.brightness < LOW_LIGHT_BRIGHTNESS,
      rate,
      warmupSec,
      windowSec: cfg.windowSec,
      complete,
      incomplete,
      underBlinking,
      vignette: underBlinking ? Math.min(1, 0.4 + 0.6 * (1 - rate / UNDER_BLINK_PER_MIN)) : 0,
      screenSec,
      nudge: m.nudge,
    })
  }, [m])

  const teardown = useCallback(() => {
    cancelAnimationFrame(m.raf)
    m.stream?.getTracks().forEach((t) => t.stop())
    m.stream = null
    m.landmarker?.close()
    m.landmarker = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [m, videoRef])

  const fail = useCallback(
    (kind: ErrorKind, detail: string) => {
      teardown()
      m.phase = 'error'
      m.error = { kind, detail }
      m.faceVisible = false
      publish()
    },
    [m, teardown, publish],
  )

  const restartCalibration = (note: string | null) => {
    m.calStart = null
    m.calSamples = []
    m.calNote = note
  }

  const finishCalibration = (now: number) => {
    if (m.calSamples.length < MIN_CAL_SAMPLES) {
      restartCalibration('We lost sight of your face during calibration. Look at the screen and we will try again.')
      return
    }
    const baseline = openEyeBaseline(m.calSamples)
    if (baseline < MIN_BASELINE) {
      restartCalibration('Your eyes looked closed. Keep them open and look at the screen, then we will try again.')
      return
    }
    m.baseline = baseline
    m.calNote = null
    m.events = []
    m.detector.reset()
    m.trackStart = now
    m.screenStart ??= now
    m.phase = 'tracking'
  }

  const sampleBrightness = (video: HTMLVideoElement, now: number) => {
    if (now - m.lastBrightT < 500) return
    m.lastBrightT = now
    m.canvas ??= Object.assign(document.createElement('canvas'), { width: 32, height: 24 })
    const ctx = m.canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(video, 0, 0, 32, 24)
    const px = ctx.getImageData(0, 0, 32, 24).data
    let sum = 0
    for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    m.brightness = sum / (px.length / 4)
  }

  const onNoFace = (now: number) => {
    m.faceVisible = false
    m.ear = null
    m.detector.reset()
    m.faceLostSince ??= now
    // Away long enough counts as a break: screen time restarts when the face returns.
    if (m.phase === 'tracking' && now - m.faceLostSince >= config().breakAwaySec * 1000) {
      m.screenStart = null
      m.nudge = false
    }
  }

  const onFace = (now: number, video: HTMLVideoElement, lm: NormalizedLandmark[], shapes: Classifications | undefined) => {
    if (m.faceLostSince !== null) {
      // Time with no face must not count as time without blinking.
      if (now - m.faceLostSince >= NO_FACE_MS) {
        m.events = []
        m.trackStart = now
      }
      m.faceLostSince = null
    }
    if (m.phase === 'tracking') m.screenStart ??= now

    const ear = averageEar(lm, video.videoWidth, video.videoHeight)
    m.ear = ear
    m.faceVisible = true

    if (m.phase === 'calibrating') {
      m.calStart ??= now
      m.calSamples.push(ear)
      if (now - m.calStart >= CALIBRATION_MS) finishCalibration(now)
    } else if (m.phase === 'tracking' && m.baseline !== null) {
      const kind = m.detector.update(now, ear, blinkBlend(shapes), m.baseline)
      if (kind) m.events.push({ t: now, kind })
    }
  }

  const start = useCallback(async () => {
    teardown()
    const id = ++m.session
    Object.assign(m, createEngine(), { session: id, phase: 'loading' as Phase })
    publish()

    if (!navigator.mediaDevices?.getUserMedia) {
      fail('camera-failed', 'This browser cannot reach a camera. Cameras need HTTPS or localhost.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
    } catch (e) {
      if (id !== m.session) return
      const name = e instanceof DOMException ? e.name : ''
      const detail = e instanceof Error ? `${name}: ${e.message}` : String(e)
      if (name === 'NotAllowedError' || name === 'SecurityError') fail('camera-denied', detail)
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') fail('no-camera', detail)
      else fail('camera-failed', detail)
      return
    }
    if (id !== m.session) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    m.stream = stream
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (id === m.session) fail('camera-failed', 'The camera was disconnected.')
    })

    const video = videoRef.current
    if (!video) {
      fail('camera-failed', 'Video element missing.')
      return
    }
    video.srcObject = stream
    try {
      await video.play()
    } catch (e) {
      if (id === m.session) fail('camera-failed', String(e))
      return
    }

    let landmarker: FaceLandmarker
    try {
      landmarker = await createLandmarker()
    } catch (e) {
      if (id === m.session) fail('model-failed', e instanceof Error ? e.message : String(e))
      return
    }
    if (id !== m.session) {
      landmarker.close()
      return
    }
    m.landmarker = landmarker
    m.phase = 'calibrating'
    publish()

    const tick = () => {
      m.raf = requestAnimationFrame(tick)
      if (video.readyState < 2 || video.currentTime === m.lastVideoTime) return
      m.lastVideoTime = video.currentTime
      const now = performance.now()
      sampleBrightness(video, now)
      let result
      try {
        result = landmarker.detectForVideo(video, now)
      } catch (e) {
        fail('model-failed', e instanceof Error ? e.message : String(e))
        return
      }
      const lm = result.faceLandmarks[0]
      if (lm) onFace(now, video, lm, result.faceBlendshapes?.[0])
      else onNoFace(now)
    }
    tick()
  }, [m, teardown, publish, fail, videoRef])

  const stop = useCallback(() => {
    m.session++
    teardown()
    Object.assign(m, createEngine(), { session: m.session })
    publish()
  }, [m, teardown, publish])

  const recalibrate = useCallback(() => {
    if (m.phase !== 'tracking' && m.phase !== 'calibrating') return
    m.phase = 'calibrating'
    m.detector.reset()
    m.events = []
    m.nudge = false
    m.calStart = null
    m.calSamples = []
    m.calNote = null
    publish()
  }, [m, publish])

  const takeBreak = useCallback(() => {
    const now = performance.now()
    m.screenStart = now
    m.trackStart = now
    m.events = []
    m.snoozeUntil = 0
    m.nudge = false
    publish()
  }, [m, publish])

  const snooze = useCallback(() => {
    m.snoozeUntil = performance.now() + config().snoozeSec * 1000
    m.nudge = false
    publish()
  }, [m, publish])

  // Keep the demo flag current and refresh the UI a few times a second while the camera is running.
  useEffect(() => {
    demoRef.current = demo
  }, [demo])

  useEffect(() => {
    const id = setInterval(() => {
      if (m.phase === 'calibrating' || m.phase === 'tracking') publish()
    }, 250)
    return () => {
      clearInterval(id)
      teardown()
    }
  }, [m, publish, teardown])

  return { snap, start, stop, recalibrate, takeBreak, snooze }
}
