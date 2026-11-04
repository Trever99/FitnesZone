import React, { useEffect, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Dumbbell, Timer, Layers, Zap, Clock, Percent, Medal, Scale, RotateCcw } from 'lucide-react'
import { api, fmt, muscleColor } from '@/lib/api'
import { useToast, Card, Badge, Button, StatCard, Segmented, EmptyState, Skeleton, SectionTitle } from '@/components/ui'

type Period = 7 | 30 | 90 | 180 | 365

type AnalyticsData = {
  totals: { workouts: number; volume: number; sets: number; totalMin: number; avgMin: number }
  series: { date: string; workouts: number; volume: number; minutes: number }[]
  muscleDist: { m: string; n: number }[]
  e1rm: { name: string; e1rm: number }[]
  prs: { id: number; name: string; weight: number; reps: number; e1rm: number; achieved_at: string }[]
  weights: { entry_date: string; weight_kg: number }[]
  weeklyFreq: { wk: string; n: number }[]
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7D' }, { value: 30, label: '30D' }, { value: 90, label: '3M' },
  { value: 180, label: '6M' }, { value: 365, label: '1Y' },
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

export default function Analytics() {
  const toast = useToast()
  const [period, setPeriod] = useState<Period>(30)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = async (p: Period, silent = false) => {
    if (!silent) setLoading(true)
    setErr('')
    try {
      const d = await api.get<AnalyticsData>(`/api/analytics?period=${p}`)
      setData(d)
    } catch {
      setErr('Could not load analytics for this period.')
      toast('Could not load analytics', 'err')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(period) }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  const t = data?.totals
  const consistency = data?.series?.length
    ? Math.round((data.series.filter((s) => s.workouts > 0).length / data.series.length) * 100)
    : 0
  const volSeries = (data?.series ?? []).map((s) => ({ date: fmt.date(s.date), tons: s.volume / 1000 }))
  const weightSeries = (data?.weights ?? []).map((w) => ({ date: fmt.date(w.entry_date), weight_kg: w.weight_kg }))

  return (
    <div className="page-in space-y-6">
      <PageHeader
        title="Analytics"
        sub="Your training, quantified"
        action={<Segmented value={period} onChange={setPeriod} options={PERIODS} />}
      />

      {err && !loading && (
        <EmptyState icon={<RotateCcw size={20} />} title="Couldn’t load analytics" body={err}
          action={<Button onClick={() => load(period)}>Retry</Button>} />
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}</div>
        </div>
      ) : data ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={<Dumbbell size={16} />} label="Workouts" value={fmt.n(t?.workouts)} sub={`in ${period} days`} />
            <StatCard icon={<Clock size={16} />} label="Training hours" value={fmt.dur((t?.totalMin ?? 0) * 60)} sub="total time under effort" />
            <StatCard icon={<Layers size={16} />} label="Sets completed" value={fmt.n(t?.sets)} sub="logged sets" />
            <StatCard icon={<Zap size={16} />} label="Volume lifted" value={fmt.vol(t?.volume ?? 0)} sub="total weight moved" />
            <StatCard icon={<Timer size={16} />} label="Avg session" value={fmt.dur((t?.avgMin ?? 0) * 60)} sub="per workout" />
            <StatCard icon={<Percent size={16} />} label="Consistency" value={`${consistency}%`} sub={`${consistency}% of days active`} />
          </div>

          {/* Volume + workouts charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <SectionTitle title="Training volume" sub="Tons lifted per day" />
              <div className="h-56">
                {volSeries.some((s) => s.tons > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={volSeries} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="date" tick={tip} axisLine={false} tickLine={false} minTickGap={26} />
                      <YAxis tick={tip} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v: any) => [`${fmt.n(Number(v), 2)} t`, 'Volume']} />
                      <Line type="monotone" dataKey="tons" stroke="var(--accent)" strokeWidth={2.5} dot={false} name="Volume" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Zap size={18} />} title="No volume yet" body="Finish a workout in this period to see volume." />
                )}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle title="Workouts" sub="Sessions per day" />
              <div className="h-56">
                {(data?.series ?? []).some((s) => s.workouts > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(data?.series ?? []).map((s) => ({ date: fmt.date(s.date), workouts: s.workouts }))} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="date" tick={tip} axisLine={false} tickLine={false} minTickGap={26} />
                      <YAxis tick={tip} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v: any) => [fmt.n(Number(v)), 'Workouts']} />
                      <Bar dataKey="workouts" fill="var(--accent)" radius={[6, 6, 0, 0]} name="Workouts" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Dumbbell size={18} />} title="No sessions" body="No workouts recorded in this period." />
                )}
              </div>
            </Card>
          </div>

          {/* Muscle distribution + Top lifts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <SectionTitle title="Muscle distribution" sub="Sets by muscle group" />
              {data.muscleDist.length ? (
                <div className="flex flex-wrap items-center justify-center gap-5">
                  <div className="h-56 w-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.muscleDist} dataKey="n" nameKey="m" innerRadius={58} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                          {data.muscleDist.map((m) => <Cell key={m.m} fill={muscleColor(m.m)} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [fmt.n(Number(v)), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex max-w-[220px] flex-wrap gap-1.5">
                    {data.muscleDist.slice(0, 9).map((m) => (
                      <Badge key={m.m}><span className="h-2 w-2 rounded-full" style={{ background: muscleColor(m.m) }} />{m.m}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState icon={<Layers size={18} />} title="No muscle data" body="Train in this period to see your split." />
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle title="Top lifts by est. 1RM" sub="Strongest estimated one-rep maxes" />
              {data.e1rm.length ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.e1rm.slice(0, 7)} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                      <XAxis type="number" tick={tip} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={tip} axisLine={false} tickLine={false} width={110} />
                      <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v: any) => [`${fmt.n(Number(v), 1)} kg`, 'Est. 1RM']} />
                      <Bar dataKey="e1rm" fill="var(--accent)" radius={[0, 6, 6, 0]} name="Est. 1RM" barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={<Medal size={18} />} title="No lifts yet" body="Log weighted sets to see estimated 1RMs." />
              )}
            </Card>
          </div>

          {/* PRs table */}
          <Card className="overflow-hidden">
            <div className="p-5 pb-0"><SectionTitle title="Personal records" sub="Latest PRs in this period" /></div>
            {data.prs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-5 py-2.5 font-medium">Exercise</th>
                      <th className="px-3 py-2.5 font-medium">Best set</th>
                      <th className="px-3 py-2.5 font-medium">Est. 1RM</th>
                      <th className="px-5 py-2.5 text-right font-medium">Achieved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.prs.map((p) => (
                      <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-card2/60">
                        <td className="px-5 py-3 font-medium text-ink">{p.name}</td>
                        <td className="px-3 py-3 text-muted">{fmt.n(p.weight, 1)} kg × {fmt.n(p.reps)}</td>
                        <td className="px-3 py-3 font-semibold text-lime">{fmt.n(p.e1rm, 1)} kg</td>
                        <td className="px-5 py-3 text-right text-muted">{fmt.date(p.achieved_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 pt-2">
                <EmptyState icon={<Medal size={18} />} title="No PRs in this period" body="Push a little harder — your next PR is around the corner." />
              </div>
            )}
          </Card>

          {/* Weight trend + weekly frequency */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <SectionTitle title="Weight trend" sub="Bodyweight entries" />
              <div className="h-56">
                {weightSeries.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightSeries} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="anaW" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="date" tick={tip} axisLine={false} tickLine={false} minTickGap={26} />
                      <YAxis tick={tip} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v: any) => [`${fmt.n(Number(v), 1)} kg`, 'Weight']} />
                      <Area type="monotone" dataKey="weight_kg" stroke="var(--accent)" strokeWidth={2.5} fill="url(#anaW)" fillOpacity={0.15} name="Weight" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Scale size={18} />} title="Not enough data" body="Log weight entries in Progress to build a trend." />
                )}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle title="Weekly frequency" sub="Workouts per ISO week" />
              <div className="h-56">
                {data.weeklyFreq.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weeklyFreq} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="wk" tick={tip} axisLine={false} tickLine={false} />
                      <YAxis tick={tip} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v: any) => [fmt.n(Number(v)), 'Workouts']} />
                      <Bar dataKey="n" fill="var(--accent)" radius={[6, 6, 0, 0]} name="Workouts" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Dumbbell size={18} />} title="No weekly data" body="Workouts in this period will appear here by week." />
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
