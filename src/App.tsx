import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useEyeTracker } from './useEyeTracker'
import type { ErrorKind, MeasureResult, Snapshot } from './useEyeTracker'
import { BlinkIllustration, OpticianIllustration, PrivacyIllustration } from './Illustrations'
import { CALIBRATION_MS, CLOSED_RATIO, DEMO_MIN_FINISH_SEC, MEASURE_SEC, MIN_FINISH_SEC, PARTIAL_RATIO, SHORT_SESSION_SEC } from './blink'
import type { Segment } from './blink'
import { fetchSummary } from './summary'
import { shareResult } from './share'
import type { SummaryResult } from './summary'
import { RELAXED_RANGE, SCREEN_RANGE, bandFor } from './reference'
import type { Band, Range } from './reference'

const ERROR_COPY: Record<ErrorKind, { title: string; body: string }> = {
  'camera-denied': {
    title: 'Camera blocked.',
    body: 'Eyes Wise Open needs your webcam to count your blinks. Allow camera access in your browser address bar, then try again. Video never leaves this device.',
  },
  'no-camera': {
    title: 'No camera found.',
    body: 'Plug in or enable a webcam, then try again.',
  },
  'camera-failed': {
    title: 'Camera problem.',
    body: 'The camera could not be started. It may be in use by another app.',
  },
  'model-failed': {
    title: "Eye model didn't load.",
    body: 'The face-tracking model failed to load or run. Check your connection and try again.',
  },
}

function clock(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

const DEBUG = new URLSearchParams(window.location.search).has('debug')

type Step = 'intro' | 'check' | 'result'

function InfoCard({
  tone,
  title,
  art,
  children,
}: {
  tone: 'forest' | 'dark' | 'aqua'
  title: string
  art?: ReactNode
  children: ReactNode
}) {
  return (
    <article className={`card card-${tone}`}>
      {art && <div className="card-art">{art}</div>}
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  )
}

function PrivacyBadge() {
  return (
    <span className="privacy-badge">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8,11 V8 a4,4 0 0 1 8,0 V11" />
      </svg>
      Video stays on this device.
    </span>
  )
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="hero">
        <h1>
          Eye check
          <br />
          While you work.
        </h1>
        <div className="hero-actions">
          <button className="pill pill-primary pill-big" onClick={onStart}>
            Start
          </button>
          <PrivacyBadge />
        </div>
      </section>
      <section className="cards">
        <InfoCard tone="forest" title="What is measured" art={<BlinkIllustration />}>
          Blinks per minute, and how many only part-close your eye, while you work. A 10 second calibration comes first. Press Finish
          when you want your result, and keep this window open beside your work.
        </InfoCard>
        <InfoCard tone="dark" title="What is shared" art={<PrivacyIllustration />}>
          Video stays in your browser and is never recorded. Only anonymous numbers go to Gemini for your summary. Sharing with your
          company is optional.
        </InfoCard>
        <InfoCard tone="aqua" title="Not a medical device" art={<OpticianIllustration />}>
          It does not diagnose anything. A low reading is a prompt to see an optician.
        </InfoCard>
      </section>
    </>
  )
}

function ErrorScreen({ error, onRetry, onBack }: { error: NonNullable<Snapshot['error']>; onRetry: () => void; onBack: () => void }) {
  const copy = ERROR_COPY[error.kind]
  return (
    <section className="hero" role="alert">
      <h1>{copy.title}</h1>
      <p className="lede">{copy.body}</p>
      <div className="hero-actions">
        <button className="pill pill-primary pill-big" onClick={onRetry}>
          Try again
        </button>
        <PrivacyBadge />
      </div>
      <button className="link" onClick={onBack}>
        Back to start
      </button>
      <p className="detail">{error.detail}</p>
    </section>
  )
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="banner" role="status">
      {children}
    </div>
  )
}

function Check({
  s,
  videoRef,
  onRecalibrate,
  onFinish,
  onStop,
}: {
  s: Snapshot
  videoRef: RefObject<HTMLVideoElement | null>
  onRecalibrate: () => void
  onFinish: () => void
  onStop: () => void
}) {
  const loading = s.phase === 'loading'
  const calibrating = s.phase === 'calibrating'
  const secondsLeft = Math.ceil((1 - s.calibration) * (CALIBRATION_MS / 1000))

  return (
    <section className="check">
      <div className="controls">
        <button className="pill pill-primary" onClick={onStop}>
          Stop
        </button>
        <button className="pill pill-secondary" onClick={onRecalibrate} disabled={loading}>
          Recalibrate
        </button>
        <PrivacyBadge />
      </div>

      <div className="banners">
        {s.noFace && <Banner>We can't see your face. The measurement is paused until you are back in view.</Banner>}
        {s.lowLight && <Banner>Too dark for reliable tracking. Add light in front of you.</Banner>}
        {s.hidden && <Banner>This tab was hidden, so counting paused. Keep this window visible beside your work.</Banner>}
      </div>

      <div className={`watch ${calibrating || loading ? '' : 'watch-measuring'}`}>
        <div className="card card-dark preview">
          <video ref={videoRef} muted playsInline />
          <div className="preview-status">
            <span className={`dot ${s.faceVisible ? 'dot-on' : ''}`} />
            {loading ? 'Starting…' : s.faceVisible ? 'Face found' : 'Looking for your face…'}
          </div>
        </div>

        {(loading || calibrating) && (
          <div className="card card-aqua">
            <h3>Calibrating</h3>
            <p>Look at the screen and blink naturally. If you change between glasses on and off, press Recalibrate.</p>
            <div className="bar" role="progressbar" aria-label="Calibration progress" aria-valuenow={Math.round(s.calibration * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${s.calibration * 100}%` }} />
            </div>
            {!loading && <p>{s.calibration > 0 ? `${secondsLeft}s` : 'Waiting for your face…'}</p>}
            {s.calibrationNote && <p className="note">{s.calibrationNote}</p>}
          </div>
        )}

        {s.phase === 'tracking' && (
          <div className="card card-pale">
            <h3>Measuring while you work</h3>
            <p>Carry on with your work and keep this window visible beside it.</p>
            <p className="timer">{s.measuring ? `${clock(s.measureElapsedSec)} measured` : 'Starting…'}</p>
            <button className="pill pill-primary" onClick={onFinish} disabled={!s.canFinish}>
              {s.canFinish ? 'Finish and see result' : s.measuring ? `Finish unlocks in ${s.finishInSec}s` : 'Finish and see result'}
            </button>
          </div>
        )}
      </div>

      {DEBUG && s.phase === 'tracking' && s.baseline !== null && s.ear !== null && (
        <p className="detail">
          EAR {s.ear.toFixed(3)} · baseline {s.baseline.toFixed(3)} · complete below {(s.baseline * CLOSED_RATIO).toFixed(3)} · partial below{' '}
          {(s.baseline * PARTIAL_RATIO).toFixed(3)}
        </p>
      )}
    </section>
  )
}

// One horizontal bar: the person's rate against the two reference bands.
function ComparisonChart({ rate }: { rate: number }) {
  const max = Math.max(30, Math.ceil(rate / 10) * 10)
  const at = (v: number) => `${(Math.min(v, max) / max) * 100}%`
  const band = (r: Range) => ({ left: at(r.min), width: `${((r.max - r.min) / max) * 100}%` })
  const ticks = Array.from({ length: max / 10 + 1 }, (_, i) => i * 10)

  return (
    <figure className="chart">
      <div className="chart-track" role="img" aria-label={`Your rate is ${rate.toFixed(1)} blinks per minute. ${SCREEN_RANGE.label} is ${SCREEN_RANGE.min} to ${SCREEN_RANGE.max}. ${RELAXED_RANGE.label} is ${RELAXED_RANGE.min} to ${RELAXED_RANGE.max}.`}>
        <div className="chart-band chart-screen" style={band(SCREEN_RANGE)} />
        <div className="chart-band chart-relaxed" style={band(RELAXED_RANGE)} />
        <div className="chart-marker" style={{ left: at(rate) }}>
          <span>You: {rate.toFixed(1)}</span>
        </div>
      </div>
      <div className="chart-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: at(t) }}>
            {t}
          </span>
        ))}
      </div>
      <figcaption>
        <span className="legend">
          <i className="chart-screen" />
          {SCREEN_RANGE.label}: {SCREEN_RANGE.min} to {SCREEN_RANGE.max} ({SCREEN_RANGE.cite})
        </span>
        <span className="legend">
          <i className="chart-relaxed" />
          {RELAXED_RANGE.label}: {RELAXED_RANGE.min} to {RELAXED_RANGE.max} ({RELAXED_RANGE.cite})
        </span>
      </figcaption>
    </figure>
  )
}

function minutesLabel(sec: number) {
  return sec < 3600 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`
}

// Blink rate in each part of the session as bars, over the two reference bands.
function SessionChart({ timeline }: { timeline: Segment[] }) {
  const W = 480
  const H = 220
  const L = 30
  const R = 8
  const T = 12
  const B = 30
  const total = timeline[timeline.length - 1].endSec
  const top = Math.max(20, Math.ceil(Math.max(...timeline.map((s) => s.rate)) / 5) * 5)
  const x = (sec: number) => L + (sec / total) * (W - L - R)
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const band = (r: Range, fill: string) => <rect x={L} width={W - L - R} y={y(r.max)} height={y(r.min) - y(r.max)} fill={fill} />
  const yTicks = Array.from({ length: Math.floor(top / 10) + 1 }, (_, i) => i * 10)
  const first = Math.round(timeline[0].rate)
  const last = Math.round(timeline[timeline.length - 1].rate)

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="session-chart"
        role="img"
        aria-label={`Blinks per minute across ${timeline.length} parts of the session, ${first} in the first part and ${last} in the last`}
      >
        {band(SCREEN_RANGE, '#a0e870')}
        {band(RELAXED_RANGE, '#a0e1e1')}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(22,51,0,0.25)" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="13" fill="#163300">
              {t}
            </text>
          </g>
        ))}
        {timeline.map((s) => {
          const gap = 4
          const bx = x(s.startSec) + gap
          return <rect key={s.startSec} x={bx} width={Math.max(2, x(s.endSec) - x(s.startSec) - gap * 2)} y={y(s.rate)} height={y(0) - y(s.rate)} fill="#163300" />
        })}
        {[0, total / 2, total].map((sec, i) => (
          <text key={sec} x={x(sec)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize="13" fill="#163300">
            {sec === 0 ? '0' : minutesLabel(sec)}
          </text>
        ))}
      </svg>
      <figcaption>
        <span className="legend">
          <i className="chart-screen" />
          {SCREEN_RANGE.label}: {SCREEN_RANGE.min} to {SCREEN_RANGE.max}
        </span>
        <span className="legend">
          <i className="chart-relaxed" />
          {RELAXED_RANGE.label}: {RELAXED_RANGE.min} to {RELAXED_RANGE.max}
        </span>
      </figcaption>
    </figure>
  )
}

const BAND_LABEL: Record<Band, string> = { low: 'Low', typical: 'Typical', high: 'High' }

// Opt-in and off by default: nothing is sent until the button is pressed.
function ShareCard({ r }: { r: MeasureResult }) {
  // The code is typed in. A link ending in ?org=CODE only pre-fills it, and it can still be changed.
  const [org, setOrg] = useState(() => (new URLSearchParams(window.location.search).get('org') ?? '').trim().toUpperCase())
  const [state, setState] = useState<{ status: 'idle' | 'sending' | 'done' | 'error'; message?: string }>({ status: 'idle' })

  const send = async () => {
    setState({ status: 'sending' })
    const res = await shareResult(org.trim(), r)
    setState(res.ok ? { status: 'done' } : { status: 'error', message: res.error })
  }

  return (
    <div className="card card-dark" aria-live="polite">
      <h3>Share with your company</h3>
      {state.status === 'done' ? (
        <p>Shared. Thank you. Your name was never part of it.</p>
      ) : (
        <>
          <p>Optional. Sends your rate, partial-blink share and band with a company code. No name, no account, and it can't be taken back.</p>
          <div className="share-row">
            <label className="field">
              Company code
              <input value={org} onChange={(e) => setOrg(e.target.value.toUpperCase())} maxLength={32} autoComplete="off" spellCheck={false} />
            </label>
            <button className="pill pill-secondary" onClick={send} disabled={state.status === 'sending' || org.trim().length < 2}>
              {state.status === 'sending' ? 'Sending…' : 'Share result'}
            </button>
          </div>
          {state.status === 'error' && <p className="note">{state.message}</p>}
        </>
      )}
    </div>
  )
}

function Result({ r, summary, onAgain, onBack }: { r: MeasureResult; summary: SummaryResult | null; onAgain: () => void; onBack: () => void }) {
  const noReading = r.blinks === 0
  const band = bandFor(r.blinksPerMinute)

  return (
    <section className="hero result">
      {noReading ? (
        <>
          <h1>No reading.</h1>
          <div className="card card-aqua">
            <p>
              No blinks were detected. That is more likely a tracking problem than a real result, so no band is shown. Try again with more light
              on your face, or press Recalibrate if you changed glasses.
            </p>
          </div>
        </>
      ) : (
        <>
          <h1>Your result.</h1>

          {r.seconds < SHORT_SESSION_SEC && (
            <p className="note">
              This ran for only {r.seconds < 90 ? `${Math.round(r.seconds)} seconds` : `${Math.round(r.seconds / 60)} minutes`}, which is too short to judge. Treat it as a
              demo of the flow, not a reading.
            </p>
          )}

          <div className="result-cols">
          <div className="col">
          <div className="result-grid">
            <div className="card card-dark">
              <h3>Blinks per minute</h3>
              <div className="big">{Math.round(r.blinksPerMinute)}</div>
              <p className="band">{BAND_LABEL[band]} band</p>
            </div>
            <div className="card card-aqua">
              <h3>Incomplete blinks</h3>
              <div className="big">{r.incompletePct === null ? '--' : `${Math.round(r.incompletePct)}%`}</div>
            </div>
          </div>

          <div className="card card-pale">
            <h3>Against typical ranges</h3>
            <ComparisonChart rate={r.blinksPerMinute} />
          </div>

          {r.timeline.length >= 2 && (
            <div className="card card-pale">
              <h3>Through the session</h3>
              <SessionChart timeline={r.timeline} />
            </div>
          )}
          </div>

          <div className="col">

          <div className="card card-forest" aria-live="polite">
            <h3>Your summary</h3>
            <p className="summary-text">{summary === null ? 'Writing your summary…' : summary.text}</p>
            {band === 'low' && <p className="callout">Worth discussing with an optician.</p>}
            {summary && (
              <p className="fineprint">
                {summary.source === 'gemini' ? 'Written by Gemini.' : `Template summary, not written by Gemini${summary.note ? `: ${summary.note}` : ''}.`} Not a
                medical device, and it does not check your vision. Eye pain or changed sight: see an optician.
              </p>
            )}
          </div>

          <ShareCard r={r} />
          </div>
          </div>

          {r.lowLight && <p className="note">The image was dark for part of this check, so the reading may be less reliable. Try again with more light on your face.</p>}
        </>
      )}
      <div className="hero-actions">
        <button className="pill pill-primary pill-big" onClick={onAgain}>
          Measure again
        </button>
        <PrivacyBadge />
      </div>
      <button className="link" onClick={onBack}>
        Back to start
      </button>
    </section>
  )
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [demo, setDemo] = useState(false)
  const [step, setStep] = useState<Step>('intro')
  const [result, setResult] = useState<MeasureResult | null>(null)
  const [summary, setSummary] = useState<SummaryResult | null>(null)
  const handled = useRef<MeasureResult | null>(null) // the result we already reacted to (effects can fire twice in dev)
  const { snap: s, start, stop, measure, finishEarly, recalibrate } = useEyeTracker(videoRef)
  const minFinishSec = demo ? DEMO_MIN_FINISH_SEC : MIN_FINISH_SEC

  // Once calibration is done, measure. If the user recalibrates, the measurement is dropped and
  // this runs again when the new calibration finishes.
  useEffect(() => {
    if (step !== 'check' || s.phase !== 'tracking') return
    measure(MEASURE_SEC, minFinishSec).then((r) => {
      if (!r || handled.current === r) return
      handled.current = r
      stop() // camera off as soon as the measurement is done
      setResult(r)
      setSummary(null)
      setStep('result')
      if (r.blinks > 0) fetchSummary(r).then((res) => handled.current === r && setSummary(res))
    })
  }, [step, s.phase, measure, minFinishSec, stop])

  const begin = () => {
    handled.current = null
    setResult(null)
    setSummary(null)
    setStep('check')
    start()
  }

  const home = () => {
    stop()
    handled.current = null
    setResult(null)
    setSummary(null)
    setStep('intro')
  }

  return (
    <>
      <header className="topbar">
        <img className="logo" src="/logo/logo-horizontal.svg" alt="Eyes Wise Open" />
        <button className="pill pill-secondary" onClick={() => setDemo(!demo)} disabled={step === 'check'} aria-pressed={demo}>
          Demo mode: {demo ? 'on' : 'off'}
        </button>
      </header>

      <main>
        {step === 'intro' && <Intro onStart={begin} />}
        {step === 'check' &&
          (s.phase === 'error' && s.error ? (
            <ErrorScreen error={s.error} onRetry={start} onBack={home} />
          ) : (
            <Check s={s} videoRef={videoRef} onRecalibrate={recalibrate} onFinish={finishEarly} onStop={home} />
          ))}
        {step === 'result' && result && <Result r={result} summary={summary} onAgain={begin} onBack={home} />}
      </main>
    </>
  )
}
