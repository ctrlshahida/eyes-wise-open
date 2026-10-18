import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ComparisonChart } from './charts'
import { CALL_LABEL, PRIORITY_LABEL, createAgent, updateAgent } from './cohortAgent'
import type { AgentState, Priority } from './cohortAgent'

// Employer view: group numbers only. The server never sends an individual result, and sends nothing
// until at least 5 responses are behind it.

interface Aggregate {
  org: string
  enough: true
  includesSample: boolean
  realIncluded: boolean // real responses only join the numbers once there are at least 5 of them
  realCount: number | null
  sampleCount: number
  sampleExtraMax: number
  count: number
  avgRate: number
  avgIncompletePct: number | null
  lowShare: number
  bands: { low: number; typical: number; high: number }
}
type Reply = Aggregate | { org: string; enough: false; needed: number }

// One numbered section of the agent panel: a real heading, so screen readers and keyboard users can jump between them.
function AgentStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = `agent-step-${n}`
  return (
    <section className="agent-step" aria-labelledby={id}>
      <h3 id={id}>
        <span className="step-num" aria-hidden="true">
          {n}
        </span>
        {title}
      </h3>
      <div className="step-body">{children}</div>
    </section>
  )
}

export default function Employer() {
  const [orgInput, setOrgInput] = useState(() => (new URLSearchParams(window.location.search).get('org') ?? '').toUpperCase())
  const [org, setOrg] = useState(orgInput)
  const [includeSample, setIncludeSample] = useState(true)
  const [extra, setExtra] = useState(0) // demo responses added so far
  const [priority, setPriority] = useState<Priority>('headaches')
  const [screenShare, setScreenShare] = useState(100)
  const [agent, setAgent] = useState<AgentState | null>(null)
  const [data, setData] = useState<Reply | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load on change and refresh every 5 seconds, so a response shared on another screen shows up.
  useEffect(() => {
    if (org.trim().length < 2) return
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/aggregate?org=${encodeURIComponent(org)}&sample=${includeSample ? 1 : 0}&extra=${extra}`, { signal: AbortSignal.timeout(8000) })
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
  }, [org, includeSample, extra])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setOrg(orgInput.trim())
  }

  const shown = data && data.org === org.trim().toUpperCase() ? data : null
  // The agent recomputes whenever the numbers, the priority or a correction changes, and keeps its own history.
  useEffect(() => {
    if (!shown?.enough) {
      setAgent(null)
      return
    }
    const input = {
      count: shown.count,
      avgRate: shown.avgRate,
      avgIncompletePct: shown.avgIncompletePct,
      lowShare: shown.lowShare,
      includesSample: shown.includesSample,
      sampleCount: shown.sampleCount,
      realIncluded: shown.realIncluded,
      realCount: shown.realCount,
      priority,
      screenShare,
    }
    setAgent((prev) => (prev ? updateAgent(prev, input) : createAgent(input)))
  }, [shown, priority, screenShare])


  return (
    <section className="hero result">
      <h1>Team results.</h1>

      <div className="card card-pale">
        <form className="share-row" onSubmit={submit}>
          <label className="field">
            Company code
            <input value={orgInput} onChange={(e) => setOrgInput(e.target.value.toUpperCase())} maxLength={32} autoComplete="off" spellCheck={false} />
          </label>
          <button className="pill pill-primary" type="submit" disabled={orgInput.trim().length < 2}>
            Show results
          </button>
        </form>
        <div className="share-row">
          <label className="tick">
            <input type="checkbox" checked={includeSample} onChange={(e) => setIncludeSample(e.target.checked)} />
            Include sample data
          </label>
          <button
            className="pill pill-secondary"
            onClick={() => setExtra((n) => n + 3)}
            disabled={!includeSample || (shown?.enough ? extra >= shown.sampleExtraMax : false)}
          >
            Add 3 sample responses
          </button>
          {extra > 0 && (
            <button className="link" onClick={() => setExtra(0)}>
              Reset
            </button>
          )}
        </div>
      </div>

      {error && <p className="note">{error}</p>}
      {org.trim().length < 2 && <p className="note">Enter your company code to see your team's results.</p>}

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

          {agent && (
            <section className="agent-panel" aria-labelledby="agent-title">
              <div className="agent-top">
                <h2 id="agent-title">Team agent</h2>
                <p>It updates its call as responses come in and when you change what matters. Rules only, no AI model.</p>
              </div>

              <AgentStep n={1} title="My call">
                <p className="agent-call">{CALL_LABEL[agent.call]}</p>
                <div
                  className="meter"
                  role="meter"
                  aria-label="How sure I am"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(agent.confidence * 100)}
                  aria-valuetext={`${Math.round(agent.confidence * 100)} percent sure`}
                >
                  <div style={{ width: `${Math.round(agent.confidence * 100)}%` }} />
                </div>
                <p className="meter-text">{Math.round(agent.confidence * 100)}% sure</p>
                <p className="agent-action">
                  <strong>What I recommend:</strong> {agent.action}
                </p>
              </AgentStep>

              <AgentStep n={2} title="Why">
                <div className="agent-cols">
                  <div>
                    <h4>Supports my call ({agent.evidenceFor.length})</h4>
                    <ul className="plus">
                      {agent.evidenceFor.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Argues against it ({agent.evidenceAgainst.length})</h4>
                    <ul className="minus">
                      {agent.evidenceAgainst.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AgentStep>

              <AgentStep n={3} title="What changed">
                <div className="agent-change" aria-live="polite">
                  {agent.change ? (
                    <>
                      <p className="agent-change-title">I changed my {agent.change.what === 'call' ? 'mind' : agent.change.what === 'action' ? 'advice' : 'confidence'}.</p>
                      <p>
                        <span>Before</span> {agent.change.before}
                      </p>
                      <p>
                        <span>Now</span> {agent.change.now}
                      </p>
                      <p>
                        <span>Why</span> {agent.change.why}
                      </p>
                    </>
                  ) : (
                    <p className="agent-change-title">Nothing yet. Add sample responses, change the priority or correct the roles, and I will show what moved.</p>
                  )}
                </div>
                {agent.log.length > 1 && (
                  <>
                    <h4>Earlier</h4>
                    <ol className="timeline">
                      {agent.log.slice(1).map((e) => (
                        <li key={e.id}>
                          {e.change.before.replace(/\.$/, '')} to {e.change.now.replace(/\.$/, '')}. {e.change.why}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </AgentStep>

              <AgentStep n={4} title="Tell me what matters">
                <fieldset className="segmented">
                  <legend>Priority</legend>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <label key={p}>
                      <input type="radio" name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} />
                      <span>{PRIORITY_LABEL[p]}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="field range">
                  <span>
                    Roles that are screen-based: <output>{screenShare}%</output>
                  </span>
                  <input type="range" min={0} max={100} step={5} value={screenShare} onChange={(e) => setScreenShare(Number(e.target.value))} />
                </label>
              </AgentStep>
            </section>
          )}
        </>
      )}
    </section>
  )
}
