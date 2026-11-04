import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from './db.js'

const SECRET = process.env.JWT_SECRET || 'fitzone-dev-secret-change-me'
export const sign = (uid) => jwt.sign({ uid }, SECRET, { expiresIn: '30d' })

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    req.uid = jwt.verify(token, SECRET).uid
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
}

const router = Router()
const emailOk = (e) => z.string().email().safeParse(e).success

router.post('/register', (req, res) => {
  const s = z.object({ name: z.string().min(2).max(60), email: z.string().email(), password: z.string().min(8).max(100) }).safeParse(req.body)
  if (!s.success) return res.status(400).json({ error: 'Enter a valid name, email and a password of at least 8 characters.' })
  const { name, email, password } = s.data
  const e = email.toLowerCase().trim()
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(e)) return res.status(409).json({ error: 'An account with this email already exists.' })
  const token = jwt.sign({ e }, SECRET, { expiresIn: '24h' })
  const { lastInsertRowid: uid } = db.prepare('INSERT INTO users (email,password_hash,name,email_verified,verify_token,created_at) VALUES (?,?,?,0,?,?)')
    .run(e, bcrypt.hashSync(password, 10), name, token, Date.now())
  db.prepare('INSERT INTO notifications (user_id,title,body,created_at) VALUES (?,?,?,?)')
    .run(uid, 'Welcome to FITZONE', 'Complete your profile to unlock your personalized dashboard.', Date.now())
  res.json({ token, verifyToken: token, message: 'Account created. Check your inbox to verify your email.' })
})

router.post('/login', (req, res) => {
  const e = (req.body.email || '').toLowerCase().trim()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(e)
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash))
    return res.status(401).json({ error: 'Incorrect email or password.' })
  res.json({ token: sign(user.id), mustOnboard: !db.prepare('SELECT onboarded FROM profiles WHERE user_id = ?').get(user.id)?.onboarded })
})

router.post('/forgot-password', (req, res) => {
  const e = (req.body.email || '').toLowerCase().trim()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(e)
  // Always 200 to avoid account enumeration
  if (user) {
    const token = jwt.sign({ e, r: true }, SECRET, { expiresIn: '1h' })
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, Date.now() + 3600000, user.id)
  }
  res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' })
})

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body
  try {
    const p = jwt.verify(token, SECRET)
    const user = db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?').get(token, Date.now())
    if (!user || user.email !== p.e) throw new Error()
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(bcrypt.hashSync(password, 10), user.id)
    res.json({ ok: true, message: 'Password updated. You can now log in.' })
  } catch {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' })
  }
})

router.post('/verify-email', (req, res) => {
  try {
    const p = jwt.verify(req.body.token, SECRET)
    const user = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(req.body.token)
    if (!user || user.email !== p.e) throw new Error()
    db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?').run(user.id)
    res.json({ ok: true, message: 'Email verified successfully.' })
  } catch {
    res.status(400).json({ error: 'Verification link is invalid or expired.' })
  }
})

router.get('/me', requireAuth, (req, res) => {
  const u = db.prepare('SELECT id,email,name,email_verified,created_at FROM users WHERE id = ?').get(req.uid)
  const p = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.uid)
  res.json({ user: u, profile: p ? { ...p, equipment: JSON.parse(p.equipment || '[]') } : null })
})

export default router
