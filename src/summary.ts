// End-of-session summary. Only these aggregate numbers are ever sent to the server.

export interface SessionStats {
  avgRate: number | null // blinks per minute over the session, null if too short to tell
  incompletePct: number | null // share of blinks that were incomplete, null if no blinks
  screenMin: number // minutes of tracked screen time
  breaks: number
  beliefChanges: number
}

export interface SummaryResult {
  text: string
  source: 'gemini' | 'template'
  note: string | null // why the template was used, shown in the UI
}

const MIN_SCREEN_MIN = 0.5 // shorter sessions are not worth sending

function round(v: number) {
  return Math.round(v)
}

export function templateSummary(s: SessionStats): string {
  if (s.screenMin < MIN_SCREEN_MIN) return 'This session was too short to summarise. Track for a few minutes to get a summary.'
  const parts = [`You spent ${round(s.screenMin)} ${round(s.screenMin) === 1 ? 'minute' : 'minutes'} at the screen and took ${s.breaks} ${s.breaks === 1 ? 'break' : 'breaks'}.`]
  if (s.avgRate !== null) {
    parts.push(
      `You averaged ${round(s.avgRate)} blinks a minute${s.incompletePct !== null ? `, and ${round(s.incompletePct)}% of blinks were incomplete` : ''}.`,
    )
  }
  parts.push('DSE guidance recommends short, regular breaks away from the screen.')
  return parts.join(' ')
}

export async function fetchSummary(s: SessionStats): Promise<SummaryResult> {
  const fallback = (note: string): SummaryResult => ({ text: templateSummary(s), source: 'template', note })
  if (s.screenMin < MIN_SCREEN_MIN) return fallback('Session too short to send.')

  try {
    const r = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await r.json().catch(() => null)
    if (!r.ok || typeof data?.text !== 'string') return fallback(data?.error ?? `Server returned ${r.status}`)
    return { text: data.text, source: 'gemini', note: null }
  } catch {
    return fallback('Could not reach the server')
  }
}
