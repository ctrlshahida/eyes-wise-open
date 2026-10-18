// Past results, kept only in this browser (localStorage). Never sent to the server or any API.
// Clearing site data, a private window or another device means no history: the app copes with that.
import type { MeasureResult } from './useEyeTracker'
import { SHORT_SESSION_SEC } from './blink'

export interface PastCheck {
  at: string // ISO time the check finished
  blinksPerMinute: number
  incompletePct: number | null
  seconds: number
  demo: boolean
  lowLight: boolean
}

const KEY = 'ewo-history-v1'
const KEEP = 20 // stored; the trend shows the last TREND_SIZE
export const TREND_SIZE = 5

export function loadHistory(): PastCheck[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(data) ? data.filter((c) => typeof c?.blinksPerMinute === 'number' && typeof c?.at === 'string') : []
  } catch {
    return []
  }
}

export function saveCheck(r: MeasureResult, demo: boolean) {
  const entry: PastCheck = {
    at: new Date().toISOString(),
    blinksPerMinute: Math.round(r.blinksPerMinute * 10) / 10,
    incompletePct: r.incompletePct === null ? null : Math.round(r.incompletePct),
    seconds: Math.round(r.seconds),
    demo,
    lowLight: r.lowLight,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([...loadHistory(), entry].slice(-KEEP)))
  } catch {
    // Storage blocked or full: the result still shows, it just is not remembered.
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do.
  }
}

// A check the trend should not treat as a real reading. The chart still shows it, labelled.
export function isRough(c: PastCheck) {
  return c.demo || c.lowLight || c.seconds < SHORT_SESSION_SEC
}
