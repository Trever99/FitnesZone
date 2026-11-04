const BASE = '/api'
const TOKEN_KEY = 'fitzone_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  if (path.startsWith('/api/')) path = path.slice(4)
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((opts.headers as Record<string, string>) || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { ...opts, headers })
  let json: any = null
  try { json = await res.json() } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(json?.error || `Request failed (${res.status})`, res.status)
  return (json?.data !== undefined && !(json instanceof Array) && json.ok === undefined ? json : json) as T
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(p: string, body?: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
}

export const fmt = {
  n: (v: number | null | undefined, d = 0) => (v == null || isNaN(Number(v))) ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }),
  vol: (kg: number) => kg >= 1_000_000 ? `${(kg / 1_000_000).toFixed(1)}M kg` : kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`,
  dur: (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min` },
  durShort: (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`,
  date: (d: string | number | Date) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  dateLong: (d: string | number | Date) => new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
  time: (d: string | number | Date) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  rel: (d: string | number | Date) => {
    const diff = (Date.now() - new Date(d).getTime()) / 86400000
    if (diff < 0.04) return 'just now'; if (diff < 1) return 'today'; if (diff < 2) return 'yesterday'
    if (diff < 7) return `${Math.round(diff)}d ago`; return fmt.date(d)
  },
}

export const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#c8f542', Back: '#7dd956', Legs: '#4ecdc4', Quadriceps: '#4ecdc4', Hamstrings: '#54b8f0',
  Shoulders: '#8b7cf6', Biceps: '#f47ab8', Triceps: '#ff8a5c', Forearms: '#d9a6ff', Glutes: '#ffc75c',
  Calves: '#63e6be', Abs: '#ffe066', Cardio: '#ff5c5c',
}
export const muscleColor = (m: string) => MUSCLE_COLORS[m?.split(',')[0]?.trim()] || '#8b7cf6'
