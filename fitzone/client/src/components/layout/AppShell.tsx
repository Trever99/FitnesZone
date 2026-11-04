import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, ClipboardList, CalendarRange, Utensils, TrendingUp, Bot, User, Zap, Menu, LogOut, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { cn, Badge } from '../ui'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/exercises', label: 'Exercises', icon: ClipboardList },
  { to: '/planner', label: 'Planner', icon: CalendarRange },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/coach', label: 'AI Coach', icon: Bot },
  { to: '/profile', label: 'Profile', icon: User },
]
const MOBILE = NAV.filter((n) => ['/dashboard', '/workouts', '/progress', '/nutrition', '/profile'].includes(n.to))

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => (localStorage.getItem('fitzone_theme') as any) || 'dark')
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('fitzone_theme', theme)
  }, [theme])
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>
}
const ThemeCtx = React.createContext<{ theme: string; setTheme: (t: 'dark' | 'light') => void }>(null as any)
export const useTheme = () => React.useContext(ThemeCtx)

export function AppShell({ children, crumb }: { children: React.ReactNode; crumb?: string }) {
  const { user, profile, logout } = useAuth()
  const [open, setOpen] = React.useState(false)
  const location = useLocation()
  const theme = useTheme()
  const [stime, setStime] = React.useState('')
  React.useEffect(() => {
    if (location.pathname.startsWith('/workouts/session')) setStime(localStorage.getItem('fitzone_live') || '') // workout mode has own padding
    else setStime('')
    setOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  const initials = (user?.name || 'A').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const levelPercent = null

  return (
    <div className="min-h-screen lg:flex" style={{ background: 'var(--bg), #0a0b0f' }}>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-30 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface/60 lg:flex">
        <Brand />
        <nav className="mt-1 flex-1 px-3 py-2">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={cn('mb-1 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13.5px] font-medium transition-all',
                'hover:bg-card2 hover:text-ink', location.pathname.startsWith(n.to) ? 'bg-lime/10 text-lime' : 'text-muted')}>
              <n.icon size={17} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mx-3 mb-3 rounded-2xl bg-gradient-to-br from-lime/[0.12] to-transparent border border-lime/20 p-3.5">
          <div className="flex items-center gap-2 text-lime"><Zap size={14} /><span className="text-[11px] font-semibold uppercase tracking-wide">Keep it up</span></div>
          <p className="mt-1 text-[12px] leading-snug text-muted">Consistency beats intensity. Show up again today.</p>
        </div>
        <UserFooter user={user!} initials={initials} logout={logout} theme={theme} />
      </aside>

      {/* Mobile topbar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/85 px-4 backdrop-blur-xl lg:hidden">
        <button onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-ink"><Menu size={18} /></button>
        <div className="flex items-center gap-2"><LogoMark size={22} /><span className="font-display text-[15px] font-extrabold tracking-tight">FITZONE</span></div>
        <NavLink to="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-lime/15 text-[11px] font-bold text-lime">{initials}</NavLink>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-line bg-surface modal-in">
            <div className="flex items-center justify-between px-5 py-4">
              <Brand />
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted"><X size={16} /></button>
            </div>
            <nav className="flex-1 px-3">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={cn('mb-1 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium',
                  location.pathname.startsWith(n.to) ? 'bg-lime/10 text-lime' : 'text-muted')}>
                  <n.icon size={17} />{n.label}
                </NavLink>
              ))}
            </nav>
            <UserFooter user={user!} initials={initials} logout={logout} theme={theme} />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="min-h-screen flex-1 pb-24 pt-16 lg:pb-8 lg:pt-0">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-stretch border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden">
        {MOBILE.map((n) => (
          <NavLink key={n.to} to={n.to} className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium"
            style={{ color: location.pathname.startsWith(n.to) ? 'var(--accent)' : 'var(--muted)' }}>
            <n.icon size={20} strokeWidth={location.pathname.startsWith(n.to) ? 2.2 : 1.7} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-xl bg-lime accent-glow" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size * 0.62} height={size * 0.62}><path d="M25 28h50v9H50v35H38V37H25z" fill="var(--accent-ink)" /></svg>
    </span>
  )
}

const Brand = () => (
  <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
    <LogoMark />
    <span className="font-display text-[17px] font-extrabold tracking-tight text-ink">FITZONE</span>
  </div>
)

function UserFooter({ user, initials, logout, theme }: any) {
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-3 rounded-2xl bg-card p-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime/15 text-[11px] font-bold text-lime">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink">{user?.name}</div>
          <div className="truncate text-[11px] text-muted">{user?.email}</div>
        </div>
        <button onClick={logout} title="Log out" className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-card2 hover:text-danger"><LogOut size={15} /></button>
      </div>
      <ThemeToggle theme={theme.theme} setTheme={theme.setTheme} />
    </div>
  )
}

function ThemeToggle({ theme, setTheme }: { theme: string; setTheme: (t: 'dark' | 'light') => void }) {
  return (
    <div className="mt-2 flex items-center justify-between rounded-2xl bg-card px-3.5 py-2.5">
      <span className="text-[12px] text-muted">Appearance</span>
      <div className="flex gap-1">
        {(['dark', 'light'] as const).map((t) => (
          <button key={t} onClick={() => setTheme(t)} className={cn('rounded-lg px-2.5 py-1 text-[11px] font-medium transition', theme === t ? 'bg-lime text-lime-ink' : 'text-muted hover:text-ink')}>
            {t === 'dark' ? 'Dark' : 'Light'}
          </button>
        ))}
      </div>
    </div>
  )
}

export { Badge }
