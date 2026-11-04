import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dumbbell, Flame, Trophy, TrendingUp, Zap, Pencil, KeyRound, Bell, BellOff, Download, LogOut,
  Trash2, ShieldCheck, MailCheck, MailWarning, Moon, Sun, CheckCheck, AlertTriangle, Eye, EyeOff,
} from 'lucide-react'
import { api, fmt, getToken, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/components/layout/AppShell'
import {
  Button, Card, SectionTitle, StatCard, Field, Input, Select, Modal, Confirm as ConfirmModal, Badge,
  Skeleton, EmptyState, ProgressRing, useToast, cn,
} from '@/components/ui'

interface ProfileData {
  user: { id: number; email: string; name: string; email_verified: number; created_at: number }
  profile: {
    age: number | null; gender: string | null; height_cm: number | null; weight_kg: number | null
    target_weight: number | null; experience: string | null; goal: string | null; location: string | null
    equipment: string[]; days_per_week: number | null; duration_pref: number | null; calorie_target: number | null
  } | null
  stats: { workouts: number; streak: number; volume: number; sets: number; prs: number; early: number }
  level: { xp: number; level: number; into: number; span: number; pct: number }
}

interface Notification { id: number; title: string; body: string; kind: string | null; read: number; created_at: number }

const EQUIPMENT = ['Barbells', 'Dumbbells', 'Machines', 'Cables', 'Resistance Bands', 'Bodyweight', 'Kettlebells']
const GOALS: Record<string, string> = {
  muscle_building: 'Build Muscle', fat_loss: 'Fat Loss', strength: 'Strength', endurance: 'Endurance', general_fitness: 'General Fitness',
}
const PREF_KEY = 'fitzone_prefs'
type Prefs = { reminders: boolean; restDayAlerts: boolean; weeklyReport: boolean }
const DEFAULT_PREFS: Prefs = { reminders: true, restDayAlerts: true, weeklyReport: false }

const initialsOf = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'F'

export default function Profile() {
  const { logout, refresh } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState<ProfileData | null>(null)
  const [notif, setNotif] = useState<Notification[] | null>(null)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') } } catch { return DEFAULT_PREFS }
  })

  const load = useCallback(async () => {
    try {
      const [p, n] = await Promise.all([
        api.get<ProfileData>('/profile'),
        api.get<{ notifications: Notification[] }>('/notifications'),
      ])
      setData(p); setNotif(n.notifications || []); setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your profile.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const togglePref = (k: keyof Prefs) => {
    setPrefs((p) => {
      const nextP = { ...p, [k]: !p[k] }
      localStorage.setItem(PREF_KEY, JSON.stringify(nextP))
      return nextP
    })
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setNotif((n) => (n || []).map((x) => ({ ...x, read: 1 })))
      toast('All notifications marked as read.', 'ok')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not update notifications.', 'err')
    }
  }

  if (error) {
    return (
      <div className="page-in">
        <EmptyState icon={<AlertTriangle size={22} className="text-danger" />} title="Couldn’t load your profile" body={error}
          action={<Button onClick={() => void load()}>Retry</Button>} />
      </div>
    )
  }

  if (!data || !notif) {
    return (
      <div className="page-in space-y-6">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const { user, profile, stats, level } = data
  const unread = notif.filter((n) => !n.read).length

  return (
    <div className="page-in space-y-6">
      {/* Header */}
      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-lime/10 blur-[80px]" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-lime/15 font-display text-xl font-bold text-lime accent-glow">
            {initialsOf(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{user.name}</h1>
              {user.email_verified
                ? <Badge color="ok"><MailCheck size={11} /> Verified</Badge>
                : <Badge color="warn"><MailWarning size={11} /> Not verified</Badge>}
              {profile && <Badge><Flame size={11} /> {GOALS[profile.goal || ''] || 'General Fitness'}</Badge>}
            </div>
            <p className="mt-1 truncate text-[13px] text-muted">{user.email}</p>
            <p className="text-[11.5px] text-muted/70">Member since {fmt.dateLong(user.created_at)}</p>
          </div>
          {!user.email_verified && <VerifyButton refresh={refresh} />}
        </div>
      </Card>

      {/* Level */}
      <Card className="flex items-center gap-6 p-6">
        <ProgressRing pct={level.pct} size={120} stroke={10}>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted">Level</div>
            <div className="font-display text-[26px] font-bold leading-none text-lime">{level.level}</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Zap size={14} className="text-lime" /> {fmt.n(level.xp)} XP</div>
          <p className="mt-1 text-[12.5px] text-muted">Earn XP from training volume and completed workouts.</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-card2">
            <div className="h-full rounded-full bg-lime transition-all duration-500" style={{ width: `${level.pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted">Level up: next tier at {fmt.n(level.span - level.into)} XP</p>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Dumbbell size={15} />} label="Total workouts" value={fmt.n(stats.workouts)} sub="all time" />
        <StatCard icon={<Flame size={15} />} label="Active streak" value={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`} sub="keep it alive" accent={stats.streak > 0} />
        <StatCard icon={<TrendingUp size={15} />} label="Lifetime volume" value={fmt.vol(stats.volume)} sub={`${fmt.n(stats.sets)} sets moved`} />
        <StatCard icon={<Trophy size={15} />} label="Personal records" value={fmt.n(stats.prs)} sub="PRs earned" accent={stats.prs > 0} />
      </div>

      {/* Body & training settings */}
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Body & training settings" sub="Your metrics and plan preferences — the coach uses these everywhere"
          action={<Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil size={13} /> Edit</Button>} />
        {profile ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <SettingRow label="Height" value={`${profile.height_cm ?? '—'} cm`} />
            <SettingRow label="Weight" value={`${profile.weight_kg ?? '—'} kg`} />
            <SettingRow label="Target weight" value={profile.target_weight ? `${profile.target_weight} kg` : '—'} />
            <SettingRow label="Age" value={profile.age != null ? `${profile.age}` : '—'} />
            <SettingRow label="Experience" value={profile.experience || '—'} />
            <SettingRow label="Location" value={profile.location === 'home' ? 'Home' : 'Full gym'} />
            <SettingRow label="Days / week" value={profile.days_per_week ? `${profile.days_per_week}×` : '—'} />
            <SettingRow label="Session length" value={profile.duration_pref ? `${profile.duration_pref} min` : '—'} />
            <SettingRow label="Calorie target" value={profile.calorie_target ? `${fmt.n(profile.calorie_target)} kcal` : '—'} />
            <SettingRow label="Equipment" value={profile.equipment.length ? profile.equipment.join(', ') : '—'} className="col-span-2 sm:col-span-3 lg:col-span-4" />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">No profile yet — finish onboarding to set your metrics.</p>
        )}
      </Card>

      {/* Notifications */}
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Notifications" sub={unread ? `${unread} unread` : 'You’re all caught up'}
          action={notif.length > 0 && unread > 0 ? (
            <Button variant="outline" size="sm" onClick={() => void markAllRead()}><CheckCheck size={13} /> Mark all read</Button>
          ) : undefined} />
        {notif.length === 0 ? (
          <EmptyState icon={<BellOff size={20} />} title="No notifications" body="Achievements, streak alerts and weekly reports will land here." />
        ) : (
          <ul className="divide-y divide-line">
            {notif.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-line' : 'bg-lime')} />
                <div className="min-w-0 flex-1">
                  <div className={cn('text-[13.5px]', n.read ? 'font-medium text-muted' : 'font-semibold text-ink')}>{n.title}</div>
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{n.body}</div>
                </div>
                <span className="shrink-0 text-[11px] text-muted/70">{fmt.rel(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Preferences */}
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Preferences" sub="Appearance and local reminder settings" />
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl border border-line bg-card2/60 px-4 py-3">
            <div className="text-[13px] font-medium text-ink"><Moon size={14} className="mr-2 inline text-muted" />Appearance</div>
            <ThemeButtons />
          </div>
          {([
            { k: 'reminders' as const, label: 'Reminders', text: 'Nudges to log workouts and meals' },
            { k: 'restDayAlerts' as const, label: 'Rest-day alerts', text: 'Note it when you skip planned rest days' },
            { k: 'weeklyReport' as const, label: 'Weekly report', text: 'A summary of your training week' },
          ]).map((row) => (
            <div key={row.k} className="flex items-center justify-between rounded-2xl border border-line bg-card2/60 px-4 py-3">
              <div>
                <div className="text-[13px] font-medium text-ink"><Bell size={14} className="mr-2 inline text-muted" />{row.label}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">{row.text} · saved on this device</div>
              </div>
              <button onClick={() => togglePref(row.k)} role="switch" aria-checked={prefs[row.k]}
                className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', prefs[row.k] ? 'bg-lime' : 'bg-line')}>
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all', prefs[row.k] ? 'left-[22px]' : 'left-0.5')} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Security */}
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Security" sub="Change your account password" />
        <PasswordSection toast={toast} />
      </Card>

      {/* Data */}
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Your data" sub="Take everything FITZONE knows with you" />
        <DataActions toast={toast} />
      </Card>

      {/* Danger zone */}
      <Card className="border-danger/30">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[15px] font-display font-bold text-danger"><Trash2 size={16} /> Danger zone</div>
            <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">
              Permanently delete your account, workouts, nutrition logs and history. This cannot be undone.
            </p>
          </div>
          <DeleteAccount onDone={() => { logout(); navigate('/login', { replace: true }) }} />
        </div>
      </Card>

      {profile && (
        <EditSettingsModal
          open={editOpen} onClose={() => setEditOpen(false)} data={data}
          onSaved={() => { void load(); void refresh(); toast('Settings saved.', 'ok') }}
          toast={toast}
        />
      )}
    </div>
  )
}

function SettingRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-card2/60 px-3.5 py-2.5', className)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">{value}</div>
    </div>
  )
}

function ThemeButtons() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="flex gap-1.5">
      {(['dark', 'light'] as const).map((t) => (
        <button key={t} onClick={() => setTheme(t)}
          className={cn('inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition',
            theme === t ? 'bg-lime text-lime-ink' : 'text-muted hover:text-ink hover:bg-line/50')}>
          {t === 'dark' ? <Moon size={13} /> : <Sun size={13} />} {t === 'dark' ? 'Dark' : 'Light'}
        </button>
      ))}
    </div>
  )
}

/* ---------- Verify email (demo) ---------- */
function VerifyButton({ refresh }: { refresh: () => Promise<void> }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  const verify = async () => {
    const t = token.trim()
    if (!t) { toast('Paste the verification token from your register email.', 'err'); return }
    setBusy(true)
    try {
      await api.post('/auth/verify-email', { token: t })
      await refresh()
      toast('Email verified successfully.', 'ok')
      setOpen(false)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Verification failed.', 'err')
    } finally { setBusy(false) }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><ShieldCheck size={13} /> Verify email</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Verify your email">
        <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
          In this demo build no email provider is configured — paste the verification token (it was returned when you registered, or repeated in the server console).
        </p>
        <Field label="Verification token">
          <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs…" />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={busy} onClick={() => void verify()}><ShieldCheck size={15} /> Verify</Button>
        </div>
      </Modal>
    </>
  )
}

/* ---------- Edit settings ---------- */
function EditSettingsModal({ open, onClose, data, onSaved, toast }:
  { open: boolean; onClose: () => void; data: ProfileData; onSaved: () => void; toast: (t: string, k?: 'ok' | 'err' | 'info') => void }) {
  const p = data.profile!
  const [f, setF] = useState({
    name: data.user.name, age: p.age != null ? String(p.age) : '', gender: p.gender || 'prefer_not_say',
    height_cm: p.height_cm != null ? String(p.height_cm) : '', weight_kg: p.weight_kg != null ? String(p.weight_kg) : '',
    target_weight: p.target_weight != null ? String(p.target_weight) : '', experience: p.experience || 'beginner',
    goal: p.goal || 'general_fitness', location: p.location === 'home' ? 'home' : 'gym',
    equipment: [...p.equipment], days_per_week: p.days_per_week || 3, duration_pref: p.duration_pref || 60,
    calorie_target: p.calorie_target != null ? String(p.calorie_target) : '',
  })
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const n = (v: string) => (v.trim() === '' ? null : Number(v))
    if (f.name.trim().length < 2) { toast('Name must be at least 2 characters.', 'err'); return }
    if (f.age.trim() === '' || isNaN(Number(f.age)) || Number(f.age) < 13 || Number(f.age) > 90) { toast('Age must be between 13 and 90.', 'err'); return }
    if (f.height_cm.trim() === '' || isNaN(Number(f.height_cm)) || Number(f.height_cm) < 120 || Number(f.height_cm) > 230) { toast('Height must be 120–230 cm.', 'err'); return }
    if (f.weight_kg.trim() === '' || isNaN(Number(f.weight_kg)) || Number(f.weight_kg) < 30 || Number(f.weight_kg) > 250) { toast('Weight must be 30–250 kg.', 'err'); return }
    if (f.target_weight && (isNaN(Number(f.target_weight)) || Number(f.target_weight) < 30 || Number(f.target_weight) > 250)) { toast('Target weight must be 30–250 kg.', 'err'); return }
    setBusy(true)
    try {
      await api.put('/profile', {
        name: f.name.trim(), age: Number(f.age), gender: f.gender === 'prefer_not_say' ? null : f.gender,
        height_cm: Number(f.height_cm), weight_kg: Number(f.weight_kg), target_weight: n(f.target_weight),
        experience: f.experience, goal: f.goal, location: f.location, equipment: f.equipment,
        days_per_week: f.days_per_week, duration_pref: f.duration_pref, calorie_target: n(f.calorie_target),
      })
      onSaved(); onClose()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save settings.', 'err')
    } finally { setBusy(false) }
  }

  const toggleEq = (e: string) => setF((s) => ({ ...s, equipment: s.equipment.includes(e) ? s.equipment.filter((x) => x !== e) : [...s.equipment, e] }))

  return (
    <Modal open={open} onClose={onClose} title="Edit body & training settings" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name"><Input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Age" hint="13–90"><Input type="number" step={1} min={13} max={90} value={f.age} onChange={(e) => setF((s) => ({ ...s, age: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <Select value={f.gender} onChange={(e) => setF((s) => ({ ...s, gender: e.target.value }))}>
              <option value="prefer_not_say">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </Field>
          <Field label="Calorie target" hint="kcal / day"><Input type="number" step={10} value={f.calorie_target} onChange={(e) => setF((s) => ({ ...s, calorie_target: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Height (cm)"><Input type="number" step={1} value={f.height_cm} onChange={(e) => setF((s) => ({ ...s, height_cm: e.target.value }))} /></Field>
          <Field label="Weight (kg)"><Input type="number" step={0.1} value={f.weight_kg} onChange={(e) => setF((s) => ({ ...s, weight_kg: e.target.value }))} /></Field>
          <Field label="Target (kg)" hint="optional"><Input type="number" step={0.1} value={f.target_weight} onChange={(e) => setF((s) => ({ ...s, target_weight: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Experience">
            <Select value={f.experience} onChange={(e) => setF((s) => ({ ...s, experience: e.target.value }))}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
          <Field label="Primary goal">
            <Select value={f.goal} onChange={(e) => setF((s) => ({ ...s, goal: e.target.value }))}>
              {Object.entries(GOALS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Training location">
            <Select value={f.location} onChange={(e) => setF((s) => ({ ...s, location: e.target.value }))}>
              <option value="gym">Full gym</option>
              <option value="home">Home</option>
            </Select>
          </Field>
          <Field label="Days / week">
            <Select value={String(f.days_per_week)} onChange={(e) => setF((s) => ({ ...s, days_per_week: Number(e.target.value) }))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}× per week</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Session length">
          <Select value={String(f.duration_pref)} onChange={(e) => setF((s) => ({ ...s, duration_pref: Number(e.target.value) }))}>
            {[30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} minutes</option>)}
          </Select>
        </Field>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Equipment</p>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((e) => {
              const on = f.equipment.includes(e)
              return (
                <button key={e} type="button" onClick={() => toggleEq(e)}
                  className={cn('rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
                    on ? 'border-lime bg-lime/15 text-lime' : 'border-line bg-card2/60 text-muted hover:text-ink')}>
                  {e}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={() => void save()}>Save changes</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Export + logout ---------- */
function DataActions({ toast }: { toast: (t: string, k?: 'ok' | 'err' | 'info') => void }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)

  const exportData = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/export', { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) throw new ApiError(`Export failed (${res.status})`, res.status)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fitzone-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast('Export downloaded as JSON.', 'ok')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Export failed.', 'err')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" loading={busy} onClick={() => void exportData()}><Download size={15} /> Export data (.json)</Button>
      <Button variant="outline" onClick={() => setConfirmOut(true)}><LogOut size={15} /> Log out</Button>
      <ConfirmModal open={confirmOut} onClose={() => setConfirmOut(false)} title="Log out?" body="You can log back in any time — your data stays saved."
        onConfirm={() => { logout(); navigate('/login', { replace: true }) }} />
    </div>
  )
}

function PasswordSection({ toast }: { toast: (t: string, k?: 'ok' | 'err' | 'info') => void }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (password.length < 8) { toast('Password must be at least 8 characters.', 'err'); return }
    if (password !== repeat) { toast('Passwords don’t match.', 'err'); return }
    setBusy(true)
    try {
      await api.put('/profile', { password })
      setPassword(''); setRepeat('')
      toast('Password updated.', 'ok')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not update the password.', 'err')
    } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="New password" hint="min 8 characters">
        <div className="relative">
          <Input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" value={password}
            onChange={(e) => setPassword(e.target.value)} className="pr-10" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password visibility"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </Field>
      <Field label="Confirm new password">
        <Input type="password" autoComplete="new-password" placeholder="••••••••" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </Field>
      <Button variant="outline" loading={busy} onClick={() => void save()} disabled={!password}><KeyRound size={15} /> Update password</Button>
    </div>
  )
}

/* ---------- Password + delete account ---------- */
function DeleteAccount({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)

  const del = async () => {
    setBusy(true)
    try {
      await api.del('/account')
      toast('Account deleted. Stay strong out there.', 'info')
      setOpen(false)
      onDone()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not delete the account.', 'err')
    } finally { setBusy(false) }
  }

  return (
    <>
      <Button variant="danger" onClick={() => { setWord(''); setOpen(true) }}><Trash2 size={15} /> Delete account</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete account permanently">
        <p className="text-[13px] leading-relaxed text-muted">
          This removes <span className="font-semibold text-danger">everything</span>: profile, workouts, nutrition logs, records and achievements. There is no undo.
        </p>
        <div className="mt-4">
          <Field label="Type DELETE to confirm">
            <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="DELETE" className="border-danger/40" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={word !== 'DELETE'} onClick={() => void del()}>Delete forever</Button>
        </div>
      </Modal>
    </>
  )
}
