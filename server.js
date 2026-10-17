import express from 'express'
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

const app = express()
app.use(express.json({ limit: '4kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, gemini: Boolean(process.env.GEMINI_API_KEY) })
})

// A number within limits, or null. Anything else in the body is ignored, so only aggregates reach Gemini.
function num(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 10) / 10 : null
}

const SUMMARY_INSTRUCTION = `You write a short end-of-session summary for an office worker using a screen-break reminder.
Use only the numbers given. Plain English, 2 or 3 sentences, under 70 words, no markdown, no headings.
Write numbers as digits and round them to whole numbers. Mention the blink rate and the incomplete-blink share when given.
Frame it around UK DSE (display screen equipment) good practice: regular short breaks and looking away from the screen.
The app is not a medical device: never diagnose, never name eye conditions, never give medical advice.
Do not add a disclaimer, the app shows one separately. If a number is null, it was not measured: do not guess it.`

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
  const stats = {
    averageBlinksPerMinute: num(b.avgRate, 0, 200),
    incompleteBlinkPercent: num(b.incompletePct, 0, 100),
    screenTimeMinutes: num(b.screenMin, 0, 24 * 60),
    breaksTaken: num(b.breaks, 0, 1000),
    agentBeliefChanges: num(b.beliefChanges, 0, 10000),
  }

  try {
    const r = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        system_instruction: SUMMARY_INSTRUCTION,
        input: `Session numbers: ${JSON.stringify(stats)}`,
        generation_config: { max_output_tokens: 400, thinking_level: GEMINI_THINKING },
        store: false,
      }),
      signal: AbortSignal.timeout(10_000),
    })
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
