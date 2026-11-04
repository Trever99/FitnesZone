export function evalAchievements(db, uid) {
  const stats = {
    workouts: db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL').get(uid).n,
    streak: computeStreak(db, uid),
    volume: db.prepare('SELECT COALESCE(SUM(total_volume),0) v FROM sessions WHERE user_id = ?').get(uid).v,
    sets: db.prepare('SELECT COUNT(*) n FROM exercise_sets es JOIN sessions s ON s.id = es.session_id WHERE s.user_id = ? AND es.done = 1').get(uid).n,
    prs: db.prepare('SELECT COUNT(*) n FROM personal_records WHERE user_id = ?').get(uid).n,
    early: db.prepare(`SELECT COUNT(*) n FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL AND CAST(strftime('%H', started_at/1000, 'unixepoch', 'localtime') AS INTEGER) < 8`).get(uid).n,
  }
  const achieved = new Set(db.prepare('SELECT a.code FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = ?').all(uid).map((r) => r.code))
  const rules = {
    first_workout: stats.workouts >= 1,
    w10: stats.workouts >= 10,
    w25: stats.workouts >= 25,
    w50: stats.workouts >= 50,
    streak7: stats.streak >= 7,
    vol_100t: stats.volume >= 100000,
    sets100: stats.sets >= 100,
    pr5: stats.prs >= 5,
    early_bird: stats.early >= 1,
    nutrition1: false,
    consistent: stats.workouts >= 20,
  }
  for (const [code, ok] of Object.entries(rules)) {
    if (ok && !achieved.has(code)) {
      const a = db.prepare('SELECT * FROM achievements WHERE code = ?').get(code)
      if (a) {
        db.prepare('INSERT INTO user_achievements (user_id,achievement_id,earned_at) VALUES (?,?,?)').run(uid, a.id, Date.now())
        db.prepare('INSERT INTO notifications (user_id,title,body,kind,created_at) VALUES (?,?,?,?,?)')
          .run(uid, 'Achievement unlocked', `“${a.name}” — ${a.description}`, 'achievement', Date.now())
      }
    }
  }
  return stats
}

export function computeStreak(db, uid) {
  const days = new Set(db.prepare(`SELECT DISTINCT strftime('%Y-%m-%d', started_at/1000, 'unixepoch', 'localtime') d FROM sessions WHERE user_id = ? AND completed_at IS NOT NULL`).all(uid).map((r) => r.d))
  let streak = 0
  const d = new Date()
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1) // streak alive if trained yesterday
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

export function levelInfo(totalVolume, workouts) {
  const xp = Math.round(totalVolume / 100 / 10 + workouts * 50)
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 60)) + 1)
  const curFloor = ((level - 1) ** 2) * 60
  const nextFloor = level ** 2 * 60
  return { xp, level, into: xp - curFloor, span: nextFloor - curFloor, pct: Math.min(100, Math.round(((xp - curFloor) / (nextFloor - curFloor)) * 100)) }
}
