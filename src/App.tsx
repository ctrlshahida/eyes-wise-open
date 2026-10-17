import { useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useEyeTracker } from './useEyeTracker'
import { BlinkIllustration, DseSetupIllustration, LookAwayIllustration, PrivacyIllustration } from './Illustrations'
import type { ErrorKind, Snapshot } from './useEyeTracker'
import { CALIBRATION_MS, CLOSED_RATIO, PARTIAL_RATIO } from './blink'

const ERROR_COPY: Record<ErrorKind, { title: string; body: string }> = {
  'camera-denied': {
    title: 'Camera blocked.',
    body: 'Eyes Wise Open needs your webcam to watch your blinks. Allow camera access in your browser address bar, then try again. Video never leaves this device.',
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

const DEBUG = new URLSearchParams(window.location.search).has('debug')

function formatTime(sec: number) {
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function InfoCard({ tone, title, art, children }: { tone: 'sage' | 'red'; title: string; art?: ReactNode; children: ReactNode }) {
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
        <rect x="5" y="11" width="14" height="10" />
        <path d="M8,11 V8 a4,4 0 0 1 8,0 V11" />
      </svg>
      Video stays on this device.
    </span>
  )
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="hero">
        <h1>DSE compliance with zero forms.</h1>
        <p className="lede">A break reminder that watches your eyes instead of a timer.</p>
        <div className="hero-actions">
          <button className="pill pill-primary pill-big" onClick={onStart}>
            Allow camera and start
          </button>
          <PrivacyBadge />
        </div>
      </section>
      <section className="cards">
        <InfoCard tone="sage" title="Blinks, not timers" art={<BlinkIllustration />}>
          It learns your normal blink pattern and nudges you when your eyes need a rest.
        </InfoCard>
        <InfoCard tone="sage" title="Video stays here" art={<PrivacyIllustration />}>
          Your webcam feed is processed in your browser. Nothing is recorded or uploaded.
        </InfoCard>
        <InfoCard tone="red" title="Not a medical device" art={<DseSetupIllustration />}>
          It prompts breaks. A full DSE assessment still needs a person.
        </InfoCard>
      </section>
    </>
  )
}

function ErrorScreen({ error, onRetry }: { error: NonNullable<Snapshot['error']>; onRetry: () => void }) {
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

function Dashboard({
  s,
  demo,
  setDemo,
  videoRef,
  onRecalibrate,
  onStop,
}: {
  s: Snapshot
  demo: boolean
  setDemo: (v: boolean) => void
  videoRef: RefObject<HTMLVideoElement | null>
  onRecalibrate: () => void
  onStop: () => void
}) {
  const loading = s.phase === 'loading'
  const calibrating = s.phase === 'calibrating'
  const secondsLeft = Math.ceil((1 - s.calibration) * (CALIBRATION_MS / 1000))

  return (
    <section className="dash">
      <div className="controls">
        <button className="pill pill-primary" onClick={onStop}>
          Stop
        </button>
        <button className="pill pill-secondary" onClick={onRecalibrate} disabled={loading}>
          Recalibrate
        </button>
        <label className="toggle">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span>Demo mode</span>
        </label>
        <PrivacyBadge />
      </div>

      <div className="banners">
        {s.noFace && <Banner>We can't see your face. Blink counting is paused.</Banner>}
        {s.lowLight && <Banner>Too dark for reliable tracking. Add light in front of you.</Banner>}
      </div>

      <div className="card card-sage preview">
        <video ref={videoRef} muted playsInline />
        <div className="preview-status">
          <span className={`dot ${s.faceVisible ? 'dot-on' : ''}`} />
          {loading ? 'Starting…' : s.faceVisible ? 'Face found' : 'Looking for your face…'}
        </div>
      </div>

      {calibrating && (
        <div className="card card-sage">
          <p>Look at the screen and blink naturally.</p>
          <div className="bar" aria-label="Calibration progress">
            <div style={{ width: `${s.calibration * 100}%` }} />
          </div>
          <p>{s.calibration > 0 ? `${secondsLeft}s` : 'Waiting for your face…'}</p>
          {s.calibrationNote && <p className="note">{s.calibrationNote}</p>}
        </div>
      )}

      {s.phase === 'tracking' && (
        <>
          <div className={`card card-sage ${s.underBlinking ? 'rate-low' : ''}`}>
            <div className="big">{s.rate === null ? '--' : Math.round(s.rate)}</div>
            <p>
              {s.noFace ? 'Blinks per minute (paused)' : s.rate === null ? `Blinks per minute · measuring, ${s.warmupSec}s` : 'Blinks per minute'}
            </p>
          </div>
          <div className="stats">
            <div className="card card-sage">
              <div className="big">{s.complete}</div>
              <p>Complete</p>
            </div>
            <div className="card card-sage">
              <div className="big">{s.incomplete}</div>
              <p>Incomplete</p>
            </div>
            <div className="card card-sage">
              <div className="big">{formatTime(s.screenSec)}</div>
              <p>Screen time</p>
            </div>
          </div>
        </>
      )}

      {DEBUG && s.phase === 'tracking' && s.baseline !== null && s.ear !== null && (
        <p className="detail">
          EAR {s.ear.toFixed(3)} · baseline {s.baseline.toFixed(3)} · complete below {(s.baseline * CLOSED_RATIO).toFixed(3)} · partial below{' '}
          {(s.baseline * PARTIAL_RATIO).toFixed(3)}
        </p>
      )}
    </section>
  )
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [demo, setDemo] = useState(false)
  const { snap: s, start, stop, recalibrate, takeBreak, snooze } = useEyeTracker(videoRef, demo)

  const active = s.phase === 'loading' || s.phase === 'calibrating' || s.phase === 'tracking'

  return (
    <>
      <div className="vignette" style={{ opacity: s.vignette }} aria-hidden="true" />

      <header className="topbar">
        <img className="logo" src="/logo/logo-horizontal.svg" alt="Eyes Wise Open" />
      </header>

      <main>
        {s.phase === 'error' && s.error ? (
          <ErrorScreen error={s.error} onRetry={start} />
        ) : active ? (
          <Dashboard s={s} demo={demo} setDemo={setDemo} videoRef={videoRef} onRecalibrate={recalibrate} onStop={stop} />
        ) : (
          <>
            <StartScreen onStart={start} />
            <label className="toggle toggle-center">
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
              <span>Demo mode</span>
            </label>
          </>
        )}
      </main>

      {s.nudge && (
        <div className="nudge" role="alertdialog" aria-labelledby="nudge-title">
          <div className="card card-sage">
            <div className="card-art">
              <LookAwayIllustration />
            </div>
            <h2 id="nudge-title">Time for a break.</h2>
            <p>Look at something 20 feet away for 20 seconds.</p>
            <div className="nudge-actions">
              <button className="pill pill-primary" onClick={takeBreak}>
                I took a break
              </button>
              <button className="pill pill-secondary" onClick={snooze}>
                Remind me later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
