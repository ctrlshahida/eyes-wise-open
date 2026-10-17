import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const app = express()

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
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
