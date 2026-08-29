import { useState } from 'react'
import { ApiError, deleteAccount } from '../api/client'
import { useAuth } from '../auth/useAuth'

export function AccountPage() {
  const { me, refresh } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? `Could not delete (${err.status}).` : 'Could not delete.')
      setBusy(false)
    }
  }

  return (
    <div className="flex justify-center py-8">
      <div className="flex w-[640px] flex-col gap-3">
        <h1 className="text-xl font-bold text-text-headline">Account</h1>

        <div className="rounded-card border border-card-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold text-text-primary">Signed in as</div>
          <div className="text-sm text-text-secondary">{me?.email ?? me?.display_name}</div>
          <div className="mt-1 text-[11px] text-text-muted">via {me?.provider}</div>
        </div>

        <div className="rounded-card border border-card-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold text-text-primary">Linked Riot IDs</div>
          {me?.summoners.length ? (
            <ul className="flex flex-col gap-2">
              {me.summoners.map((s) => (
                <li key={s.puuid} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="text-text-primary">
                    {s.game_name}
                    <span className="text-text-muted">#{s.tag_line}</span>
                  </span>
                  {s.platform && <span className="text-[11px] text-text-muted">{s.platform}</span>}
                  {s.is_primary && (
                    <span className="rounded-card bg-chip px-1.5 py-0.5 text-[10px] text-text-secondary">
                      primary
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">None yet. Sync a Riot ID to link one.</p>
          )}
        </div>

        <div className="rounded-card border border-loss-text/40 bg-card p-4">
          <div className="mb-1 text-sm font-semibold text-loss-text">Delete account</div>
          <p className="mb-3 text-sm text-text-secondary">
            Removes your account, every note and tag you have written, and any match data no
            other player here still uses. This cannot be undone.
          </p>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-card border border-loss-text/50 px-3 py-1.5 text-xs text-loss-text hover:bg-loss-text/10"
            >
              Delete my account
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-primary">Permanently delete everything?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="rounded-card bg-loss-text px-3 py-1.5 text-xs font-medium text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-card border border-chip-border px-3 py-1.5 text-xs text-text-secondary hover:border-text-muted hover:text-text-primary disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-loss-text">{error}</p>}
        </div>
      </div>
    </div>
  )
}
