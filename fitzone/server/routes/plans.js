import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

router.get('/plans', requireAuth, (req, res) => {
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY active DESC, created_at DESC').all(req.uid)
  res.json({ plans: plans.map((p) => ({ ...p, days: JSON.parse(p.days) })) })
})

router.post('/plans', requireAuth, (req, res) => {
  const { name, split, days = [], active = false } = req.body
  if (!name || !split) return res.status(400).json({ error: 'Plan needs a name and split type.' })
  const tx = db.transaction(() => {
    if (active) db.prepare('UPDATE plans SET active = 0 WHERE user_id = ?').run(req.uid)
    const { lastInsertRowid } = db.prepare('INSERT INTO plans (user_id,name,split,days,active,created_at) VALUES (?,?,?,?,?,?)')
      .run(req.uid, name, split, JSON.stringify(days), active ? 1 : 0, Date.now())
    return lastInsertRowid
  })
  res.json({ id: tx() })
})

router.post('/plans/:id/activate', requireAuth, (req, res) => {
  const tx = db.transaction(() => {
    db.prepare('UPDATE plans SET active = 0 WHERE user_id = ?').run(req.uid)
    db.prepare('UPDATE plans SET active = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.uid)
  })
  tx()
  res.json({ ok: true })
})

router.put('/plans/:id', requireAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!p) return res.status(404).json({ error: 'Plan not found' })
  db.prepare('UPDATE plans SET name = ?, days = ? WHERE id = ?').run(req.body.name ?? p.name, JSON.stringify(req.body.days ?? JSON.parse(p.days)), p.id)
  res.json({ ok: true })
})

router.delete('/plans/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM plans WHERE id = ? AND user_id = ?').run(req.params.id, req.uid)
  res.json({ ok: true })
})

export default router
