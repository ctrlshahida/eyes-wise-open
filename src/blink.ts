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

export const UNDER_BLINK_PER_MIN = 8
export const NO_FACE_MS = 3000
export const LOW_LIGHT_BRIGHTNESS = 55 // mean luma 0-255 of the camera frame

export interface ModeConfig {
  windowSec: number // rolling window for the blink rate
  nudgeAfterSec: number // continuous screen time before a nudge can fire
  breakAwaySec: number // face absent this long counts as a break
  snoozeSec: number // "remind me later" delay
}

export const NORMAL: ModeConfig = { windowSec: 60, nudgeAfterSec: 20 * 60, breakAwaySec: 20, snoozeSec: 5 * 60 }
export const DEMO: ModeConfig = { windowSec: 20, nudgeAfterSec: 40, breakAwaySec: 6, snoozeSec: 30 }
// -----------------------------------------------------------------------------

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
