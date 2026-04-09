import express from 'express'
import cors from 'cors'
import sessionRoutes from './routes/sessions.js'
import { warmup } from './services/ollama.js'

const app = express()
app.use(cors())
app.use(express.json())

// 요청 로거
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`, req.body)
  next()
})

app.use('/api/sessions', sessionRoutes)

app.get('/health', (_req, res) => res.json({ ok: true }))

// 전역 에러 핸들러 — 항상 JSON 반환
app.use((err, _req, res, _next) => {
  console.error('[error]', err)
  res.status(500).json({ error: err.message ?? 'internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend running on :${PORT}`)
  warmup()
})
