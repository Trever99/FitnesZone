import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Calendar, ChevronDown, ClipboardList, Copy, Dumbbell, History as HistoryIcon, Pencil, Play, Plus, Search, Trash2, X,
} from 'lucide-react'
import { api, fmt, muscleColor } from '@/lib/api'
import {
  Badge, Button, Card, Confirm, EmptyState, Field, Input, Modal, Segmented, Skeleton, Textarea, cn, useToast,
} from '@/components/ui'

interface Exercise {
  id: number; name: string; muscle_group: string; secondary_muscles: string | null
  equipment: string; difficulty: string
}
interface SessSet { reps: number | null; weight: number | null; exercise_id: number; type: string; done: boolean; set_index?: number }
interface SessionRow {
  id: number; name: string; started_at: string; completed_at: string | null
  duration_sec: number | null; total_volume: number | null; sets: SessSet[]
}
interface RoutineEx { exercise_id: number; target_sets: number; target_reps: string; target_weight: number; rest_seconds: number }
interface Routine { id: number; name: string; notes: string | null; exercises: RoutineEx[] }
type BRow = RoutineEx & { name: string }

const diffColor = (d: string): 'ok' | 'warn' | 'danger' | 'line' => {
  const s = (d || '').toLowerCase()
  if (s.startsWith('adv')) return 'danger'
  if (s.startsWith('int') || s.startsWith('mid')) return 'warn'
  return 'ok'
}

// ---------- Exercise Picker (self-contained) ----------
function PickerModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const [q, setQ] = useState('')
  const [deb, setDeb] = useState('')
  const [items, setItems] = useState<Exercise[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!open) { setQ(''); setDeb(''); return }
    const t = setTimeout(() => setDeb(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q, open])
  useEffect(() => {
    if (!open) { setItems(null); setErr(false); return }
    let alive = true
    api.get<{ exercises: Exercise[] }>(`/api/exercises?q=${encodeURIComponent(deb)}`)
      .then((d) => { if (alive) { setItems(d.exercises || []); setErr(false) } })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [deb, open])

  return (
    <Modal open={open} onClose={onClose} title="Pick exercises">
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-10" autoFocus />
      </div>
      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
        {items === null && !err && [...Array(6)].map((_, i) => <Skeleton key={i} className="h-11" />)}
        {err && <p className="py-6 text-center text-[13px] text-danger">Couldn't load exercises.</p>}
        {items !== null && items.length === 0 && <p className="py-6 text-center text-[13px] text-muted">No matches for “{deb}”.</p>}
        {items?.map((e) => (
          <button key={e.id} onClick={() => onPick(e)}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-card2">
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-medium text-ink">{e.name}</div>
              <div className="text-[11px] text-muted">{e.equipment} · {e.difficulty}</div>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0"
              style={{ color: muscleColorSafe(e.muscle_group), borderColor: `${muscleColorSafe(e.muscle_group)}45`, backgroundColor: `${muscleColorSafe(e.muscle_group)}18` }}>
              {e.muscle_group}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

const muscleColorSafe = (m: string) => muscleColor(m)

// ---------- Routine Builder ----------
function RoutineBuilderModal({
  open, initial, onClose, onSaved,
}: {
  open: boolean
  initial: { id?: number; name: string; notes: string; rows: BRow[] } | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<BRow[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open && initial) {
      setName(initial.name)
      setNotes(initial.notes)
      setRows(initial.rows)
      setTouched(false)
    }
  }, [open, initial])

  const pick = (e: Exercise) => {
    if (rows.some((r) => r.exercise_id === e.id)) return
    setRows((rs) => [...rs, { exercise_id: e.id, name: e.name, target_sets: 4, target_reps: '8-10', target_weight: 0, rest_seconds: 90 }])
  }

  const save = async () => {
    if (!name.trim()) { toast('Give your routine a name', 'err'); return }
    if (rows.length === 0) { toast('Add at least one exercise', 'err'); return }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        notes: notes.trim(),
        exercises: rows.map((r) => ({
          exercise_id: r.exercise_id, target_sets: r.target_sets, target_reps: r.target_reps,
          target_weight: r.target_weight, rest_seconds: r.rest_seconds,
        })),
      }
      if (initial?.id) await api.put(`/api/workouts/routines/${initial.id}`, body)
      else await api.post('/api/workouts/routines', body)
      toast(initial?.id ? 'Routine updated' : 'Routine created', 'ok')
      onSaved()
      onClose()
    } catch (e: any) {
      toast(e?.message || 'Saving routine failed', 'err')
    } finally { setSaving(false) }
  }

  const numInput = { type: 'number' as const, inputMode: 'numeric' as const, min: 0 }
  return (
    <React.Fragment>
      <Modal open={open} onClose={onClose} wide title={initial?.id ? 'Edit routine' : 'Create routine'}>
        <div className="space-y-4">
          <Field label="Name" hint="required">
            <Input value={name} onChange={(e) => { setName(e.target.value); setTouched(true) }} placeholder="e.g. My push day" />
          </Field>
          <Field label="Notes" hint="optional">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Focus, tempo, progression notes…" />
          </Field>

          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line py-5 text-center text-[13px] text-muted">No exercises yet — add your first below.</p>
            )}
            {rows.map((r, i) => (
              <div key={`${r.exercise_id}-${i}`} className="rounded-2xl border border-line bg-night2/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-lime/15 text-[11px] font-bold text-lime">{i + 1}</span>
                    <span className="truncate text-[13.5px] font-semibold text-ink">{r.name}</span>
                  </div>
                  <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" title="Remove">
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <Field label="Sets"><Input {...numInput} step={1} value={r.target_sets} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, target_sets: Number(e.target.value) || 0 } : x))} className="h-9 px-2 text-center" /></Field>
                  <Field label="Reps"><Input value={r.target_reps} inputMode="numeric" placeholder="8-10" onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, target_reps: e.target.value } : x))} className="h-9 px-2 text-center" /></Field>
                  <Field label="kg"><Input {...numInput} step={2.5} value={r.target_weight} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, target_weight: Number(e.target.value) || 0 } : x))} className="h-9 px-2 text-center" /></Field>
                  <Field label="Rest s"><Input {...numInput} step={5} value={r.rest_seconds} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, rest_seconds: Number(e.target.value) || 0 } : x))} className="h-9 px-2 text-center" /></Field>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen(true)}><Plus size={14} /> Add exercise</Button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={saving}>{initial?.id ? 'Save changes' : 'Create routine'}</Button>
          </div>
        </div>
      </Modal>
      <PickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pick} />
    </React.Fragment>
  )
}

// ---------- Page ----------
export default function Workouts() {
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<'history' | 'routines'>('history')
  const [exAll, setExAll] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [routines, setRoutines] = useState<Routine[] | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('Today\'s workout')
  const [creating, setCreating] = useState(false)

  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderInitial, setBuilderInitial] = useState<WorkoutsBuilderInitial | null>(null)

  const [confirm, setConfirm] = useState<{ kind: 'session' | 'routine'; id: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  type WorkoutsBuilderInitial = { id?: number; name: string; notes: string; rows: BRow[] }

  // one-time exercise map + both lists
  useEffect(() => {
    api.get<{ exercises: Exercise[] }>('/api/exercises').then((d) => setExAll(d.exercises || [])).catch(() => {})
    api.get<{ sessions: SessionRow[] }>('/api/workouts/sessions?limit=40').then((d) => setSessions(d.sessions || [])).catch(() => setSessions([]))
    api.get<{ routines: Routine[] }>('/api/workouts/routines').then((d) => setRoutines(d.routines || [])).catch(() => setRoutines([]))
  }, [])

  const exName = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of exAll) m.set(e.id, e.name)
    return m
  }, [exAll])

  const loadSessions = () => api.get<{ sessions: SessionRow[] }>('/api/workouts/sessions?limit=40').then((d) => setSessions(d.sessions || [])).catch(() => {})
  const loadRoutines = () => api.get<{ routines: Routine[] }>('/api/workouts/routines').then((d) => setRoutines(d.routines || [])).catch(() => {})

  const startNew = async () => {
    setCreating(true)
    try {
      const s = await api.post<{ id: number }>('/api/workouts/sessions', { name: newName.trim() || 'Workout' })
      navigate(`/workouts/session/${s.id}`)
    } catch (e: any) {
      toast(e?.message || 'Could not start workout', 'err')
      setCreating(false)
    }
  }

  const startRoutine = async (r: Routine) => {
    try {
      const s = await api.post<{ id: number }>('/api/workouts/sessions', { routine_id: r.id })
      navigate(`/workouts/session/${s.id}`)
    } catch (e: any) {
      toast(e?.message || 'Could not start routine', 'err')
    }
  }

  const doDelete = async () => {
    if (!confirm) return
    setDeleting(true)
    const path = confirm.kind === 'session' ? `/api/workouts/sessions/${confirm.id}` : `/api/workouts/routines/${confirm.id}`
    try {
      await api.del(path)
      toast(confirm.kind === 'session' ? 'Workout deleted' : 'Routine deleted', 'ok')
      confirm.kind === 'session' ? loadSessions() : loadRoutines()
    } catch (e: any) {
      toast(e?.message || 'Delete failed', 'err')
    } finally { setDeleting(false) }
  }

  return (
    <div className="page-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Workouts</h1>
          <p className="mt-1 text-sm text-muted">Train, track and build your arsenal of routines.</p>
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'history', label: 'History' }, { value: 'routines', label: 'Routines' }]} />
      </div>

      {/* ============ HISTORY ============ */}
      {tab === 'history' && (
        <div className="space-y-4">
          <Button onClick={() => setNewOpen(true)}><Plus size={16} /> New workout</Button>

          {sessions === null ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : sessions.length === 0 ? (
            <EmptyState icon={<Dumbbell size={20} />} title="No workouts yet" body="Log your first session to start building your streak and strength history."
              action={<Button onClick={() => setNewOpen(true)}><Play size={15} /> Start a workout</Button>} />
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const completed = !!s.completed_at
                const done = (s.sets || []).filter((x) => x.done !== false)
                const vol = s.total_volume ?? done.reduce((a, x) => a + (Number(x.reps) || 0) * (Number(x.weight) || 0), 0)
                const grouped = groupSessionSets(s.sets || [], exName)
                return (
                  <Card key={s.id} className="overflow-hidden">
                    <button
                      className={cn('flex w-full items-center justify-between gap-3 p-4 text-left', completed && 'transition hover:bg-card2')}
                      onClick={() => completed ? navigate(`/workouts/session/${s.id}`) : setExpanded(expanded === s.id ? null : s.id)}
                      disabled={!completed}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-display text-[15px] font-semibold text-ink">{s.name}</h3>
                          {completed ? null : <Badge color="lime">In progress</Badge>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                          <HistoryIcon size={11} /> {fmt.rel(s.started_at)} · {fmt.time(s.started_at)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {completed && s.duration_sec != null && <Badge><TimerInline sec={s.duration_sec} /></Badge>}
                        {completed && <Badge color="lime"><VolumeInline kg={vol} /></Badge>}
                        <Badge>{done.length} sets</Badge>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'session', id: s.id, name: s.name }) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" title="Delete workout"
                        ><Trash2 size={13} /></button>
                        <ChevronDown size={14} className={cn('text-muted transition', expanded === s.id && 'rotate-180')} />
                      </div>
                    </button>
                    {expanded === s.id && (
                      <div className="space-y-2.5 border-t border-line bg-night2/40 p-4">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {grouped.length === 0 && <p className="text-[13px] text-muted">No sets logged.</p>}
                          {grouped.map((g) => (
                            <div key={g.exId} className="rounded-2xl border border-line bg-card p-3">
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="truncate text-[13px] font-semibold text-ink">{g.name}</span>
                                <span className="text-[11px] text-muted">{g.doneCount}/{g.sets.length} sets</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {g.sets.map((x, i) => (
                                  <span key={i} className={cn('rounded-lg px-2 py-1 text-[11.5px]', x.done ? 'bg-lime/10 text-lime' : 'bg-card2 text-muted')}>
                                    {x.reps ?? 0} × {fmt.n(x.weight ?? 0, 1)}kg
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {completed && (
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/workouts/session/${s.id}`)}>
                              View summary <ArrowRight size={13} />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ ROUTINES ============ */}
      {tab === 'routines' && (
        <div className="space-y-4">
          <Button onClick={() => { setBuilderInitial(null); setBuilderOpen(true) }}><Plus size={16} /> Create routine</Button>

          {routines === null ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : routines.length === 0 ? (
            <EmptyState icon={<ClipboardList size={20} />} title="No routines yet" body="Build a reusable template — like “My push day” — then start it with one tap."
              action={<Button onClick={() => { setBuilderInitial(null); setBuilderOpen(true) }}><Plus size={15} /> Create routine</Button>} />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {routines.map((r) => (
                <Card key={r.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-[15px] font-semibold text-ink">{r.name}</h3>
                      {r.notes && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{r.notes}</p>}
                    </div>
                    <Badge color="lime">{r.exercises?.length ?? 0} ex</Badge>
                  </div>
                  <div className="my-3 space-y-1 border-y border-line py-3 text-[12.5px]">
                    {(r.exercises || []).slice(0, 4).map((e, i) => (
                      <div key={`${e.exercise_id}-${i}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-ink/90">{exName.get(e.exercise_id) || `Exercise #${e.exercise_id}`}</span>
                        <span className="shrink-0 text-muted">
                          {e.target_sets ?? 3} × {e.target_reps ?? '8-10'}{e.target_weight ? ` @ ${e.target_weight}kg` : ''}
                        </span>
                      </div>
                    ))}
                    {(r.exercises?.length ?? 0) > 4 && <p className="pt-1 text-[11px] text-muted">+{(r.exercises?.length ?? 0) - 4} more…</p>}
                    {(r.exercises?.length ?? 0) === 0 && <p className="text-[12px] text-muted">Empty routine — edit to add exercises.</p>}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Button size="sm" onClick={() => startRoutine(r)}><Play size={13} /> Start</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setBuilderInitial({
                        id: r.id, name: r.name, notes: r.notes || '',
                        rows: (r.exercises || []).map((e, i) => ({
                          exercise_id: e.exercise_id, name: exName.get(e.exercise_id) || `Exercise ${i + 1}`,
                          target_sets: e.target_sets ?? 3, target_reps: e.target_reps ?? '8-10',
                          target_weight: e.target_weight ?? 0, rest_seconds: e.rest_seconds ?? 90,
                        })),
                      })
                      setBuilderOpen(true)
                    }}><Pencil size={13} /> Edit</Button>
                    <Button size="sm" variant="ghost" title="Duplicate" onClick={async () => {
                      try { await api.post(`/api/workouts/routines/${r.id}/duplicate`); toast('Routine duplicated', 'ok'); loadRoutines() }
                      catch (e: any) { toast(e?.message || 'Duplicate failed', 'err') }
                    }}><Copy size={13} /></Button>
                    <Button size="sm" variant="danger" title="Delete" onClick={() => setConfirm({ kind: 'routine', id: r.id, name: r.name })}><Trash2 size={13} /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New workout modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Start a workout">
        <Field label="Workout name" hint="you can also start from a routine">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Push day" autoFocus />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
          <Button onClick={startNew} loading={creating}><Play size={15} /> Start now</Button>
        </div>
        <p className="mt-4 text-center text-[12px] text-muted">
          Want a template? Go to the <Link to="/workouts" onClick={() => setTab('routines')} className="text-lime underline underline-offset-2">Routines</Link> tab.
        </p>
      </Modal>

      {/* Routine builder */}
      <RoutineBuilderModal
        open={builderOpen}
        initial={builderInitial}
        onClose={() => setBuilderOpen(false)}
        onSaved={() => { loadRoutines() }}
      />

      {/* Delete confirm */}
      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doDelete}
        title={confirm?.kind === 'session' ? 'Delete workout?' : 'Delete routine?'}
        body={confirm ? `“${confirm.name}” will be removed permanently. This can't be undone.` : undefined}
        danger
      />
      {deleting && <span className="hidden" />}
    </div>
  )
}

// small inline helpers
function TimerInline({ sec }: { sec: number }) {
  return <><Calendar size={11} /> {fmt.dur(sec)}</>
}
function VolumeInline({ kg }: { kg: number }) { return <>{fmt.vol(kg)}</> }

function groupSessionSets(sets: SessSet[], exName: Map<number, string>) {
  const groups: { exId: number; name: string; sets: SessSet[]; doneCount: number }[] = []
  const map = new Map<number, { exId: number; name: string; sets: SessSet[]; doneCount: number }>()
  for (const s of sets) {
    let g = map.get(s.exercise_id)
    if (!g) { g = { exId: s.exercise_id, name: exName.get(s.exercise_id) || `Exercise #${s.exercise_id}`, sets: [], doneCount: 0 }; map.set(s.exercise_id, g); groups.push(g) }
    g.sets.push(s)
    if (s.done !== false) g.doneCount++
  }
  return groups
}
