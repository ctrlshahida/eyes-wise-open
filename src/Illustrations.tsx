import type { ReactNode } from 'react'

// Flat outlined illustrations, drawn in the same style as the Node Foundation ones:
// thick round-joined strokes, cream skin, looping CSS animation (see .illo-* in index.css).
// They show DSE factors. Only the blink one is something the app measures.

const INK = '#202020'
const CREAM = '#FBF6EA'
const FOREST = '#163300'
const GREEN = '#B6DBA0'
const SOFT = '#DCEBCF'
const RED = '#7F1D2A'

// Desk, chair and a seated figure facing right, without the head.
function Workstation() {
  return (
    <>
      {/* chair */}
      <rect x="102" y="240" width="8" height="26" fill={INK} />
      <path d="M68,268 H144" strokeWidth="5" fill="none" />
      <rect x="58" y="150" width="14" height="82" rx="7" fill={RED} />
      <rect x="68" y="228" width="88" height="12" rx="5" fill={RED} />

      {/* desk legs */}
      <rect x="50" y="204" width="8" height="62" fill={FOREST} />
      <rect x="246" y="204" width="8" height="62" fill={FOREST} />

      {/* person: neck, torso, legs */}
      <rect x="119" y="134" width="12" height="24" fill={CREAM} />
      <path d="M84,226 C80,192 88,164 114,154 L138,160 C134,184 132,206 140,226 Z" fill={GREEN} />
      <rect x="84" y="212" width="80" height="16" rx="8" fill={INK} />
      <rect x="152" y="222" width="18" height="44" rx="9" fill={INK} />
      <rect x="148" y="258" width="36" height="10" rx="5" fill={CREAM} />

      {/* desk top, keyboard, arm */}
      <rect x="40" y="194" width="224" height="10" fill={FOREST} />
      <rect x="150" y="186" width="62" height="8" rx="3" fill={CREAM} />
      <path d="M122,162 L130,190 L174,184" stroke={INK} strokeWidth="17" fill="none" />
      <path d="M122,162 L130,190 L174,184" stroke={GREEN} strokeWidth="10" fill="none" />
      <circle cx="178" cy="182" r="8" fill={CREAM} />

      {/* monitor, side on, screen facing the person */}
      <rect x="214" y="176" width="8" height="18" fill={INK} />
      <rect x="200" y="188" width="38" height="6" rx="3" fill={INK} />
      <rect x="210" y="116" width="14" height="62" rx="5" fill={CREAM} />
      <rect x="212" y="120" width="4" height="54" fill={SOFT} stroke="none" />
    </>
  )
}

function Head({ className }: { className?: string }) {
  return (
    <g className={className}>
      <ellipse cx="126" cy="116" rx="22" ry="25" fill={CREAM} />
      <path d="M102,120 C96,80 138,72 149,102 C138,94 122,98 112,124 C108,124 104,122 102,120 Z" fill={INK} />
      <path d="M147,114 q8,5 0,9" fill="none" strokeWidth="3" />
      <circle cx="138" cy="112" r="2.6" fill={INK} stroke="none" />
    </g>
  )
}

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
          <rect x="30" y="-140" width="420" height="370" fill={GREEN} strokeWidth="4" />
        </g>
      </g>
      <path className="illo-closed" d="M50,150 C150,200 330,200 430,150" fill="none" strokeWidth="4" />
      <path d={eye} fill="none" strokeWidth="4" />
    </Frame>
  )
}

// Looking past the screen at something far away (the break advice).
export function LookAwayIllustration() {
  return (
    <Frame label="A person at a desk looking past their monitor at a tree out of the window, 20 feet away">
      <path d="M20,268 H460" strokeWidth="5" fill="none" />

      {/* window with a tree */}
      <rect x="380" y="64" width="84" height="120" fill={SOFT} />
      <path d="M422,64 V184 M380,124 H464" fill="none" strokeWidth="3" />
      <g className="illo-tree">
        <rect x="418" y="140" width="8" height="44" fill={INK} />
        <circle cx="422" cy="122" r="26" fill={GREEN} />
      </g>
      <rect x="380" y="64" width="84" height="120" fill="none" />

      <Workstation />
      <Head className="illo-head" />

      <path className="illo-gaze-line" d="M146,112 L374,100" stroke={RED} fill="none" strokeDasharray="8 10" />
      <text
        className="illo-gaze-text"
        x="262"
        y="88"
        textAnchor="middle"
        fontSize="24"
        fontWeight="500"
        fill={INK}
        stroke="none"
        fontFamily="'Oswald', 'Arial Narrow', sans-serif"
      >
        20 ft
      </text>
    </Frame>
  )
}

const CHECKS = ["Arm's length", 'Eye level', 'Elbows at 90°', 'Feet flat']

// The parts of a DSE setup that a webcam cannot judge.
export function DseSetupIllustration() {
  return (
    <Frame label="A person at a desk with their screen at arm's length and eye level, elbows at 90 degrees and feet flat, beside a checklist">
      <path d="M20,268 H460" strokeWidth="5" fill="none" />
      <Workstation />
      <Head />

      {/* eye level */}
      <path className="illo-dash" d="M146,112 H234" stroke={RED} strokeWidth="3" fill="none" strokeDasharray="8 10" />
      {/* distance to screen */}
      <g stroke={RED} strokeWidth="3" fill="none">
        <path d="M150,92 H208 M158,86 L150,92 L158,98 M200,86 L208,92 L200,98" />
      </g>
      {/* right angle at the elbow */}
      <path d="M125.7,174.6 L141.6,172.5 L145.9,187.9" stroke={RED} strokeWidth="3" fill="none" />

      {CHECKS.map((text, i) => (
        <g key={text}>
          <circle cx="292" cy={78 + i * 42} r="13" fill={SOFT} />
          <path className="illo-tick" style={{ animationDelay: `${i * 0.8}s` }} d={`M285,${78 + i * 42} l5,6 l10,-12`} stroke={FOREST} strokeWidth="4" fill="none" />
          <text x="316" y={85 + i * 42} fontSize="24" fontWeight="500" fill={INK} stroke="none" fontFamily="'Oswald', 'Arial Narrow', sans-serif">
            {text}
          </text>
        </g>
      ))}
    </Frame>
  )
}

// Video stays on the device: the camera feed is locked in, the way to the cloud is blocked.
export function PrivacyIllustration() {
  return (
    <Frame label="A laptop with a padlock on its screen and a blocked path to the cloud">
      <path d="M20,268 H460" strokeWidth="5" fill="none" />
      <rect x="110" y="64" width="240" height="150" rx="10" fill={FOREST} />
      <rect x="124" y="78" width="212" height="122" rx="4" fill={SOFT} />
      <circle className="illo-pulse" cx="230" cy="71" r="3" fill={RED} stroke="none" />
      <path d="M86,214 H374 L394,246 H66 Z" fill={GREEN} />
      <path d="M208,246 H252" strokeWidth="4" fill="none" />

      {/* padlock */}
      <path d="M212,124 v-14 a18,18 0 0 1 36,0 v14" fill="none" strokeWidth="5" />
      <rect x="198" y="124" width="64" height="48" rx="6" fill={GREEN} />
      <circle cx="230" cy="144" r="6" fill={INK} stroke="none" />
      <path d="M230,148 V160" strokeWidth="4" fill="none" />

      {/* blocked route to the cloud */}
      <path className="illo-dash" d="M340,132 H384" stroke={RED} fill="none" strokeDasharray="8 10" />
      <path d="M396,168 H448 a16,16 0 0 0 0,-32 a22,22 0 0 0 -42,-6 a18,18 0 0 0 -14,38 Z" fill="none" strokeDasharray="3 8" />
      <path d="M398,114 L446,184 M446,114 L398,184" stroke={RED} strokeWidth="6" fill="none" />
    </Frame>
  )
}
