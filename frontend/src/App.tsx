import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { demoLogin } from './api/client'
import { AuthProvider } from './auth/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { AccountPage } from './pages/AccountPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MatchupsPage } from './pages/MatchupsPage'
import { PinnedUserProfilePage } from './pages/PinnedUserProfilePage'
import { PinnedUsersPage } from './pages/PinnedUsersPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { StatsPage } from './pages/StatsPage'

function MatchRedirect() {
  const { matchId } = useParams<{ matchId: string }>()
  return <Navigate to={`/?expand=${matchId}`} replace />
}

function AuthGate() {
  const { me, loading, refresh } = useAuth()
  const [startingDemo, setStartingDemo] = useState(
    () => new URLSearchParams(window.location.search).has('demo'),
  )

  useEffect(() => {
    if (loading || me || !startingDemo) return
    demoLogin()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => setStartingDemo(false))
  }, [loading, me])

  if (loading || (startingDemo && !me)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    )
  }
  if (!me) {
    return (
      <div className="min-h-screen bg-page">
        <Routes>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </div>
    )
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="matches/:matchId" element={<MatchRedirect />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="matchups" element={<MatchupsPage />} />
        <Route path="pinned" element={<PinnedUsersPage />} />
        <Route path="pinned/:id" element={<PinnedUserProfilePage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
