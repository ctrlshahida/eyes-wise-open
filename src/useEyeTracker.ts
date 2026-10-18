import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Segment } from './blink'
import {
  BlinkDetector,
  CALIBRATION_MS,
  LOW_LIGHT_BRIGHTNESS,
  LOW_LIGHT_SHARE,
  MIN_BASELINE,
  MIN_CAL_SAMPLES,
  NO_FACE_MS,
  averageEar,
  buildTimeline,
  openEyeBaseline,
} from './blink'

export type Phase = 'idle' | 'loading' | 'calibrating' | 'tracking' | 'error'
export type ErrorKind = 'camera-denied' | 'no-camera' | 'camera-failed' | 'model-failed'

// What measure() returns. Anonymous numbers only: no video, no images.
export interface MeasureResult {
  seconds: number // face-in-view time actually measured
  blinks: number
  complete: number
  incomplete: number
  blinksPerMinute: number
  incompletePct: number | null // null when no blinks were seen
  lowLight: boolean // the frame was dark for a large share of the measurement
  timeline: Segment[] // blink rate across the session, empty when it was under two minutes
}

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
  measuring: boolean
  measureElapsedSec: number // time measured so far, counts only time with a face in view
  canFinish: boolean // enough has been measured to finish early
  finishInSec: number // seconds of measuring still needed before Finish unlocks
  hidden: boolean // the tab is hidden, so the browser is not giving us camera frames
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
  measuring: false,
  measureElapsedSec: 0,
  canFinish: false,
  finishInSec: 0,
  hidden: false,
}

interface Measurement {
  seconds: number // safety cap
  minFinishSec: number
  faceSec: number
  complete: number
  incomplete: number
  frames: number
  darkFrames: number
  blinkTimes: number[] // when each blink happened, in measured seconds
  promise: Promise<MeasureResult | null>
  resolve: (r: MeasureResult | null) => void
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
    lastFaceT: null as number | null,
    brightness: null as number | null,
    lastBrightT: 0,
    canvas: null as HTMLCanvasElement | null,
    measurement: null as Measurement | null,
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

export function useEyeTracker(videoRef: RefObject<HTMLVideoElement | null>) {
  const engine = useRef<Engine | null>(null)
  engine.current ??= createEngine()
  const m = engine.current
  const [snap, setSnap] = useState<Snapshot>(EMPTY)

  const publish = useCallback(() => {
    const now = performance.now()
    const noFace = m.faceLostSince !== null && now - m.faceLostSince >= NO_FACE_MS
    const ms = m.measurement
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
      measuring: ms !== null,
      measureElapsedSec: ms ? Math.floor(ms.faceSec) : 0,
      canFinish: ms !== null && ms.faceSec >= ms.minFinishSec,
      finishInSec: ms ? Math.max(0, Math.ceil(ms.minFinishSec - ms.faceSec)) : 0,
      hidden: document.hidden,
    })
  }, [m])

  // Closing the camera also abandons any measurement in progress (its promise resolves to null).
  const teardown = useCallback(() => {
    cancelAnimationFrame(m.raf)
    m.stream?.getTracks().forEach((t) => t.stop())
    m.stream = null
    m.landmarker?.close()
    m.landmarker = null
    m.measurement?.resolve(null)
    m.measurement = null
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

  const finishCalibration = () => {
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
    m.detector.reset()
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

  const finishMeasurement = (ms: Measurement) => {
    const blinks = ms.complete + ms.incomplete
    m.measurement = null
    ms.resolve({
      seconds: ms.faceSec,
      blinks,
      complete: ms.complete,
      incomplete: ms.incomplete,
      blinksPerMinute: (blinks * 60) / ms.faceSec,
      incompletePct: blinks > 0 ? (ms.incomplete / blinks) * 100 : null,
      lowLight: ms.frames > 0 && ms.darkFrames / ms.frames > LOW_LIGHT_SHARE,
      timeline: buildTimeline(ms.blinkTimes, ms.faceSec),
    })
  }

  const onNoFace = (now: number) => {
    m.faceVisible = false
    m.ear = null
    m.detector.reset()
    m.faceLostSince ??= now
  }

  const onFace = (now: number, video: HTMLVideoElement, lm: NormalizedLandmark[], shapes: Classifications | undefined) => {
    m.faceLostSince = null
    // Time with no face is not counted: the measurement clock only runs while the face is in view.
    const dt = m.lastFaceT !== null && now - m.lastFaceT < 1500 ? (now - m.lastFaceT) / 1000 : 0
    m.lastFaceT = now

    const ear = averageEar(lm, video.videoWidth, video.videoHeight)
    m.ear = ear
    m.faceVisible = true

    if (m.phase === 'calibrating') {
      m.calStart ??= now
      m.calSamples.push(ear)
      if (now - m.calStart >= CALIBRATION_MS) finishCalibration()
    } else if (m.phase === 'tracking' && m.baseline !== null) {
      const kind = m.detector.update(now, ear, blinkBlend(shapes), m.baseline)
      const ms = m.measurement
      if (ms) {
        ms.faceSec += dt
        ms.frames++
        if (m.brightness !== null && m.brightness < LOW_LIGHT_BRIGHTNESS) ms.darkFrames++
        if (kind) {
          ms[kind]++
          ms.blinkTimes.push(ms.faceSec)
        }
        if (ms.faceSec >= ms.seconds) finishMeasurement(ms)
      }
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

  // Measure until finishEarly() is called (allowed after minFinishSec) or the maxSec cap is hit, and
  // return the blink counts and rate. Only time with a face in view counts.
  // Needs a finished calibration. Resolves to null if the measurement is abandoned
  // (recalibrate, stop, camera error). Calling it again while one is running returns the same promise.
  const measure = useCallback(
    (seconds: number, minFinishSec: number): Promise<MeasureResult | null> => {
      if (m.measurement) return m.measurement.promise
      if (m.phase !== 'tracking') return Promise.resolve(null)
      let resolve!: Measurement['resolve']
      const promise = new Promise<MeasureResult | null>((r) => (resolve = r))
      m.measurement = { seconds, minFinishSec, faceSec: 0, complete: 0, incomplete: 0, frames: 0, darkFrames: 0, blinkTimes: [], promise, resolve }
      m.detector.reset()
      publish()
      return promise
    },
    [m, publish],
  )

  // End the measurement now with what has been counted so far.
  const finishEarly = useCallback(() => {
    const ms = m.measurement
    if (ms && ms.faceSec >= ms.minFinishSec) finishMeasurement(ms)
  }, [m])

  // Glasses on or off: take a new baseline. Any measurement so far is discarded.
  const recalibrate = useCallback(() => {
    if (m.phase !== 'tracking' && m.phase !== 'calibrating') return
    m.measurement?.resolve(null)
    m.measurement = null
    m.phase = 'calibrating'
    m.detector.reset()
    m.calStart = null
    m.calSamples = []
    m.calNote = null
    publish()
  }, [m, publish])

  // Refresh the UI a few times a second while the camera is running.
  useEffect(() => {
    const id = setInterval(() => {
      if (m.phase === 'calibrating' || m.phase === 'tracking') publish()
    }, 250)
    return () => {
      clearInterval(id)
      teardown()
    }
  }, [m, publish, teardown])

  return { snap, start, stop, measure, finishEarly, recalibrate }
}
