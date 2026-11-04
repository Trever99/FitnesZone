import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { UPLOADS_DIR } from './db.js'
import { seedAll } from './seed.js'
import authRouter from './auth.js'
import exercisesRouter from './routes/exercises.js'
import workoutsRouter from './routes/workouts.js'
import plansRouter from './routes/plans.js'
import nutritionRouter from './routes/nutrition.js'
import progressRouter from './routes/progress.js'
import coachRouter from './routes/coach.js'
import appRouter from './routes/app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 4000
const app = express()

app.use(cors())
app.use(express.json({ limit: '15mb' }))
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'FITZONE API' }))
app.use('/api/auth', authRouter)
app.use('/api/exercises', exercisesRouter)
app.use('/api/workouts', workoutsRouter)
app.use('/api', plansRouter)
app.use('/api/nutrition', nutritionRouter)
app.use('/api/progress', progressRouter)
app.use('/api/coach', coachRouter)
app.use('/api', appRouter)

// JSON error handler
app.use('/api', (err, _req, res, _next) => {
  console.error('[api error]', err.stack || err.message)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

// Serve built client
const distCandidates = [
  path.join(__dirname, '..', 'dist'),
  path.join(__dirname, '..', 'client', 'dist'),
]
const dist = distCandidates.find((d) => fs.existsSync(path.join(d, 'index.html'))) || distCandidates[0]
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

seedAll()
app.listen(PORT, () => console.log(`FITZONE API ready on http://localhost:${PORT}`))
