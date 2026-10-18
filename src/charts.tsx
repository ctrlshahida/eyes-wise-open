import type { Segment } from './blink'
import { RELAXED_RANGE, SCREEN_RANGE } from './reference'
import type { Range } from './reference'
import { isRough } from './history'
import type { PastCheck } from './history'

// One horizontal bar: the person's rate against the two reference bands.
export function ComparisonChart({ rate, label = 'You' }: { rate: number; label?: string }) {
  const max = Math.max(30, Math.ceil(rate / 10) * 10)
  const at = (v: number) => `${(Math.min(v, max) / max) * 100}%`
  const band = (r: Range) => ({ left: at(r.min), width: `${((r.max - r.min) / max) * 100}%` })
  const ticks = Array.from({ length: max / 10 + 1 }, (_, i) => i * 10)

  return (
    <figure className="chart">
      <div className="chart-track" role="img" aria-label={`${label === 'You' ? 'Your rate' : 'The average'} is ${rate.toFixed(1)} blinks per minute. ${SCREEN_RANGE.label} is ${SCREEN_RANGE.min} to ${SCREEN_RANGE.max}. ${RELAXED_RANGE.label} is ${RELAXED_RANGE.min} to ${RELAXED_RANGE.max}.`}>
        <div className="chart-band chart-screen" style={band(SCREEN_RANGE)} />
        <div className="chart-band chart-relaxed" style={band(RELAXED_RANGE)} />
        <div className="chart-marker" style={{ left: at(rate) }}>
          <span>{label}: {rate.toFixed(1)}</span>
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
export function SessionChart({ timeline }: { timeline: Segment[] }) {
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


function dayLabel(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// Blink rate of the last few checks, oldest on the left, over the two reference bands.
// Solid dots are full readings; hollow dots were short, demo or low-light checks and are only a rough guide.
export function TrendChart({ checks }: { checks: PastCheck[] }) {
  const W = 360
  const H = 230
  const L = 28
  const R = 12
  const T = 26
  const B = 44
  const top = Math.max(20, Math.ceil(Math.max(...checks.map((c) => c.blinksPerMinute)) / 10) * 10)
  const x = (i: number) => (checks.length === 1 ? (L + W - R) / 2 : L + 14 + (i / (checks.length - 1)) * (W - L - R - 28))
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const band = (r: Range, fill: string) => <rect x={L} width={W - L - R} y={y(r.max)} height={y(r.min) - y(r.max)} fill={fill} />
  const yTicks = Array.from({ length: Math.floor(top / 10) + 1 }, (_, i) => i * 10)
  const anyRough = checks.some(isRough)
  const described = checks
    .map((c) => `${dayLabel(c.at)} ${timeLabel(c.at)}: ${Math.round(c.blinksPerMinute)}${isRough(c) ? ' (rough)' : ''}`)
    .join('; ')

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="session-chart trend-chart" role="img" aria-label={`Blinks per minute in your last ${checks.length} checks, oldest first. ${described}.`}>
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
        <polyline points={checks.map((c, i) => `${x(i)},${y(c.blinksPerMinute)}`).join(' ')} fill="none" stroke="#163300" strokeWidth="3" strokeLinejoin="round" />
        {checks.map((c, i) => (
          <g key={c.at}>
            <circle cx={x(i)} cy={y(c.blinksPerMinute)} r="7" fill={isRough(c) ? '#ffffff' : '#163300'} stroke="#163300" strokeWidth="3" />
            <text x={x(i)} y={y(c.blinksPerMinute) - 13} textAnchor="middle" fontSize="17" fontWeight="700" fill="#163300">
              {Math.round(c.blinksPerMinute)}
            </text>
            <text x={x(i)} y={H - 24} textAnchor="middle" fontSize="15" fill="#163300">
              {dayLabel(c.at)}
            </text>
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="14" fill="#163300">
              {timeLabel(c.at)}
            </text>
          </g>
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
        {anyRough && (
          <span className="legend">
            <i className="legend-hollow" />
            Hollow dot: under 2 minutes, demo mode or poor light, so only a rough guide
          </span>
        )}
      </figcaption>
    </figure>
  )
}
