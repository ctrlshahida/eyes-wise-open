import { useEffect, useState } from 'react'
import { ComparisonChart } from './charts'

// Employer view: group numbers only. The server never sends an individual result, and sends nothing
// until at least 5 responses are behind it.

interface Aggregate {
  org: string
  enough: true
  includesSample: boolean
  realIncluded: boolean // real responses only join the numbers once there are at least 5 of them
  realCount: number | null
  sampleCount: number
  count: number
  avgRate: number
  avgIncompletePct: number | null
  lowShare: number
  bands: { low: number; typical: number; high: number }
}
type Reply = Aggregate | { org: string; enough: false; needed: number }

// Where the recommended action changes. The AI's choice, not from a source.
const LOW_SHARE_HIGH = 40
const LOW_SHARE_MID = 20

function recommend(lowShare: number) {
  if (lowShare >= LOW_SHARE_HIGH) {
    return 'A large share of the team blinks less than usual at a screen. Offer eye tests as a benefit and build short screen breaks into the working day.'
  }
  if (lowShare >= LOW_SHARE_MID) {
    return 'A noticeable share of the team is in the low band. Make eye tests easy to book and encourage regular breaks away from the screen.'
  }
  return 'Few people are in the low band. Keep eye tests available and run the check again next quarter.'
}

const WORKING_DAYS_PER_MONTH = 21

export default function Employer() {
  const [orgInput, setOrgInput] = useState(() => (new URLSearchParams(window.location.search).get('org') ?? '').toUpperCase())
  const [org, setOrg] = useState(orgInput)
  const [includeSample, setIncludeSample] = useState(true)
  const [data, setData] = useState<Reply | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState(1000)
  const [minutes, setMinutes] = useState(10)

  // Load on change and refresh every 5 seconds, so a response shared on another screen shows up.
  useEffect(() => {
    if (org.trim().length < 2) return
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/aggregate?org=${encodeURIComponent(org)}&sample=${includeSample ? 1 : 0}`, { signal: AbortSignal.timeout(8000) })
        const body = await res.json().catch(() => null)
        if (!alive) return
        if (!res.ok) {
          setError(body?.error ?? `The API server did not answer (status ${res.status})`)
          return
        }
        setError(null)
        setData(body as Reply)
      } catch {
        if (alive) setError('Could not reach the server')
      }
    }
    load()
    const id = setInterval(load, 5000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [org, includeSample])

  const shown = data && data.org === org.trim().toUpperCase() ? data : null
  const affected = shown?.enough ? Math.round((employees * shown.lowShare) / 100) : 0
  const hoursPerMonth = Math.round((affected * minutes * WORKING_DAYS_PER_MONTH) / 60)

  return (
    <section className="hero result">
      <h1>Team results.</h1>

      <div className="card card-pale">
        <div className="share-row">
          <label className="field">
            Company code
            <input value={orgInput} onChange={(e) => setOrgInput(e.target.value.toUpperCase())} maxLength={32} autoComplete="off" spellCheck={false} />
          </label>
          <button className="pill pill-primary" onClick={() => setOrg(orgInput.trim())} disabled={orgInput.trim().length < 2}>
            Show results
          </button>
        </div>
        <label className="tick">
          <input type="checkbox" checked={includeSample} onChange={(e) => setIncludeSample(e.target.checked)} />
          Include sample data
        </label>
      </div>

      {error && <p className="note">{error}</p>}
      {org.trim().length < 2 && <p className="note">Enter a company code to see its results.</p>}

      {shown && !shown.enough && (
        <div className="card card-aqua">
          <h3>Not enough responses yet.</h3>
          <p>Results appear once at least {shown.needed} people have shared.</p>
        </div>
      )}

      {shown?.enough && (
        <>
          {shown.includesSample && (
            <p className="note">
              Sample data: {shown.sampleCount} invented responses are included so this view has something to show.
              {!shown.realIncluded && ' Real responses join the numbers once at least 5 people have shared.'}
            </p>
          )}

          <div className="stat-grid">
            <div className="card card-dark">
              <h3>People assessed</h3>
              <div className="big">{shown.count}</div>
              <p className="band">
                {shown.realIncluded ? `${shown.realCount} real` : '0 real counted yet'}
                {shown.includesSample ? `, ${shown.sampleCount} sample` : ''}
              </p>
            </div>
            <div className="card card-aqua">
              <h3>In the low band</h3>
              <div className="big">{Math.round(shown.lowShare)}%</div>
            </div>
            <div className="card card-aqua">
              <h3>Incomplete blinks</h3>
              <div className="big">{shown.avgIncompletePct === null ? '--' : `${Math.round(shown.avgIncompletePct)}%`}</div>
            </div>
          </div>

          <div className="card card-pale">
            <h3>Average rate on the reference bands</h3>
            <ComparisonChart rate={shown.avgRate} label="Average" />
          </div>

          <div className="card card-pale">
            <h3>Where people fall</h3>
            <div className="bandbar" role="img" aria-label={`${shown.bands.low} low, ${shown.bands.typical} typical, ${shown.bands.high} high`}>
              <div style={{ flex: shown.bands.low, background: '#202020' }} />
              <div style={{ flex: shown.bands.typical, background: '#a0e1e1' }} />
              <div style={{ flex: shown.bands.high, background: '#a0e870' }} />
            </div>
            <figcaption className="bandkey">
              <span className="legend">
                <i style={{ background: '#202020' }} />
                Low: {shown.bands.low}
              </span>
              <span className="legend">
                <i style={{ background: '#a0e1e1', border: '2px solid #202020' }} />
                Typical: {shown.bands.typical}
              </span>
              <span className="legend">
                <i style={{ background: '#a0e870', border: '2px solid #202020' }} />
                High: {shown.bands.high}
              </span>
            </figcaption>
          </div>

          <div className="card card-forest">
            <h3>Recommended action</h3>
            <p className="summary-text">{recommend(shown.lowShare)}</p>
          </div>

          <div className="card card-pale">
            <h3>At your scale</h3>
            <div className="share-row">
              <label className="field">
                Assumed employees
                <input type="number" min={1} value={employees} onChange={(e) => setEmployees(Math.max(1, Number(e.target.value) || 1))} />
              </label>
              <label className="field">
                Assumed minutes lost per person per day
                <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(Math.max(0, Number(e.target.value) || 0))} />
              </label>
            </div>
          </div>

          <div className="result-grid">
            <div className="card card-dark">
              <h3>People in the low band</h3>
              <div className="big">{affected.toLocaleString()}</div>
            </div>
            <div className="card card-aqua">
              <h3>Hours a month at your assumptions</h3>
              <div className="big">{hoursPerMonth.toLocaleString()}</div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
