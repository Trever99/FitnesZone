import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'
import { evalAchievements } from '../services/achievements.js'
import path from 'node:path'
import { UPLOADS_DIR } from '../db.js'
import fs from 'node:fs'

const router = Router()

// ---------- Measurements ----------
router.get('/measurements', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM measurements WHERE user_id = ? ORDER BY entry_date DESC LIMIT 200').all(req.uid)
  res.json({ measurements: rows })
})

router.post('/measurements', requireAuth, (req, res) => {
  const b = req.body
  if (!b.weight_kg && !b.body_fat && !b.chest && !b.waist && !b.arm && !b.thigh && !b.shoulder)
    return res.status(400).json({ error: 'Add at least one measurement.' })
  const { lastInsertRowid } = db.prepare('INSERT INTO measurements (user_id,entry_date,weight_kg,body_fat,chest,waist,arm,thigh,shoulder) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(req.uid, b.entry_date, b.weight_kg ?? null, b.body_fat ?? null, b.chest ?? null, b.waist ?? null, b.arm ?? null, b.thigh ?? null, b.shoulder ?? null)
  if (b.weight_kg) {
    const cur = (db.prepare('SELECT MAX(entry_date) d FROM measurements WHERE user_id = ? AND weight_kg IS NOT NULL AND id != ?').get(req.uid, lastInsertRowid)?.d) || ''
    // update profile weight to latest measurement
    if (b.entry_date >= cur) db.prepare('UPDATE profiles SET weight_kg = ? WHERE user_id = ?').run(b.weight_kg, req.uid)
  }
  evalAchievements(db, req.uid)
  res.json({ id: lastInsertRowid })
})

router.delete('/measurements/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM measurements WHERE id = ? AND user_id = ?').run(req.params.id, req.uid)
  res.json({ ok: true })
})

// ---------- Photos ----------
router.get('/photos', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id,file,label,taken_at FROM progress_photos WHERE user_id = ? ORDER BY taken_at DESC').all(req.uid)
  res.json({ photos: rows })
})

router.post('/photos', requireAuth, (req, res) => {
  const { dataUrl, label = '' } = req.body
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dataUrl || '')) return res.status(400).json({ error: 'Upload a JPG, PNG or WebP image.' })
  const ext = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp' }[dataUrl.match(/data:image\/(\w+);/)[1]]
  const file = `p${req.uid}_${Date.now()}.${ext}`
  fs.writeFileSync(path.join(UPLOADS_DIR, file), Buffer.from(dataUrl.split(',')[1], 'base64'))
  db.prepare('INSERT INTO progress_photos (user_id,file,label,taken_at) VALUES (?,?,?,?)').run(req.uid, file, label, new Date().toISOString().slice(0, 10))
  res.json({ ok: true })
})

router.delete('/photos/:id', requireAuth, (req, res) => {
  const p = db.prepare('SELECT file FROM progress_photos WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (p) { try { fs.unlinkSync(path.join(UPLOADS_DIR, p.file)) } catch {} ; db.prepare('DELETE FROM progress_photos WHERE id = ?').run(p.file ? req.params.id : -1) }
  res.json({ ok: true })
})

// ---------- Achievements ----------
router.get('/achievements', requireAuth, (req, res) => {
  const all = db.prepare('SELECT * FROM achievements ORDER BY goal').all()
  const earned = db.prepare('SELECT a.id, ua.earned_at FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = ?').all(req.uid)
  const earnedMap = new Map(earned.map((e) => [e.id, e.earned_at]))
  // streak + muscle stats for display
  const stats = evalAchievements(db, req.uid)
  const muscleDist = db.prepare(`SELECT e.muscle_group m, COUNT(*) n FROM exercise_sets es JOIN sessions s ON s.id = es.session_id JOIN exercises e ON e.id = es.exercise_id WHERE s.user_id = ? GROUP BY e.muscle_group ORDER BY n DESC LIMIT 8`).all(req.uid)
  res.json({ achievements: all.map((a) => ({ ...a, earnedAt: earnedMap.get(a.id) || null })), stats, muscleDist })
})

export default router
