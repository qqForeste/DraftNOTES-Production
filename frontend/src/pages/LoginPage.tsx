import { useEffect, useState } from 'react'
import { demoLogin, devLogin, getAuthProviders, guestLogin, oauthLoginUrl } from '../api/client'
import type { AuthProviders } from '../api/types'
import { useAuth } from '../auth/useAuth'

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Continue with Google',
  discord: 'Continue with Discord',
}

export function LoginPage() {
  const { refresh } = useAuth()
  const [providers, setProviders] = useState<AuthProviders | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [guestBusy, setGuestBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAuthProviders().then(setProviders).catch(() => setError('Could not reach the backend.'))
  }, [])

  const authFailed = new URLSearchParams(window.location.search).has('auth_error')

  async function handleDemo() {
    setDemoBusy(true)
    setError(null)
    try {
      await demoLogin()
      await refresh()
    } catch {
      setError('Could not start the demo. Try again in a moment.')
      setDemoBusy(false)
    }
  }

  async function handleGuest() {
    setGuestBusy(true)
    setError(null)
    try {
      await guestLogin()
      await refresh()
    } catch {
      setError('Could not start a guest session. Try again in a moment.')
      setGuestBusy(false)
    }
  }

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await devLogin(email)
      await refresh()
    } catch {
      setError('Sign in failed. Is the email valid?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <div className="w-[420px] rounded-card border border-card-border bg-card p-6">
        <h1 className="mb-1 text-xl font-semibold text-text-headline">DraftNotes</h1>
        <p className="mb-5 text-sm text-text-secondary">
          Tag what went wrong in your ranked games and see the patterns build up over time.
        </p>

        {authFailed && (
          <p className="mb-4 text-sm text-loss-text">Sign in was cancelled or failed. Try again.</p>
        )}

        {providers?.demo_enabled && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleDemo}
              disabled={demoBusy}
              className="w-full rounded-card bg-accent py-2.5 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50"
            >
              {demoBusy ? 'Loading the demo…' : 'Explore the demo (no login required)'}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              Opens a ready-made account with a Pro Player's match history with example
              notes already written. (Temporary)
            </p>
          </div>
        )}

        {providers?.guest_enabled && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleGuest}
              disabled={guestBusy}
              className="w-full rounded-card border border-chip-border py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              {guestBusy ? 'Starting…' : 'Continue without logging in'}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              Sync any Riot ID and start tagging right away without logging in. WARNING: No saved stats.
            </p>
          </div>
        )}

        {providers && providers.providers.length > 0 && (
          <>
            {(providers.demo_enabled || providers.guest_enabled) && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-chip-border" />
                <span className="text-[11px] text-text-muted">or track your own account</span>
                <div className="h-px flex-1 bg-chip-border" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              {providers.providers.map((provider) => (
                <a
                  key={provider}
                  href={oauthLoginUrl(provider)}
                  className={`rounded-card py-2.5 text-center text-sm ${
                    providers.demo_enabled || providers.guest_enabled
                      ? 'border border-chip-border font-medium text-text-secondary hover:text-text-primary'
                      : 'bg-accent font-medium text-page'
                  }`}
                >
                  {PROVIDER_LABELS[provider] ?? `Continue with ${provider}`}
                </a>
              ))}
            </div>
          </>
        )}

        {providers?.providers.length === 0 &&
          !providers.dev_login_enabled &&
          !providers.demo_enabled &&
          !providers.guest_enabled && (
          <p className="text-sm text-loss-text">
            No sign-in provider is configured. Set the Google or Discord credentials in the backend
            environment.
          </p>
        )}

        {providers?.dev_login_enabled && (
          <form onSubmit={handleDevLogin} className="mt-4 flex flex-col gap-2">
            {providers.providers.length > 0 && (
              <div className="my-1 text-center text-[11px] text-text-muted">or, for local dev</div>
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-card border border-chip-border bg-inset px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-card border border-chip-border py-2 text-sm text-text-secondary hover:border-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Dev sign in'}
            </button>
            <p className="text-[11px] text-text-muted">
              Development only. This endpoint does not exist in production.
            </p>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-loss-text">{error}</p>}

        <p className="mt-5 text-[11px] text-text-muted">
          By continuing you accept the{' '}
          <a href="/terms" className="underline hover:text-text-secondary">
            terms
          </a>{' '}
          and how your data is handled, described in the{' '}
          <a href="/privacy" className="underline hover:text-text-secondary">
            privacy notice
          </a>
          .
        </p>
      </div>

      <p className="max-w-[420px] text-center text-[11px] text-text-muted">
        DraftNotes isn't endorsed by Riot Games and doesn't reflect the views or opinions of
        Riot Games or anyone officially involved in producing or managing Riot Games
        properties. Riot Games, and all associated properties are trademarks or registered
        trademarks of Riot Games, Inc.
      </p>
    </div>
  )
}
