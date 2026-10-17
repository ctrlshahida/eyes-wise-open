// Rule-based belief agent. Plain TypeScript, no LLM, no React.
// Every tick it weighs evidence for each hypothesis, keeps one current best call,
// acts on it, and logs every change of mind with the reason.

import { CALIBRATION_MS, LOW_LIGHT_BRIGHTNESS, UNDER_BLINK_PER_MIN } from './blink'

export type Hypothesis = 'fatigued' | 'fine' | 'bad-light' | 'in-call'
export type Action = 'none' | 'vignette' | 'nudge' | 'queue-break' | 'ask-light'

export const LABELS: Record<Hypothesis, string> = {
  fatigued: 'Under-blinking',
  fine: 'Fine',
  'bad-light': 'Bad lighting',
  'in-call': 'In a call',
}

// ---- Tunable settings -------------------------------------------------------
export const SWITCH_MARGIN = 0.1 // a new hypothesis must lead the current one by 10 points to take over
export const FINE_STEP = 2 // "I was fine" relaxes the threshold by this many blinks per minute
export const MIN_THRESHOLD = 4
export const INCOMPLETE_HIGH = 0.5 // this share of incomplete blinks counts as strain
export const MIN_BLINKS_FOR_RATIO = 4 // too few blinks and the ratio means nothing
export const FINE_PRIOR = 1 // with no evidence at all, assume the person is fine
const LOG_SIZE = 8
// -----------------------------------------------------------------------------

export interface AgentInputs {
  now: number // ms, performance.now()
  rate: number | null // blinks per minute, null while measuring or face missing
  complete: number
  incomplete: number
  screenSec: number // continuous screen time
  nudgeAfterSec: number
  windowSec: number // blink-rate window, used to scale how long memories last
  brightness: number | null // mean frame luma 0-255
  noFace: boolean
  callMode: boolean
}

export interface Evidence {
  hyp: Hypothesis
  weight: number // positive supports the hypothesis, negative counts against it
  text: string
}

export interface LogEntry {
  t: number
  text: string
}

// What the UI reads. A fresh object each tick.
export interface Belief {
  hypothesis: Hypothesis
  confidence: number // 0..1
  confidences: Record<Hypothesis, number>
  evidenceFor: string[]
  evidenceAgainst: string[]
  reliability: number // 0..1, how much the blink data is trusted right now
  threshold: number // current under-blinking threshold, blinks per minute
  action: Action
  actionText: string
  breakQueued: boolean
  changedMind: string | null
  log: LogEntry[]
  changes: number // number of belief changes this session
}

export function createAgent() {
  return {
    hypothesis: null as Hypothesis | null,
    confidences: null as Record<Hypothesis, number> | null,
    threshold: UNDER_BLINK_PER_MIN,
    fineAt: null as number | null, // last "I was fine"
    recalibratedAt: null as number | null,
    forcedReason: null as string | null, // a user correction skips the switch margin once
    breakQueued: false,
    lastCallMode: false,
    lastLowLight: false,
    changedMind: null as string | null,
    log: [] as LogEntry[],
    changes: 0,
  }
}

export type AgentState = ReturnType<typeof createAgent>

const HYPOTHESES: Hypothesis[] = ['fatigued', 'fine', 'bad-light', 'in-call']

const pct = (v: number) => `${Math.round(v * 100)}%`

function ago(sec: number) {
  return sec < 60 ? `${Math.round(sec)}s` : `${Math.round(sec / 60)} min`
}

function clock(sec: number) {
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function note(a: AgentState, t: number, text: string) {
  a.log.unshift({ t, text })
  if (a.log.length > LOG_SIZE) a.log.pop()
}

// ---- User and tracker events ------------------------------------------------

export function agentWasFine(a: AgentState, now: number) {
  const before = a.threshold
  a.threshold = Math.max(MIN_THRESHOLD, a.threshold - FINE_STEP)
  a.fineAt = now
  a.forcedReason = 'You said you were fine'
  note(
    a,
    now,
    before === a.threshold
      ? `You said you were fine. Dropping the fatigue call. Threshold already at its floor of ${a.threshold}/min.`
      : `You said you were fine. Dropping the fatigue call and relaxing the threshold from ${before} to ${a.threshold}/min.`,
  )
}

export function agentRecalibrated(a: AgentState, now: number) {
  a.recalibratedAt = now
  note(a, now, 'Recalibrated. Trusting blink data less until the new baseline has been tested.')
}

// Call mode switched on while a break nudge was on screen: keep the break, show it later.
export function agentDeferNudge(a: AgentState, now: number) {
  if (a.breakQueued) return
  a.breakQueued = true
  note(a, now, 'Call started while a break was due. Break queued for after your call.')
}

// Call after the user takes or snoozes a break, so a queued break is not shown twice.
export function agentBreakHandled(a: AgentState) {
  a.breakQueued = false
}

// ---- Evidence ---------------------------------------------------------------

function gather(a: AgentState, i: AgentInputs) {
  const ev: Evidence[] = []
  const add = (hyp: Hypothesis, weight: number, text: string) => ev.push({ hyp, weight, text })

  // How far to trust the blink numbers.
  let reliability = 1
  const lowLight = i.brightness !== null && i.brightness < LOW_LIGHT_BRIGHTNESS
  if (lowLight) {
    reliability *= 0.3
    add('bad-light', 3, `Frame is dark (brightness ${Math.round(i.brightness!)} of 255)`)
  } else if (i.brightness !== null) {
    add('bad-light', -1.5, 'Frame is well lit')
  }
  if (i.noFace) {
    reliability *= 0.2
    add('bad-light', 1.5, 'Face not visible')
  }
  const sinceRecal = a.recalibratedAt === null ? Infinity : (i.now - a.recalibratedAt) / 1000
  if (sinceRecal < CALIBRATION_MS / 1000 + i.windowSec) {
    reliability *= 0.5
    add('bad-light', 1, 'Just recalibrated, the new baseline is untested')
  }
  if (i.rate === null && !i.noFace) {
    reliability *= 0.5
    add('fine', -0.3, 'Blink rate is still being measured')
  }
  const r = reliability

  // Blink rate against the (possibly relaxed) threshold.
  if (i.rate !== null) {
    const rate = Math.round(i.rate)
    if (i.rate < a.threshold) {
      const w = (2 + 2 * (1 - i.rate / a.threshold)) * r
      const text = `Blinking ${rate}/min, below your ${a.threshold}/min threshold`
      add('fatigued', w, text)
      add('fine', -w, text)
    } else {
      const text = `Blinking ${rate}/min, at or above your ${a.threshold}/min threshold`
      add('fine', 2 * r, text)
      add('fatigued', -2 * r, text)
    }
  }

  // Incomplete blinks.
  const total = i.complete + i.incomplete
  if (total >= MIN_BLINKS_FOR_RATIO) {
    const ratio = i.incomplete / total
    if (ratio >= INCOMPLETE_HIGH) {
      add('fatigued', r, `${pct(ratio)} of recent blinks are incomplete`)
      add('fine', -0.5 * r, `${pct(ratio)} of recent blinks are incomplete`)
    } else {
      add('fine', 0.5 * r, `Only ${pct(ratio)} of recent blinks are incomplete`)
    }
  }

  // Continuous screen time. Not from the blink data, so not scaled by reliability.
  if (i.screenSec >= i.nudgeAfterSec) add('fatigued', 1, `${clock(i.screenSec)} of continuous screen time`)
  else add('fine', 0.5, `Only ${clock(i.screenSec)} of continuous screen time`)

  // The user's own correction, fading as new data arrives.
  const fineMemorySec = i.windowSec * 3
  const sinceFine = a.fineAt === null ? Infinity : (i.now - a.fineAt) / 1000
  if (sinceFine < fineMemorySec) {
    const k = 1 - sinceFine / fineMemorySec
    add('fatigued', -6 * k, `You said you were fine ${ago(sinceFine)} ago`)
    add('fine', 3 * k, `You said you were fine ${ago(sinceFine)} ago`)
  }

  // Call mode.
  if (i.callMode) add('in-call', 4, 'Call mode is on')
  else add('in-call', -2, 'Call mode is off')

  return { ev, reliability, lowLight }
}

function topTexts(ev: Evidence[], hyp: Hypothesis, sign: 1 | -1) {
  return ev
    .filter((e) => e.hyp === hyp && Math.sign(e.weight) === sign)
    .sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight))
    .slice(0, 3)
    .map((e) => e.text)
}

// ---- Main tick --------------------------------------------------------------

export function updateAgent(a: AgentState, i: AgentInputs): Belief {
  // Log input changes the agent reacts to.
  if (i.callMode !== a.lastCallMode) {
    note(a, i.now, i.callMode ? 'Call mode on. Nudges are deferred until the call ends.' : 'Call mode off.')
    a.lastCallMode = i.callMode
  }

  const { ev, reliability, lowLight } = gather(a, i)
  if (lowLight !== a.lastLowLight) {
    note(a, i.now, lowLight ? 'Low light. Trusting blink data less.' : 'Light is back to normal. Trusting blink data again.')
    a.lastLowLight = lowLight
  }

  // Sum the evidence, then turn scores into confidences (softmax) so they always add up to 100%.
  const scores = { fatigued: 0, fine: FINE_PRIOR, 'bad-light': 0, 'in-call': 0 } as Record<Hypothesis, number>
  for (const e of ev) scores[e.hyp] += e.weight
  const exp = HYPOTHESES.map((h) => Math.exp(scores[h]))
  const sum = exp.reduce((x, y) => x + y, 0)
  const conf = Object.fromEntries(HYPOTHESES.map((h, k) => [h, exp[k] / sum])) as Record<Hypothesis, number>
  const best = HYPOTHESES.reduce((x, y) => (conf[y] > conf[x] ? y : x))

  // Switch only on a clear lead, or straight away after a user correction. Never wait for more data.
  const old = a.hypothesis
  if (old === null) {
    a.hypothesis = best
    note(a, i.now, `Starting with: ${LABELS[best]}, ${pct(conf[best])}.`)
  } else if (best !== old && (a.forcedReason !== null || conf[best] - conf[old] >= SWITCH_MARGIN)) {
    const reason = a.forcedReason ?? topTexts(ev, best, 1)[0] ?? topTexts(ev, old, -1)[0] ?? 'the evidence shifted'
    const was = a.confidences?.[old] ?? conf[old]
    a.changedMind = `Dropped "${LABELS[old]}" (${pct(was)} → ${pct(conf[old])}). Reason: ${reason}. Now: ${LABELS[best]}, ${pct(conf[best])}.`
    note(a, i.now, a.changedMind)
    a.hypothesis = best
    a.changes++
  }
  a.forcedReason = null
  a.confidences = conf
  const hyp: Hypothesis = a.hypothesis ?? best

  // Act on the current call.
  const breakDue = i.screenSec >= i.nudgeAfterSec
  let action: Action
  let actionText: string
  if (hyp === 'bad-light') {
    action = 'ask-light'
    actionText = 'Blink data is unreliable. Asking for better light, nudges on hold.'
  } else if (i.callMode) {
    // Conflicting signals: fatigue is weighed against the call, not thrown away.
    if (!a.breakQueued && breakDue && scores.fatigued > scores.fine) {
      a.breakQueued = true
      note(a, i.now, 'Fatigue signs during a call. Break queued for after your call.')
    }
    action = a.breakQueued ? 'queue-break' : 'none'
    actionText = a.breakQueued ? 'Break queued for after your call.' : 'In a call. Watching quietly, no nudges.'
  } else if (a.breakQueued) {
    action = 'nudge'
    actionText = 'Your call ended, so the queued break is due now.'
  } else if (hyp === 'fatigued') {
    action = breakDue ? 'nudge' : 'vignette'
    actionText = breakDue ? 'Suggesting a break.' : 'Dimming the screen edges as a gentle reminder to blink.'
  } else {
    action = 'none'
    actionText = 'You look fine. Keep going.'
  }

  return {
    hypothesis: hyp,
    confidence: conf[hyp],
    confidences: conf,
    evidenceFor: topTexts(ev, hyp, 1),
    evidenceAgainst: topTexts(ev, hyp, -1),
    reliability,
    threshold: a.threshold,
    action,
    actionText,
    breakQueued: a.breakQueued,
    changedMind: a.changedMind,
    log: [...a.log],
    changes: a.changes,
  }
}
