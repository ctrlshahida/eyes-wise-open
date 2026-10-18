// The optional "share my anonymous result" step. The record has no name, account or video:
// company code, blinks per minute, share of partial blinks and the band. The server adds the time.
import type { MeasureResult } from './useEyeTracker'
import { bandFor } from './reference'

export async function shareResult(org: string, r: MeasureResult): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org,
        blinksPerMinute: r.blinksPerMinute,
        incompletePct: r.incompletePct,
        band: bandFor(r.blinksPerMinute),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: data?.error ?? `The API server did not answer (status ${res.status})` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}
