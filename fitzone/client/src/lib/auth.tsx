import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'

export interface User { id: number; email: string; name: string; email_verified: number; created_at: number }
export interface Profile {
  user_id: number; age: number | null; gender: string | null; height_cm: number | null
  weight_kg: number | null; target_weight: number | null; experience: string | null; goal: string | null
  location: string | null; equipment: string[]; days_per_week: number | null; duration_pref: number | null
  calorie_target: number | null; onboarded: number
}

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  authed: boolean
  mustOnboard: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  setProfile: (p: Profile) => void
}

const Ctx = createContext<AuthState>(null as any)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfileState] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setProfileState(null); setLoading(false); return }
    try {
      const d = await api.get<{ user: User; profile: Profile | null }>('/auth/me')
      setUser(d.user)
      setProfileState(d.profile)
      if (d.user && getToken()) setToken(getToken())
    } catch {
      setToken(null); setUser(null); setProfileState(null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = async (email: string, password: string) => {
    const d = await api.post<{ token: string }>('/auth/login', { email, password })
    setToken(d.token)
    await refresh()
  }

  const register = async (name: string, email: string, password: string) => {
    const d = await api.post<{ token: string }>('/auth/register', { name, email, password })
    setToken(d.token)
    await refresh()
  }

  const logout = () => { setToken(null); setUser(null); setProfileState(null) }

  const setProfile = (p: Profile) => setProfileState(p)

  return (
    <Ctx.Provider value={{ user, profile, loading, authed: !!user, mustOnboard: !!user && !!profile === false || !!(user && profile && !profile.onboarded), login, register, logout, refresh, setProfile }}>
      {children}
    </Ctx.Provider>
  )
}
