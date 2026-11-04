import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Scale, Camera, Trophy, Plus, Trash2, Lock, Upload, GitCompareArrows, ChevronRight, Flame, Layers, Medal,
} from 'lucide-react'
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api, fmt } from '@/lib/api'
import { cn, useToast, Card, Badge, Button, StatCard, Segmented, Modal, Confirm, Field, Input, Select, EmptyState, Skeleton, SectionTitle } from '@/components/ui'

type Tab = 'measurements' | 'photos' | 'achievements'

type Meas = {
  id: number
  entry_date: string
  weight_kg: number | null
  body_fat?: number | null
  chest?: number | null
  waist?: number | null
  arm?: number | null
  thigh?: number | null
  shoulder?: number | null
}

type Photo = { id: number; file: string; label?: string | null; created_at?: string | number }

type Ach = {
  id: number; code: string; name: string; description: string; icon: string
  goal: string; earnedAt: string | null
}

type AchStats = {
  workouts?: number; workouts7?: number; workouts28?: number; streak?: number
  volume?: number; avgDur?: number; totalSec?: number; goalRate?: number
}

const FIELDS = [
  { key: 'weight_kg', label: 'Weight (kg)', unit: 'kg' },
  { key: 'body_fat', label: 'Body fat', unit: '%' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', unit: 'cm' },
  { key: 'shoulder', label: 'Shoulder', unit: 'cm' },
] as const

const emptyForm = () => ({
  entry_date: new Date().toISOString().slice(0, 10),
  weight_kg: '',
  body_fat: '', chest: '', waist: '', arm: '', thigh: '', shoulder: '',
})

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

function statFor(goal: string | number, s: AchStats): { cur: number; target: number } {
  const goalText = String(goal)
  const target = parseFloat(goalText.replace(/[^0-9.]/g, '')) || 1
  const g = goalText.toLowerCase()
  let cur = 0
  if (g.includes('streak')) cur = s.streak ?? 0
  else if (g.includes('volume') || g.includes('ton') || g.includes(' kg')) cur = s.volume ?? 0
  else if (g.includes('workout') || g.includes('session') || g.includes('train')) cur = s.workouts ?? 0
  else cur = s.workouts ?? 0
  return { cur, target }
}

export default function Progress() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('measurements')

  // ---- Measurements ----
  const [meas, setMeas] = useState<Meas[]>([])
  const [measLoading, setMeasLoading] = useState(true)
  const [measErr, setMeasErr] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState<Meas | null>(null)
  const [cmpA, setCmpA] = useState('')
  const [cmpB, setCmpB] = useState('')

  // ---- Photos ----
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photosLoading, setPhotosLoading] = useState(true)
  const [photoLabel, setPhotoLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [delPhoto, setDelPhoto] = useState<Photo | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ---- Achievements ----
  const [achs, setAchs] = useState<Ach[]>([])
  const [achStats, setAchStats] = useState<AchStats>({})
  const [achLoading, setAchLoading] = useState(true)

  const loadMeas = useCallback(async () => {
    setMeasLoading(true)
    setMeasErr('')
    try {
      const d = await api.get<{ measurements: Meas[] }>('/api/progress/measurements')
      const list = d.measurements ?? []
      setMeas(list)
      const sorted = [...list].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))
      if (sorted.length) {
        setCmpA(sorted[Math.max(0, sorted.length - 2)]?.entry_date || sorted[0].entry_date)
        setCmpB(sorted[sorted.length - 1].entry_date)
      }
    } catch {
      setMeasErr('Could not load measurements.')
    } finally {
      setMeasLoading(false)
    }
  }, [])

  const loadPhotos = useCallback(async () => {
    setPhotosLoading(true)
    try {
      const d = await api.get<{ photos: Photo[] }>('/api/progress/photos')
      setPhotos(d.photos ?? [])
    } catch {
      setPhotos([])
    } finally {
      setPhotosLoading(false)
    }
  }, [])

  const loadAch = useCallback(async () => {
    setAchLoading(true)
    try {
      const d = await api.get<{ achievements: Ach[]; stats: AchStats }>('/api/progress/achievements')
      setAchs(d.achievements ?? [])
      setAchStats(d.stats ?? {})
    } catch {
      setAchs([])
    } finally {
      setAchLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMeas(); loadPhotos(); loadAch()
  }, [loadMeas, loadPhotos, loadAch])

  const addMeas = async () => {
    const w = parseFloat(form.weight_kg)
    if (!w || w <= 0) { toast('Enter a valid weight', 'err'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { entry_date: form.entry_date, weight_kg: w }
      for (const f of FIELDS.slice(1)) {
        const v = parseFloat(form[f.key])
        if (form[f.key] !== '' && !isNaN(v) && v > 0) body[f.key] = v
      }
      await api.post('/api/progress/measurements', body)
      toast('Measurement saved')
      setAddOpen(false)
      setForm(emptyForm())
      loadMeas()
    } catch {
      toast('Could not save measurement', 'err')
    } finally {
      setSaving(false)
    }
  }

  const removeMeas = async (id: number) => {
    try {
      await api.del(`/api/progress/measurements/${id}`)
      toast('Entry deleted', 'info')
      loadMeas()
    } catch {
      toast('Could not delete entry', 'err')
    }
  }

  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast('Choose an image file', 'err'); return }
    if (file.size > 4 * 1024 * 1024) { toast('Image is larger than 4 MB', 'err'); return }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await api.post('/api/progress/photos', { dataUrl: reader.result, label: photoLabel.trim() || undefined })
        toast('Photo added')
        setPhotoLabel('')
        loadPhotos()
      } catch {
        toast('Upload failed', 'err')
      } finally {
        setUploading(false)
      }
    }
    reader.onerror = () => { toast('Could not read file', 'err'); setUploading(false) }
    reader.readAsDataURL(file)
  }

  const removePhoto = async (id: number) => {
    try {
      await api.del(`/api/progress/photos/${id}`)
      toast('Photo deleted', 'info')
      loadPhotos()
    } catch {
      toast('Could not delete photo', 'err')
    }
  }

  const weightSeries = [...meas]
    .sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))
    .filter((m) => m.weight_kg != null)
    .map((m) => ({ date: fmt.date(m.entry_date), weight_kg: m.weight_kg as number }))

  const latest = meas.length ? [...meas].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))[0] : null
  const firstM = meas.length ? [...meas].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))[0] : null
  const wDelta = latest && firstM && latest.weight_kg != null && firstM.weight_kg != null
    ? Math.round((latest.weight_kg - firstM.weight_kg) * 10) / 10 : null

  const A = meas.find((m) => m.entry_date === cmpA)
  const B = meas.find((m) => m.entry_date === cmpB)
  const cmpRows = A && B
    ? FIELDS.map((f) => {
      const a = (A as unknown as Record<string, number | null>)[f.key]
      const b = (B as unknown as Record<string, number | null>)[f.key]
      return { ...f, delta: a != null && b != null ? Math.round((b - a) * 10) / 10 : null }
    })
    : []
  const cmpName = (d?: string) => {
    const m = meas.find((x) => x.entry_date === d)
    return d ? `${fmt.date(d)}${m?.weight_kg != null ? ` · ${fmt.n(m.weight_kg, 1)} kg` : ''}` : 'Select a date'
  }
  const sortedDates = [...meas].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1)).map((m) => m.entry_date)

  const earned = achs.filter((a) => !!a.earnedAt)
  const unlockedPct = achs.length ? Math.round((earned.length / achs.length) * 100) : 0

  return (
    <div className="page-in space-y-6">
      <PageHeader
        title="Progress"
        sub="Measure it, see it, own it"
        action={<Segmented value={tab} onChange={setTab} options={[{ value: 'measurements', label: 'Measurements' }, { value: 'photos', label: 'Photos' }, { value: 'achievements', label: 'Achievements' }]} />}
      />

      {/* ================= MEASUREMENTS ================= */}
      {tab === 'measurements' && (
        <div className="space-y-6">
          {measLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={<Scale size={16} />} label="Latest weight" value={latest?.weight_kg != null ? `${fmt.n(latest.weight_kg, 1)} kg` : '—'} sub={latest ? fmt.date(latest.entry_date) : 'No entries'} />
              <StatCard icon={<Flame size={16} />} label="Body fat" value={latest?.body_fat != null ? `${fmt.n(latest.body_fat, 1)}%` : '—'} sub="latest reading" />
              <StatCard icon={<ChevronRight size={16} />} label="Weight change" value={wDelta == null ? '—' : `${wDelta > 0 ? '+' : ''}${wDelta} kg`} sub="since your first entry" />
              <StatCard icon={<Layers size={16} />} label="Entries" value={fmt.n(meas.length)} sub="measurements logged" />
            </div>
          )}

          {measErr ? (
            <EmptyState icon={<Scale size={20} />} title="Couldn’t load measurements" body={measErr} action={<Button onClick={loadMeas}>Retry</Button>} />
          ) : measLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-48" />
            </div>
          ) : (
            <>
              <Card className="p-5">
                <SectionTitle
                  title="Weight history"
                  sub={`${weightSeries.length} entries`}
                  action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add measurement</Button>}
                />
                <div className="h-64">
                  {weightSeries.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightSeries} margin={{ top: 10, right: 10, bottom: 0, left: -22 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                        <XAxis dataKey="date" tick={tip} axisLine={false} tickLine={false} minTickGap={24} />
                        <YAxis tick={tip} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                        <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v: any) => [`${fmt.n(Number(v), 1)} kg`, 'Weight']} />
                        <Line type="monotone" dataKey="weight_kg" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent)' }} name="Weight" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState icon={<Scale size={18} />} title={weightSeries.length ? 'Add another entry to see the trend' : 'No measurements yet'} body="Track your weight to watch the trend line grow." action={<Button onClick={() => setAddOpen(true)}><Plus size={14} /> Add measurement</Button>} />
                  )}
                </div>
              </Card>

              {/* Compare */}
              <Card className="p-5">
                <SectionTitle title="Compare" sub="Pick two dates and see what changed" />
                {meas.length >= 2 ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Baseline">
                        <Select value={cmpA} onChange={(e) => setCmpA(e.target.value)}>
                          {sortedDates.map((d) => <option key={d} value={d}>{cmpName(d)}</option>)}
                        </Select>
                      </Field>
                      <Field label="Latest">
                        <Select value={cmpB} onChange={(e) => setCmpB(e.target.value)}>
                          {sortedDates.map((d) => <option key={d} value={d}>{cmpName(d)}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {cmpRows.map((r) => (
                        <div key={r.key} className={cn('rounded-2xl border px-4 py-3', r.key === 'weight_kg' ? 'border-lime/40 bg-lime/[0.07]' : 'border-line bg-night2/40')}>
                          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{r.label}</div>
                          <div className={cn('mt-0.5 font-display text-lg font-bold', r.key === 'weight_kg' ? 'text-lime' : 'text-ink')}>
                            {r.delta == null ? '—' : `${r.delta > 0 ? '+' : ''}${fmt.n(r.delta, 1)} ${r.unit}`}
                          </div>
                          <div className="text-[11px] text-muted">
                            {r.delta == null ? 'Missing on one side' : `${r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : '='} vs ${cmpName(cmpB)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={<GitCompareArrows size={18} />} title="Need at least two entries" body="Add a second measurement to compare against your baseline." />
                )}
              </Card>

              {/* History table */}
              <Card className="overflow-hidden">
                <div className="p-5 pb-0"><SectionTitle title="History" sub="All logged measurements" /></div>
                {meas.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                          <th className="px-5 py-2.5 font-medium">Date</th>
                          <th className="px-3 py-2.5 font-medium">Weight</th>
                          <th className="px-3 py-2.5 font-medium">Body fat</th>
                          <th className="px-3 py-2.5 font-medium">Chest</th>
                          <th className="px-3 py-2.5 font-medium">Waist</th>
                          <th className="px-3 py-2.5 font-medium">Arm</th>
                          <th className="px-5 py-2.5 text-right font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {meas.map((m) => (
                          <tr key={m.id} className="border-b border-line/60 last:border-0 hover:bg-card2/60">
                            <td className="px-5 py-3 font-medium text-ink">{fmt.date(m.entry_date)}</td>
                            <td className="px-3 py-3 text-ink">{m.weight_kg != null ? `${fmt.n(m.weight_kg, 1)} kg` : '—'}</td>
                            <td className="px-3 py-3 text-muted">{m.body_fat != null ? `${fmt.n(m.body_fat, 1)}%` : '—'}</td>
                            <td className="px-3 py-3 text-muted">{m.chest != null ? `${fmt.n(m.chest, 1)} cm` : '—'}</td>
                            <td className="px-3 py-3 text-muted">{m.waist != null ? `${fmt.n(m.waist, 1)} cm` : '—'}</td>
                            <td className="px-3 py-3 text-muted">{m.arm != null ? `${fmt.n(m.arm, 1)} cm` : '—'}</td>
                            <td className="px-5 py-3 text-right">
                              <Button variant="ghost" size="icon" title="Delete" onClick={() => setDelTarget(m)}><Trash2 size={15} className="text-danger" /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-5 pt-2">
                    <EmptyState icon={<Scale size={18} />} title="Nothing logged yet" body="Your measurement history will appear here." />
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ================= PHOTOS ================= */}
      {tab === 'photos' && (
        <div className="space-y-6">
          {photosLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}</div>
          ) : photos.length ? (
            <>
              <Card className="flex flex-wrap items-end gap-3 p-5">
                <div className="min-w-[220px] flex-1">
                  <Field label="Label (optional)" hint="e.g. “Week 8 — cutting”">
                    <Input value={photoLabel} onChange={(e) => setPhotoLabel(e.target.value)} placeholder="Progress photo label" maxLength={80} />
                  </Field>
                </div>
                <Button loading={uploading} onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload photo</Button>
              </Card>

              {photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {photos.map((p) => (
                    <Card key={p.id} className="group overflow-hidden p-0">
                      <button onClick={() => setLightbox(p)} className="relative block w-full">
                        <img src={`/uploads/${p.file}`} alt={p.label || 'Progress photo'} loading="lazy"
                          className="h-44 w-full object-cover transition group-hover:brightness-110" />
                        <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                          {p.created_at ? fmt.date(p.created_at) : '—'}
                        </span>
                      </button>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-ink">{p.label || 'Progress photo'}</div>
                          <div className="text-[11px] text-muted">{p.created_at ? fmt.rel(p.created_at) : ''}</div>
                        </div>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => setDelPhoto(p)}><Trash2 size={14} className="text-danger" /></Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<Camera size={22} />}
              title="No progress photos yet"
              body="Snap a photo every few weeks — the mirror lies, the timeline doesn’t."
              action={<Button onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload first photo</Button>}
            />
          )}
          {/* hidden input stays mounted for the empty-state CTA */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
        </div>
      )}

      {/* ================= ACHIEVEMENTS ================= */}
      {tab === 'achievements' && (
        <div className="space-y-6">
          <Card className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/12 text-lime"><Trophy size={22} /></div>
            <div className="flex-1">
              <div className="font-display text-[15px] font-bold text-ink">{earned.length} / {achs.length} unlocked</div>
              <div className="mt-1.5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${unlockedPct}%` }} />
              </div>
            </div>
            <span className="font-display text-2xl font-extrabold text-lime">{unlockedPct}%</span>
          </Card>

          {achLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-36" />)}</div>
          ) : achs.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {achs.map((a) => {
                const isEarned = !!a.earnedAt
                const { cur, target } = statFor(a.goal, achStats)
                const pct = Math.min(100, Math.round((cur / Math.max(target, cur)) * 100))
                return (
                  <Card key={a.id} className={cn('p-5', isEarned ? 'border-lime/40 bg-lime/[0.05]' : 'opacity-90')}>
                    <div className="flex items-start gap-3.5">
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl', isEarned ? 'bg-lime/15' : 'bg-card2 grayscale')}>
                        {isEarned ? a.icon : <Lock size={16} className="text-muted" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className={cn('font-display text-[14px] font-bold', isEarned ? 'text-ink' : 'text-muted')}>{a.name}</h3>
                          {isEarned
                            ? <Badge color="lime">Earned {a.earnedAt ? fmt.date(a.earnedAt) : ''}</Badge>
                            : <Badge><Lock size={10} /> Locked</Badge>}
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">{a.description}</p>
                        <div className="mt-3">
                          <div className="h-1.5 overflow-hidden rounded-full bg-line">
                            <div className={cn('h-full rounded-full', isEarned ? 'bg-lime' : 'bg-muted/60')} style={{ width: `${isEarned ? 100 : pct}%` }} />
                          </div>
                          <div className="mt-1 text-[11px] text-muted">
                            {isEarned ? 'Unlocked 🎉' : `${fmt.n(cur)} / ${fmt.n(target)} · ${pct}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={<Medal size={20} />} title="No achievements defined" body="Keep training — badges will appear here." />
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add measurement">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={form.entry_date} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            </Field>
            <Field label="Weight (kg)" hint="required">
              <Input type="number" step="0.1" min="0" placeholder="82.5" value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.slice(1).map((f) => (
              <Field key={f.key} label={`${f.label} (${f.unit})`} hint="optional">
                <Input type="number" step="0.1" min="0" placeholder="—" value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={addMeas}>Save measurement</Button>
          </div>
        </div>
      </Modal>

      <Confirm
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => delTarget && removeMeas(delTarget.id)}
        title="Delete measurement?"
        body={delTarget ? `This removes the entry from ${fmt.date(delTarget.entry_date)}. This can’t be undone.` : ''}
        danger
      />
      <Confirm
        open={!!delPhoto}
        onClose={() => setDelPhoto(null)}
        onConfirm={() => delPhoto && removePhoto(delPhoto.id)}
        title="Delete photo?"
        body="This removes the progress photo permanently."
        danger
      />

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title={lightbox?.label || 'Progress photo'} wide>
        {lightbox && (
          <div className="space-y-3">
            <img src={`/uploads/${lightbox.file}`} alt={lightbox.label || 'Progress photo'} className="max-h-[60vh] w-full rounded-2xl object-contain bg-night2" />
            <div className="flex items-center justify-between text-sm text-muted">
              <span>{lightbox.created_at ? fmt.dateLong(lightbox.created_at) : ''}</span>
              <Button variant="ghost" size="sm" onClick={() => { setLightbox(null); setDelPhoto(lightbox) }}>
                <Trash2 size={13} className="text-danger" /> Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
