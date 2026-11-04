import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import {
  UtensilsCrossed, Trash2, Plus, Search, ChefHat, Sunrise, Sun, Moon, Cookie, Droplets,
  Minus, CalendarDays, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { api, fmt, getToken, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  Button, Card, SectionTitle, Input, Select, Field, Modal, Confirm, Badge, Skeleton, EmptyState,
  ProgressRing, useToast, cn,
} from '@/components/ui'

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type Meal = (typeof MEALS)[number]
const MEAL_ICON: Record<Meal, typeof Sunrise> = { breakfast: Sunrise, lunch: Sun, dinner: Moon, snack: Cookie }
const MEAL_TITLE: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' }

interface Food { id: number | string; name: string; serving: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }
interface Entry extends Food { servings: number }
type Meals = Record<Meal, Entry[]>
interface DayData { date: string; meals: Meals; totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number }; target: number; water: number }

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const kcalOf = (e: { calories: number; servings: number }) => Math.round(e.calories * e.servings)

function MacroBar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const color = pct >= 100 ? 'var(--ok)' : pct >= 60 ? 'var(--accent)' : 'var(--warn)'
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="font-medium text-muted">{label}</span>
        <span className="text-ink"><span className="font-semibold">{fmt.n(value)}</span><span className="text-muted"> / {fmt.n(target)}{unit}</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-card2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function Nutrition() {
  const { profile } = useAuth()
  const toast = useToast()
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState<DayData | null>(null)
  const [history, setHistory] = useState<{ date: string; calories: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [waterBusy, setWaterBusy] = useState(false)
  const [delEntry, setDelEntry] = useState<Entry | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addMeal, setAddMeal] = useState<Meal>('breakfast')
  const openAdd = (m: Meal) => { setAddMeal(m); setAddOpen(true) }

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const q = date ? `?date=${date}` : ''
      const [day, hist] = await Promise.all([
        api.get<DayData>(`/nutrition/day${q}`),
        api.get<{ days: { date: string; calories: number }[] }>('/nutrition/history?days=14'),
      ])
      setData(day)
      setHistory(hist.days || [])
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load nutrition data.')
    } finally { setLoading(false) }
  }, [date])

  useEffect(() => { void fetchAll() }, [fetchAll])

  // Macro targets: protein 1.8 g/kg, carbs 45% of kcal, fat 28% of kcal, fiber 30 g
  const targets = useMemo(() => {
    const target = data?.target || profile?.calorie_target || 2500
    const bw = profile?.weight_kg || 75
    return { protein: bw * 1.8, carbs: (target * 0.45) / 4, fat: (target * 0.28) / 9, fiber: 30 }
  }, [data?.target, profile])

  const target = data?.target || profile?.calorie_target || 2500
  const totals = data?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const eaten = Math.round(totals.calories)
  const remaining = target - eaten
  const waterMl = data?.water || 0

  const changeWater = async (delta: number) => {
    setWaterBusy(true)
    try {
      const res = await fetch('/api/nutrition/water', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ delta, ...(date ? { date } : {}) }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new ApiError(json?.error || 'Could not update water.', res.status)
      if (data) setData({ ...data, water: json?.ml ?? Math.max(0, data.water + delta) })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not update water.'
      toast(msg, 'err')
    } finally { setWaterBusy(false) }
  }

  const removeEntry = async () => {
    if (!delEntry) return
    try {
      await api.del(`/nutrition/entries/${delEntry.id}`)
      toast(`Removed “${delEntry.name}”.`, 'ok')
      void fetchAll(true)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not delete entry.', 'err')
    } finally { setDelEntry(null) }
  }

  if (loading) {
    return (
      <div className="page-in space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[220px]" />
        </div>
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-in">
        <EmptyState icon={<AlertTriangle size={22} className="text-danger" />} title="Couldn’t load nutrition" body={error}
          action={<Button onClick={() => void fetchAll()}><RefreshCw size={15} /> Retry</Button>} />
      </div>
    )
  }

  return (
    <div className="page-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Nutrition</h1>
          <p className="mt-0.5 text-[13px] text-muted">Log meals, hit your macros, stay hydrated.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)}
              className={cn('w-[165px] pl-9 pr-2.5 py-2 text-[13px]', date === todayStr() && 'border-lime/40')} />
          </div>
          <Button variant="outline" size="icon" title="Refresh" onClick={() => void fetchAll()}><RefreshCw size={15} /></Button>
        </div>
      </div>

      {/* Calories + macro targets */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex items-center gap-6 p-6">
          <ProgressRing pct={target > 0 ? (eaten / target) * 100 : 0} size={130} stroke={11}
            color={remaining < 0 ? 'var(--danger)' : eaten / target >= 0.8 ? 'var(--accent)' : 'var(--ok)'}>
            <div>
              <div className="font-display text-[22px] font-bold leading-none text-ink">{fmt.n(eaten)}</div>
              <div className="text-[11px] text-muted">of {fmt.n(target)} kcal</div>
            </div>
          </ProgressRing>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              {remaining < 0 ? <Badge color="danger">{fmt.n(-remaining)} kcal over target</Badge>
                : <Badge color="lime">{fmt.n(remaining)} kcal remaining</Badge>}
            </div>
            <div className="space-y-2 text-[12.5px]">
              <div className="flex justify-between"><span className="text-muted">Protein</span><span className="font-semibold text-ink">{fmt.n(totals.protein)} g</span></div>
              <div className="flex justify-between"><span className="text-muted">Carbs</span><span className="font-semibold text-ink">{fmt.n(totals.carbs)} g</span></div>
              <div className="flex justify-between"><span className="text-muted">Fat</span><span className="font-semibold text-ink">{fmt.n(totals.fat)} g</span></div>
              <div className="flex justify-between"><span className="text-muted">Fiber</span><span className="font-semibold text-ink">{fmt.n(totals.fiber)} g</span></div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle title="Macro breakdown" sub="Targets: protein 1.8 g/kg · carbs 45% · fat 28% · fiber 30 g" />
          <div className="space-y-3.5">
            <MacroBar label="Protein" value={totals.protein} target={targets.protein} unit=" g" />
            <MacroBar label="Carbs" value={totals.carbs} target={targets.carbs} unit=" g" />
            <MacroBar label="Fat" value={totals.fat} target={targets.fat} unit=" g" />
            <MacroBar label="Fiber" value={totals.fiber} target={targets.fiber} unit=" g" />
          </div>
        </Card>
      </div>

      {/* Meals */}
      {MEALS.map((meal) => {
        const Icon = MEAL_ICON[meal]
        const entries: Entry[] = data?.meals?.[meal] || []
        const mealKcal = entries.reduce((a, e) => a + kcalOf(e), 0)
        return (
          <Card key={meal} className="p-5 sm:p-6">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-lime" />
                  <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{MEAL_TITLE[meal]}</h2>
                  {entries.length > 0 && <Badge color="lime">{fmt.n(mealKcal)} kcal</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {entries.length ? `${entries.length} item${entries.length > 1 ? 's' : ''}` : 'Nothing logged yet'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openAdd(meal)}><Plus size={14} /> Add food</Button>
            </div>
            {entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-4 text-center text-[12.5px] text-muted">
                No {MEAL_TITLE[meal].toLowerCase()} logged for this day.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {entries.map((e) => (
                  <li key={String(e.id)} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card2 text-muted"><UtensilsCrossed size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-ink">{e.name}</div>
                      <div className="truncate text-[11.5px] text-muted">
                        {fmt.n(e.servings, 1)}× {e.serving || 'serving'} · P {fmt.n(e.protein * e.servings)} · C {fmt.n(e.carbs * e.servings)} · F {fmt.n(e.fat * e.servings)} g
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-lime">{fmt.n(kcalOf(e))} kcal</span>
                    <Button variant="ghost" size="icon" onClick={() => setDelEntry(e)} title="Remove entry" className="hover:text-danger">
                      <Trash2 size={15} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}

      {/* Water */}
      <Card className="flex items-center gap-6 p-6">
        <ProgressRing pct={(waterMl / 2500) * 100} size={108} stroke={9} color="var(--accent)">
          <div>
            <div className="font-display text-[17px] font-bold leading-none text-ink">{(waterMl / 1000).toFixed(2).replace(/\.?0+$/, '')} L</div>
            <div className="text-[10.5px] text-muted">of 2.5 L</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Droplets size={15} className="text-lime" /> Water</div>
          <p className="mt-0.5 text-[12.5px] text-muted">{fmt.n(waterMl)} ml logged · aim for 2500 ml (10 glasses).</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" disabled={waterBusy || waterMl === 0} onClick={() => void changeWater(-250)}><Minus size={14} /> 250 ml</Button>
            <Button size="sm" disabled={waterBusy} onClick={() => void changeWater(250)}><Plus size={14} /> 250 ml</Button>
          </div>
        </div>
      </Card>

      {/* 14-day history */}
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Last 14 days" sub="Daily calories vs. your target" />
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-muted">Log your first meal to see history here.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history.map((h) => ({ ...h, label: h.date.slice(5) }))} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="kcalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} formatter={(v) => [`${fmt.n(Number(v))} kcal`, 'Calories']} />
                <ReferenceLine y={target} stroke="var(--warn)" strokeDasharray="4 4" />
                <Bar dataKey="calories" fill="url(#kcalGrad)" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Confirm
        open={!!delEntry} onClose={() => setDelEntry(null)} onConfirm={() => void removeEntry()} danger
        title="Remove entry?"
        body={`“${delEntry?.name ?? ''}” will be removed from your log for ${fmt.date(date)}.`}
      />

      <AddFoodModal
        open={addOpen} onClose={() => setAddOpen(false)} meal={addMeal} date={date}
        onDone={(msg) => { toast(msg, 'ok'); void fetchAll(true) }}
      />
    </div>
  )
}

/* ---------- Add-food modal (search + custom) ---------- */
function AddFoodModal({ open, onClose, meal: initialMeal, date, onDone }:
  { open: boolean; onClose: () => void; meal: Meal; date: string; onDone: (msg: string) => void }) {
  const toast = useToast()
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [tab, setTab] = useState<'search' | 'custom'>('search')
  const [q, setQ] = useState('')
  const [foods, setFoods] = useState<Food[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [pick, setPick] = useState<Food | null>(null)
  const [servings, setServings] = useState('1')
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // custom-food fields
  const [cName, setCName] = useState('')
  const [cServing, setCServing] = useState('1 serving')
  const [cKcal, setCKcal] = useState('')
  const [cProtein, setCProtein] = useState('')
  const [cCarbs, setCCarbs] = useState('')
  const [cFat, setCFat] = useState('')
  const [cFiber, setCFiber] = useState('')

  useEffect(() => { if (open) { setMeal(initialMeal); setTab('search'); setPick(null); setQ(''); setServings('1') } }, [open, initialMeal])

  const runSearch = useCallback(async (query: string) => {
    setSearching(true)
    try {
      const d = await api.get<{ foods: Food[] }>(`/nutrition/foods?q=${encodeURIComponent(query)}&limit=25`)
      setFoods(d.foods || [])
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Search failed.', 'err')
      setFoods([])
    } finally { setSearching(false) }
  }, [toast])

  useEffect(() => {
    if (!open || tab !== 'search') return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void runSearch(q.trim()), 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, tab])

  const postEntry = async (foodId: number | string, meal: Meal, servings: number) => {
    await api.post('/nutrition/entries', { food_id: Number(foodId), meal, servings: Number(servings) || 1, date: date || undefined })
  }

  const add = async () => {
    if (!pick) return
    const s = Number(servings)
    if (!s || s < 0.1 || s > 20) { toast('Servings must be between 0.1 and 20.', 'err'); return }
    setBusy(true)
    try {
      await postEntry(pick.id, meal, s)
      onDone(`Added ${fmt.n(s, 1)}× ${pick.name} to ${MEAL_TITLE[meal].toLowerCase()}.`)
      onClose()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not add entry.', 'err')
    } finally { setBusy(false) }
  }

  const createCustom = async () => {
    const kcal = Number(cKcal)
    if (cName.trim().length < 2) { toast('Give your food a name (2+ characters).', 'err'); return }
    if (!cKcal || isNaN(kcal) || kcal <= 0) { toast('Enter the calories for one serving.', 'err'); return }
    setBusy(true)
    try {
      const created = await api.post<{ id: number }>('/nutrition/foods', {
        name: cName.trim(), serving: cServing.trim() || '1 serving', calories: kcal,
        protein: Number(cProtein) || 0, carbs: Number(cCarbs) || 0, fat: Number(cFat) || 0, fiber: Number(cFiber) || 0,
      })
      await postEntry(created.id, meal, 1)
      onDone(`Added “${cName.trim()}” (1 serving) to ${MEAL_TITLE[meal].toLowerCase()}.`)
      onClose()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not create the food.', 'err')
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add food" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meal">
            <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
              {MEALS.map((m) => <option key={m} value={m}>{MEAL_TITLE[m]}</option>)}
            </Select>
          </Field>
          <Field label="Source">
            <div className="flex gap-1.5 pt-0.5">
              <Button variant={tab === 'search' ? 'primary' : 'outline'} size="sm" className="flex-1" onClick={() => setTab('search')}>
                <Search size={14} /> Search
              </Button>
              <Button variant={tab === 'custom' ? 'primary' : 'outline'} size="sm" className="flex-1" onClick={() => setTab('custom')}>
                <ChefHat size={14} /> Custom
              </Button>
            </div>
          </Field>
        </div>

        {tab === 'search' && (
          <div className="space-y-3">
            <Input autoFocus placeholder="Search foods — “chicken breast”, “oats”, “banana”…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-line">
              {searching && (
                <div className="space-y-2 p-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-11 rounded-xl" />)}
                </div>
              )}
              {!searching && foods && foods.length === 0 && (
                <p className="px-4 py-8 text-center text-[12.5px] text-muted">No matches — try another term or create a custom food.</p>
              )}
              {!searching && foods && foods.length > 0 && (
                <ul className="divide-y divide-line">
                  {foods.map((f) => (
                    <li key={String(f.id)}>
                      <button onClick={() => { setPick(f); setServings('1') }}
                        className={cn('flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition',
                          pick?.id === f.id ? 'bg-lime/10' : 'hover:bg-card2')}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-ink">{f.name}</div>
                          <div className="truncate text-[11.5px] text-muted">
                            {f.serving || '1 serving'} · P {fmt.n(f.protein)} · C {fmt.n(f.carbs)} · F {fmt.n(f.fat)} g
                          </div>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold text-lime">{fmt.n(f.calories)} kcal</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {pick && (
              <div className="rounded-2xl border border-lime/30 bg-lime/[0.06] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{pick.name}</div>
                    <div className="text-[11.5px] text-muted">{fmt.n(pick.calories)} kcal per {pick.serving || 'serving'}</div>
                  </div>
                  <div className="flex shrink-0 items-end gap-2">
                    <Field label="Servings"><Input type="number" step={0.1} min={0.1} max={20} className="w-20 py-2" value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
                    <Button size="md" loading={busy} onClick={() => void add()}><Plus size={15} /> Add</Button>
                  </div>
                </div>
                <div className="mt-2 text-[11.5px] text-muted">
                  ≈ <span className="font-semibold text-lime">{fmt.n(pick.calories * (Number(servings) || 0))} kcal</span> total
                  {` · P ${fmt.n(pick.protein * (Number(servings) || 0))} C ${fmt.n(pick.carbs * (Number(servings) || 0))} F ${fmt.n(pick.fat * (Number(servings) || 0))} g`}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'custom' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Grandma’s lasagna" /></Field>
              <Field label="Serving description"><Input value={cServing} onChange={(e) => setCServing(e.target.value)} placeholder="1 slice" /></Field>
            </div>
            <Field label="Calories" hint="per serving"><Input type="number" step={1} min={0} value={cKcal} onChange={(e) => setCKcal(e.target.value)} placeholder="450" /></Field>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Protein g"><Input type="number" step={0.1} min={0} value={cProtein} onChange={(e) => setCProtein(e.target.value)} placeholder="30" /></Field>
              <Field label="Carbs g"><Input type="number" step={0.1} min={0} value={cCarbs} onChange={(e) => setCCarbs(e.target.value)} placeholder="40" /></Field>
              <Field label="Fat g"><Input type="number" step={0.1} min={0} value={cFat} onChange={(e) => setCFat(e.target.value)} placeholder="12" /></Field>
              <Field label="Fiber g"><Input type="number" step={0.1} min={0} value={cFiber} onChange={(e) => setCFiber(e.target.value)} placeholder="4" /></Field>
            </div>
            <Button className="w-full" size="lg" loading={busy} onClick={() => void createCustom()}><Plus size={16} /> Create & add to {MEAL_TITLE[meal]}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
