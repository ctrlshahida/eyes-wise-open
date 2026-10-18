import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')

// API keys live in .env next to this file (on the server: /opt/app/.env). Never in the frontend.
try {
  process.loadEnvFile(path.join(__dirname, '.env'))
} catch {
  // No .env: routes that need a key report it and the frontend falls back.
}

// Flash-Lite answered in about 1s in testing; 3.8 Flash took close to a minute. 3.8 Flash does not accept
// 'minimal' thinking, so set GEMINI_THINKING=low if you switch GEMINI_MODEL to it.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
const GEMINI_THINKING = process.env.GEMINI_THINKING || 'minimal'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

// Anonymous shared results live in one JSON file (gitignored, so a git pull never touches it).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'assessments.json')
const MAX_RECORDS = 20_000
let lastWrite = Promise.resolve()

async function readRecords() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
}

// Writes are queued one after another so two people sharing at once cannot overwrite each other.
function addRecord(record) {
  const run = lastWrite
    .catch(() => {})
    .then(async () => {
      const all = await readRecords()
      if (all.length >= MAX_RECORDS) throw Object.assign(new Error('full'), { status: 507 })
      all.push(record)
      await fs.mkdir(DATA_DIR, { recursive: true })
      const tmp = DATA_FILE + '.tmp'
      await fs.writeFile(tmp, JSON.stringify(all))
      await fs.rename(tmp, DATA_FILE)
    })
  lastWrite = run
  return run
}

const app = express()
app.use(express.json({ limit: '4kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, gemini: Boolean(process.env.GEMINI_API_KEY) })
})

// "45 seconds", "12 minutes" or "7.5 hours", or null.
function spoken(sec) {
  if (sec === null) return null
  if (sec < 90) return `${Math.round(sec)} seconds`
  if (sec < 5400) return `${Math.round(sec / 60)} minutes`
  return `${(sec / 3600).toFixed(1)} hours`
}

// How the rate changed between the first and second half of the session, worked out here so the model does not have to.
function trendText(t) {
  const first = t && num(t.first, 0, 200)
  const second = t && num(t.second, 0, 200)
  if (first === null || second === null || first === undefined || second === undefined) return null
  const a = Math.round(first)
  const b = Math.round(second)
  if (Math.abs(second - first) < Math.max(1, first * 0.15)) return `stayed about the same between the first and second half of the session (${a} then ${b} blinks a minute)`
  return `${second < first ? 'dropped' : 'rose'} from ${a} to ${b} blinks a minute between the first and second half of the session`
}

// Where the rate sits against the two ranges, worked out here so the model does not have to.
function position(rate, screen, relaxed) {
  if (rate === null || !screen || !relaxed) return null
  if (rate < screen[0]) return 'below the typical screen-use range'
  if (rate <= screen[1]) return 'inside the typical screen-use range'
  if (rate < relaxed[0]) return 'above the typical screen-use range but below the typical relaxed range'
  if (rate <= relaxed[1]) return 'inside the typical relaxed range'
  return 'above the typical relaxed range'
}

// A number within limits, or null. Anything else in the body is ignored, so only these aggregates reach Gemini.
function num(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 10) / 10 : null
}

const SUMMARY_INSTRUCTION = `You write a short analysis for an office worker who just had their blinking measured while they worked at a screen.
Use only the numbers given. Plain English, exactly 3 short sentences of under 25 words each (under 70 words in total), no markdown, no headings. Write numbers as digits, rounded to whole numbers. "measuredFor" is a duration such as "45 seconds". Work it into a sentence (for example "over 45 seconds"), and never write the word measuredFor.
Sentence 1: state "position" in your own words, with the rate and the two ranges. Copy the position exactly; never work it out yourself. Say "the reference ranges in this app", never "studies show", and name no source.
Sentence 2: if shortSession is true, say only that the session was too short to say much and should be treated as a snapshot. Otherwise, if the band is "low", say that blinking less than usual at a screen may leave eyes feeling dry or tired if the pattern continues. If the band is "typical" or "high", say nothing here suggests a problem and that one session is only a snapshot. Use cautious words like "may". Mention no condition other than dry or tired eyes. No statistics and no timeframes. If "trend" is given and shortSession is false, mention it in this sentence using its wording exactly (for example "your rate dropped from 8 to 5 blinks a minute between the first and second half of the session"), and do not guess why.
Sentence 3: one practical tip, such as looking away from the screen now and then and blinking fully. Do not mention opticians, the app adds that line itself.
This is not a medical device: never diagnose, never give medical advice. Do not add a disclaimer, the app shows one separately. If a number is null, it was not measured: do not guess it.`

// Pull the text out of an Interactions API response. Tolerates the older generateContent shape too.
function extractText(data) {
  for (const step of data?.steps ?? []) {
    if (step.type !== 'model_output') continue
    const part = (step.content ?? []).find((c) => c.type === 'text' && c.text)
    if (part) return part.text
  }
  return data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? null
}

app.post('/api/summary', async (req, res) => {
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: 'Gemini is not configured on the server' })

  const b = req.body ?? {}
  const range = (v) => (Array.isArray(v) && num(v[0], 0, 200) !== null && num(v[1], 0, 200) !== null ? [num(v[0], 0, 200), num(v[1], 0, 200)] : null)
  const screen = range(b.screenRange)
  const relaxed = range(b.relaxedRange)
  const rate = num(b.blinksPerMinute, 0, 200)
  const stats = {
    blinksPerMinute: num(b.blinksPerMinute, 0, 200),
    incompleteBlinkPercent: num(b.incompletePct, 0, 100),
    measuredFor: spoken(num(b.seconds, 0, 24 * 3600)),
    band: ['low', 'typical', 'high'].includes(b.band) ? b.band : null,
    typicalScreenUseRange: screen,
    typicalRelaxedRange: relaxed,
    position: position(rate, screen, relaxed),
    shortSession: b.shortSession === true,
    trend: trendText(b.trend),
  }

  try {
    const body = JSON.stringify({
      model: GEMINI_MODEL,
      system_instruction: SUMMARY_INSTRUCTION,
      input: `Session numbers: ${JSON.stringify(stats)}`,
      generation_config: { max_output_tokens: 400, thinking_level: GEMINI_THINKING },
      store: false,
    })
    const call = () =>
      fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
        signal: AbortSignal.timeout(10_000),
      })
    let r = await call()
    // Gemini answered 403 "caller does not have permission" on roughly 1 call in 4 in testing, on both endpoints,
    // and the same call worked a moment later. Retry a few times before giving up.
    for (let attempt = 2; attempt <= 4 && [403, 429, 500, 502, 503].includes(r.status); attempt++) {
      console.warn('Gemini returned', r.status, `retrying (attempt ${attempt} of 4)`)
      await new Promise((done) => setTimeout(done, 800))
      r = await call()
    }
    const data = await r.json().catch(() => null)
    if (!r.ok) {
      console.error('Gemini error', r.status, (Array.isArray(data) ? data[0] : data)?.error?.message ?? data)
      return res.status(502).json({ error: `Gemini returned ${r.status}` })
    }
    const text = extractText(data)?.trim()
    if (!text) return res.status(502).json({ error: 'Gemini returned no text' })
    res.json({ text, model: GEMINI_MODEL })
  } catch (e) {
    console.error('Gemini request failed', e)
    res.status(502).json({ error: e?.name === 'TimeoutError' ? 'Gemini timed out' : 'Could not reach Gemini' })
  }
})

// One anonymous record: company code, time (set here), blinks per minute, share of partial blinks, band.
// Nothing else in the request body is kept.
app.post('/api/assessment', async (req, res) => {
  const b = req.body ?? {}
  const org = typeof b.org === 'string' ? b.org.trim().toUpperCase() : ''
  if (!/^[A-Z0-9_-]{2,32}$/.test(org)) return res.status(400).json({ error: 'Enter a company code of 2 to 32 letters or numbers' })

  const rate = num(b.blinksPerMinute, 0, 200)
  const incomplete = b.incompletePct === null ? null : num(b.incompletePct, 0, 100)
  const validBand = ['low', 'typical', 'high'].includes(b.band)
  if (rate === null || (b.incompletePct !== null && incomplete === null) || !validBand) {
    return res.status(400).json({ error: 'Invalid result' })
  }

  try {
    await addRecord({ org, timestamp: new Date().toISOString(), blinksPerMinute: rate, incompletePct: incomplete, band: b.band })
    res.status(201).json({ ok: true })
  } catch (e) {
    console.error('Could not store assessment', e)
    res.status(e.status === 507 ? 507 : 500).json({ error: 'Could not store your result' })
  }
})

// ---- Employer view: group numbers only ----
const MIN_GROUP = 5
const ORG_PATTERN = /^[A-Z0-9_-]{2,32}$/

// INVENTED sample responses so the employer view has something to show in a demo. They are not real people.
// The view labels them "Sample data". One toggle (?sample=0) removes them.
const SAMPLE_COHORT = [
  { blinksPerMinute: 3.2, incompletePct: 45, band: 'low' },
  { blinksPerMinute: 4.4, incompletePct: 41, band: 'low' },
  { blinksPerMinute: 4.8, incompletePct: 36, band: 'low' },
  { blinksPerMinute: 5.3, incompletePct: 30, band: 'typical' },
  { blinksPerMinute: 5.9, incompletePct: 28, band: 'typical' },
  { blinksPerMinute: 6.6, incompletePct: 33, band: 'typical' },
  { blinksPerMinute: 7.4, incompletePct: 22, band: 'typical' },
  { blinksPerMinute: 8.8, incompletePct: 25, band: 'typical' },
  { blinksPerMinute: 10.2, incompletePct: 18, band: 'typical' },
  { blinksPerMinute: 12.5, incompletePct: 15, band: 'typical' },
  { blinksPerMinute: 16.0, incompletePct: 12, band: 'typical' },
  { blinksPerMinute: 21.5, incompletePct: 8, band: 'high' },
]

function summarise(rows) {
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  const round1 = (v) => Math.round(v * 10) / 10
  const incomplete = rows.map((r) => r.incompletePct).filter((v) => typeof v === 'number')
  const bands = { low: 0, typical: 0, high: 0 }
  for (const r of rows) bands[r.band]++
  return {
    count: rows.length,
    avgRate: round1(mean(rows.map((r) => r.blinksPerMinute))),
    avgIncompletePct: incomplete.length ? round1(mean(incomplete)) : null,
    lowShare: round1((bands.low / rows.length) * 100),
    bands,
  }
}

// Aggregates only: never an individual record. Nothing is sent below MIN_GROUP rows. Real responses only join
// the numbers once there are at least MIN_GROUP of them for this company code, because otherwise the known sample
// data could be subtracted back out to reveal one person's result.
app.get('/api/aggregate', async (req, res) => {
  const org = typeof req.query.org === 'string' ? req.query.org.trim().toUpperCase() : ''
  if (!ORG_PATTERN.test(org)) return res.status(400).json({ error: 'Enter a company code of 2 to 32 letters or numbers' })
  const includeSample = req.query.sample !== '0'

  try {
    const real = (await readRecords()).filter((r) => r.org === org)
    const realIncluded = real.length >= MIN_GROUP
    const rows = [...(realIncluded ? real : []), ...(includeSample ? SAMPLE_COHORT : [])]
    if (rows.length < MIN_GROUP) return res.json({ org, enough: false, needed: MIN_GROUP })
    res.json({
      org,
      enough: true,
      includesSample: includeSample,
      realIncluded,
      realCount: realIncluded ? real.length : null,
      sampleCount: includeSample ? SAMPLE_COHORT.length : 0,
      ...summarise(rows),
    })
  } catch (e) {
    console.error('Could not read assessments', e)
    res.status(500).json({ error: 'Could not read the results' })
  }
})

// Bad JSON and other request errors: a short JSON message, never a stack trace.
app.use('/api', (err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.status === 400 ? 'Invalid request body' : 'Server error' })
})

app.use(express.static(dist))

// Fallback to index.html for anything that is not an API route or a static file
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(dist, 'index.html'))
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Eyes Wise Open listening on http://localhost:${port}`)
})
