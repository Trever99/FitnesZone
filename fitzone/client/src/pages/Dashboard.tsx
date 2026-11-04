import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  Flame, Dumbbell, Scale, Zap, Trophy, Percent, Play, TrendingUp,
  Utensils, BarChart3, ClipboardList, CalendarClock, Timer, ChevronRight,
} from 'lucide-react'
import { api, fmt, muscleColor } from '@/lib/api'
import { cn, useToast, Card, Badge, Button, StatCard, ProgressRing, EmptyState, Skeleton, SectionTitle } from '@/components/ui'

type TodayWorkout = {
  routineId?: number
  name: string
  duration: number
  muscle_groups?: string
  exercises?: { tr: string; rs: string; name: string; muscle_group: string }[]
}

type DashData = {
  profile: { name?: string; weight_kg?: number | null }
  user: { id: number; name: string }
  stats: {
    workouts: number; workouts7: number; workouts28: number; streak: number
    volume: number; avgDur: number; totalSec: number; goalRate: number
    level: { xp: number; level: number; into: number; span: number; pct: number }
  }
  nutrition: { target: number; eaten: number; protein: number }
  weightHistory: { entry_date: string; weight_kg: number }[]
  frequency: { date: string; n: number; v: number }[]
  muscle: { m: string; n: number }[]
  todayWorkout: TodayWorkout | null
  recentAchievements: { name: string; icon: string; description: string }[]
}

const MOTIVATION = [
  'The only bad workout is the one that didn’t happen.',
  'Discipline is choosing what you want most over what you want now.',
  'Sweat is fat crying. Make it cry today.',
  'Small daily reps beat big rare efforts.',
  'You don’t have to be extreme, just consistent.',
  'Strength is built one session at a time.',
  'Progress starts the moment you show up.',
  'Fall in love with the process and the results will follow.',
]

const QUICK = [
  { to: '/workouts', label: 'Start workout', icon: Play },
  { to: '/progress', label: 'Log weight', icon: Scale },
  { to: '/nutrition', label: 'Track food', icon: Utensils },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/planner', label: 'New plan', icon: ClipboardList },
]

const tip = { fill: 'var(--muted)', fontSize: 11 } as const

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [starting, setStarting] = useState(false)

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const d = await api.get<DashData>('/api/dashboard')
      setData(d)
    } catch {
      setErr('Could not load your dashboard. Try again.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const startWorkout = async (routineId?: number) => {
    setStarting(true)
    try {
      const r = await api.post<{ id: number }>('/api/workouts/sessions', routineId ? { routine_id: routineId } : {})
      navigate(`/workouts/session/${r.id}`)
    } catch {
      toast('Could not start the session', 'err')
      setStarting(false)
    }
  }

  const now = new Date()
  const h = now.getHours()
  const greeting = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const first = (data?.user?.name || data?.profile?.name || 'Athlete').split(' ')[0]
  const initials = (data?.user?.name || 'FZ').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  const wh = data?.weightHistory ?? []
  const lastW = wh[wh.length - 1]
  const firstW = wh[0]
  const wDelta = lastW && firstW ? Math.round((lastW.weight_kg - firstW.weight_kg) * 10) / 10 : null
  const weightSeries = wh.map((w) => ({ date: fmt.date(w.entry_date), weight_kg: w.weight_kg }))

  const freq14 = (() => {
    const map = new Map<string, number>()
    for (const f of data?.frequency ?? []) map.set(f.date, f.n)
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (13 - i))
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { date: fmt.date(d), n: map.get(key) ?? 0 }
    })
  })()

  const tw = data?.todayWorkout ?? null
  const groups = tw
    ? tw.exercises
      ? Array.from(new Set(tw.exercises.map((e) => e.muscle_group.split(',')[0].trim())))
      : tw.muscle_groups
        ? tw.muscle_groups.split(',').map((s) => s.trim()).filter(Boolean)
        : []
    : []

  const eaten = data?.nutrition.eaten ?? 0
  const target = data?.nutrition.target ?? 0
  const calPct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0

  if (loading) {
    return (
      <div className="page-in space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-72" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-56" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-56" />)}</div>
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="page-in space-y-6">
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={<BarChart3 size={22} />}
          title="Something went wrong"
          body={err || 'No dashboard data available right now.'}
          action={<Button onClick={load}>Retry</Button>}
        />
      </div>
    )
  }

  return (
    <div className="page-in space-y-6">
      <PageHeader title="Dashboard" sub={fmt.dateLong(now)} action={<Link to="/analytics"><Button variant="outline" size="sm">Analytics <ChevronRight size={14} /></Button></Link>} />

      {/* Greeting hero */}
      <Card className="relative overflow-hidden border-lime/20 bg-gradient-to-br from-lime/[0.09] via-card to-card p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-lime text-lg font-bold text-lime-ink">{initials}</div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-ink md:text-2xl">Good {greeting}, {first} 👋</h2>
            <p className="mt-0.5 text-sm text-muted">{fmt.dateLong(now)}</p>
            <p className="mt-2 max-w-md text-[13px] italic leading-relaxed text-muted">“{MOTIVATION[now.getDate() % MOTIVATION.length]}”</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <Badge color="lime" className="h-7 px-3 text-[12px]">Level {data.stats.level.level}</Badge>
              <p className="mt-1.5 text-[11px] text-muted">{fmt.n(data.stats.level.into)} / {fmt.n(data.stats.level.span)} XP</p>
            </div>
            <ProgressRing pct={data.stats.level.pct} size={64} stroke={6}>
              <span className="font-display text-sm font-bold text-ink">{data.stats.level.pct}%</span>
            </ProgressRing>
          </div>
        </div>
      </Card>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Scale size={16} />}
          label="Current weight"
          value={lastW ? `${fmt.n(lastW.weight_kg, 1)} kg` : '—'}
          sub={wDelta == null ? 'No data yet' : `${wDelta >= 0 ? '▲' : '▼'} ${Math.abs(wDelta)} kg vs start`}
        />
        <StatCard
          icon={<Flame size={16} />}
          label="Calories today"
          value={`${fmt.n(eaten)}`}
          sub={`${calPct}% of ${fmt.n(target)} kcal`}
        />
        <StatCard icon={<Dumbbell size={16} />} label="Weekly workouts" value={`${data.stats.workouts7}`} sub={`${data.stats.streak}-day streak 🔥`} />
        <StatCard icon={<Zap size={16} />} label="Total volume" value={fmt.vol(data.stats.volume)} sub={`${fmt.n(data.stats.workouts)} all-time sessions`} />
      </div>

      {/* Today's training */}
      <Card className={cn('p-6', tw && 'border-lime/25 bg-gradient-to-br from-lime/[0.06] to-transparent')}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">Today’s Training</h2>
            <p className="mt-0.5 text-xs text-muted">{now.toLocaleDateString(undefined, { weekday: 'long' })}</p>
          </div>
          {tw && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-muted"><CalendarClock size={13} /> {tw.duration ?? '—'} min est.</div>
            </div>
          )}
        </div>

        {tw ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h3 className="font-display text-lg font-bold text-ink">{tw.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => <Badge key={g}>{g}</Badge>)}
              </div>
            </div>
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              {(tw.exercises ?? []).slice(0, 6).map((e, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-line bg-night2/60 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{e.name}</div>
                    <div className="text-[11px] text-muted">{e.muscle_group}</div>
                  </div>
                  <span className="ml-2 shrink-0 text-[12px] font-semibold text-lime">{e.tr} × {e.rs || '—'}</span>
                </div>
              ))}
            </div>
            <Button size="lg" loading={starting} onClick={() => startWorkout(tw.routineId)} className="w-full sm:w-auto">
              <Play size={16} /> Start Workout
            </Button>
          </>
        ) : (
          <EmptyState
            icon={<Timer size={22} />}
            title="Rest day"
            body="No workout scheduled today. Perfect time to recover — or build your next plan."
            action={<Link to="/planner"><Button variant="outline">Open Planner</Button></Link>}
          />
        )}
      </Card>

      {/* Quick actions */}
      <SectionTitle title="Quick actions" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {QUICK.map((q) => (
          <button key={q.to} onClick={() => navigate(q.to)}
            className="group flex flex-col items-start gap-3 rounded-3xl border border-line bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-lime/40 hover:bg-card2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime/12 text-lime"><q.icon size={17} /></span>
            <span className="text-[13px] font-medium text-ink">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Weight trend" sub={weightSeries.length ? `${weightSeries.length} entries` : 'No entries yet'} />
          <div className="h-56">
            {weightSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightSeries} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="dashW" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" tick={tip} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={tip} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v: any) => [`${fmt.n(Number(v), 1)} kg`, 'Weight']} />
                  <Area type="monotone" dataKey="weight_kg" stroke="var(--accent)" strokeWidth={2.5} fill="url(#dashW)" fillOpacity={0.15} name="Weight" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<Scale size={18} />} title="No weight data" body="Log your weight in Progress to see the trend." />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Activity — 14 days" sub="Workouts per day" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={freq14} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tick={tip} axisLine={false} tickLine={false} minTickGap={18} />
                <YAxis tick={tip} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v: any) => [fmt.n(Number(v)), 'Workouts']} />
                <Bar dataKey="n" fill="var(--accent)" radius={[6, 6, 0, 0]} name="Workouts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Muscle distribution + achievements */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Muscle distribution" sub="All-time sets by muscle group" />
          {data.muscle.length ? (
            <div className="flex flex-wrap items-center justify-center gap-5">
              <div className="h-56 w-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.muscle} dataKey="n" nameKey="m" innerRadius={58} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                      {data.muscle.map((m) => <Cell key={m.m} fill={muscleColor(m.m)} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${fmt.n(Number(v))} sets`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex max-w-[220px] flex-wrap gap-1.5">
                {data.muscle.slice(0, 8).map((m) => (
                  <Badge key={m.m}><span className="h-2 w-2 rounded-full" style={{ background: muscleColor(m.m) }} />{m.m}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={<Dumbbell size={18} />} title="No muscle data" body="Complete a workout to see your muscle split." />
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Recent achievements" sub="Fresh wins from your training" />
          <div className="flex flex-col gap-3">
            {data.recentAchievements.length ? (
              data.recentAchievements.map((a, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-night2/50 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime/12 text-lg">{a.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">{a.name}</div>
                    <div className="truncate text-[11px] text-muted">{a.description}</div>
                  </div>
                  <Trophy size={15} className="text-lime" />
                </div>
              ))
            ) : (
              <EmptyState icon={<Trophy size={18} />} title="No achievements yet" body="Log your first workouts to unlock badges." />
            )}
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-lime/20 bg-lime/[0.06] px-4 py-3">
            <Percent size={16} className="text-lime" />
            <span className="text-[12px] text-muted">Goal completion</span>
            <div className="ml-auto"><ProgressRing pct={data.stats.goalRate} size={46} stroke={5}><span className="text-[11px] font-bold text-ink">{data.stats.goalRate}%</span></ProgressRing></div>
          </div>
          <Link to="/analytics" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-lime hover:underline">
            Deep-dive in Analytics <TrendingUp size={13} />
          </Link>
        </Card>
      </div>
    </div>
  )
}
