import { Router } from 'express'
import { z } from 'zod'
import { db, today } from '../db.js'
import { requireAuth } from '../auth.js'
import { evalAchievements } from '../services/achievements.js'

const router = Router()

// ---------- Routines ----------
router.get('/routines', requireAuth, (req, res) => {
  const routines = db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC').all(req.uid)
  const exStmt = db.prepare(`SELECT re.*, e.name, e.muscle_group, e.equipment, e.difficulty FROM routine_exercises re
    JOIN exercises e ON e.id = re.exercise_id WHERE re.routine_id = ? ORDER BY re.position`)
  res.json({ routines: routines.map((r) => ({ ...r, exercises: exStmt.all(r.id) })) })
})

router.post('/routines', requireAuth, (req, res) => {
  const s = z.object({ name: z.string().min(1).max(80), notes: z.string().max(400).optional().default(''),
    plan_id: z.number().nullable().optional(),
    exercises: z.array(z.object({ exercise_id: z.number(), target_sets: z.number().min(1).max(20).default(3),
      target_reps: z.string().max(20).default('8-12'), target_weight: z.number().min(0).max(600).default(0),
      rest_seconds: z.number().min(0).max(600).default(90), notes: z.string().max(200).optional().default('') })).default([]) }).safeParse(req.body)
  if (!s.success) return res.status(400).json({ error: 'Routine needs a name and valid exercises.' })
  const { name, notes, exercises, plan_id } = s.data
  const tx = db.transaction(() => {
    const { lastInsertRowid: rid } = db.prepare('INSERT INTO routines (user_id,plan_id,name,notes,created_at) VALUES (?,?,?,?,?)').run(req.uid, plan_id ?? null, name, notes, Date.now())
    exercises.forEach((e, i) => db.prepare('INSERT INTO routine_exercises (routine_id,exercise_id,position,target_sets,target_reps,target_weight,rest_seconds,notes) VALUES (?,?,?,?,?,?,?,?)')
      .run(rid, e.exercise_id, i, e.target_sets, e.target_reps, e.target_weight, e.rest_seconds, e.notes || ''))
    return rid
  })
  res.json({ id: tx() })
})

router.put('/routines/:id', requireAuth, (req, res) => {
  const r = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!r) return res.status(404).json({ error: 'Routine not found' })
  const { name, notes, exercises } = req.body
  const tx = db.transaction(() => {
    db.prepare('UPDATE routines SET name = ?, notes = ? WHERE id = ?').run(name ?? r.name, notes ?? r.notes, r.id)
    if (Array.isArray(exercises)) {
      db.prepare('DELETE FROM routine_exercises WHERE routine_id = ?').run(r.id)
      exercises.forEach((e, i) => db.prepare('INSERT INTO routine_exercises (routine_id,exercise_id,position,target_sets,target_reps,target_weight,rest_seconds,notes) VALUES (?,?,?,?,?,?,?,?)')
        .run(r.id, e.exercise_id ?? e.exerciseId, i, e.target_sets ?? 3, e.target_reps ?? '8-12', e.target_weight ?? 0, e.rest_seconds ?? 90, e.notes || ''))
    }
  })
  tx()
  res.json({ ok: true })
})

router.delete('/routines/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?').run(req.params.id, req.uid)
  res.json({ ok: true })
})

router.post('/routines/:id/duplicate', requireAuth, (req, res) => {
  const r = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!r) return res.status(404).json({ error: 'Routine not found' })
  const ex = db.prepare('SELECT * FROM routine_exercises WHERE routine_id = ? ORDER BY position').all(r.id)
  const tx = db.transaction(() => {
    const { lastInsertRowid: rid } = db.prepare('INSERT INTO routines (user_id,plan_id,name,notes,created_at) VALUES (?,?,?,?,?)').run(req.uid, r.plan_id, r.name + ' (copy)', r.notes, Date.now())
    ex.forEach((e) => db.prepare('INSERT INTO routine_exercises (routine_id,exercise_id,position,target_sets,target_reps,target_weight,rest_seconds,notes) VALUES (?,?,?,?,?,?,?,?)')
      .run(rid, e.exercise_id, e.position, e.target_sets, e.target_reps, e.target_weight, e.rest_seconds, e.notes))
    return rid
  })
  res.json({ id: tx() })
})

// ---------- Live sessions ----------
router.post('/sessions', requireAuth, (req, res) => {
  const { routine_id = null, name = 'Workout' } = req.body
  let exercise_ids = []
  if (routine_id) {
    const r = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(routine_id, req.uid)
    if (!r) return res.status(404).json({ error: 'Routine not found' })
    exercise_ids = db.prepare('SELECT exercise_id FROM routine_exercises WHERE routine_id = ? ORDER BY position').all(routine_id).map((x) => x.exercise_id)
  }
  const { lastInsertRowid: sid } = db.prepare('INSERT INTO sessions (user_id,routine_id,name,started_at) VALUES (?,?,?,?)').run(req.uid, routine_id, name, Date.now())
  res.json({ id: sid, exercise_ids })
})

router.get('/sessions', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?').all(req.uid, limit)
  const base = db.prepare(`SELECT es.*, e.name, e.muscle_group FROM exercise_sets es JOIN exercises e ON e.id = es.exercise_id WHERE es.session_id = ? ORDER BY es.exercise_id, es.set_index`)
  res.json({ sessions: sessions.map((s) => ({ ...s, sets: base.all(s.id) })) })
})

router.get('/sessions/:id', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!s) return res.status(404).json({ error: 'Workout session not found' })
  const sets = db.prepare(`SELECT es.*, e.name, e.muscle_group, e.equipment FROM exercise_sets es JOIN exercises e ON e.id = es.exercise_id WHERE es.session_id = ? ORDER BY es.exercise_id, es.set_index`).all(s.id)
  const prs = db.prepare(`SELECT pr.*, e.name FROM personal_records pr JOIN exercises e ON e.id = pr.exercise_id WHERE pr.user_id = ? AND pr.achieved_at BETWEEN ? AND ?`).all(req.uid, s.started_at - 60000, (s.completed_at || Date.now()) + 60000)
  res.json({ session: s, sets, records: prs })
})

router.delete('/sessions/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.uid)
  res.json({ ok: true })
})

router.put('/sessions/:id/finish', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!s) return res.status(404).json({ error: 'Session not found' })
  if (s.completed_at) return res.status(400).json({ error: 'Session already finished' })
  const stats = db.prepare(`SELECT COALESCE(SUM(reps * weight),0) v, COUNT(*) n FROM exercise_sets WHERE session_id = ? AND done = 1 AND weight > 0`).get(s.id)
  const setsCount = db.prepare('SELECT COUNT(*) n FROM exercise_sets WHERE session_id = ? AND done = 1').get(s.id).n
  const duration = Math.max(60, Math.round((Date.now() - s.started_at) / 1000))
  db.prepare('UPDATE sessions SET completed_at = ?, duration_sec = ?, total_volume = ? WHERE id = ?')
    .run(Date.now(), duration, stats.v, s.id)
  const records = db.prepare(`SELECT id, exercise_id, weight, reps FROM exercise_sets WHERE session_id = ? AND done = 1`).all(s.id)
  const newPRs = []
  for (const st of records) {
    const e1rm = Math.round(st.weight * (1 + st.reps / 30))
    const best = db.prepare('SELECT e1rm FROM personal_records WHERE user_id = ? AND exercise_id = ? ORDER BY e1rm DESC LIMIT 1').get(req.uid, st.exercise_id)
    if (st.weight > 0 && e1rm > (best?.e1rm ?? -1)) {
      db.prepare('INSERT INTO personal_records (user_id,exercise_id,weight,reps,e1rm,achieved_at) VALUES (?,?,?,?,?,?)')
        .run(req.uid, st.exercise_id, st.weight, st.reps, e1rm, Date.now())
      newPRs.push(st.exercise_id)
    }
  }
  evalAchievements(db, req.uid)
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(s.id)
  const doneSets = db.prepare(`SELECT es.*, e.name FROM exercise_sets es JOIN exercises e ON e.id = es.exercise_id WHERE es.session_id = ? AND es.done = 1 ORDER BY es.exercise_id, es.set_index`).all(s.id)
  const calories = Math.round(duration * 0.09 + stats.v / 1000 * 1.2)
  res.json({ session, sets: doneSets, prs: newPRs.length, calories, setCount: setsCount })
})

router.post('/sessions/:id/sets', requireAuth, (req, res) => {
  const s = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!s) return res.status(404).json({ error: 'Session not found' })
  const b = z.object({ exercise_id: z.number(), set_index: z.number().min(0).max(50), reps: z.number().min(0).max(1000), weight: z.number().min(0).max(600), type: z.enum(['normal', 'warmup', 'failure', 'dropset']).default('normal') }).safeParse(req.body)
  if (!b.success) return res.status(400).json({ error: 'Invalid set data' })
  const { lastInsertRowid } = db.prepare('INSERT INTO exercise_sets (session_id,exercise_id,set_index,reps,weight,type,done) VALUES (?,?,?,?,?,?,1)')
    .run(s.id, b.data.exercise_id, b.data.set_index, b.data.reps, b.data.weight, b.data.type)
  res.json({ id: lastInsertRowid })
})

router.put('/sessions/:id/sets/:setId', requireAuth, (req, res) => {
  const s = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!s) return res.status(404).json({ error: 'Session not found' })
  const { reps, weight, done, type } = req.body
  db.prepare(`UPDATE exercise_sets SET reps = COALESCE(?,reps), weight = COALESCE(?,weight), done = COALESCE(?,done), type = COALESCE(?,type) WHERE id = ? AND session_id = ?`)
    .run(reps ?? null, weight ?? null, done === undefined ? null : done ? 1 : 0, type ?? null, req.params.setId, s.id)
  res.json({ ok: true })
})

// Personal records list
router.get('/records', requireAuth, (req, res) => {
  const prs = db.prepare(`SELECT pr.*, e.name, e.muscle_group, e.equipment FROM personal_records pr JOIN exercises e ON e.id = pr.exercise_id
    WHERE pr.user_id = ? ORDER BY pr.achieved_at DESC`).all(req.uid)
  res.json({ records: prs })
})

export default router
