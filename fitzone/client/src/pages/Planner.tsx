import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, Check, ClipboardList, Pencil, Plus, Sparkles, Trash2, Zap,
} from 'lucide-react'
import { api, muscleColor } from '@/lib/api'
import {
  Badge, Button, Card, Confirm, EmptyState, Field, Input, Modal, Segmented, Select, Skeleton, cn, useToast,
} from '@/components/ui'

interface PlanDay { day: string; type: 'workout' | 'rest' | string; name?: string | null; muscle_groups?: string | null }
interface Plan { id: number; name: string; split: string; active: number | boolean; days: PlanDay[] }
interface Routine { id: number; name: string; exercises?: { exercise_id: number }[] }

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEK_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const SPLIT_TEMPLATES: Record<string, { label: string; days: { name: string; mg: string }[] }> = {
  push_pull_legs: {
    label: 'Push / Pull / Legs',
    days: [
      { name: 'Push day', mg: 'Chest, Shoulders, Triceps' },
      { name: 'Pull day', mg: 'Back, Biceps, Forearms' },
      { name: 'Leg day', mg: 'Legs, Glutes, Calves' },
    ],
  },
  upper_lower: {
    label: 'Upper / Lower',
    days: [
      { name: 'Upper body', mg: 'Chest, Back, Shoulders, Arms' },
      { name: 'Lower body', mg: 'Legs, Glutes, Calves' },
    ],
  },
  bro_split: {
    label: 'Bro Split',
    days: [
      { name: 'Chest day', mg: 'Chest, Abs' },
      { name: 'Back day', mg: 'Back, Forearms' },
      { name: 'Shoulder day', mg: 'Shoulders, Abs' },
      { name: 'Arm day', mg: 'Biceps, Triceps' },
      { name: 'Leg day', mg: 'Legs, Calves' },
      { name: 'Conditioning day', mg: 'Cardio, Abs' },
    ],
  },
  arnold_split: {
    label: 'Arnold Split',
    days: [
      { name: 'Chest & Back', mg: 'Chest, Back' },
      { name: 'Shoulders & Arms', mg: 'Shoulders, Biceps, Triceps' },
      { name: 'Legs', mg: 'Legs, Calves' },
    ],
  },
  full_body: {
    label: 'Full Body',
    days: [{ name: 'Full body', mg: 'Chest, Back, Legs, Shoulders' }],
  },
  custom: {
    label: 'Custom',
    days: [
      { name: 'Workout A', mg: '' },
      { name: 'Workout B', mg: '' },
    ],
  },
}

function splitLabel(split: string) { return SPLIT_TEMPLATES[split]?.label || 'Custom plan' }

function buildDays(split: string, n: number): PlanDay[] {
  const tpl = SPLIT_TEMPLATES[split]?.days || SPLIT_TEMPLATES.custom.days
  const days: PlanDay[] = []
  const cycles = tpl.length < n // reuse same day names when template is shorter than week count
  for (let i = 0; i < n; i++) {
    const t = tpl[i % tpl.length]
    const base = t.name.replace(/ [A-D]$/, '')
    const name = cycles ? `${base} ${String.fromCharCode(65 + i)}` : t.name
    days.push({ day: WEEK[i], type: 'workout', name, muscle_groups: t.mg || null })
  }
  for (let i = n; i < 7; i++) days.push({ day: WEEK[i], type: 'rest', name: null, muscle_groups: null })
  return days
}

const dayMgs = (d: PlanDay) => (d.muscle_groups || '').split(',').map((m) => m.trim()).filter(Boolean)

export default function Planner() {
  const toast = useToast()
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null)

  const [wizOpen, setWizOpen] = useState(false)
  const [wizSplit, setWizSplit] = useState('push_pull_legs')
  const [wizDays, setWizDays] = useState(4)
  const [wizName, setWizName] = useState('')
  const [wizNameTouched, setWizNameTouched] = useState(false)
  const [wizSaving, setWizSaving] = useState(false)

  const [editing, setEditing] = useState<Plan | null>(null)
  const [editName, setEditName] = useState('')
  const [editDays, setEditDays] = useState<PlanDay[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [activating, setActivating] = useState<number | null>(null)

  // one fetch per list
  useEffect(() => {
    load()
    api.get<{ routines: Routine[] }>('/api/workouts/routines').then((d) => setRoutines(d.routines || [])).catch(() => {})
  }, [])

  const load = () => api.get<{ plans: Plan[] }>('/api/plans').then((d) => setPlans(d.plans || [])).catch(() => setPlans([]))

  // wizard auto-name
  useEffect(() => {
    if (!wizNameTouched) setWizName(`${splitLabel(wizSplit)} — ${wizDays} Day`)
  }, [wizSplit, wizDays, wizNameTouched])

  const toggleWizDay = (v: number) => setWizDays(v)

  const wizDaysBuilt = useMemo(() => buildDays(wizSplit, wizDays), [wizSplit, wizDays])

  const createPlan = async () => {
    if (!wizName.trim()) { toast('Give your plan a name', 'err'); return }
    setWizSaving(true)
    try {
      await api.post('/api/plans', {
        name: wizName.trim(),
        split: wizSplit,
        days: wizDaysBuilt,
        active: true,
      })
      toast('Plan generated and set active 🎉', 'ok')
      setWizOpen(false)
      await load()
    } catch (e: any) {
      toast(e?.message || 'Creating plan failed', 'err')
    } finally { setWizSaving(false) }
  }

  const activate = async (p: Plan) => {
    setActivating(p.id)
    try {
      await api.post(`/api/plans/${p.id}/activate`)
      toast(`“${p.name}” is now your active plan`, 'ok')
      await load()
    } catch (e: any) {
      toast(e?.message || 'Activation failed', 'err')
    } finally { setActivating(null) }
  }

  const openEdit = (p: Plan) => {
    setEditing(p)
    setEditName(p.name)
    const byDay = new Map((p.days || []).map((d) => [d.day, d]))
    setEditDays(WEEK.map((day) => {
      const d = byDay.get(day)
      return { day, type: d?.type === 'workout' ? 'workout' : 'rest', name: d?.name ?? '', muscle_groups: d?.muscle_groups ?? '' }
    }))
  }

  const saveEdit = async () => {
    if (!editing || !editName.trim()) { toast('Plan name is required', 'err'); return }
    setEditSaving(true)
    try {
      await api.put(`/api/plans/${editing.id}`, { name: editName.trim(), days: editDays })
      toast('Plan updated', 'ok')
      setEditing(null)
      await load()
    } catch (e: any) {
      toast(e?.message || 'Saving plan failed', 'err')
    } finally { setEditSaving(false) }
  }

  const doDelete = async () => {
    if (!confirm) return
    try {
      await api.del(`/api/plans/${confirm.id}`)
      toast('Plan deleted', 'ok')
      await load()
    } catch (e: any) {
      toast(e?.message || 'Delete failed', 'err')
    }
  }

  const activePlan = useMemo(() => plans?.find((p) => !!p.active) || null, [plans])

  return (
    <div className="page-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Training Planner</h1>
          <p className="mt-1 text-sm text-muted">Design your weekly split and stay on schedule.</p>
        </div>
        <Button onClick={() => { setWizNameTouched(false); setWizOpen(true) }}><Sparkles size={15} /> Generate plan</Button>
      </div>

      {plans === null ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
        </div>
      ) : (
        <React.Fragment>
          {/* Active plan summary */}
          {activePlan && (
            <Card className="border-lime/25 bg-gradient-to-br from-lime/[0.06] to-transparent p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-lime" />
                  <h2 className="font-display text-[15px] font-bold text-ink">{activePlan.name}</h2>
                  <Badge color="lime">Active</Badge>
                </div>
                <span className="text-[11px] text-muted">{splitLabel(activePlan.split)}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {WEEK.map((day, i) => {
                  const d = (activePlan.days || []).find((x) => x.day === day)
                  return d && d.type === 'workout' ? (
                    <div key={day} className="rounded-2xl border border-line bg-card px-3.5 py-3">
                      <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wide text-muted">
                        <span>{WEEK_SHORT[i]}</span>
                        <span className="text-lime">TRAIN</span>
                      </div>
                      <div className="mt-0.5 truncate font-display text-[13.5px] font-bold text-ink">{d.name}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {dayMgs(d).map((m) => (
                          <span key={m} className="rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium"
                            style={{ color: muscleColor(m), borderColor: `${muscleColor(m)}45`, backgroundColor: `${muscleColor(m)}18` }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div key={day} className="rounded-2xl border border-dashed border-line/70 bg-card/40 px-3.5 py-3">
                      <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wide text-muted">
                        <span>{WEEK_SHORT[i]}</span><span className="opacity-90">REST</span>
                      </div>
                      <div className="mt-0.5 text-[13.5px] font-semibold text-muted/70">Recover</div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Plan cards */}
          {plans.length === 0 ? (
            <EmptyState icon={<CalendarDays size={20} />} title="No training plans yet"
              body="Generate a weekly split — push/pull/legs, upper/lower and more — in seconds."
              action={<Button onClick={() => { setWizNameTouched(false); setWizOpen(true) }}><Sparkles size={15} /> Generate plan</Button>} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((p) => {
                const byDayMap = new Map((p.days || []).map((d) => [d.day, d]))
                return (
                  <Card key={p.id} className={cn('flex flex-col p-4', !!p.active && 'border-lime/35')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-[15px] font-bold text-ink">{p.name}</h3>
                        <p className="mt-0.5 text-[11px] text-muted">{splitLabel(p.split)}</p>
                      </div>
                      {!!p.active && <Badge color="lime">Active</Badge>}
                    </div>

                    {/* 7-day mini grid */}
                    <div className="mt-4 grid grid-cols-7 gap-1">
                      {WEEK_SHORT.map((sh, i) => {
                        const d = byDayMap.get(WEEK[i])
                        const isWorkout = d?.type === 'workout'
                        const mg = isWorkout ? dayMgs(d!)[0] : ''
                        const c = isWorkout ? muscleColor(mg) : undefined
                        return (
                          <div key={sh} className="flex flex-col items-center gap-1">
                            <span className="text-[9px] uppercase tracking-wide text-muted">{sh}</span>
                            <span className="flex h-8 w-full items-center justify-center rounded-lg border text-[10px] font-bold"
                              style={isWorkout
                                ? { color: c, borderColor: `${c}55`, backgroundColor: `${c}1c` }
                                : { color: 'var(--muted)', borderColor: 'var(--line)', backgroundColor: 'transparent' }}>
                              {isWorkout ? <Check size={12} /> : '·'}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    <span className="mt-3 text-[11px] text-muted">
                      {(p.days || []).filter((d) => d.type === 'workout').length} training days / week
                    </span>

                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                      {!p.active && (
                        <Button size="sm" variant="outline" loading={activating === p.id} onClick={() => activate(p)}><Zap size={13} /> Activate</Button>
                      )}
                      <Button size="sm" variant="subtle" onClick={() => openEdit(p)}><Pencil size={13} /> Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirm({ id: p.id, name: p.name })}><Trash2 size={13} /></Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </React.Fragment>
      )}

      {/* Tip: assign workouts from routines */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime"><ClipboardList size={16} /></span>
          <div className="min-w-0">
            <h3 className="font-display text-[14px] font-bold text-ink">Assign workouts from your routines</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Tip: name your plan days the same as your existing routines so each scheduled day maps to a ready-made template.
              {routines.length > 0 && (
                <React.Fragment>
                  {' '}You already have <span className="text-ink">{routines.length}</span> routine{routines.length === 1 ? '' : 's'}:
                </React.Fragment>
              )}
            </p>
            {routines.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {routines.slice(0, 6).map((r) => (
                  <span key={r.id} className="rounded-full border border-line bg-card2 px-2.5 py-1 text-[11px] text-ink">{r.name}</span>
                ))}
              </div>
            )}
            <Link to="/workouts" className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold text-lime hover:underline">
              Go to Workouts <Plus size={13} />
            </Link>
          </div>
        </div>
      </Card>

      {/* Generate plan wizard */}
      <Modal open={wizOpen} onClose={() => setWizOpen(false)} title="Generate a plan">
        <div className="space-y-4">
          <Field label="Split">
            <Select value={wizSplit} onChange={(e) => setWizSplit(e.target.value)}>
              {Object.entries(SPLIT_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Days per week" hint="training days">
            <Segmented value={wizDays} onChange={toggleWizDay} options={([3, 4, 5, 6] as const).map((n) => ({ value: n, label: String(n) }))} />
          </Field>
          <Field label="Plan name">
            <Input value={wizName} onChange={(e) => { setWizName(e.target.value); setWizNameTouched(true) }} />
          </Field>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-medium text-muted">Weekly preview</span>
              <span className="text-[11px] text-muted">{7 - wizDays} rest day{7 - wizDays === 1 ? '' : 's'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {wizDaysBuilt.map((d, i) => d.type === 'workout' ? (
                <span key={i} className="rounded-full border px-3 py-1 text-[12px] font-medium text-ink"
                  style={{ borderColor: `${muscleColor(dayMgs(d)[0] || '')}45`, backgroundColor: `${muscleColor(dayMgs(d)[0] || '')}18` }}>
                  {WEEK_SHORT[i]} · {d.name}
                </span>
              ) : (
                <span key={i} className="rounded-full border border-dashed border-line px-3 py-1 text-[12px] text-muted">{WEEK_SHORT[i]} · rest</span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setWizOpen(false)}>Cancel</Button>
            <Button onClick={createPlan} loading={wizSaving}><Sparkles size={15} /> Generate plan</Button>
          </div>
        </div>
      </Modal>

      {/* Edit plan modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} wide title="Edit plan">
        {editing && (
          <div className="space-y-4">
            <Field label="Plan name">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </Field>
            <div className="space-y-2">
              {editDays.map((d, i) => (
                <div key={d.day} className="grid grid-cols-[64px_92px_1fr_1.3fr] gap-2 rounded-2xl border border-line bg-night2/50 p-2.5">
                  <span className="flex items-center text-[12px] font-semibold text-muted">{WEEK_SHORT[i]}</span>
                  <Select value={d.type} onChange={(e) => setEditDays((ds) => ds.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className="h-9 py-0 text-[12.5px]">
                    <option value="workout">Workout</option>
                    <option value="rest">Rest</option>
                  </Select>
                  <Input value={d.type === 'workout' ? (d.name ?? '') : ''} disabled={d.type !== 'workout'} placeholder="e.g. Push day"
                    onChange={(e) => setEditDays((ds) => ds.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="h-9 py-0 text-[12.5px]" />
                  <Input value={d.type === 'workout' ? (d.muscle_groups ?? '') : ''} disabled={d.type !== 'workout'} placeholder="Muscle groups"
                    onChange={(e) => setEditDays((ds) => ds.map((x, j) => j === i ? { ...x, muscle_groups: e.target.value } : x))} className="h-9 py-0 text-[12.5px]" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveEdit} loading={editSaving}><Check size={15} /> Save plan</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={doDelete} danger
        title="Delete plan?" body={confirm ? `“${confirm.name}” will be removed permanently. This can't be undone.` : undefined} />
    </div>
  )
}
