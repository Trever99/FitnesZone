import { Router } from 'express'
import { z } from 'zod'
import { db, today } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

router.get('/day', requireAuth, (req, res) => {
  const date = req.query.date || today()
  const entries = db.prepare(`SELECT fe.*, f.name, f.brand, f.serving, f.calories, f.protein, f.carbs, f.fat, f.fiber
    FROM food_entries fe JOIN foods f ON f.id = fe.food_id WHERE fe.user_id = ? AND fe.entry_date = ? ORDER BY fe.created_at`).all(req.uid, date)
  const totals = entries.reduce((a, e) => ({
    calories: a.calories + e.calories * e.servings, protein: a.protein + e.protein * e.servings,
    carbs: a.carbs + e.carbs * e.servings, fat: a.fat + e.fat * e.servings, fiber: a.fiber + e.fiber * e.servings,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
  const meals = { breakfast: [], lunch: [], dinner: [], snack: [] }
  for (const e of entries) (meals[e.meal] || meals.snack).push(e)
  const water = (db.prepare('SELECT ml FROM water_log WHERE user_id = ? AND log_date = ?').get(req.uid, date)?.ml) || 0
  const profile = db.prepare('SELECT calorie_target FROM profiles WHERE user_id = ?').get(req.uid)
  const target = profile?.calorie_target || 2500
  res.json({ date, meals, totals, target, water })
})

router.get('/history', requireAuth, (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 60)
  const rows = db.prepare(`SELECT fe.entry_date, f.calories, f.protein, f.carbs, f.fat, fe.servings, fe.meal
    FROM food_entries fe JOIN foods f ON f.id = fe.food_id WHERE fe.user_id = ? GROUP BY fe.entry_date`).all(req.uid)
  // proper aggregation
  const all = db.prepare(`SELECT fe.entry_date, fe.servings, f.calories, f.protein, f.carbs, f.fat FROM food_entries fe JOIN foods f ON f.id = fe.food_id WHERE fe.user_id = ? AND fe.entry_date >= ?`).all(req.uid, new Date(Date.now() - days * 86400000).toISOString().slice(0, 10))
  const byDay = {}
  for (const r of all) {
    byDay[r.entry_date] ??= { date: r.entry_date, calories: 0, protein: 0, carbs: 0, fat: 0 }
    byDay[r.entry_date].calories += r.calories * r.servings
    byDay[r.entry_date].protein += r.protein * r.servings
    byDay[r.entry_date].carbs += r.carbs * r.servings
    byDay[r.entry_date].fat += r.fat * r.servings
  }
  res.json({ days: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-days) })
})

router.patch('/water', requireAuth, (req, res) => {
  const { date = today(), delta = 0 } = req.body
  const cur = (db.prepare('SELECT ml FROM water_log WHERE user_id = ? AND log_date = ?').get(req.uid, date)?.ml) || 0
  const ml = Math.max(0, cur + delta)
  db.prepare('INSERT INTO water_log (user_id,log_date,ml) VALUES (?,?,?) ON CONFLICT (user_id,log_date) DO UPDATE SET ml = ?')
    .run(req.uid, date, ml, ml)
  res.json({ ml })
})

router.get('/foods', requireAuth, (req, res) => {
  let list = db.prepare('SELECT * FROM foods').all()
  const { q = '', limit = 25 } = req.query
  if (q) list = list.filter((f) => f.name.toLowerCase().includes(String(q).toLowerCase()))
  list.sort((a, b) => a.name.localeCompare(b.name))
  res.json({ foods: list.slice(0, Math.min(Number(limit), 50)) })
})

router.post('/foods', requireAuth, (req, res) => {
  const s = z.object({ name: z.string().min(2).max(80), serving: z.string().max(30).default('1 serving'), calories: z.number().min(0).max(3000),
    protein: z.number().min(0).max(200).default(0), carbs: z.number().min(0).max(300).default(0),
    fat: z.number().min(0).max(200).default(0), fiber: z.number().min(0).max(100).default(0) }).safeParse(req.body)
  if (!s.success) return res.status(400).json({ error: 'Enter a name and calories at minimum.' })
  const { lastInsertRowid } = db.prepare('INSERT INTO foods (name,serving,calories,protein,carbs,fat,fiber,user_id) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(s.data.name, s.data.serving, s.data.calories, s.data.protein, s.data.carbs, s.data.fat, s.data.fiber, req.uid)
  res.json({ id: lastInsertRowid })
})

router.post('/entries', requireAuth, (req, res) => {
  const s = z.object({ food_id: z.number(), meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), servings: z.number().min(0.1).max(20).default(1), date: z.string().optional() }).safeParse(req.body)
  if (!s.success) return res.status(400).json({ error: 'Invalid entry.' })
  db.prepare('INSERT INTO food_entries (user_id,food_id,meal,servings,entry_date,created_at) VALUES (?,?,?,?,?,?)')
    .run(req.uid, s.data.food_id, s.data.meal, s.data.servings, s.data.date || today(), Date.now())
  res.json({ ok: true })
})

router.delete('/entries/:id', requireAuth, (req, res) => {
  const e = db.prepare('SELECT fe.*, f.name FROM food_entries fe JOIN foods f ON f.id = fe.food_id WHERE fe.id = ? AND fe.user_id = ?').get(req.params.id, req.uid)
  if (!e) return res.status(404).json({ error: 'Entry not found' })
  db.prepare('DELETE FROM food_entries WHERE id = ?').run(e.id)
  res.json({ ok: true, name: e.name })
})

router.get('/summary', requireAuth, (req, res) => {
  const uid = req.uid
  const logged = db.prepare('SELECT COUNT(*) n FROM food_entries WHERE user_id = ? AND entry_date >= ?').get(uid, new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)).n
  res.json({ activeDays30: new Set(db.prepare('SELECT entry_date FROM food_entries WHERE user_id = ? AND entry_date >= ?').all(uid, new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).map((r) => r.entry_date)).size, entries60: logged })
})

export default router
