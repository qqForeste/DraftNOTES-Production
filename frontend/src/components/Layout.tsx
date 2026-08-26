import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { logout } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { hasViewTarget } from '../lib/viewTarget'
import { HeaderSearch } from './HeaderSearch'
import { ThemePicker } from './ThemePicker'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-card px-3 py-1.5 text-xs transition-colors ${
    isActive ? 'bg-accent font-medium text-page' : 'text-text-secondary hover:text-text-primary'
  }`

const SEARCHABLE_PATHS = ['/', '/stats']

export function Layout() {
  const { me, refresh } = useAuth()
  const isDemo = me?.provider === 'demo'
  const isGuest = me?.provider === 'guest'
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const viewingOther = hasViewTarget(searchParams)
  const showSearch = SEARCHABLE_PATHS.includes(location.pathname)

  async function handleSignOut() {
    await logout()
    await refresh()
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="flex h-14 items-center justify-center border-b border-header-border bg-header">
        <div className="flex w-[1012px] items-center gap-7">
          <NavLink to="/" className="flex shrink-0 items-center gap-2">
            <img src="/Logo/logo-icon.png" alt="" className="h-8 w-auto" />
            <div className="flex items-baseline gap-px">
              <span className="text-[19px] font-bold tracking-[-0.4px] text-text-primary">DRAFT</span>
              <span className="text-[19px] font-bold tracking-[-0.4px] text-text-primary">NOTES</span>
            </div>
          </NavLink>
          <nav className="flex shrink-0 gap-0.5">
            <NavLink to="/" end className={tabClass}>
              Match history
            </NavLink>
            {!viewingOther && (
              <>
                <NavLink to="/stats" className={tabClass}>
                  Review
                </NavLink>
                <NavLink to="/matchups" className={tabClass}>
                  Matchups
                </NavLink>
                <NavLink to="/pinned" className={tabClass}>
                  Pinned
                </NavLink>
              </>
            )}
          </nav>
          <div className="flex-1" />
          <div className="flex shrink-0 items-center gap-3">
            <ThemePicker />
            {isDemo ? (
              <span className="rounded-card bg-accent px-2 py-0.5 text-[11px] font-bold text-page">
                DEMO
              </span>
            ) : isGuest ? (
              <span className="rounded-card bg-chip px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                GUEST
              </span>
            ) : (
              <NavLink to="/account" className="text-[11px] text-text-secondary hover:text-text-primary">
                {me?.display_name ?? me?.email}
              </NavLink>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-card border border-chip-border px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary"
            >
              {isDemo ? 'Exit demo' : isGuest ? 'End session' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      {showSearch && (
        <div className="flex justify-center border-b border-header-border bg-inset-alt py-2">
          <div className="flex w-[1012px] justify-center">
            <HeaderSearch />
          </div>
        </div>
      )}

      {isDemo && (
        <div className="flex justify-center border-b border-header-border bg-inset-alt py-2">
          <div className="flex w-[1012px] items-center gap-2 text-[11px] text-text-secondary">
            <span>
              You're exploring a demo on a public pro match history. Notes you write are private to
              this session and are cleared later.
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleSignOut}
              className="font-medium text-accent hover:opacity-80"
            >
              Sign in to track your own account →
            </button>
          </div>
        </div>
      )}

      {isGuest && (
        <div className="flex justify-center border-b border-header-border bg-inset-alt py-2">
          <div className="flex w-[1012px] items-center gap-2 text-[11px] text-text-secondary">
            <span>
              You're syncing without an account. This works like the real thing, but there's no
              way back into it once you leave. Sign in properly to keep it.
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleSignOut}
              className="font-medium text-accent hover:opacity-80"
            >
              Sign in →
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="flex flex-col items-center justify-center gap-1 border-t border-header-border py-4 text-[11px] text-text-muted">
        <div className="flex gap-3">
          <span>DRAFTNOTES · personal match review</span>
          <NavLink to="/privacy" className="hover:text-text-secondary">
            Privacy
          </NavLink>
          <NavLink to="/terms" className="hover:text-text-secondary">
            Terms
          </NavLink>
        </div>
        <p className="max-w-[620px] text-center">
          DraftNotes isn't endorsed by Riot Games and doesn't reflect the views or opinions of
          Riot Games or anyone officially involved in producing or managing Riot Games
          properties. Riot Games, and all associated properties are trademarks or registered
          trademarks of Riot Games, Inc.
        </p>
      </footer>
    </div>
  )
}
