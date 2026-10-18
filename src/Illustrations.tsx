import type { ReactNode } from 'react'

// Flat outlined illustrations: thick round-joined strokes, looping CSS animation (see .illo-* in index.css).

const INK = '#202020'
const CREAM = '#FBF6EA'
const FOREST = '#163300'
const LIME = '#A0E870'
const AQUA = '#A0E1E1'
const RED = '#7F1D2A'
const ORANGE = '#F25533' // approximates incident.io's orange, used only on the agent drawing

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 480 300" className="illo" role="img" aria-label={label}>
      <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  )
}

// An eye that blinks fully, then only part of the way: complete vs incomplete.
export function BlinkIllustration() {
  const eye = 'M50,150 C130,62 350,62 430,150 C350,238 130,238 50,150 Z'
  return (
    <Frame label="An eye blinking fully, then blinking only part of the way">
      <defs>
        <clipPath id="illo-eye-clip">
          <path d={eye} />
        </clipPath>
      </defs>
      <path d={eye} fill={CREAM} strokeWidth="4" />
      <g clipPath="url(#illo-eye-clip)">
        <circle cx="240" cy="150" r="56" fill={FOREST} strokeWidth="4" />
        <circle cx="240" cy="150" r="22" fill={INK} stroke="none" />
        {/* a monitor reflected in the eye */}
        <rect x="262" y="116" width="24" height="15" rx="3" fill={CREAM} stroke="none" />
        <g className="illo-lid">
          <rect x="30" y="-140" width="420" height="370" fill={LIME} strokeWidth="4" />
        </g>
      </g>
      <path className="illo-closed" d="M50,150 C150,200 330,200 430,150" fill="none" strokeWidth="4" />
      <path d={eye} fill="none" strokeWidth="4" />
    </Frame>
  )
}

const CHART_ROWS = [
  { text: 'E', size: 64, y: 96 },
  { text: 'F P', size: 46, y: 148 },
  { text: 'T O Z', size: 34, y: 192 },
  { text: 'L P E D', size: 26, y: 228 },
]

// An optician's eye chart with a highlight stepping down the rows: a low reading is a prompt to see one.
export function OpticianIllustration() {
  return (
    <Frame label="An optician's eye chart with the rows being read from the largest letters to the smallest">
      <rect x="150" y="28" width="180" height="228" rx="8" fill="#fff" strokeWidth="4" />
      {CHART_ROWS.map((row, i) => (
        <g key={row.text}>
          <text
            x="240"
            y={row.y}
            textAnchor="middle"
            fontSize={row.size}
            fill={INK}
            stroke="none"
            fontFamily="'Anton', Impact, sans-serif"
            letterSpacing="0.08em"
          >
            {row.text}
          </text>
          <rect
            className="illo-row"
            style={{ animationDelay: `${i * 1.6}s` }}
            x="162"
            y={row.y - row.size * 0.95}
            width="156"
            height={row.size * 1.2}
            rx="6"
            fill="none"
            stroke={RED}
            strokeWidth="3.5"
            strokeDasharray="8 8"
          />
        </g>
      ))}
      <path d="M20,268 H460" strokeWidth="5" fill="none" />
      <path d="M210,256 V268 M270,256 V268" strokeWidth="5" fill="none" />
    </Frame>
  )
}

// The team agent's flame: two layers that flicker slowly, with embers that rise and fade. Drawn from scratch.
export function FlameIllustration() {
  return (
    <svg viewBox="0 0 160 170" className="flame" aria-hidden="true" focusable="false">
      <circle className="ember ember-1" cx="26" cy="52" r="4" fill={ORANGE} />
      <circle className="ember ember-2" cx="138" cy="62" r="3.5" fill={ORANGE} />
      <circle className="ember ember-3" cx="80" cy="26" r="3" fill="#ffb199" />
      <path
        className="flame-outer"
        d="M80,10 C88,42 142,62 142,110 C142,146 116,166 80,166 C44,166 18,146 18,110 C18,84 36,70 50,52 C54,66 62,72 70,66 C80,58 76,34 80,10 Z"
        fill={ORANGE}
      />
      <path
        className="flame-inner"
        d="M80,88 C86,106 116,114 116,136 C116,154 100,162 80,162 C60,162 44,154 44,136 C44,116 66,108 72,96 C76,104 80,102 80,88 Z"
        fill="#ffb199"
      />
    </svg>
  )
}

// Video stays on the device: the camera feed is locked in, the way to the cloud is blocked.
export function PrivacyIllustration() {
  return (
    <Frame label="A laptop with a padlock on its screen and a blocked path to the cloud">
      <path d="M20,268 H460" strokeWidth="5" fill="none" />
      <rect x="110" y="64" width="240" height="150" rx="10" fill={FOREST} />
      <rect x="124" y="78" width="212" height="122" rx="4" fill={AQUA} />
      <circle className="illo-pulse" cx="230" cy="71" r="3" fill={RED} stroke="none" />
      <path d="M86,214 H374 L394,246 H66 Z" fill={LIME} />
      <path d="M208,246 H252" strokeWidth="4" fill="none" />

      {/* padlock */}
      <path d="M212,124 v-14 a18,18 0 0 1 36,0 v14" fill="none" strokeWidth="5" />
      <rect x="198" y="124" width="64" height="48" rx="6" fill={LIME} />
      <circle cx="230" cy="144" r="6" fill={INK} stroke="none" />
      <path d="M230,148 V160" strokeWidth="4" fill="none" />

      {/* blocked route to the cloud */}
      <path className="illo-dash" d="M340,132 H384" stroke={RED} fill="none" strokeDasharray="8 10" />
      <path d="M396,168 H448 a16,16 0 0 0 0,-32 a22,22 0 0 0 -42,-6 a18,18 0 0 0 -14,38 Z" fill="none" strokeDasharray="3 8" />
      <path d="M398,114 L446,184 M446,114 L398,184" stroke={RED} strokeWidth="6" fill="none" />
    </Frame>
  )
}
