import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Dumbbell, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { api, muscleColor } from '@/lib/api'
import { Badge, Button, Card, EmptyState, Input, SectionTitle, Select, Skeleton, cn } from '@/components/ui'

interface Exercise {
  id: number; name: string; muscle_group: string; secondary_muscles: string | null
  equipment: string; difficulty: string
}
interface ExMeta {
  muscleGroups: string[]; equipment: string[]; difficulties: string[]; browseGroups: string[]
}

const diffColor = (d: string): 'ok' | 'warn' | 'danger' | 'line' => {
  const s = (d || '').toLowerCase()
  if (s.startsWith('adv')) return 'danger'
  if (s.startsWith('int') || s.startsWith('mid')) return 'warn'
  return 'ok'
}

export default function Exercises() {
  const navigate = useNavigate()
  const [meta, setMeta] = useState<ExMeta | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [count, setCount] = useState(0)
  const [loadingList, setLoadingList] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const [equipment, setEquipment] = useState('')
  const [difficulty, setDifficulty] = useState('')

  // debounce the search input
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300)
    return () => clearTimeout(t)
  }, [qInput])

  // fetch meta once
  useEffect(() => {
    let alive = true
    api.get<ExMeta>('/api/exercises/meta')
      .then((d) => { if (alive) setMeta(d) })
      .catch(() => { /* fall back to All group only */ })
    return () => { alive = false }
  }, [])

  // fetch the exercise list (refetches on any filter change)
  useEffect(() => {
    let alive = true
    setLoadingList(true)
    const qs = new URLSearchParams()
    if (q) qs.set('q', q)
    if (group && group !== 'All') qs.set('group', group)
    if (equipment) qs.set('equipment', equipment)
    if (difficulty) qs.set('difficulty', difficulty)
    api.get<{ count: number; exercises: Exercise[] }>(`/api/exercises?${qs.toString()}`)
      .then((d) => {
        if (!alive) return
        setExercises(d.exercises || [])
        setCount(d.count ?? (d.exercises || []).length)
        setErr(null)
      })
      .catch((e: Error) => { if (alive) setErr(e.message) })
      .finally(() => { if (alive) setLoadingList(false) })
    return () => { alive = false }
  }, [q, group, equipment, difficulty])

  const groups = useMemo(() => (meta?.browseGroups?.length ? meta.browseGroups : ['All'] as const), [meta])
  const hasFilters = q || group !== 'All' || equipment || difficulty

  const resetFilters = () => { setQInput(''); setQ(''); setGroup('All'); setEquipment(''); setDifficulty('') }

  return (
    <div className="page-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Exercise Library</h1>
        <p className="mt-1 text-sm text-muted">{count} exercises · proper form and technique for every movement</p>
      </div>

      {/* Search + filters */}
      <Card className="p-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search exercises…"
            className="pl-10"
            aria-label="Search exercises"
          />
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[12px] font-medium transition-all',
                  group === g ? 'border-lime/40 bg-lime/15 text-lime' : 'border-line bg-card2 text-muted hover:border-muted/40 hover:text-ink',
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="shrink-0 text-muted" />
            <Select value={equipment} onChange={(e) => setEquipment(e.target.value)} className="h-9 py-0 text-[13px]" aria-label="Filter by equipment">
              <option value="">Any equipment</option>
              {(meta?.equipment ?? []).map((eq) => <option key={eq} value={eq}>{eq}</option>)}
            </Select>
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="h-9 py-0 text-[13px]" aria-label="Filter by difficulty">
              <option value="">Any difficulty</option>
              {(meta?.difficulties ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      {/* Grid */}
      {err ? (
        <EmptyState icon={<Dumbbell size={20} />} title="Couldn't load exercises" body={err}
          action={<Button onClick={() => setErr(null)} variant="outline">Retry</Button>} />
      ) : loadingList ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-[104px]" />)}
        </div>
      ) : exercises.length === 0 ? (
        <EmptyState
          icon={<Search size={20} />}
          title="No exercises found"
          body={hasFilters ? 'No exercises match your current filters. Try widening your search.' : 'The library is empty for now.'}
          action={hasFilters ? <Button variant="outline" size="sm" onClick={resetFilters}><RotateCcw size={13} /> Reset filters</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          <SectionTitle title="All exercises" sub={`${count} exercise${count === 1 ? '' : 's'}`} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exercises.map((ex) => {
              const mc = muscleColor(ex.muscle_group)
              return (
                <button key={ex.id} onClick={() => navigate(`/exercises/${ex.id}`)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60 rounded-3xl">
                  <Card className="group h-full p-4 transition-all duration-150 hover:border-lime/40 hover:bg-card2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-ink">{ex.name}</h3>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-card2 text-muted transition group-hover:bg-lime/15 group-hover:text-lime">
                        <ChevronRight size={15} />
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium"
                        style={{ color: mc, borderColor: `${mc}45`, backgroundColor: `${mc}18` }}>
                        {ex.muscle_group}
                      </span>
                      <Badge>{ex.equipment}</Badge>
                      <Badge color={diffColor(ex.difficulty)}>{ex.difficulty}</Badge>
                    </div>
                  </Card>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
