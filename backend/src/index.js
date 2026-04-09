import express from 'express'
import cors from 'cors'
import sessionRoutes from './routes/sessions.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/sessions', sessionRoutes)

app.get('/health', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend running on :${PORT}`))
