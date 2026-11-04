import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User as UserIcon, Ruler, Dumbbell, Check, ArrowLeft, ArrowRight, Flame, Zap, Wind, HeartPulse, Activity,
  Building2, Home, Sparkles, PartyPopper,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Button, Card, Field, Input, Select, Segmented, Badge, Skeleton, useToast, cn } from '@/components/ui'

type Gender = '' | 'male' | 'female' | 'prefer_not_say'

const EQUIPMENT = ['Barbells', 'Dumbbells', 'Machines', 'Cables', 'Resistance Bands', 'Bodyweight', 'Kettlebells']

const GOALS = [
  { value: 'muscle_building', label: 'Build Muscle', icon: Dumbbell, text: 'Hypertrophy focus, surplus nutrition' },
  { value: 'fat_loss', label: 'Fat Loss', icon: Flame, text: 'Calorie deficit, conditioning work' },
  { value: 'strength', label: 'Strength', icon: Zap, text: 'Heavy compounds, lower reps' },
  { value: 'endurance', label: 'Endurance', icon: Wind, text: 'Capacity work, sustainable pace' },
  { value: 'general_fitness', label: 'General Fitness', icon: HeartPulse, text: 'Balanced health & habit building' },
] as const

const STEPS = [
  { title: 'About you', icon: UserIcon },
  { title: 'Body metrics', icon: Ruler },
  { title: 'Training', icon: Dumbbell },
  { title: 'Review', icon: Check },
] as const

type Draft = {
  name: string
  age: string
  gender: Gender
  height_cm: string
  weight_kg: string
  target_weight: string
  experience: 'beginner' | 'intermediate' | 'advanced'
  goal: string
  location: 'gym' | 'home'
  equipment: string[]
  days_per_week: number
  duration_pref: number
}

const num = (v: string) => (v.trim() === '' ? null : Number(v))
const nErr = (v: string, label: string, min: number, max: number, required = true) => {
  if (num(v) === null) return required ? `${label} is required.` : ''
  const n = Number(v)
  if (isNaN(n)) return `${label} must be a number.`
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`
  return ''
}

const GOAL_LABEL: Record<string, string> = Object.fromEntries(GOALS.map((g) => [g.value, g.label]))

export default function Onboarding() {
  const { user, profile, refresh } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [ready, setReady] = useState(false)

  const [d, setD] = useState<Draft>({
    name: '', age: '', gender: '', height_cm: '', weight_kg: '', target_weight: '',
    experience: 'beginner', goal: '', location: 'gym', equipment: ['Barbells', 'Dumbbells'],
    days_per_week: 3, duration_pref: 60,
  })

  // Prefill: from profile if already onboarded, else fall back to account name
  useEffect(() => {
    setD((prev) => {
      const base = { ...prev }
      if (user?.name) base.name = user.name
      if (profile) {
        base.age = profile.age != null ? String(profile.age) : base.age
        base.gender = (profile.gender as Gender) || ''
        base.height_cm = profile.height_cm != null ? String(profile.height_cm) : ''
        base.weight_kg = profile.weight_kg != null ? String(profile.weight_kg) : ''
        base.target_weight = profile.target_weight != null ? String(profile.target_weight) : ''
        base.experience = (profile.experience as Draft['experience']) || 'beginner'
        base.goal = profile.goal || ''
        base.location = (profile.location === 'home' ? 'home' : 'gym') as 'gym' | 'home'
        if (Array.isArray(profile.equipment) && profile.equipment.length) base.equipment = profile.equipment.filter((e) => EQUIPMENT.includes(e))
        if (profile.days_per_week) base.days_per_week = profile.days_per_week
        if (profile.duration_pref) base.duration_pref = profile.duration_pref
      }
      return base
    })
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  const errors = useMemo(() => ({
    name: d.name.trim().length < 2 ? 'Enter your full name.' : '',
    age: nErr(d.age, 'Age', 13, 90),
    height: nErr(d.height_cm, 'Height', 120, 230),
    weight: nErr(d.weight_kg, 'Weight', 30, 250),
    target: nErr(d.target_weight, 'Target weight', 30, 250, false),
    goal: !d.goal ? 'Pick a primary goal.' : '',
  }), [d])

  const stepErr = (s: number): string | null => {
    if (s === 0) return errors.name || errors.age || null
    if (s === 1) return errors.height || errors.weight || errors.target || null
    if (s === 2) return errors.goal || null
    return null
  }

  const next = () => {
    setTouched(true)
    const e = stepErr(step)
    if (e) { toast(e, 'err'); return }
    setTouched(false); setFormErr('')
    setStep((s) => Math.min(3, s + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const back = () => { setTouched(false); setFormErr(''); setStep((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const finish = async () => {
    setBusy(true); setFormErr('')
    try {
      // Keep the account name in sync if it was edited on step 1
      if (user && d.name.trim() && d.name.trim() !== user.name) {
        await api.put('/profile', { name: d.name.trim() })
      }
      await api.post('/onboarding', {
        age: Number(d.age), gender: d.gender || null, height_cm: Number(d.height_cm),
        weight_kg: Number(d.weight_kg), target_weight: num(d.target_weight),
        experience: d.experience, goal: d.goal, location: d.location, equipment: d.equipment,
        days_per_week: d.days_per_week, duration_pref: d.duration_pref,
      })
      await refresh()
      toast('Profile complete — your starter plan is ready!', 'ok')
      navigate('/dashboard', { replace: true })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
      setFormErr(msg); toast(msg, 'err')
    } finally { setBusy(false) }
  }

  if (!ready) {
    return (
      <div className="page-in space-y-6">
        <Skeleton className="h-16 w-full max-w-xl mx-auto" />
        <Skeleton className="mx-auto h-[420px] w-full max-w-2xl" />
      </div>
    )
  }

  const errIf = (v: string) => (touched ? v : undefined)

  return (
    <div className="page-in mx-auto max-w-2xl space-y-6 py-2">
      {/* Stepper header */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex flex-1 flex-col items-center gap-2 text-center">
              <div className="relative flex items-center w-full justify-center">
                {i > 0 && <div className={cn('absolute right-1/2 h-0.5 w-1/2 rounded', i <= step ? 'bg-lime/50' : 'bg-line')} />}
                {i < STEPS.length - 1 && <div className={cn('absolute left-1/2 h-0.5 w-1/2 rounded', i < step ? 'bg-lime/50' : 'bg-line')} />}
                <span className={cn('relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl border transition-all',
                  i < step ? 'border-lime/40 bg-lime/15 text-lime' : i === step ? 'border-lime bg-lime text-lime-ink accent-glow' : 'border-line bg-card2 text-muted')}>
                  {i < step ? <Check size={17} /> : <s.icon size={17} />}
                </span>
              </div>
              <span className={cn('text-[11.5px] font-medium', i === step ? 'text-ink' : 'text-muted')}>{s.title}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-card2">
          <div className="h-full rounded-full bg-lime transition-all duration-500" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>
      </Card>

      <Card className="p-6 sm:p-8" key={step}>
        {/* Step 1 — About you */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime/12 text-lime"><UserIcon size={20} /></span>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight text-ink">About you</h1>
                <p className="mt-0.5 text-[13px] text-muted">Tell us who we’re building a plan for.</p>
              </div>
            </div>
            <Field label="Full name" error={errIf(errors.name)}>
              <Input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Alex Carter" autoComplete="name" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Age" hint="13–90" error={errIf(errors.age)}>
                <Input type="number" step={1} min={13} max={90} value={d.age} onChange={(e) => set('age', e.target.value)} placeholder="27" />
              </Field>
              <Field label="Gender" hint="optional">
                <Select value={d.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
              </Field>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">Your age helps calibrate calorie targets and heart-rate zones. Gender only tunes estimates — skip it any time.</p>
          </div>
        )}

        {/* Step 2 — Body metrics */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime/12 text-lime"><Ruler size={20} /></span>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight text-ink">Body metrics</h1>
                <p className="mt-0.5 text-[13px] text-muted">Baselines for calorie targets and progress tracking.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Height (cm)" hint="120–230" error={errIf(errors.height)}>
                <Input type="number" step={1} min={120} max={230} value={d.height_cm} onChange={(e) => set('height_cm', e.target.value)} placeholder="178" />
              </Field>
              <Field label="Weight (kg)" hint="30–250" error={errIf(errors.weight)}>
                <Input type="number" step={0.1} min={30} max={250} value={d.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} placeholder="75" />
              </Field>
              <Field label="Target weight (kg)" hint="optional" error={errIf(errors.target)}>
                <Input type="number" step={0.1} min={30} max={250} value={d.target_weight} onChange={(e) => set('target_weight', e.target.value)} placeholder="72" />
              </Field>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">We log today’s weight as your starting point so your progress chart begins here.</p>
          </div>
        )}

        {/* Step 3 — Training profile */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime/12 text-lime"><Dumbbell size={20} /></span>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight text-ink">Training profile</h1>
                <p className="mt-0.5 text-[13px] text-muted">This shapes your split, exercises and calorie target.</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">Experience level</p>
              <Segmented value={d.experience} onChange={(v) => set('experience', v)} options={[
                { value: 'beginner', label: 'Beginner' },
                { value: 'intermediate', label: 'Intermediate' },
                { value: 'advanced', label: 'Advanced' },
              ]} />
            </div>

            <div>
              <p className={cn('mb-2 flex items-center justify-between text-xs font-medium text-muted')}>
                Primary goal{touched && errors.goal && <span className="text-[11px] text-danger">{errors.goal}</span>}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {GOALS.map((g) => (
                  <button key={g.value} type="button" onClick={() => set('goal', g.value)}
                    className={cn('rounded-2xl border p-3.5 text-left transition-all',
                      d.goal === g.value ? 'border-lime bg-lime/10 accent-glow' : 'border-line bg-card2/60 hover:border-muted/50')}>
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', d.goal === g.value ? 'bg-lime text-lime-ink' : 'bg-card text-muted')}>
                      <g.icon size={17} />
                    </span>
                    <div className="mt-2.5 text-[13px] font-semibold text-ink">{g.label}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted">{g.text}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">Where do you train?</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'gym', label: 'Full gym', icon: Building2, text: 'Free weights, machines & cables' },
                  { value: 'home', label: 'At home', icon: Home, text: 'Minimal or home equipment' },
                ] as const).map((l) => (
                  <button key={l.value} type="button" onClick={() => set('location', l.value)}
                    className={cn('flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all',
                      d.location === l.value ? 'border-lime bg-lime/10' : 'border-line bg-card2/60 hover:border-muted/50')}>
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', d.location === l.value ? 'bg-lime text-lime-ink' : 'bg-card text-muted')}>
                      <l.icon size={18} />
                    </span>
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{l.label}</div>
                      <div className="text-[11px] text-muted">{l.text}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">Available equipment</p>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map((e) => {
                  const on = d.equipment.includes(e)
                  return (
                    <button key={e} type="button"
                      onClick={() => set('equipment', on ? d.equipment.filter((x) => x !== e) : [...d.equipment, e])}
                      className={cn('rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all',
                        on ? 'border-lime bg-lime/15 text-lime' : 'border-line bg-card2/60 text-muted hover:border-muted/50 hover:text-ink')}>
                      {e}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Days per week</p>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button key={n} type="button" onClick={() => set('days_per_week', n)}
                      className={cn('h-9 w-9 rounded-xl border text-[13px] font-semibold transition-all',
                        d.days_per_week === n ? 'border-lime bg-lime text-lime-ink' : 'border-line bg-card2/60 text-muted hover:border-muted/50 hover:text-ink')}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Session length</p>
                <Segmented value={d.duration_pref} onChange={(v) => set('duration_pref', v)} options={[
                  { value: 30, label: '30m' }, { value: 45, label: '45m' }, { value: 60, label: '60m' }, { value: 90, label: '90m' },
                ]} />
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime/12 text-lime"><Sparkles size={20} /></span>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight text-ink">Review & build your plan</h1>
                <p className="mt-0.5 text-[13px] text-muted">One last look — then we generate your starter routine.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge color="lime">{d.name.trim()}</Badge>
              <Badge>Age {d.age}</Badge>
              {d.gender && d.gender !== 'prefer_not_say' && <Badge>{d.gender.replace('_', ' ')}</Badge>}
              <Badge>{d.height_cm} cm</Badge>
              <Badge>{d.weight_kg} kg</Badge>
              {d.target_weight && d.target_weight !== d.weight_kg && <Badge color="warn">→ {d.target_weight} kg</Badge>}
              <Badge>{d.experience}</Badge>
              <Badge color="lime">{GOAL_LABEL[d.goal] || d.goal}</Badge>
              <Badge>{d.location === 'home' ? 'Home' : 'Full gym'}</Badge>
              <Badge>{d.days_per_week}× / week</Badge>
              <Badge>{d.duration_pref} min sessions</Badge>
              {d.equipment.map((e) => <Badge key={e}>{e}</Badge>)}
            </div>
            <div className="rounded-2xl border border-lime/30 bg-gradient-to-br from-lime/[0.09] to-transparent p-4">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-lime"><PartyPopper size={14} /> What happens next</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                We create an active {d.days_per_week}-day {d.location === 'home' ? 'home' : 'gym'} plan matched to your experience, set your goal-based calorie target, and unlock your personalized dashboard.
              </p>
            </div>
            {formErr && (
              <div className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">{formErr}</div>
            )}
          </div>
        )}

        {/* Nav */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={back} disabled={step === 0 || busy} className={step === 0 ? 'invisible' : ''}>
            <ArrowLeft size={16} /> Back
          </Button>
          {step < 3 ? (
            <Button onClick={next} size="lg" className="min-w-[130px]">Continue <ArrowRight size={16} /></Button>
          ) : (
            <Button onClick={finish} loading={busy} size="lg" className="min-w-[180px]">
              {!busy ? <Activity size={16} /> : null} {busy ? 'Building your plan…' : 'Create my plan'}
            </Button>
          )}
        </div>
      </Card>

      <p className="text-center text-[12px] text-muted">You can change every detail later from your profile page.</p>
    </div>
  )
}
