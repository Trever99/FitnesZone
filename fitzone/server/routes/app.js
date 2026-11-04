import { Router } from 'express'
import { db, today } from '../db.js'
import { requireAuth } from '../auth.js'
import { evalAchievements, computeStreak, levelInfo } from '../services/achievements.js'
import bcrypt from 'bcryptjs'

const router = Router()

// Everything the dashboard needs in one call
router.get('/dashboard', requireAuth, (req, res) => {
  const uid = req.uid
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(uid)
  const p = profile ? { ...profile, equipment: JSON.parse(profile.equipment || '[]') } : null
  const now = Date.now()
  const d30 = today() && new Date(now - 30 * 86400000).toISOString().slice(0, 10)
  const d7 = new Date(now - 7 * 86400000).toISOString().slice(0, 10)

  const stats = db.prepare(`SELECT COUNT(*) workouts, COALESCE(SUM(total_volume),0) volume, COALESCE(AVG(duration_sec),0) avgDur,
    COALESCE(SUM(duration_sec),0) totalSec FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL`).get(uid)
  const workouts7 = db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL AND started_at >= ?').get(uid, new Date(now - 7 * 86400000).getTime()).n
  const workouts28 = db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL AND started_at >= ?').get(uid, new Date(now - 28 * 86400000).getTime()).n
  const streak = computeStreak(db, uid)
  const lvl = levelInfo(stats.volume, stats.workouts)

  // weight history
  const weights = db.prepare('SELECT entry_date, weight_kg FROM measurements WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY entry_date').all(uid)
  // last 14 days workout frequency
  const freq = db.prepare(`SELECT strftime('%Y-%m-%d', started_at/1000, 'unixepoch', 'localtime') d, COUNT(*) n, COALESCE(SUM(total_volume),0) v
    FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL AND started_at >= ? GROUP BY d`).all(uid, new Date(now - 14 * 86400000).getTime())

  // nutrition today
  const foodToday = db.prepare(`SELECT COALESCE(SUM(f.calories * fe.servings),0) kcal, COALESCE(SUM(f.protein * fe.servings),0) protein FROM food_entries fe JOIN foods f ON f.id = fe.food_id WHERE fe.user_id = ? AND fe.entry_date = ?`).get(uid, today())

  // muscle distribution (30d)
  const muscle = db.prepare(`SELECT e.muscle_group m, COUNT(DISTINCT s.id) n FROM exercise_sets es JOIN sessions s ON s.id = es.session_id JOIN exercises e ON e.id = es.exercise_id WHERE s.user_id = ? AND s.started_at >= ? GROUP BY e.muscle_group ORDER BY n DESC LIMIT 6`).all(uid, new Date(now - 30 * 86400000).getTime())

  // plan + today's workout suggestion
  const activePlan = db.prepare('SELECT * FROM plans WHERE user_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1').get(uid)
  let todayWorkout = null
  if (activePlan) {
    const days = JSON.parse(activePlan.days)
    const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]
    const match = days.find((x) => x.day === dow)
    if (match?.type === 'workout') {
      const routine = db.prepare('SELECT * FROM routines WHERE user_id = ? AND name = ? ORDER BY created_at DESC LIMIT 1').get(uid, match.name)
      if (routine) {
        const ex = db.prepare(`SELECT re.target_reps tr, re.rest_seconds rs, e.name, e.muscle_group FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id WHERE re.routine_id = ? ORDER BY re.position LIMIT 4`).all(routine.id)
        todayWorkout = { routineId: routine.id, name: routine.name, exercises: ex, duration: 45 + ex.length * 5 }
      } else todayWorkout = { name: match.name, muscle_groups: match.muscle_groups, duration: 50 }
    }
  }
  const goals = db.prepare(`SELECT a.*, ua.earned_at FROM achievements a LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ?`).all(uid)

  res.json({
    profile: p, user: db.prepare('SELECT name,email,email_verified FROM users WHERE id = ?').get(uid),
    stats: { ...stats, workouts7, workouts28, streak, level: lvl, goalRate: Math.min(100, Math.round((workouts28 / ((p?.days_per_week || 3) * 4)) * 100)) },
    nutrition: { target: p?.calorie_target || 2500, eaten: Math.round(foodToday.kcal), protein: Math.round(foodToday.protein) },
    weightHistory: weights.slice(-40),
    frequency: freq, muscle,
    todayWorkout,
    recentAchievements: goals.filter((g) => g.earned_at).slice(-6).reverse().map((g) => ({ name: g.name, icon: g.icon, description: g.description })),
  })
})

// Analytics with period filter
router.get('/analytics', requireAuth, (req, res) => {
  const uid = req.uid
  const period = Number(req.query.period) || 7
  const since = period === -1 ? 0 : Date.now() - period * 86400000
  const check = db.prepare(`SELECT * FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL AND started_at >= ? ORDER BY started_at`).all(uid, since)
  const totals = check.reduce((a, s) => ({ volume: a.volume + s.total_volume, sets: a.sets + s.total_volume }), { volume: 0, sets: 0 })
  const setCount = db.prepare('SELECT COUNT(*) n FROM exercise_sets es JOIN sessions s ON s.id = es.session_id WHERE s.user_id = ? AND es.done = 1 AND s.started_at >= ?').get(uid, since).n
  const byDay = {}
  for (const s of check) {
    const d = new Date(s.started_at).toISOString().slice(0, 10)
    byDay[d] ??= { date: d, workouts: 0, volume: 0, minutes: 0 }
    byDay[d].workouts++; byDay[d].volume += Math.round(s.total_volume / 100) / 10; byDay[d].minutes += Math.round(s.duration_sec / 60)
  }
  const series = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
  const muscleDist = db.prepare(`SELECT e.muscle_group m, COUNT(*) n FROM exercise_sets es JOIN sessions s ON s.id = es.session_id JOIN exercises e ON e.id = es.exercise_id WHERE s.user_id = ? AND s.started_at >= ? GROUP BY e.muscle_group ORDER BY n DESC`).all(uid, since)
  const e1rm = db.prepare(`SELECT e.name, MAX(es.weight * (1 + es.reps/30)) e1rm FROM exercise_sets es JOIN sessions s ON s.id = es.session_id JOIN exercises e ON e.id = es.exercise_id WHERE s.user_id = ? AND es.done = 1 AND es.weight > 0 GROUP BY e.name ORDER BY e1rm DESC LIMIT 8`).all(uid)
  const prs = db.prepare(`SELECT pr.*, e.name FROM personal_records pr JOIN exercises e ON e.id = pr.exercise_id WHERE pr.user_id = ? ORDER BY pr.achieved_at DESC LIMIT 10`).all(uid)
  const weights = db.prepare('SELECT entry_date, weight_kg FROM measurements WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY entry_date').all(uid)
  const weeklyFreq = db.prepare(`SELECT strftime('%Y-%W', started_at/1000, 'unixepoch') wk, COUNT(*) n FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL AND started_at >= ? GROUP BY wk`).all(uid, since)
  evalAchievements(db, uid)
  res.json({
    totals: { workouts: check.length, volume: Math.round(totals.volume / 100) / 10, sets: setCount, totalMin: check.reduce((a, s) => a + s.duration_sec, 0) / 60, avgMin: check.length ? Math.round(check.reduce((a, s) => a + s.duration_sec, 0) / check.length / 60) : 0 },
    series, muscleDist, e1rm: e1rm.map((r) => ({ name: r.name, e1rm: Math.round(r.e1rm * 10) / 10 })), prs, weights, weeklyFreq: weeklyFreq.map((w) => ({ wk: w.wk, n: w.n })),
  })
})

// Profile
router.get('/profile', requireAuth, (req, res) => {
  const u = db.prepare('SELECT id,email,name,email_verified,created_at FROM users WHERE id = ?').get(req.uid)
  const p = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.uid)
  const stats = evalAchievements(db, req.uid)
  const lvl = levelInfo(db.prepare('SELECT COALESCE(SUM(total_volume),0) v FROM sessions WHERE user_id = ?').get(req.uid).v, stats.workouts)
  res.json({ user: u, profile: p ? { ...p, equipment: JSON.parse(p.equipment || '[]') } : null, stats, level: lvl })
})

router.put('/profile', requireAuth, (req, res) => {
  const b = req.body
  if (b.name !== undefined) {
    if (!b.name || b.name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' })
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(b.name.trim(), req.uid)
  }
  if (b.password) {
    if (b.password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(b.password, 10), req.uid)
    delete b.password
  }
  const allowed = ['age','gender','height_cm','weight_kg','target_weight','experience','goal','location','days_per_week','duration_pref','calorie_target']
  const settings = Object.fromEntries(allowed.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]))
  if (b.equipment !== undefined) settings.equipment = JSON.stringify(Array.isArray(b.equipment) ? b.equipment : String(b.equipment).split(',').filter(Boolean))
  if (Object.keys(settings).length) {
    const cur = db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(req.uid)
    if (cur) {
      const sets = Object.keys(settings).map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE profiles SET ${sets} WHERE user_id = ?`).run(...Object.values(settings), req.uid)
    } else {
      const cols = ['user_id', ...Object.keys(settings)]
      db.prepare(`INSERT INTO profiles (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(req.uid, ...Object.values(settings))
    }
  }
  res.json({ ok: true })
})

// Account deletion
router.delete('/account', requireAuth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.uid)
  res.json({ ok: true })
})

// Data export
router.get('/export', requireAuth, (req, res) => {
  const uid = req.uid
  const tables = {
    profiles: db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(uid),
    sessions: db.prepare('SELECT * FROM sessions WHERE user_id = ?').all(uid),
    exercise_sets: db.prepare(`SELECT es.* FROM exercise_sets es JOIN sessions s ON s.id = es.session_id WHERE s.user_id = ?`).all(uid),
    routines: db.prepare('SELECT * FROM routines WHERE user_id = ?').all(uid),
    routine_exercises: db.prepare('SELECT re.* FROM routine_exercises re JOIN routines r ON r.id = re.routine_id WHERE r.user_id = ?').all(uid),
    plans: db.prepare('SELECT * FROM plans WHERE user_id = ?').all(uid),
    measurements: db.prepare('SELECT * FROM measurements WHERE user_id = ?').all(uid),
    food_entries: db.prepare('SELECT * FROM food_entries WHERE user_id = ?').all(uid),
    personal_records: db.prepare('SELECT * FROM personal_records WHERE user_id = ?').all(uid),
    achievements: db.prepare('SELECT a.* FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = ?').all(uid),
    notifications: db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(uid),
    chat_messages: db.prepare('SELECT * FROM chat_messages WHERE user_id = ?').all(uid),
  }
  res.setHeader('Content-Disposition', `attachment; filename="fitzone-export-${today()}.json"`)
  res.json({ exportedAt: new Date().toISOString(), data: tables })
})

// Onboarding
router.post('/onboarding', requireAuth, (req, res) => {
  const b = req.body
  if (!b.age || !b.height_cm || !b.weight_kg || !b.goal) return res.status(400).json({ error: 'Complete all required fields.' })
  const equipment = JSON.stringify(Array.isArray(b.equipment) ? b.equipment : [])
  const goalKcal = { muscle_building: 2900, fat_loss: 2100, strength: 2800, endurance: 2500, general_fitness: 2400 }
  const calorie_target = b.calorie_target || (goalKcal[b.goal] || 2500)
  const cur = db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(req.uid)
  const vals = [b.age, b.gender || null, b.height_cm, b.weight_kg, b.target_weight ?? null, b.experience || 'beginner', b.goal, b.location || 'gym', equipment, b.days_per_week || 3, b.duration_pref || 60, calorie_target, 1]
  if (cur) db.prepare(`UPDATE profiles SET age=?, gender=?, height_cm=?, weight_kg=?, target_weight=?, experience=?, goal=?, location=?, equipment=?, days_per_week=?, duration_pref=?, calorie_target=?, onboarded=? WHERE user_id=?`).run(...vals, req.uid)
  else db.prepare(`INSERT INTO profiles (age,gender,height_cm,weight_kg,target_weight,experience,goal,location,equipment,days_per_week,duration_pref,calorie_target,onboarded,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...vals, req.uid)
  db.prepare('INSERT INTO measurements (user_id,entry_date,weight_kg) VALUES (?,?,?)').run(req.uid, today(), b.weight_kg)
  // auto-generate starter plan from onboarding answers
  generateStarterPlan(req.uid, b)
  evalAchievements(db, req.uid)
  db.prepare('INSERT INTO notifications (user_id,title,body,kind,created_at) VALUES (?,?,?,?,?)')
    .run(req.uid, 'Profile complete', 'Your personalized plan is ready. Time to train!', 'success', Date.now())
  res.json({ ok: true })
})

router.get('/notifications', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.uid)
  res.json({ notifications: rows })
})
router.post('/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.uid)
  res.json({ ok: true })
})

function generateStarterPlan(uid, b) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const n = Number(b.days_per_week) || 3
  let pattern
  if (n <= 3) pattern = ['Full Body A', 'rest', 'Full Body B', 'rest', 'Full Body C', 'rest', 'rest']
  else if (n === 4) pattern = ['Upper Power', 'Lower Power', 'rest', 'Upper Hypertrophy', 'Lower Hypertrophy', 'rest', 'rest']
  else if (n === 5) pattern = ['Push', 'Pull', 'rest', 'Legs', 'Upper Pump', 'Cardio & Core', 'rest']
  else pattern = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'rest']
  const groups = { Push: 'Chest, Shoulders, Triceps', Pull: 'Back, Biceps, Forearms', Legs: 'Quads, Glutes, Hamstrings, Calves' }
  const daysOut = days.map((d, i) => pattern[i] === 'rest' ? { day: d, type: 'rest' } : { day: d, type: 'workout', name: pattern[i], muscle_groups: groups[pattern[i]] || 'Full Body' })
  const split = n <= 3 ? 'full_body' : n === 4 ? 'upper_lower' : 'push_pull_legs'
  db.prepare('INSERT INTO plans (user_id,name,split,days,active,created_at) VALUES (?,?,?,?,1,?)')
    .run(uid, `${n}-Day ${b.location === 'home' ? 'Home' : 'Gym'} Plan`, split, JSON.stringify(daysOut), Date.now())
}

export default router
