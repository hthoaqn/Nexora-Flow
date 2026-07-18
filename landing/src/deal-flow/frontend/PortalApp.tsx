'use client'

/**
 * Deal-flow startup portal — routes at site root (no /portal).
 * Marketing stays at /. App home is /dashboard.
 */
import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './store/useAuthStore'
import { api } from './api'

import Dashboard from './pages/Dashboard'
import SetupProfile from './pages/SetupProfile'
import Matches from './pages/Matches'
import Connections from './pages/Connections'
import Partners from './pages/Partners'
import Sandbox from './pages/Sandbox'
import InvestorMatches from './pages/InvestorMatches'
import Evaluations from './pages/Evaluations'
import EvaluationCasePage from './pages/EvaluationCase'
import PitchRoom from './pages/PitchRoom'
import SimulationRound from './pages/SimulationRound'
import ProofRound from './pages/ProofRound'
import NotificationsPage from './pages/Notifications'
import Layout from './components/Layout'
import { isInvestorPipelineEnabled } from '@/investor/flags'

function LoginRedirect() {
  useEffect(() => {
    window.location.replace('/login?tab=startup')
  }, [])
  return (
    <div className="flex h-svh items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function RegisterRedirect() {
  useEffect(() => {
    window.location.replace('/register')
  }, [])
  return (
    <div className="flex h-svh items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function BootScreen({ label }: { label: string }) {
  return (
    <div className="flex h-svh w-full flex-col items-center justify-center gap-3 bg-background">
      <div className="size-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  const hydrated = useAuthStore((s) => s._hasHydrated)
  if (!hydrated) {
    return (
      <BootScreen
        label={
          typeof window !== 'undefined' &&
          window.localStorage.getItem('nf-lang') === 'en'
            ? 'Restoring session…'
            : 'Đang khôi phục phiên…'
        }
      />
    )
  }
  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  const hydrated = useAuthStore((s) => s._hasHydrated)
  if (!hydrated) return <BootScreen label="…" />
  if (token) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function PortalApp() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const hydrated = useAuthStore((s) => s._hasHydrated)
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated)
  const [checking, setChecking] = useState(true)

  // Fallback if onRehydrateStorage did not fire (SSR edge)
  useEffect(() => {
    if (hydrated) return
    const t = window.setTimeout(() => {
      if (!useAuthStore.getState()._hasHydrated) {
        setHasHydrated(true)
      }
    }, 80)
    return () => clearTimeout(t)
  }, [hydrated, setHasHydrated])

  useEffect(() => {
    if (!hydrated) return

    const checkSession = async () => {
      const token = useAuthStore.getState().accessToken
      if (!token) {
        setChecking(false)
        return
      }
      try {
        const res = await api.get('/auth/me')
        if (res.data?.success) {
          const payload = res.data.data
          const user = payload?.user ?? payload
          if (user?.id) {
            const st = String(user.status || 'active').toLowerCase()
            if (st === 'pending' || st === 'rejected') {
              clearAuth()
              window.location.replace('/pending')
              return
            }
            setAuth(
              user,
              token,
              useAuthStore.getState().refreshToken || '',
            )
          }
        }
      } catch (e: any) {
        const status = e?.response?.status
        const code =
          e?.response?.data?.error?.code || e?.response?.data?.detail?.code
        if (code === 'ACCOUNT_PENDING' || code === 'PENDING_APPROVAL') {
          clearAuth()
          window.location.replace('/pending')
          return
        }
        // Only log out on real auth failure — not network blips
        if (status === 401 || status === 403) {
          clearAuth()
        }
      }
      setChecking(false)
    }
    void checkSession()
  }, [hydrated, accessToken, setAuth, clearAuth])

  if (!hydrated || checking) {
    return (
      <BootScreen
        label={
          typeof window !== 'undefined' &&
          window.localStorage.getItem('nf-lang') === 'en'
            ? 'Opening Startup Portal…'
            : 'Đang mở Startup Portal…'
        }
      />
    )
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" expand={false} richColors closeButton />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginRedirect />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterRedirect />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <SetupProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/startup/extractions/:extractionId/review"
          element={
            <ProtectedRoute>
              <SetupProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Matches />
            </ProtectedRoute>
          }
        />
        <Route
          path="/connections"
          element={
            <ProtectedRoute>
              <Connections />
            </ProtectedRoute>
          }
        />
        <Route
          path="/partners"
          element={
            <ProtectedRoute>
              <Partners />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sandbox"
          element={
            <ProtectedRoute>
              <Sandbox />
            </ProtectedRoute>
          }
        />
        {isInvestorPipelineEnabled() ? (
          <>
            <Route
              path="/investor-matches"
              element={
                <ProtectedRoute>
                  <InvestorMatches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluations"
              element={
                <ProtectedRoute>
                  <Evaluations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluations/:caseId"
              element={
                <ProtectedRoute>
                  <EvaluationCasePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluations/:caseId/pitch"
              element={
                <ProtectedRoute>
                  <PitchRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluations/:caseId/simulation"
              element={
                <ProtectedRoute>
                  <SimulationRound />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluations/:caseId/proof"
              element={
                <ProtectedRoute>
                  <ProofRound />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
          </>
        ) : null}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
