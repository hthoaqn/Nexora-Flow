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

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import SetupProfile from './pages/SetupProfile'
import Matches from './pages/Matches'
import Connections from './pages/Connections'
import Partners from './pages/Partners'
import Sandbox from './pages/Sandbox'
import Layout from './components/Layout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (token) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function PortalApp() {
  const { accessToken, setAuth, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      if (accessToken) {
        try {
          const res = await api.get('/auth/me')
          if (res.data?.success) {
            const { user } = res.data.data
            setAuth(user, accessToken, useAuthStore.getState().refreshToken || '')
          }
        } catch {
          clearAuth()
        }
      }
      setChecking(false)
    }
    void checkSession()
  }, [accessToken, setAuth, clearAuth])

  if (checking) {
    return (
      <div className="flex h-svh w-full flex-col items-center justify-center gap-3 bg-background">
        <div className="size-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Đang mở Startup Portal…</p>
      </div>
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
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <Register />
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
        {/* Legacy: / was dashboard in original portal */}
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
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
