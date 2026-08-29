import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, getPinnedUser, listPinnedUsers, startPinnedSync } from '../api/client'
import { SyncTimeoutError, describeJobError, waitForPinnedSync } from '../api/sync'
import type { PinnedUserOut } from '../api/types'
import { PinnedUserRow } from '../components/PinnedUserRow'
import { RiotIdForm } from '../components/RiotIdForm'
import { PageLoading } from '../components/PageLoading'
import { useChampionMap } from '../lib/ddragon'

function describePinError(err: ApiError): string {
  if (err.status === 403) return 'Pinning is disabled in the demo. Sign in to track other players.'
  if (err.status === 409) return "You've hit the pin limit. Unpin someone to add another."
  if (err.status === 429) return 'You just refreshed this player, try again in a bit.'
  if (err.status === 503) return 'Sync queue is busy right now. Try again shortly.'
  return `Could not pin that Riot ID (${err.status}).`
}

export function PinnedUsersPage() {
  const [pinned, setPinned] = useState<PinnedUserOut[] | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const championMap = useChampionMap()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    listPinnedUsers().then(setPinned)
  }, [])

  const [prefill] = useState(() => ({
    riotId: searchParams.get('riot') ?? '',
    platform: searchParams.get('platform') ?? undefined,
  }))
  useEffect(() => {
    if (!searchParams.has('riot')) return
    const next = new URLSearchParams(searchParams)
    next.delete('riot')
    next.delete('platform')
    setSearchParams(next, { replace: true })
  }, [])

  async function handleSync(gameName: string, tagLine: string, platform: string) {
    setSyncing(true)
    setError(null)
    try {
      const job = await startPinnedSync(gameName, tagLine, platform)
      let finished
      try {
        finished = await waitForPinnedSync(job.job_id)
      } catch (pollErr) {
        listPinnedUsers().then(setPinned)
        setError(
          pollErr instanceof SyncTimeoutError
            ? 'Still syncing in the background. They should show up below shortly.'
            : "Lost track of the sync's progress, but it may have finished. Check the list below.",
        )
        return
      }
      if (finished.status !== 'complete' || finished.pinned_id == null) {
        setError(describeJobError(finished.error))
        return
      }
      const result = await getPinnedUser(finished.pinned_id)
      if (result == null) {
        setError('Could not sync that Riot ID. Double check the spelling and region.')
        return
      }
      setPinned((prev) => {
        const exists = prev?.some((p) => p.id === result.id)
        return exists ? (prev?.map((p) => (p.id === result.id ? result : p)) ?? [result]) : [result, ...(prev ?? [])]
      })
    } catch (err) {
      setError(err instanceof ApiError ? describePinError(err) : 'Something went wrong. Check that the backend is running.')
    } finally {
      setSyncing(false)
    }
  }

  function handleUpdate(updated: PinnedUserOut) {
    setPinned((prev) => prev?.map((p) => (p.id === updated.id ? updated : p)) ?? prev)
  }

  function handleRemove(id: number) {
    setPinned((prev) => prev?.filter((p) => p.id !== id) ?? prev)
  }

  return (
    <div className="flex flex-col items-center py-6">
      <div className="flex w-[1012px] flex-col gap-3">
        <div className="flex items-baseline gap-2.5">
          <div className="text-xl font-bold text-text-headline">Pinned</div>
          <div className="text-xs text-text-secondary">
            Friends and rivals you want to keep an eye on. Private to you, not part of your own match history.
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-card border border-card-border bg-card p-4.5">
          <div className="text-xs text-text-secondary">Pin a player</div>
          <RiotIdForm
            onSubmit={handleSync}
            busy={syncing}
            submitLabel="Pin"
            initialValue={prefill.riotId}
            initialPlatform={prefill.platform}
          />
          {error && <p className="text-xs text-loss-text">{error}</p>}
        </div>

        <div className="flex flex-col gap-2">
          {pinned === null || championMap == null ? (
            <PageLoading />
          ) : pinned.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-secondary">
              No one pinned yet. Sync a Riot ID above to add someone.
            </p>
          ) : (
            pinned.map((p) => (
              <PinnedUserRow key={p.id} pinned={p} championMap={championMap} onUpdate={handleUpdate} onRemove={handleRemove} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
