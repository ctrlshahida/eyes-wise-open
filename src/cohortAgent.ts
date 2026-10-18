// Cohort agent for the employer view. Plain rules, no model, no React.
// It always holds a current best call about the team and an action for the chosen priority. It never waits
// for more data. When something changes (new responses, a new priority, a correction) it recomputes, and
// if the call or action moves it says why.

export type Priority = 'headaches' | 'productivity' | 'cost'
export type Call = 'strained' | 'mixed' | 'healthy'

export const PRIORITY_LABEL: Record<Priority, string> = { headaches: 'Headaches', productivity: 'Productivity', cost: 'Cost' }
export const CALL_LABEL: Record<Call, string> = {
  strained: 'Many blink less than usual',
  mixed: 'Some blink less than usual',
  healthy: 'Mostly typical blinking',
}

export interface AgentInput {
  count: number
  avgRate: number
  avgIncompletePct: number | null
  lowShare: number // percent of responses in the low band
  includesSample: boolean
  sampleCount: number
  realIncluded: boolean
  realCount: number | null
  priority: Priority
  screenShare: number // percent of roles that are screen-based, set by the employer (a correction)
}

// What moved: the agent's call, its recommended action, or only how sure it is.
export interface Change {
  what: 'call' | 'action' | 'confidence'
  before: string
  now: string
  why: string
}

export interface AgentState {
  input: AgentInput
  call: Call
  confidence: number // 0 to 1
  action: string
  evidenceFor: string[]
  evidenceAgainst: string[]
  change: Change | null // the latest change, null until something has changed
  log: { id: number; change: Change }[] // newest first
  changes: number
}

// Where the call changes. The AI's choice, not from a source. DEADBAND stops a call flipping back and forth
// when the low-band share sits right on a line.
const STRAINED_FROM = 40
const MIXED_FROM = 20
const DEADBAND = 2
const SCREEN_RANGE_MAX = 7 // top of the typical screen-use range (src/reference.ts)
const FULL_SAMPLE = 20 // responses needed before the size of the group stops lowering confidence

function rawCall(low: number): Call {
  return low >= STRAINED_FROM ? 'strained' : low >= MIXED_FROM ? 'mixed' : 'healthy'
}

function decide(low: number, prev: Call | null): Call {
  if (!prev) return rawCall(low)
  if (prev === 'strained') return low < STRAINED_FROM - DEADBAND ? rawCall(low) : 'strained'
  if (prev === 'mixed') {
    if (low >= STRAINED_FROM + DEADBAND) return 'strained'
    if (low < MIXED_FROM - DEADBAND) return 'healthy'
    return 'mixed'
  }
  return low >= MIXED_FROM + DEADBAND ? rawCall(low) : 'healthy'
}

function confidenceOf(call: Call, i: AgentInput): number {
  // How far the low-band share is from the nearest line that would change the call.
  const lines = call === 'strained' ? [STRAINED_FROM] : call === 'mixed' ? [MIXED_FROM, STRAINED_FROM] : [MIXED_FROM]
  const margin = Math.min(1, Math.min(...lines.map((l) => Math.abs(i.lowShare - l))) / 20)
  const size = Math.min(1, i.count / FULL_SAMPLE)
  let c = 0.3 + 0.65 * (0.5 * margin + 0.5 * size)
  if (i.includesSample) c -= 0.1 // invented responses are weaker evidence about a real team
  c *= 0.6 + 0.4 * (i.screenShare / 100) // blink rate says less about screens if many roles are not screen-based
  return Math.max(0.2, Math.min(0.95, c))
}

const ACTIONS: Record<Call, Record<Priority, string>> = {
  strained: {
    headaches: 'Offer eye tests as a benefit now and build short screen breaks into the working day.',
    productivity: 'Add 20-second look-away breaks to meeting-heavy days, and run the check again in a month to see if blinking recovers.',
    cost: 'Start with the cheapest step: a team-wide reminder to take screen breaks, and make eye tests available on request.',
  },
  mixed: {
    headaches: 'Make eye tests easy to book and share a short guide on screen breaks.',
    productivity: 'Pilot break reminders with one team and compare at the next check.',
    cost: 'Hold spending for now. Share free guidance on screen breaks and check again next quarter.',
  },
  healthy: {
    headaches: 'Keep eye tests available and run the check again next quarter.',
    productivity: 'No action needed now. Run the check again next quarter to catch any change.',
    cost: 'No spending needed now. Run the check again next quarter.',
  },
}

function pct(v: number) {
  return `${Math.round(v)}%`
}

function evidence(call: Call, i: AgentInput) {
  const low = i.lowShare
  const rest = 100 - low
  const rate = Math.round(i.avgRate * 10) / 10
  const rateLow = i.avgRate <= SCREEN_RANGE_MAX
  const forList: string[] = []
  const againstList: string[] = []

  if (call === 'strained') {
    forList.push(`${pct(low)} of responses are in the low band`)
    ;(rateLow ? forList : againstList).push(`Average rate is ${rate} a minute, ${rateLow ? 'inside or below' : 'above'} the screen range`)
    againstList.push(`${pct(rest)} are typical or high`)
  } else if (call === 'mixed') {
    forList.push(`${pct(low)} in the low band is a sizeable minority`)
    againstList.push(`${pct(rest)} are typical or high, so it is not the whole team`)
    if (rateLow) againstList.push(`Average rate is ${rate} a minute, already inside the screen range, which points to more than a minority`)
    else forList.push(`Average rate is ${rate} a minute, above the screen range, so not everyone is low`)
  } else {
    forList.push(`${pct(rest)} of responses are typical or high`)
    ;(rateLow ? againstList : forList).push(`Average rate is ${rate} a minute, ${rateLow ? 'inside or below the screen range' : 'above the screen range'}`)
    againstList.push(`${pct(low)} are in the low band`)
  }
  if (i.count < FULL_SAMPLE) againstList.push(`Only ${i.count} responses so far`)
  if (i.includesSample) againstList.push(`${i.sampleCount} of ${i.count} responses are sample data, not real people`)
  if (i.screenShare < 100) againstList.push(`${100 - i.screenShare}% of roles are not screen-based`)
  return { evidenceFor: forList.slice(0, 3), evidenceAgainst: againstList.slice(0, 4) }
}

function build(i: AgentInput, prev: Call | null) {
  const call = decide(i.lowShare, prev)
  const confidence = confidenceOf(call, i)
  const action = (confidence < 0.5 ? 'Provisional: ' : '') + ACTIONS[call][i.priority]
  return { call, confidence, action, ...evidence(call, i) }
}

function causes(a: AgentInput, b: AgentInput): string[] {
  const out: string[] = []
  if (b.count !== a.count) {
    const d = b.count - a.count
    out.push(d > 0 ? `${d} new ${d === 1 ? 'response' : 'responses'} arrived (now ${b.count})` : `${-d} ${-d === 1 ? 'response was' : 'responses were'} removed (now ${b.count})`)
  }
  if (b.includesSample !== a.includesSample) out.push(b.includesSample ? 'sample data was added back' : 'sample data was removed')
  if (b.realIncluded && !a.realIncluded) out.push('real responses passed 5 and now count')
  if (b.screenShare !== a.screenShare) out.push(`you marked ${b.screenShare}% of roles as screen-based`)
  if (b.priority !== a.priority) out.push(`you changed the priority to ${PRIORITY_LABEL[b.priority].toLowerCase()}`)
  return out
}

function sentence(parts: string[]) {
  const s = parts.join(', ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function same(a: AgentInput, b: AgentInput) {
  return (
    a.count === b.count &&
    a.avgRate === b.avgRate &&
    a.avgIncompletePct === b.avgIncompletePct &&
    a.lowShare === b.lowShare &&
    a.includesSample === b.includesSample &&
    a.sampleCount === b.sampleCount &&
    a.realIncluded === b.realIncluded &&
    a.priority === b.priority &&
    a.screenShare === b.screenShare
  )
}

export function createAgent(input: AgentInput): AgentState {
  return { input, ...build(input, null), change: null, log: [], changes: 0 }
}

// Recompute for new input. Returns the same object when nothing changed, so polling is free.
export function updateAgent(prev: AgentState, input: AgentInput): AgentState {
  if (same(prev.input, input)) return prev
  const next = build(input, prev.call)
  const why = causes(prev.input, input)
  const reason = why.length ? sentence(why) : 'The numbers moved'

  const sure = (c: number) => `${pct(c * 100)} sure`
  let change = prev.change
  let latest: Change | null = null
  if (next.call !== prev.call) {
    latest = {
      what: 'call',
      before: `${CALL_LABEL[prev.call]} (${sure(prev.confidence)})`,
      now: `${CALL_LABEL[next.call]} (${sure(next.confidence)})`,
      why: `${reason}. The low-band share went from ${pct(prev.input.lowShare)} to ${pct(input.lowShare)}.`,
    }
  } else if (next.action !== prev.action && input.priority !== prev.input.priority) {
    latest = { what: 'action', before: prev.action, now: next.action, why: `${reason}.` }
  } else if (Math.abs(next.confidence - prev.confidence) >= 0.05) {
    latest = { what: 'confidence', before: sure(prev.confidence), now: sure(next.confidence), why: `${reason}.` }
  }
  if (latest) change = latest

  const log = latest ? [{ id: prev.log.length + 1, change: latest }, ...prev.log].slice(0, 20) : prev.log
  return { input, ...next, change, log, changes: prev.changes + (next.call !== prev.call ? 1 : 0) }
}
