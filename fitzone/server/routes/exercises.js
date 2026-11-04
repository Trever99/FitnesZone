import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

const MUSCLES = ['Chest','Back','Legs','Shoulders','Biceps','Triceps','Forearms','Calves','Glutes','Abs','Cardio']
const GROUP_MAP = {
  Quads: 'Legs', Hamstrings: 'Legs', Quadriceps: 'Legs', Calves: 'Calves', Glutes: 'Glutes',
  Abs: 'Abs', Core: 'Abs', 'Rear Delts': 'Shoulders', Traps: 'Shoulders', Obliques: 'Abs',
}
const EGROUPS = ['All','Chest','Back','Legs','Shoulders','Biceps','Triceps','Forearms','Calves','Glutes','Abs','Cardio']
const EQUIPMENT = ['All','Barbell','Dumbbells','Machine','Cables','Bodyweight','Resistance Bands']

router.get('/meta', (_req, res) => res.json({
  muscleGroups: MUSCLES, equipment: EQUIPMENT.slice(1),
  difficulties: ['Beginner','Intermediate','Advanced'], browseGroups: EGROUPS,
}))

router.get('/', (req, res) => {
  const { q = '', group = 'All', equipment = 'All', difficulty = 'All' } = req.query
  let rows = db.prepare('SELECT id,name,muscle_group,secondary_muscles,equipment,difficulty FROM exercises').all()
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(String(q).toLowerCase()) || (r.muscle_group + ',' + r.equipment).toLowerCase().includes(String(q).toLowerCase()))
  if (group !== 'All') {
    const g = GROUP_MAP[group] || group
    rows = rows.filter((r) => r.muscle_group === g || r.muscle_group.split(',').map((m) => m.trim()).includes(group))
  }
  if (equipment !== 'All') rows = rows.filter((r) => r.equipment === equipment)
  if (difficulty !== 'All') rows = rows.filter((r) => r.difficulty === difficulty)
  rows.sort((a, b) => a.muscle_group.localeCompare(b.muscle_group) || a.name.localeCompare(b.name))
  res.json({ count: rows.length, exercises: rows })
})

router.get('/group/:group', (req, res) => {
  const g = GROUP_MAP[req.params.group] || req.params.group
  const rows = db.prepare('SELECT id,name,muscle_group,secondary_muscles,equipment,difficulty FROM exercises').all()
    .filter((r) => r.muscle_group === g || GROUP_MAP[r.muscle_group] === g)
  res.json({ exercises: rows })
})

router.get('/:id', requireAuth, (req, res) => {
  const ex = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id)
  if (!ex) return res.status(404).json({ error: 'Exercise not found' })
  // user's personal history with this exercise
  const best = db.prepare(`SELECT MAX(exercise_sets.weight * (1 + exercise_sets.reps / 30)) n1, MAX(exercise_sets.weight) w FROM exercise_sets
    JOIN sessions s ON s.id = exercise_sets.session_id WHERE s.user_id = ? AND exercise_sets.exercise_id = ?`).get(req.uid, ex.id)
  const pr = db.prepare('SELECT * FROM personal_records WHERE user_id = ? AND exercise_id = ? ORDER BY e1rm DESC LIMIT 1').get(req.uid, ex.id)
  const lastSets = db.prepare(`SELECT exercise_sets.reps, exercise_sets.weight, exercise_sets.set_index, s.started_at FROM exercise_sets
    JOIN sessions s ON s.id = exercise_sets.session_id WHERE s.user_id = ? AND exercise_sets.exercise_id = ? ORDER BY s.started_at DESC LIMIT 6`).all(req.uid, ex.id)
  const similar = db.prepare(`SELECT id,name,muscle_group,equipment,difficulty FROM exercises WHERE muscle_group = ? AND id != ? LIMIT 6`).all(ex.muscle_group, ex.id)
  res.json({ exercise: ex, best: { weight: best?.w || 0, e1rm: Math.round(best?.n1 || 0) }, pr, lastSets, similar })
})

export default router
