import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Check, Dumbbell, Flame, Info, PartyPopper, Play, Plus, Search, SkipForward, Timer as TimerIcon, Trophy,
} from 'lucide-react'
import { api, fmt, muscleColor } from '@/lib/api'
import {
  Button, Card, EmptyState, Input, Modal, ProgressRing, SectionTitle, Skeleton, StatCard, cn, useToast,
} from '@/components/ui'

interface Sess {
  id: number; name: string; started_at: string; completed_at: string | null
  duration_sec: number | null; total_volume: number; routine_id?: number | null
}
interface SSet { id: number; exercise_id: number; name: string | null; set_index: number; reps: number | null; weight: number | null; type: string; done: boolean }
interface PrRecord { name: string; weight?: number | null; reps?: number | null; e1rm?: number | null; achieved_at?: string }
interface SessionData { session: Sess; sets: SSet[]; records: PrRecord[] }
interface Exercise { id: number; name: string; muscle_group: string; secondary_muscles: string | null; equipment: string; difficulty: string }
interface RoutineEx { exercise_id: number; target_sets?: number; target_reps?: string | null; target_weight?: number; rest_seconds?: number }
interface Routine { id: number; name: string; exercises?: RoutineEx[] }
interface FinishRes { session?: Sess; prs?: number; calories?: number; setCount?: number }

const REST_DEFAULT = 90
const num = (v: string | null | undefined) => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? 0 : n }
const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`
const caloriesEstimate = (durationSec: number, volume: number) => Math.round(durationSec * 0.09 + (volume / 1000) * 1.2)

// ---------- Exercise Picker ----------
function PickerModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const [q, setQ] = useState('')
  const [deb, setDeb] = useState('')
  const [items, setItems] = useState<Exercise[] | null>(null)
  useEffect(() => {
    if (!open) { setQ(''); setDeb(''); return }
    const t = setTimeout(() => setDeb(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q, open])
  useEffect(() => {
    if (!open) { setItems(null); return }
    let alive = true
    api.get<{ exercises: Exercise[] }>(`/api/exercises?q=${encodeURIComponent(deb)}`)
      .then((d) => { if (alive) setItems(d.exercises || []) })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [deb, open])
  return (
    <Modal open={open} onClose={onClose} title="Add exercise">
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-10" autoFocus />
      </div>
      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
        {items === null && [...Array(6)].map((_, i) => <Skeleton key={i} className="h-11" />)}
        {items !== null && items.length === 0 && <p className="py-6 text-center text-[13px] text-muted">No matches.</p>}
        {items?.map((e) => (
          <button key={e.id} onClick={() => onPick(e)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-card2">
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-medium text-ink">{e.name}</div>
              <div className="text-[11px] text-muted">{e.equipment} · {e.difficulty}</div>
            </div>
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium"
              style={{ color: muscleColor(e.muscle_group), borderColor: `${muscleColor(e.muscle_group)}45`, backgroundColor: `${muscleColor(e.muscle_group)}18` }}>
              {e.muscle_group}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ---------- view model for one set row ----------
interface RowVm {
  key: string; busyKey: string
  id: number | null
  exId: number; idx: number
  srv: SSet | null
  repsTxt: string; weightTxt: string
  done: boolean
}

function fmtTarget(re?: RoutineEx | null): string | null {
  if (!re) return null
  const sets = re.target_sets ?? 0
  const reps = re.target_reps || ''
  const w = re.target_weight ?? 0
  if (!sets && !reps) return null
  return `${sets || '–'} × ${reps || '–'}${w ? ` @ ${w}kg` : ''}`
}

function parseFirstInt(v?: string | null): number | null {
  if (!v) return null
  const m = String(v).match(/\d+/)
  return m ? Number(m[0]) : null
}

function buildRows(exId: number, srv: SSet[], re: RoutineEx | undefined, drafts: Record<string, string>): RowVm[] {
  const rows: RowVm[] = srv.map((x) => {
    const k = `${exId}:${x.set_index}`
    return {
      key: `srv-${x.id}`, busyKey: `srv-${x.id}`,
      id: x.id, exId, idx: x.set_index, srv: x,
      repsTxt: drafts[`${k}:r`] ?? String(x.reps ?? ''),
      weightTxt: drafts[`${k}:w`] ?? String(x.weight ?? ''),
      done: !!x.done,
    }
  })
  const ix = srv.length + 1
  const last = srv[srv.length - 1]
  const defReps = last?.reps ?? parseFirstInt(re?.target_reps as string | undefined)
  const lastW = last?.weight != null ? Number(last.weight) : null
  const defW = lastW != null ? Math.round((lastW + 2.5) * 10) / 10 : re?.target_weight ?? ''
  const k = `${exId}:${ix}`
  rows.push({
    key: `new-${exId}-${ix}`, busyKey: `new-${exId}-${ix}`,
    id: null, exId, idx: ix, srv: null,
    repsTxt: drafts[`${k}:r`] ?? String(defReps ?? ''),
    weightTxt: drafts[`${k}:w`] ?? String(defW ?? ''),
    done: false,
  })
  return rows
}

// ---------- confetti (pure CSS) ----------
function Confetti() {
  const colors = ['#c8f542', '#7dd956', '#4ecdc4', '#8b7cf6', '#f47ab8', '#ffc75c', '#63e6be', '#ffe066']
  const [bits] = useState(() => [...Array(16)].map((_, i) => ({
    left: (i * 6.5 + Math.random() * 4) % 96,
    dur: 2.4 + Math.random() * 2.4,
    delay: Math.random() * 2.5,
    tall: Math.random() > 0.5,
    c: colors[i % colors.length],
  })))
  return (
    <React.Fragment>
      <style>{`@keyframes fz-fall { 0% { transform: translateY(-6vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(44vh) rotate(540deg); opacity: 0 } }
        .fz-confetti { position: absolute; top: 0; animation: fz-fall linear infinite; border-radius: 2px; }`}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {bits.map((b, i) => (
          <span key={i} className="fz-confetti" style={{ left: `${b.left}%`, width: 7, height: b.tall ? 12 : 7, backgroundColor: b.c, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, opacity: 0.85 }} />
        ))}
      </div>
    </React.Fragment>
  )
}

export default function WorkoutSession() {
  const { id } = useParams()
  const sid = Number(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [data, setData] = useState<SessionData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [exAll, setExAll] = useState<Exercise[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [custom, setCustom] = useState<{ exId: number; name: string }[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ prs: number; calories: number; setCount: number } | null>(null)
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const setDraft = (key: string, v: string) => setDrafts((d) => ({ ...d, [key]: v }))

  const reload = useCallback(async () => {
    const d = await api.get<SessionData>(`/api/workouts/sessions/${sid}`)
    setData(d)
  }, [sid])

  // initial load — resets everything when the session id changes
  useEffect(() => {
    let alive = true
    setLoaded(false); setData(null); setErr(null); setCustom([]); setResult(null); setRest(null); setDrafts({})
    api.get<SessionData>(`/api/workouts/sessions/${sid}`)
      .then((d) => { if (alive) { setData(d); setLoaded(true) } })
      .catch((e: Error) => { if (alive) { setErr(e.message); setLoaded(true) } })
    api.get<{ exercises: Exercise[] }>('/api/exercises').then((d) => { if (alive) setExAll(d.exercises || []) }).catch(() => {})
    api.get<{ routines: Routine[] }>('/api/workouts/routines').then((d) => { if (alive) setRoutines(d.routines || []) }).catch(() => {})
    try {
      const pend = localStorage.getItem('fitzone_add_exercise')
      if (pend) {
        localStorage.removeItem('fitzone_add_exercise')
        const p = JSON.parse(pend)
        if (p?.id) setCustom([{ exId: Number(p.id), name: p.name || 'Exercise' }])
      }
    } catch { /* ignore */ }
    return () => { alive = false }
  }, [sid])

  // 1s tick while live
  const isDone = data?.session?.completed_at != null
  useEffect(() => {
    if (isDone || result) return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [isDone, result])

  const exName = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of exAll) m.set(e.id, e.name)
    return m
  }, [exAll])

  const routine = useMemo(() => routines.find((r) => r.id === data?.session?.routine_id) || null, [routines, data])
  const routineEx = useMemo(() => {
    const m = new Map<number, RoutineEx>()
    for (const e of routine?.exercises || []) m.set(e.exercise_id, e)
    return m
  }, [routine])

  const groups = useMemo(() => {
    if (!data) return []
    const meta = new Map<number, { name: string }>()
    const ensure = (exId: number, name: string) => { if (!meta.has(exId)) meta.set(exId, { name }) }
    for (const x of data.sets) ensure(x.exercise_id, x.name || exName.get(x.exercise_id) || 'Exercise')
    for (const exId of routineEx.keys()) ensure(exId, exName.get(exId) || 'Exercise')
    for (const c of custom) {
      if (meta.has(c.exId)) continue
      if (data.sets.some((x) => x.exercise_id === c.exId)) continue
      ensure(c.exId, c.name)
    }
    return [...meta.entries()].map(([exId, m]) => ({
      exId,
      name: m.name,
      rest: Number(routineEx.get(exId)?.rest_seconds) || REST_DEFAULT,
      target: fmtTarget(routineEx.get(exId)),
    }))
  }, [data, routineEx, custom, exName])

  const s = data?.session
  const doneSets = useMemo(() => (data?.sets ?? []).filter((x) => x.done), [data])
  const liveVolume = doneSets.reduce((a, x) => a + (Number(x.reps) || 0) * (Number(x.weight) || 0), 0)
  const elapsedSec = s?.completed_at && s.duration_sec != null
    ? s.duration_sec
    : Math.max(0, Math.floor((now - new Date(s?.started_at || Date.now()).getTime()) / 1000) || 0)
  const lastDone = doneSets[doneSets.length - 1]
  const currentName = lastDone
    ? lastDone.name || exName.get(lastDone.exercise_id) || groups.find((g) => g.exId === lastDone.exercise_id)?.name || '—'
    : groups[0]?.name || '—'
  const restLeft = rest ? Math.max(0, Math.round((rest.until - now) / 1000)) : 0
  const restPct = rest ? Math.max(0, Math.min(100, (restLeft / rest.total) * 100)) : 0

  // ---------- actions ----------
  const markDone = async (g: { exId: number; rest: number }, r: RowVm) => {
    setBusy(r.busyKey)
    try {
      const reps = num(r.repsTxt), weight = num(r.weightTxt)
      if (r.id) await api.put(`/api/workouts/sessions/${sid}/sets/${r.id}`, { reps, weight, done: true })
      else await api.post(`/api/workouts/sessions/${sid}/sets`, { exercise_id: g.exId, set_index: r.idx, reps, weight, type: 'normal', done: true })
      await reload()
      setRest({ until: Date.now() + (g.rest || REST_DEFAULT) * 1000, total: g.rest || REST_DEFAULT })
    } catch (e: any) {
      toast(e?.message || 'Saving set failed', 'err')
    } finally { setBusy(null) }
  }

  const unDone = async (r: RowVm) => {
    if (!r.id) return
    try {
      await api.put(`/api/workouts/sessions/${sid}/sets/${r.id}`, { done: false })
      await reload()
      setRest(null)
    } catch (e: any) { toast(e?.message || 'Update failed', 'err') }
  }

  const saveEdit = async (r: RowVm) => {
    if (!r.id || !r.srv) return
    if (num(r.repsTxt) === (r.srv.reps ?? 0) && num(r.weightTxt) === (r.srv.weight ?? 0)) return
    try {
      await api.put(`/api/workouts/sessions/${sid}/sets/${r.id}`, { reps: num(r.repsTxt), weight: num(r.weightTxt) })
      await reload()
    } catch (e: any) { toast(e?.message || 'Update failed', 'err') }
  }

  const addCustom = (e: Exercise) => {
    setCustom((c) => [...c, { exId: e.id, name: e.name }])
    setPickerOpen(false)
    toast(`${e.name} added — log your first set`, 'info')
    setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }), 120)
  }

  const finish = async () => {
    setBusy('finish')
    try {
      const res = await api.put<FinishRes>(`/api/workouts/sessions/${sid}/finish`)
      try { await reload() } catch { /* keep local state */ }
      const vol = liveVolume
      setResult({
        prs: res.prs ?? 0,
        calories: res.calories ?? caloriesEstimate(elapsedSec, vol),
        setCount: res.setCount ?? doneSets.length,
      })
      setRest(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      toast(e?.message || 'Finishing failed', 'err')
    } finally { setBusy(null) }
  }

  const startNext = async () => {
    try {
      const ns = await api.post<{ id: number }>('/api/workouts/sessions', { name: s?.name || 'Workout' })
      navigate(`/workouts/session/${ns.id}`)
    } catch (e: any) { toast(e?.message || 'Could not start next workout', 'err') }
  }

  // ---------- render ----------
  if (!loaded) {
    return (
      <div className="page-in space-y-5">
        <Skeleton className="h-28" />
        <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-52" />)}</div>
      </div>
    )
  }

  if (err || !s) {
    return (
      <div className="page-in space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/workouts')}><ArrowLeft size={15} /> Back</Button>
        <EmptyState icon={<Info size={20} />} title="Workout not found" body={err || 'This session may have been deleted.'}
          action={<Button variant="outline" size="sm" onClick={() => navigate('/workouts')}>Go to workouts</Button>} />
      </div>
    )
  }

  // ===== summary / result (completed or just finished) =====
  if (result || s.completed_at) {
    const sec = s.duration_sec ?? elapsedSec
    const vol = s.total_volume || liveVolume
    const cals = result?.calories ?? caloriesEstimate(sec, vol)
    const setsN = result?.setCount ?? doneSets.length
    const byEx = new Map<number, { name: string; sets: SSet[] }>()
    for (const x of data!.sets) {
      if (x.done === false) continue
      let g = byEx.get(x.exercise_id)
      if (!g) { g = { name: x.name || exName.get(x.exercise_id) || 'Exercise', sets: [] }; byEx.set(x.exercise_id, g) }
      g.sets.push(x)
    }
    const exercisesN = byEx.size
    const prs = result?.prs ?? 0
    return (
      <div className="page-in space-y-6">
        <Card className="relative overflow-hidden p-6 text-center" style={{ borderColor: 'rgba(200,245,66,.3)' }}>
          <Confetti />
          <div className="relative">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl accent-glow" style={{ background: 'var(--accent)' }}>
              <PartyPopper size={26} style={{ color: 'var(--accent-ink)' }} />
            </div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">{s.name} — done!</h1>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">
              {result ? 'Workout finished and saved. Nice work!' : 'Workout completed.'}
              {prs > 0 && <span className="text-lime"> · {prs} new PR{prs === 1 ? '' : 's'} 🏆</span>}
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<TimerIcon size={15} />} label="Duration" value={fmt.dur(sec)} accent />
          <StatCard icon={<Trophy size={15} />} label="Volume" value={fmt.vol(vol)} sub={`${fmt.n(vol, 0)} kg moved`} />
          <StatCard icon={<Check size={15} />} label="Sets completed" value={setsN} />
          <StatCard icon={<Flame size={15} />} label="Est. calories" value={cals} sub={`${exercisesN} exercises`} />
        </div>

        {data!.records.length > 0 && (
          <Card className="p-5">
            <SectionTitle title="Records" sub="Best effective 1-rep max per exercise" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data!.records.map((r, i) => (
                <div key={`${r.name}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-night2/60 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Trophy size={16} className="shrink-0 text-lime" />
                    <span className="truncate text-[13.5px] font-semibold text-ink">{r.name}</span>
                  </div>
                  <span className="shrink-0 font-display text-sm font-bold text-lime">
                    {r.e1rm != null ? `${fmt.n(r.e1rm, 1)}kg e1RM` : r.weight != null ? `${fmt.n(r.weight, 1)}kg` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5">
          <SectionTitle title="Session log" sub="Every set you completed, grouped by exercise" />
          <div className="space-y-3">
            {[...byEx.values()].map((g, gi) => (
              <div key={`${g.name}-${gi}`} className="rounded-2xl border border-line bg-night2/60 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{g.name}</span>
                  <span className="text-[11px] text-muted">{g.sets.length} sets</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.sets.map((x, i) => (
                    <span key={i} className="rounded-lg bg-card2 px-2 py-1 text-[11.5px] text-ink">
                      {x.reps ?? 0} × <span className="font-semibold text-lime">{fmt.n(x.weight ?? 0, 1)}kg</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => navigate('/workouts')}><ArrowLeft size={15} /> Back to workouts</Button>
          <Button onClick={startNext}><Play size={15} /> Start next workout</Button>
        </div>
      </div>
    )
  }

  // ===== LIVE MODE =====
  return (
    <div className="page-in space-y-5">
      {/* sticky live header */}
      <div className="sticky top-14 lg:top-0 z-20 -mx-4 sm:-mx-6 border-b border-line bg-night/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-lime">Live</span>
            </div>
            <h1 className="mt-0.5 truncate font-display text-lg font-extrabold tracking-tight text-ink">{s.name}</h1>
            <p className="text-[11.5px] text-muted">Started {fmt.time(s.started_at)} · {currentName}</p>
          </div>
          <Button onClick={finish} loading={busy === 'finish'} size="md" className="shrink-0"><Play size={15} /> FINISH WORKOUT</Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { k: 'Elapsed', v: mmss(elapsedSec) },
            { k: 'Sets done', v: String(doneSets.length) },
            { k: 'Volume', v: fmt.vol(liveVolume) },
          ].map((st) => (
            <div key={st.k} className="rounded-xl bg-card2 px-3 py-2 text-center">
              <div className="font-display text-[15px] font-bold text-ink">{st.v}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted">{st.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* exercise sections */}
      <div className="space-y-3">
        {groups.map((g) => {
          const srv = data!.sets.filter((x) => x.exercise_id === g.exId).sort((a, b) => a.set_index - b.set_index)
          const rows = buildRows(g.exId, srv, routineEx.get(g.exId), drafts)
          const mc = muscleColor(exAll.find((e) => e.id === g.exId)?.muscle_group || '')
          const doneCount = rows.filter((r) => r.done).length
          return (
            <Card key={g.exId} className="overflow-hidden">
              <div className="flex items-start justify-between gap-2 border-b border-line bg-night2/40 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-[14.5px] font-semibold text-ink">{g.name}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    {g.target && <span>{g.target}</span>}
                    <span>rest {g.rest}s</span>
                    <span>· {doneCount} done</span>
                  </div>
                </div>
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: mc }} />
              </div>
              <div className="p-3">
                <div className="mb-1.5 grid grid-cols-[30px_1fr_1fr_44px] items-center gap-2 px-1.5 text-[10px] uppercase tracking-wide text-muted">
                  <span>Set</span><span>Weight (kg)</span><span>Reps</span><span className="text-center">Done</span>
                </div>
                <div className="space-y-1.5">
                  {rows.map((r) => {
                    const isBusy = busy === r.busyKey
                    return (
                      <div key={r.key} className={cn('grid grid-cols-[30px_1fr_1fr_44px] items-center gap-2 rounded-xl border px-1.5 py-1.5',
                        r.done ? 'border-lime/25 bg-lime/[0.06]' : r.id ? 'border-line bg-card2/50' : 'border-dashed border-line bg-night2/40')}>
                        <span className="flex h-6 w-6 items-center justify-center justify-self-center rounded-lg bg-card2 text-[11px] font-bold text-muted">{r.idx}</span>
                        <Input
                          type="number" step="0.5" inputMode="decimal" placeholder="0.0"
                          value={r.weightTxt}
                          onChange={(e) => setDraft(`${g.exId}:${r.idx}:w`, e.target.value)}
                          onBlur={() => saveEdit(r)}
                          disabled={r.done}
                          className="h-9 px-2 text-center text-[13.5px]"
                          aria-label={`${g.name} set ${r.idx} weight`}
                        />
                        <Input
                          type="number" step="1" inputMode="numeric" placeholder="0"
                          value={r.repsTxt}
                          onChange={(e) => setDraft(`${g.exId}:${r.idx}:r`, e.target.value)}
                          onBlur={() => saveEdit(r)}
                          disabled={r.done}
                          className="h-9 px-2 text-center text-[13.5px]"
                          aria-label={`${g.name} set ${r.idx} reps`}
                        />
                        <button
                          onClick={() => (r.done ? unDone(r) : markDone(g, r))}
                          disabled={isBusy}
                          className={cn('mx-auto flex h-9 w-10 items-center justify-center rounded-lg border transition',
                            r.done ? 'border-lime/40 bg-lime text-lime-ink' : 'border-line bg-card2 text-muted hover:border-lime/50 hover:text-lime',
                            isBusy && 'opacity-60')}
                          title={r.done ? 'Mark as not done' : 'Log set'}
                        >
                          {isBusy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check size={15} />}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-2 text-center text-[10.5px] text-muted/70">Next set is pre-filled with +2.5 kg on your last weight</p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* add exercise */}
      <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}><Plus size={15} /> Add exercise</Button>

      {/* rest timer */}
      {rest && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <Card className="flex w-full max-w-sm items-center gap-4 p-4 shadow-2xl shadow-black/50">
            <ProgressRing pct={restPct} size={64} stroke={7} color={restLeft === 0 ? 'var(--ok)' : 'var(--accent)'}>
              <span className="font-display text-[13px] font-extrabold text-ink">{mmss(restLeft)}</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-lime">
                <TimerIcon size={13} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">{restLeft === 0 ? 'Rest over — go!' : 'Rest'}</span>
              </div>
              <p className="truncate text-[12.5px] text-muted">Catch your breath, then hit it.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setRest(null)}><SkipForward size={13} /> Skip</Button>
          </Card>
        </div>
      )}

      <PickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addCustom} />
    </div>
  )
}
