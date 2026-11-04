import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, ChartNoAxesColumn, ClipboardList, Dumbbell, Info, ListPlus, Play, Repeat, Target, Timer, Trophy, Zap,
} from 'lucide-react'
import { api, fmt, muscleColor } from '@/lib/api'
import { Badge, Button, Card, Field, Modal, ProgressRing, SectionTitle, Skeleton, useToast } from '@/components/ui'

interface Exercise {
  id: number; name: string; muscle_group: string; secondary_muscles: string | null
  equipment: string; difficulty: string
}
interface ExDetail extends Omit<Exercise, 'id'> { instructions: string | null }
interface Detail {
  exercise: ExDetail
  best: { weight: number; e1rm: number } | null
  pr: { weight: number; reps: number; e1rm: number; achieved_at: string } | null
  lastSets: { reps: number; weight: number; set_index: number; started_at: string }[]
  similar: Exercise[]
}
interface Routine {
  id: number; name: string; notes?: string | null
  exercises?: { exercise_id: number; target_sets?: number; target_reps?: string; target_weight?: number; rest_seconds?: number }[]
}

const PARAGRAPH_ICONS = [Target, Repeat, Timer, CheckCircle2, Zap, Info]

const diffColor = (d: string): 'ok' | 'warn' | 'danger' | 'line' => {
  const s = (d || '').toLowerCase()
  if (s.startsWith('adv')) return 'danger'
  if (s.startsWith('int') || s.startsWith('mid')) return 'warn'
  return 'ok'
}

export default function ExerciseDetail() {
  const { id } = useParams()
  const exId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [routines, setRoutines] = useState<Routine[] | null>(null)
  const [savingRoutineId, setSavingRoutineId] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)

  const load = () => {
    setErr(null)
    api.get<Detail>(`/api/exercises/${exId}`)
      .then((d) => setData(d))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [exId])

  const ex = data?.exercise
  const mc = muscleColor(ex?.muscle_group || '')

  const paragraphs = useMemo(() => (ex?.instructions || '').split('|').map((p) => p.trim()).filter(Boolean), [ex?.instructions])

  const perfGroups = useMemo(() => {
    const out: { date: string; sets: Detail['lastSets'] }[] = []
    const seen = new Map<string, { date: string; sets: Detail['lastSets'] }>()
    for (const s of data?.lastSets || []) {
      let g = seen.get(s.started_at)
      if (!g) { g = { date: s.started_at, sets: [] }; seen.set(s.started_at, g); out.push(g) }
      g.sets.push(s)
    }
    return out
  }, [data])

  const openAddModal = () => {
    setAddOpen(true)
    if (!routines) {
      api.get<{ routines: Routine[] }>('/api/workouts/routines').then((d) => setRoutines(d.routines)).catch(() => setRoutines([]))
    }
  }

  const addToRoutine = async (r: Routine) => {
    setSavingRoutineId(r.id)
    try {
      const body = {
        name: r.name,
        notes: r.notes ?? '',
        exercises: [
          ...(r.exercises || []).map((e) => ({
            exercise_id: e.exercise_id,
            target_sets: e.target_sets ?? 3,
            target_reps: e.target_reps ?? '8-10',
            target_weight: e.target_weight ?? 0,
            rest_seconds: e.rest_seconds ?? 90,
          })),
          { exercise_id: exId, target_sets: 3, target_reps: '8-10', target_weight: 0, rest_seconds: 90 },
        ],
      }
      await api.put(`/api/workouts/routines/${r.id}`, body)
      toast(`Added "${ex?.name}" to ${r.name}`, 'ok')
      setAddOpen(false)
    } catch (e: any) {
      toast(e?.message || 'Adding to routine failed', 'err')
    } finally { setSavingRoutineId(null) }
  }

  const startWorkout = async () => {
    setStarting(true)
    try {
      const s = await api.post<{ id: number }>('/api/workouts/sessions', { name: ex?.name || 'Workout' })
      try { localStorage.setItem('fitzone_add_exercise', JSON.stringify({ id: exId, name: ex?.name })) } catch { /* ignore */ }
      navigate(`/workouts/session/${s.id}`)
    } catch (e: any) {
      toast(e?.message || 'Could not start a workout', 'err')
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-in space-y-6">
        <Skeleton className="h-9 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <div className="flex gap-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-24 rounded-full" />)}</div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (err || !ex) {
    return (
      <div className="page-in">
        <Button variant="ghost" size="sm" onClick={() => navigate('/exercises')}><ArrowLeft size={15} /> Back to library</Button>
        <div className="mt-4">
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <Info size={22} className="text-danger" />
            <p className="text-sm text-muted">{err || 'Exercise not found.'}</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </Card>
        </div>
      </div>
    )
  }

  const secondary = (ex.secondary_muscles || '').split(',').map((s) => s.trim()).filter(Boolean)

  return (
    <div className="page-in space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/exercises')}><ArrowLeft size={15} /> Back to library</Button>

      {/* Title + badges */}
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">{ex.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
            style={{ color: mc, borderColor: `${mc}45`, backgroundColor: `${mc}18` }}>
            {ex.muscle_group}
          </span>
          {secondary.map((m) => (
            <span key={m} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
              style={{ color: muscleColor(m), borderColor: `${muscleColor(m)}40`, backgroundColor: `${muscleColor(m)}14` }}>
              {m}
            </span>
          ))}
          <Badge>{ex.equipment}</Badge>
          <Badge color={diffColor(ex.difficulty)}>{ex.difficulty}</Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={startWorkout} loading={starting}><Play size={15} /> Start a workout</Button>
        <Button variant="outline" onClick={openAddModal}><ListPlus size={15} /> Add to routine</Button>
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Instructions */}
        <Card className="p-5">
          <SectionTitle title="How to perform" sub={`${ex.muscle_group} · ${ex.equipment}`} />
          {paragraphs.length === 0 ? (
            <p className="text-sm text-muted">No instructions available for this exercise yet.</p>
          ) : (
            <ol className="space-y-3">
              {paragraphs.map((p, i) => {
                const Icon = PARAGRAPH_ICONS[i % PARAGRAPH_ICONS.length]
                return (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-card2 text-lime">
                      <Icon size={14} />
                    </span>
                    <p className="text-[13.5px] leading-relaxed text-ink/90">{p}</p>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>

        <div className="space-y-4">
          {/* PR Card */}
          <Card className="flex items-center gap-5 p-5">
            <ProgressRing pct={100} size={104} stroke={10} color="var(--accent)">
              <div className="flex flex-col items-center">
                <Trophy size={16} className="mb-0.5 text-lime" />
                <span className="font-display text-base font-extrabold text-ink">{data?.best?.weight ? `${fmt.n(data.best.weight, 1)}kg` : '—'}</span>
                <span className="text-[10px] text-muted">best weight</span>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2 text-lime"><ChartNoAxesColumn size={14} /><span className="text-[11px] font-semibold uppercase tracking-wide">Personal record</span></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-card2 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted">e1RM</div>
                  <div className="font-display text-sm font-bold text-ink">{data?.best?.e1rm ? `${fmt.n(data.best.e1rm, 1)}kg` : '—'}</div>
                </div>
                <div className="rounded-2xl bg-card2 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted">Set at</div>
                  <div className="text-[13px] font-semibold text-ink">{data?.pr?.achieved_at ? fmt.date(data.pr.achieved_at) : 'No PR yet'}</div>
                </div>
              </div>
              {data?.pr?.reps != null && data.pr.weight != null && (
                <p className="text-[11px] text-muted">Record set: <span className="text-ink">{data.pr.reps} reps × {fmt.n(data.pr.weight, 1)}kg</span></p>
              )}
            </div>
          </Card>

          {/* Last performance */}
          <Card className="p-5">
            <SectionTitle title="Last performance" sub="Your most recent logged sets" />
            {perfGroups.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-2xl bg-card2 px-4 py-3 text-[13px] text-muted">
                <Dumbbell size={15} /> You haven't performed this exercise yet — start a workout above.
              </div>
            ) : (
              <div className="space-y-3">
                {perfGroups.slice(0, 4).map((g) => (
                  <div key={g.date} className="rounded-2xl border border-line bg-night2/60 p-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
                      <span className="font-medium text-ink/80">{fmt.date(g.date)}</span>
                      <span>{fmt.time(g.date)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.sets.map((s, i) => (
                        <span key={i} className="rounded-lg bg-card2 px-2 py-1 text-[11.5px] text-ink">
                          {s.reps ?? 0} × <span className="font-semibold text-lime">{fmt.n(s.weight ?? 0, 1)}kg</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Similar exercises */}
      {(data?.similar?.length ?? 0) > 0 && (
        <div>
          <SectionTitle title="Similar exercises" sub={`Other ${ex.muscle_group} movements to rotate in`} />
          <div className="flex flex-wrap gap-2">
            {data!.similar.map((s) => (
              <Link key={s.id} to={`/exercises/${s.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-ink transition hover:border-lime/40 hover:bg-card2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: muscleColor(s.muscle_group) }} />
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Add to routine modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add to routine">
        <p className="mb-4 text-[13px] text-muted">
          Pick a routine — <span className="text-ink">{ex.name}</span> will be appended with default targets (3 × 8-10).
        </p>
        {routines === null ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : routines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center">
            <ClipboardList size={20} className="mx-auto mb-2 text-muted" />
            <p className="text-[13px] text-muted">No routines yet. Create one on the Workouts page.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {routines.map((r) => (
              <button key={r.id} onClick={() => addToRoutine(r)} disabled={savingRoutineId !== null}
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-night2/60 px-4 py-3 text-left transition hover:border-lime/40 hover:bg-card2 disabled:opacity-60">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{r.name}</div>
                  <div className="text-[11px] text-muted">{r.exercises?.length ?? 0} exercises</div>
                </div>
                <ListPlus size={15} className={savingRoutineId === r.id ? 'text-lime' : 'text-muted'} />
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
