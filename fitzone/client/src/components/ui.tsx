import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

// ---------- Toast ----------
type Toast = { id: number; text: string; kind: 'ok' | 'err' | 'info' }
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="modal-in pointer-events-auto flex items-center gap-2.5 max-w-sm w-full rounded-2xl border border-line bg-card px-4 py-3 shadow-2xl shadow-black/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-card2">
              {t.kind === 'ok' ? <CheckCircle2 size={16} className="text-lime" /> : t.kind === 'err' ? <AlertTriangle size={16} className="text-danger" /> : <Info size={16} className="text-muted" />}
            </span>
            <span className="text-sm text-ink leading-snug">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- Button ----------
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
}
const variants = {
  primary: 'bg-lime text-lime-ink font-semibold hover:brightness-110 active:brightness-95 accent-glow',
  ghost: 'text-muted hover:text-ink hover:bg-card2',
  outline: 'border border-line text-ink hover:border-muted/50 hover:bg-card2',
  danger: 'bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20',
  subtle: 'bg-card2 text-ink hover:bg-line',
}
const sizes = {
  sm: 'h-8 px-3 text-[13px] rounded-xl gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-2xl gap-2',
  icon: 'h-9 w-9 rounded-xl justify-center',
}
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn('inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60', variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading && <span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

// ---------- Card ----------
export const Card = ({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-3xl border border-line bg-card', className)} {...rest}>{children}</div>
)

export const SectionTitle = ({ title, action, sub }: { title: string; action?: React.ReactNode; sub?: string }) => (
  <div className="mb-3 flex items-end justify-between gap-3">
    <div>
      <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
    {action}
  </div>
)

// ---------- Form ----------
export const inputCls = 'w-full rounded-xl border border-line bg-night2 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 outline-none transition focus:border-lime/60 focus:ring-2 focus:ring-lime/15'

export const Input = ({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) => <input className={cn(inputCls, className)} {...rest} />
export const Textarea = ({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cn(inputCls, 'resize-none', className)} {...rest} />

export const Select = ({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cn(inputCls, 'appearance-none bg-night2', className)} {...rest}>{children}</select>
)

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-muted">
        {label}{hint && <span className="text-[11px] text-muted/70">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-danger">{error}</span>}
    </label>
  )
}

// ---------- Badge / Pill ----------
export function Badge({ color = 'line', children, className }: { color?: 'line' | 'lime' | 'danger' | 'warn' | 'ok'; children: React.ReactNode; className?: string }) {
  const map = { line: 'bg-card2 text-muted border-line', lime: 'bg-lime/15 text-lime border-lime/30', danger: 'bg-danger/10 text-danger border-danger/25', warn: 'bg-warn/10 text-warn border-warn/25', ok: 'bg-ok/10 text-ok border-ok/25' }
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', map[color], className)}>{children}</span>
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('modal-in relative w-full overflow-hidden rounded-t-3xl md:rounded-3xl border border-line bg-card shadow-2xl max-h-[92vh] flex flex-col md:w-[440px]', wide && 'md:w-[640px]')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-card2 hover:text-ink"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title, body, danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {body && <p className="mb-5 text-sm text-muted">{body}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }} className={danger ? 'bg-danger text-white border-none' : ''}>{danger ? 'Delete' : 'Confirm'}</Button>
      </div>
    </Modal>
  )
}

// ---------- Feedback ----------
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton rounded-2xl', className)} />

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-card/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-card2 text-muted">{icon}</div>}
      <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---------- ProgressRing ----------
export function ProgressRing({ pct, size = 108, stroke = 9, color = 'var(--accent)', children, track = 'var(--card2)' }:
  { pct: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode; track?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

// ---------- StatCard ----------
export function StatCard({ icon, label, value, sub, accent }: { icon?: React.ReactNode; label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <Card className={cn('p-4', accent && 'border-lime/30 bg-gradient-to-br from-lime/[0.07] to-transparent')}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div className="font-display text-xl font-bold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </Card>
  )
}

// ---------- Segmented ----------
export function Segmented<T extends string | number>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('inline-flex rounded-2xl border border-line bg-card p-1', size === 'sm' && 'p-0.5')}>
      {options.map((o) => (
        <button key={String(o.value)} onClick={() => onChange(o.value)}
          className={cn('rounded-xl font-medium transition-all', size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
            value === o.value ? 'bg-lime text-lime-ink' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
