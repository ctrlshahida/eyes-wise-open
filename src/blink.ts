// Blink maths and settings. No React, no camera: just numbers in, events out.
// Every threshold lives here so it can be tuned by testing.

export type BlinkKind = 'complete' | 'incomplete'

export interface Point {
  x: number
  y: number
}

// Landmark order is p1..p6 as in PROJECT.md: [outer corner, top1, top2, inner corner, bottom2, bottom1]
export const RIGHT_EYE = [33, 160, 158, 133, 153, 144]
export const LEFT_EYE = [362, 385, 387, 263, 373, 380]

// ---- Tunable settings -------------------------------------------------------
export const CLOSED_RATIO = 0.6 // EAR below this share of baseline = eye fully closed
export const PARTIAL_RATIO = 0.8 // EAR below this share of baseline = a dip starts
export const RECOVER_RATIO = 0.85 // EAR back above this share = dip over (hysteresis)
export const INCOMPLETE_MAX_MS = 400 // a partial dip must recover this fast to count
export const COMPLETE_MAX_MS = 1000 // longer than this is eyes shut or looking away, not a blink
export const REFRACTORY_MS = 150 // ignore new dips this soon after one ended
export const MIN_DIP_FRAMES = 2 // one noisy frame is not a blink
export const BLEND_COMPLETE_MIN = 0.3 // blendshape cross-check for a complete blink

export const CALIBRATION_MS = 10_000
export const MIN_CAL_SAMPLES = 60
export const MIN_BASELINE = 0.12

export const NO_FACE_MS = 3000
export const LOW_LIGHT_BRIGHTNESS = 55 // mean luma 0-255 of the camera frame
export const LOW_LIGHT_SHARE = 0.2 // flag a measurement if more than this share of its frames were dark

// The measurement runs while the person works and ends when they press Finish. This is only the safety
// cap (a working day) after which it ends by itself. Seconds of face-in-view time.
export const MEASURE_SEC = 8 * 60 * 60
// Finish is allowed once this much has been measured. Demo mode lowers it so the flow is quick on stage.
export const MIN_FINISH_SEC = 30
export const DEMO_MIN_FINISH_SEC = 10
export const SHORT_SESSION_SEC = 120 // under this the result says it is too short to judge (the AI's choice)
// -----------------------------------------------------------------------------

export interface Segment {
  startSec: number // offsets in measured (face-in-view) seconds
  endSec: number
  rate: number // blinks per minute inside this part
}

// Split the measured time into equal parts and count the blinks in each, so the rate can be drawn over the
// session. blinkTimes are offsets in measured seconds. Needs at least two minutes, at most 12 parts.
export function buildTimeline(blinkTimes: number[], seconds: number): Segment[] {
  const n = Math.min(12, Math.floor(seconds / 60))
  if (n < 2) return []
  const len = seconds / n
  const counts = new Array<number>(n).fill(0)
  for (const t of blinkTimes) counts[Math.min(n - 1, Math.floor(t / len))]++
  return counts.map((c, i) => ({ startSec: i * len, endSec: (i + 1) * len, rate: (c * 60) / len }))
}

// Average rate of the first half of the parts against the last half.
export function trendOf(timeline: Segment[]) {
  if (timeline.length < 2) return null
  const half = Math.floor(timeline.length / 2)
  const mean = (xs: Segment[]) => xs.reduce((a, s) => a + s.rate, 0) / xs.length
  return { first: mean(timeline.slice(0, half)), second: mean(timeline.slice(-half)) }
}

function dist(a: Point, b: Point, w: number, h: number) {
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h)
}

// EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|), measured in pixels so the video aspect ratio does not skew it.
export function eyeAspectRatio(lm: Point[], idx: number[], w: number, h: number) {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => lm[i])
  return (dist(p2, p6, w, h) + dist(p3, p5, w, h)) / (2 * dist(p1, p4, w, h))
}

export function averageEar(lm: Point[], w: number, h: number) {
  return (eyeAspectRatio(lm, RIGHT_EYE, w, h) + eyeAspectRatio(lm, LEFT_EYE, w, h)) / 2
}

export function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Median of the whole sample is pulled down a little by blinks, so take the median of the open-eye frames.
export function openEyeBaseline(samples: number[]) {
  const rough = median(samples)
  return median(samples.filter((v) => v >= rough * 0.85))
}

interface Dip {
  start: number
  frames: number
  minEar: number
  peakBlend: number | null
}

// Feed it one EAR value per video frame. It returns a blink when a dip has finished.
export class BlinkDetector {
  private dip: Dip | null = null
  private lastEnd = -Infinity

  reset() {
    this.dip = null
  }

  update(t: number, ear: number, blend: number | null, baseline: number): BlinkKind | null {
    if (!this.dip) {
      if (ear < baseline * PARTIAL_RATIO && t - this.lastEnd > REFRACTORY_MS) {
        this.dip = { start: t, frames: 1, minEar: ear, peakBlend: blend }
      }
      return null
    }

    const d = this.dip
    if (ear < baseline * RECOVER_RATIO) {
      d.frames++
      d.minEar = Math.min(d.minEar, ear)
      if (blend !== null) d.peakBlend = Math.max(d.peakBlend ?? 0, blend)
      return null
    }

    // Recovered: classify the dip.
    this.dip = null
    this.lastEnd = t
    const duration = t - d.start
    if (d.frames < MIN_DIP_FRAMES || duration > COMPLETE_MAX_MS) return null

    const closed = d.minEar < baseline * CLOSED_RATIO
    const blendAgrees = d.peakBlend === null || d.peakBlend >= BLEND_COMPLETE_MIN
    if (closed && blendAgrees) return 'complete'
    if (duration <= INCOMPLETE_MAX_MS) return 'incomplete'
    return null
  }
}
