import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Dumbbell, TrendingUp, Zap, Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react'
import { api, setToken, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { LogoMark } from '@/components/layout/AppShell'
import { Button, Card, Input, Field, Badge, useToast } from '@/components/ui'
import React from 'react'

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify'

const EmailError = (v: string) =>
  !v.trim() ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Enter a valid email address.' : ''

const FEATURES = [
  { icon: Dumbbell, title: 'Adaptive training plans', text: 'Personalized splits and starter routines that react to your goals, equipment and schedule.' },
  { icon: TrendingUp, title: 'Deep progress analytics', text: 'Volume, e1RM, PRs, streaks and body metrics — every rep becomes a data point.' },
  { icon: Zap, title: 'AI coach & nutrition tracking', text: 'Macro targets, water logging and an always-available coach in your pocket.' },
]

const BRAND = { bg: 'var(--bg), #0a0b0f' as const }

export function BrandRow({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={compact ? 26 : 30} />
      <span className="font-display text-lg font-extrabold tracking-tight text-ink">FITZONE</span>
    </div>
  )
}

export default function AuthPages({ mode }: { mode: Mode }) {
  return (
    <div className="min-h-screen flex" style={{ background: BRAND.bg }}>
      {/* Left brand panel — hidden on mobile */}
      <div className="relative hidden lg:flex w-[46%] max-w-[640px] shrink-0 flex-col justify-between overflow-hidden border-r border-line bg-surface/60 px-12 py-10">
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-lime/20 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-lime/10 blur-[110px]" />

        <div className="relative z-10"><BrandRow /></div>

        <div className="relative z-10 max-w-[440px]">
          <Badge color="lime" className="mb-5">Premium fitness platform</Badge>
          <h1 className="font-display text-[40px] leading-[1.06] font-extrabold tracking-tight text-ink">
            Train. Track.<br />
            <span className="text-lime">Transform.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Everything you need to build muscle, burn fat and stay consistent — in one beautifully dark place.
          </p>
          <div className="mt-9 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5 rounded-2xl border border-line bg-card/70 p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime/12 text-lime">
                  <f.icon size={18} />
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">{f.title}</div>
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[11px] text-muted/70">© {new Date().getFullYear()} FITZONE. Train hard, recover harder.</p>
      </div>

      {/* Right form panel */}
      <div className="flex min-h-screen flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[410px]">
          <div className="mb-6 flex justify-center lg:hidden"><BrandRow compact /></div>
          {mode === 'login' && <LoginForm />}
          {mode === 'register' && <RegisterForm />}
          {mode === 'forgot' && <ForgotForm />}
          {mode === 'reset' && <ResetForm />}
          {mode === 'verify' && <VerifyPanel />}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Login ---------------- */
function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)

  const emailErr = EmailError(email)
  const passErr = !password ? 'Password is required.' : ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (emailErr || passErr) return
    setBusy(true); setFormErr('')
    try {
      const d = await api.post<{ token: string; mustOnboard: boolean }>('/auth/login', { email: email.trim(), password })
      await login(email.trim(), password)
      toast('Welcome back! Let’s get after it.', 'ok')
      navigate(d.mustOnboard ? '/onboarding' : '/dashboard', { replace: true })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      setFormErr(msg); toast(msg, 'err')
    } finally { setBusy(false) }
  }

  return (
    <>
      <Card className="page-in p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1 text-[13.5px] text-muted">Log in to continue your streak.</p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="Email" error={touched.email ? emailErr : undefined}>
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input type="email" autoComplete="email" className="pl-10" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input type={show ? 'text' : 'password'} autoComplete="current-password" className="pl-10 pr-10" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, password: true }))} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          {formErr && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />{formErr}
            </div>
          )}

          <div className="flex justify-end">
            <Link to="/forgot" className="text-[12.5px] font-medium text-muted hover:text-lime">Forgot password?</Link>
          </div>

          <Button type="submit" loading={busy} className="w-full" size="lg">Log in <ArrowRight size={16} /></Button>
        </form>

        <div className="mt-5 rounded-xl border border-line bg-card2/70 px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Info size={12} /> Demo credentials</div>
          <p className="mt-1 text-[12.5px] text-muted">Try the demo: <span className="font-medium text-ink">demo@fitzone.app / demo1234</span></p>
          <Button variant="subtle" size="sm" className="mt-2"
            onClick={() => { setEmail('demo@fitzone.app'); setPassword('demo1234'); setTouched({ email: false, password: false }); setFormErr('') }}>
            Fill demo credentials
          </Button>
        </div>
      </Card>

      <p className="mt-5 text-center text-[13px] text-muted">
        New to FITZONE? <Link to="/register" className="font-semibold text-lime hover:underline">Create an account</Link>
      </p>
    </>
  )
}

/* ---------------- Register ---------------- */
function RegisterForm() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [verifyToken, setVerifyToken] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)

  const emailErr = EmailError(email)
  const nameErr = name.trim().length < 2 ? 'Enter your name.' : ''
  const passErr = password.length < 8 ? 'Use at least 8 characters.' : ''
  const repErr = repeat && repeat !== password ? 'Passwords don’t match.' : !repeat ? 'Repeat your password.' : ''
  const err = (k: string, v: string) => touched[k] ? v : undefined

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true, repeat: true })
    if (nameErr || emailErr || passErr || repErr) return
    setBusy(true); setFormErr('')
    try {
      const d = await api.post<{ token: string; verifyToken: string }>('/auth/register', { name: name.trim(), email: email.trim(), password })
      setToken(d.token)
      await refresh()
      setVerifyToken(d.verifyToken)
      toast('Account created — welcome to FITZONE!', 'ok')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      setFormErr(msg); toast(msg, 'err')
    } finally { setBusy(false) }
  }

  const verifyNow = async () => {
    if (!verifyToken) return
    setVerifying(true)
    try {
      await api.post('/auth/verify-email', { token: verifyToken })
      await refresh()
      toast('Email verified. You’re all set!', 'ok')
      navigate('/onboarding', { replace: true })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Verification failed.'
      toast(msg, 'err')
    } finally { setVerifying(false) }
  }

  if (verifyToken) {
    return (
      <>
        <Card className="page-in p-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime/12 text-lime"><ShieldCheck size={20} /></span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">You’re in, {name.trim().split(' ')[0]}</h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            Finish setting up to unlock your personalized plan and nutrition targets.
          </p>
          <div className="mt-5 rounded-2xl border border-lime/30 bg-lime/10 p-4">
            <div className="text-[12px] font-semibold text-lime">Email verification (demo):</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              No email provider is configured in this build. Verify instantly below, or from your profile page later.
            </p>
            <Button size="sm" className="mt-3" loading={verifying} onClick={verifyNow}>
              <ShieldCheck size={15} /> Verify now
            </Button>
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/onboarding', { replace: true })}>
            Skip for now <ArrowRight size={15} />
          </Button>
        </Card>
      </>
    )
  }

  return (
    <>
      <Card className="page-in p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Create your account</h1>
        <p className="mt-1 text-[13.5px] text-muted">Start training with a plan built around you.</p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="Full name" error={err('name', nameErr)}>
            <div className="relative">
              <UserIcon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input autoComplete="name" className="pl-10" placeholder="Alex Carter" value={name}
                onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} />
            </div>
          </Field>
          <Field label="Email" error={err('email', emailErr)}>
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input type="email" autoComplete="email" className="pl-10" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} />
            </div>
          </Field>
          <Field label="Password" hint="min 8 characters" error={err('password', passErr)}>
            <div className="relative">
              <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input type={show ? 'text' : 'password'} autoComplete="new-password" className="pl-10 pr-10" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, password: true }))} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>
          <Field label="Repeat password" error={err('repeat', repErr)}>
            <Input type="password" autoComplete="new-password" placeholder="••••••••" value={repeat}
              onChange={(e) => setRepeat(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, repeat: true }))} />
          </Field>

          {formErr && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />{formErr}
            </div>
          )}

          <Button type="submit" loading={busy} className="w-full" size="lg">Create account <ArrowRight size={16} /></Button>
        </form>
      </Card>

      <p className="mt-5 text-center text-[13px] text-muted">
        Already training with us? <Link to="/login" className="font-semibold text-lime hover:underline">Log in</Link>
      </p>
    </>
  )
}

/* ---------------- Forgot ---------------- */
function ForgotForm() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const emailErr = EmailError(email)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (emailErr) return
    setBusy(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      toast('If that email exists, a reset link has been sent.', 'ok')
      setSent(true)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      toast(msg, 'err')
    } finally { setBusy(false) }
  }

  return (
    <>
      <Card className="page-in p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Reset your password</h1>
        <p className="mt-1 text-[13.5px] text-muted">Enter the email on your account and we’ll send a reset link.</p>

        {sent ? (
          <div className="mt-6">
            <div className="flex items-start gap-2.5 rounded-xl border border-lime/30 bg-lime/10 px-3.5 py-3 text-[13px] text-ink">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-lime" />
              <span>If that email exists, a reset link has been sent. The link expires in one hour.</span>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-card2/70 px-3.5 py-3 text-[12px] leading-relaxed text-muted">
              <span className="font-semibold text-muted">Demo note:</span> no email provider is configured in this build — check this app’s server console for the generated link in a real integration, and use <span className="text-ink">/reset/&lt;token&gt;</span> to open the reset screen directly.
            </div>
            <Link to="/login" className="mt-5 block"><Button size="lg" className="w-full">Back to login</Button></Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="Email" error={touched ? emailErr : undefined}>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <Input type="email" autoComplete="email" className="pl-10" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} />
              </div>
            </Field>
            <Button type="submit" loading={busy} className="w-full" size="lg">Send reset link</Button>
          </form>
        )}
      </Card>

      <p className="mt-5 text-center text-[13px] text-muted">
        Remembered it? <Link to="/login" className="font-semibold text-lime hover:underline">Log in</Link>
      </p>
    </>
  )
}

/* ---------------- Reset ---------------- */
function ResetForm() {
  const { token } = useParams<{ token: string }>()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [formErr, setFormErr] = useState('')

  const passErr = password.length < 8 ? 'Use at least 8 characters.' : ''
  const repErr = repeat !== password ? 'Passwords don’t match.' : ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (passErr || repErr || !token) return
    setBusy(true); setFormErr('')
    try {
      await api.post('/auth/reset-password', { token, password })
      toast('Password updated. You can now log in.', 'ok')
      setDone(true)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      setFormErr(msg); toast(msg, 'err')
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <Card className="page-in p-7 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/12 text-lime"><CheckCircle2 size={22} /></span>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Password updated</h1>
        <p className="mt-1 text-[13.5px] text-muted">Your new password is live. Old sessions stay valid — log in fresh any time.</p>
        <Link to="/login" className="mt-6 block">
          <Button size="lg" className="w-full">Log in <ArrowRight size={16} /></Button>
        </Link>
      </Card>
    )
  }

  return (
    <>
      <Card className="page-in p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Choose a new password</h1>
        <p className="mt-1 text-[13.5px] text-muted">Pick something you haven’t used before, at least 8 characters.</p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="New password" hint="min 8 characters" error={touched ? passErr : undefined}>
            <Input type="password" autoComplete="new-password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched(true)} />
          </Field>
          <Field label="Confirm new password" error={touched ? repErr : undefined}>
            <Input type="password" autoComplete="new-password" placeholder="••••••••" value={repeat}
              onChange={(e) => setRepeat(e.target.value)} onBlur={() => setTouched(true)} />
          </Field>

          {formErr && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />{formErr}
            </div>
          )}

          <Button type="submit" loading={busy} className="w-full" size="lg">Update password</Button>
        </form>
      </Card>

      <p className="mt-5 text-center text-[13px] text-muted">
        <Link to="/login" className="font-semibold text-lime hover:underline">Back to login</Link>
      </p>
    </>
  )
}

/* ---------------- Verify ---------------- */
function VerifyPanel() {
  const { token } = useParams<{ token: string }>()
  const toast = useToast()
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await api.post('/auth/verify-email', { token })
        if (!alive) return
        setState('ok'); setMsg('Your email has been verified successfully.')
        toast('Email verified successfully.', 'ok')
      } catch (err) {
        if (!alive) return
        setState('err')
        setMsg(err instanceof ApiError ? err.message : 'Verification link is invalid or expired.')
      }
    })()
    return () => { alive = false }
  }, [token, toast])

  return (
    <Card className="page-in p-7 text-center">
      {state === 'loading' && (
        <>
          <Loader2 size={26} className="mx-auto animate-spin text-lime" />
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Verifying your email…</h1>
          <p className="mt-1 text-[13.5px] text-muted">Hang tight — this only takes a second.</p>
        </>
      )}
      {state === 'ok' && (
        <>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/12 text-lime"><CheckCircle2 size={22} /></span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Email verified</h1>
          <p className="mt-1 text-[13.5px] text-muted">{msg}</p>
          <Link to="/login" className="mt-6 block">
            <Button size="lg" className="w-full">Continue to login <ArrowRight size={16} /></Button>
          </Link>
        </>
      )}
      {state === 'err' && (
        <>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/12 text-danger"><AlertTriangle size={22} /></span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Verification failed</h1>
          <p className="mt-1 text-[13.5px] text-muted">{msg}</p>
          <Link to="/login" className="mt-6 block">
            <Button variant="outline" size="lg" className="w-full">Back to login</Button>
          </Link>
        </>
      )}
    </Card>
  )
}
