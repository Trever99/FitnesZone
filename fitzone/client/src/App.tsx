import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ToastProvider, Skeleton } from '@/components/ui'
import { AppShell, ThemeProvider } from '@/components/layout/AppShell'

import AuthPages from '@/pages/Auth'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Workouts from '@/pages/Workouts'
import WorkoutSession from '@/pages/WorkoutSession'
import Exercises from '@/pages/Exercises'
import ExerciseDetail from '@/pages/ExerciseDetail'
import Planner from '@/pages/Planner'
import Nutrition from '@/pages/Nutrition'
import Progress from '@/pages/Progress'
import Coach from '@/pages/Coach'
import Analytics from '@/pages/Analytics'
import Profile from '@/pages/Profile'

function Loader() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 py-10">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-40" />
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { authed, loading, profile } = useAuth()
  if (loading) return <Loader />
  if (!authed) return <Navigate to="/login" replace state={{ from: window.location.pathname }} />
  if (profile && !profile.onboarded) return <Navigate to="/onboarding" replace />
  return <AppShell>{children}</AppShell>
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { authed, loading, profile } = useAuth()
  if (loading) return <Loader />
  if (authed) return <Navigate to={profile?.onboarded ? '/dashboard' : '/onboarding'} replace />
  return children as any
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<PublicOnly><AuthPages mode="login" /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><AuthPages mode="register" /></PublicOnly>} />
              <Route path="/forgot" element={<PublicOnly><AuthPages mode="forgot" /></PublicOnly>} />
              <Route path="/reset/:token" element={<AuthPages mode="reset" />} />
              <Route path="/verify/:token" element={<AuthPages mode="verify" />} />
              <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
              <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
              <Route path="/workouts" element={<Protected><Workouts /></Protected>} />
              <Route path="/workouts/session/:id" element={<Protected><WorkoutSession /></Protected>} />
              <Route path="/exercises" element={<Protected><Exercises /></Protected>} />
              <Route path="/exercises/:id" element={<Protected><ExerciseDetail /></Protected>} />
              <Route path="/planner" element={<Protected><Planner /></Protected>} />
              <Route path="/nutrition" element={<Protected><Nutrition /></Protected>} />
              <Route path="/progress" element={<Protected><Progress /></Protected>} />
              <Route path="/coach" element={<Protected><Coach /></Protected>} />
              <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
