// The written analysis on the result screen. Only anonymous numbers are sent, never video.
import type { MeasureResult } from './useEyeTracker'
import { RELAXED_RANGE, SCREEN_RANGE, bandFor } from './reference'
import { SHORT_SESSION_SEC, trendOf } from './blink'
import { isRough } from './history'
import type { PastCheck } from './history'

export interface SummaryResult {
  text: string
  source: 'gemini' | 'template'
  note: string | null // why the template was used, shown in the UI
}

const MIN_SECONDS = 10 // shorter measurements are not worth sending

function spoken(sec: number) {
  if (sec < 90) return `${Math.round(sec)} seconds`
  if (sec < 5400) return `${Math.round(sec / 60)} minutes`
  return `${(sec / 3600).toFixed(1)} hours`
}

function trendPhrase(first: number, second: number) {
  const a = Math.round(first)
  const b = Math.round(second)
  if (Math.abs(second - first) < Math.max(1, first * 0.15)) return `Your rate stayed about the same between the first and second half of the session (${a} then ${b} a minute).`
  return `Your rate ${second < first ? 'dropped' : 'rose'} from ${a} to ${b} a minute between the first and second half of the session.`
}

function templateSummary(r: MeasureResult): string {
  const band = bandFor(r.blinksPerMinute)
  const first = `Over ${spoken(r.seconds)} you blinked about ${Math.round(r.blinksPerMinute)} times a minute, which is in the ${band} band against the reference ranges in this app.`
  const trend = trendOf(r.timeline)
  const second =
    r.seconds < SHORT_SESSION_SEC
      ? 'This session was too short to say much, so treat it as a snapshot.'
      : band === 'low'
        ? 'Blinking less than usual at a screen may leave eyes feeling dry or tired.'
        : 'One session is only a snapshot.'
  const tip = 'Looking away from the screen now and then, and blinking fully, may help.'
  return [first, trend ? trendPhrase(trend.first, trend.second) : null, second, tip].filter(Boolean).join(' ')
}

export async function fetchSummary(r: MeasureResult): Promise<SummaryResult> {
  const fallback = (note: string): SummaryResult => ({ text: templateSummary(r), source: 'template', note })
  if (r.seconds < MIN_SECONDS) return fallback('Measurement too short to send.')

  try {
    const res = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blinksPerMinute: r.blinksPerMinute,
        incompletePct: r.incompletePct,
        seconds: r.seconds,
        shortSession: r.seconds < SHORT_SESSION_SEC,
        trend: trendOf(r.timeline),
        band: bandFor(r.blinksPerMinute),
        screenRange: [SCREEN_RANGE.min, SCREEN_RANGE.max],
        relaxedRange: [RELAXED_RANGE.min, RELAXED_RANGE.max],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || typeof data?.text !== 'string') return fallback(data?.error ?? `The API server did not answer (status ${res.status})`)
    return { text: data.text, source: 'gemini', note: null }
  } catch {
    return fallback('Could not reach the server')
  }
}

// ---- Trend explanation: only sent when the person presses "Explain my trend" ----

function trendTemplate(checks: PastCheck[]): string {
  const first = Math.round(checks[0].blinksPerMinute)
  const last = Math.round(checks[checks.length - 1].blinksPerMinute)
  const same = Math.abs(last - first) < Math.max(1, first * 0.15)
  const move = same
    ? `Your blink rate stayed about the same over your last ${checks.length} checks (${first} then ${last} a minute).`
    : `Your blink rate went ${last < first ? 'down' : 'up'} from ${first} to ${last} a minute over your last ${checks.length} checks.`
  const rough = checks.some(isRough)
  return `${move} ${rough ? 'Some checks were short, in demo mode or in poor light, so treat this as a rough guide.' : 'Looking away from the screen now and then, and blinking fully, may help.'}`
}

export async function fetchTrendSummary(checks: PastCheck[]): Promise<SummaryResult> {
  const fallback = (note: string): SummaryResult => ({ text: trendTemplate(checks), source: 'template', note })
  try {
    const res = await fetch('/api/trend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checks: checks.map((c) => ({ blinksPerMinute: c.blinksPerMinute, rough: isRough(c) })), // no dates, no other fields
        screenRange: [SCREEN_RANGE.min, SCREEN_RANGE.max],
        relaxedRange: [RELAXED_RANGE.min, RELAXED_RANGE.max],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || typeof data?.text !== 'string') return fallback(data?.error ?? `The API server did not answer (status ${res.status})`)
    return { text: data.text, source: 'gemini', note: null }
  } catch {
    return fallback('Could not reach the server')
  }
}
