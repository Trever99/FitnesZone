import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

router.get('/messages', requireAuth, (req, res) => {
  const msgs = db.prepare('SELECT id,role,content,created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 40').all(req.uid)
  res.json({ messages: msgs.reverse() })
})

router.post('/messages', requireAuth, async (req, res) => {
  const uid = req.uid
  const text = (req.body.content || '').toString().trim().slice(0, 2000)
  if (!text) return res.status(400).json({ error: 'Type a message first.' })
  db.prepare('INSERT INTO chat_messages (user_id,role,content,created_at) VALUES (?,?,?,?)').run(uid, 'user', text, Date.now())
  let reply, demoMode = true
  try {
    const r = await generateReply(uid, text)
    reply = r.reply; demoMode = r.demoMode
  } catch (err) {
    console.error('[coach]', err.message)
    reply = "I'm having trouble analyzing that right now — try asking about routines, nutrition, or your training analysis!"
  }
  db.prepare('INSERT INTO chat_messages (user_id,role,content,created_at) VALUES (?,?,?,?)').run(uid, 'assistant', reply, Date.now())
  res.json({ reply, demoMode })
})

async function generateReply(uid, text) {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(uid)
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(uid)
  const p = profile ? { ...profile, equipment: JSON.parse(profile.equipment || '[]') } : {}
  const low = text.toLowerCase()

  const stats = {
    workouts30: db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL AND started_at > ?').get(uid, Date.now() - 30 * 86400000).n,
    lastSession: db.prepare('SELECT * FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 1').get(uid),
    volume28: db.prepare('SELECT COALESCE(SUM(total_volume),0) v FROM sessions WHERE user_id = ? AND started_at > ?').get(uid, Date.now() - 28 * 86400000).v,
  }
  const weekly = stats.workouts30 / 4.3

  if (process.env.OPENAI_API_KEY) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `You are FITZONE Coach, a supportive certified personal trainer. User: ${user?.name}, ${p.age || '?'}y, ${p.weight_kg || '?'}kg, goal ${p.goal || 'general fitness'}, ${p.experience || 'beginner'}, trains ${p.days_per_week || 3}x/week (${p.location || 'gym'}). Recent: ${stats.workouts30} workouts in 30 days. Give practical, safe guidance. No medical diagnoses. Keep it under 180 words.` },
            { role: 'user', content: text },
          ],
          temperature: 0.7, max_tokens: 400,
        }),
      })
      if (r.ok) {
        const j = await r.json()
        return j.choices?.[0]?.message?.content ? { reply: j.choices[0].message.content, demoMode: false } : demoReply(text, stats, p, weekly)
      }
    } catch { /* fall through to demo */
    }
  }

  return { reply: demoReply(text, stats, p, weekly, uid), demoMode: true }
}

function demoReply(text, stats, p, weekly, uid) {
  const low = text.toLowerCase()
  const last = stats.lastSession ? `${stats.lastSession.name} ${Math.round(stats.lastSession.total_volume / 100) / 10}t volume` : 'no completed sessions yet'
  const profileLine = `You're training ${p.days_per_week || 3}x/week (${p.location || 'gym'}), goal: ${String(p.goal || 'general fitness').replace('_', ' ')}, ${p.experience || 'beginner'} level.`

  const cards = [
    { re: /progressive overload|heavier|plateau/i, gen: () => {
        const recent = db.prepare(`SELECT e.name, es.weight, es.reps FROM exercise_sets es JOIN sessions s ON s.id = es.session_id JOIN exercises e ON e.id = es.exercise_id WHERE s.user_id = ? AND es.done = 1 ORDER BY s.started_at DESC LIMIT 12`).all(uid)
        const firstLine = recent[0]?.name ? `Last sets logged: ${recent[0].name} at ${recent[0].weight} kg × ${recent[0].reps} reps.` : 'Log a workout and I can suggest exact numbers.'
        return `**Progressive overload plan**\n${firstLine}\n\nThis week, try one of:\n• Add 2.5 kg on your strongest compound and drop 1 rep\n• Add +1 rep per set at the same weight\n• Add a set and cut rest to 60\u201375s\n\nOnly increase one variable per exercise per week \u2014 that\u2019s how you progress without burning out. 🏋️`
      } },
    { re: /routine|program|plan|split/i, gen: () => `Based on your profile I'd suggest a ${Number(p.days_per_week) >= 5 ? 'Push/Pull/Legs split' : Number(p.days_per_week) === 4 ? 'Upper/Lower split' : 'Full Body split'}.\n\n📅 ${Number(p.days_per_week) >= 5 ? 'P \u2013 P \u2013 L \u2013 P \u2013 P \u2013 L + rest' : Number(p.days_per_week) === 4 ? 'Upper \u2013 Lower \u2013 rest \u2013 Upper \u2013 Lower \u2013 rest \u2013 rest' : 'Full Body on Mon/Wed/Fri'}\n\nOpen the **Planner** tab and tap \u201cGenerate plan\u201d \u2014 I\u2019ll adapt exercises to your equipment (${p.equipment?.length ? p.equipment.length + ' types available' : 'gym setup'}) and experience level. You can edit every exercise from there.` },
    { re: /nutrition|diet|protein|eat|calorie|food/i, gen: () => `Nutrition targets for your goal:\n\n🥩 **Protein:** ${Math.round(Number(p.weight_kg || 75) * 1.8)} g/day (${String(p.goal).includes('fat') ? '1.9 g/kg on a cut' : '1.8 g/kg'})\n🍚 **Calories:** ${p.calorie_target || 2500} kcal ${String(p.goal).includes('fat') ? '\u2192 aim ~400 kcal below maintenance for 0.5 kg/week' : String(p.goal).includes('muscle') ? '\u2192 250\u2013350 kcal surplus' : '\u2192 maintenance, adjust monthly'}\n💧 **Water:** 2\u20133 L/day\n\nLog meals in the **Nutrition** tab \u2014 I\u2019ll compare intake to your target automatically.\n\n⚠️ I can\u2019t provide medical diagnoses — for medical conditions or eating concerns, see a professional.` },
    { re: /technique|form|how do i|how to/i, gen: () => { const ex = db.prepare(`SELECT name, instructions FROM exercises WHERE name LIKE ? LIMIT 1`).get('%' + text.replace(/[^a-z ]/gi, '').trim().split(/\s+/).pop() + '%'); const pick = ex || db.prepare('SELECT name, instructions FROM exercises WHERE name = ?').get('Deadlift'); return `**${pick.name} — technique**\n${pick.instructions.split('|')[0]}\n\nKey cues: full range of motion, controlled eccentric (~2\u20133s), and stop a set when form breaks \u2014 not just when the reps stop.` } },
    { re: /rest|recover|sore|sleep/i, gen: () => `**Recovery check**\nYour last session: ${last}. Weekly frequency: ${weekly.toFixed(1)} workouts.\n\n• Allow 48h before retraining the same muscle group\n• Sleep 7\u20139 h — it drives more progress than any supplement\n• ${stats.volume28 > 30000 ? 'Your 4-week volume is high; consider a lighter "deload" session this week.' : 'Volume looks sustainable — keep it up.'}\n\nSoreness that lasts beyond 72h means reduce the load next session.` },
    { re: /analy\w*|how am i|stats|summary/i, gen: () => `**Your performance snapshot**\n• Workouts last 30 days: ${stats.workouts30}\n• Weekly average: ${weekly.toFixed(1)} sessions\n• 4-week training volume: ${Math.round(stats.volume28 / 100) / 10} t\n• Last session: ${last}\n\n${weekly >= (p.days_per_week || 3) - 1 ? 'You\u2019re hitting your planned frequency — excellent consistency. 🎯' : 'You\u2019re slightly under plan — book your next session while motivation is high.'}` },
  ]

  for (const c of cards) if (c.re.test(low)) return c.gen()

  const motivations = [
    'The only bad workout is the one that didn\u2019t happen. What can I plan for you today?',
    `You haven\u2019t asked me about routines, overload, nutrition or analysis yet — those I can help with! ${profileLine}`,
    'Progress is built session by session. Ask me to generate a routine, suggest overload, or analyze your recent training!',
  ]
  return motivations[Math.floor(Math.random() * motivations.length)]
}

export default router
