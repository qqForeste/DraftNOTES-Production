import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deletePinnedUser, getPinnedUser, updatePinnedNote } from '../api/client'
import type { PinnedUserOut } from '../api/types'
import { ChampionIcon } from '../components/ChampionIcon'
import { PageLoading } from '../components/PageLoading'
import { useChampionMap, useProfileIconUrl } from '../lib/ddragon'
import { formatDuration, formatKda, formatRelativeTime } from '../lib/format'
import { getQueueLabel } from '../lib/queue'
import { formatRankLabel, getRankEmblemUrl, getTierColor } from '../lib/rankIcons'

export function PinnedUserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [pinned, setPinned] = useState<PinnedUserOut | null | undefined>(undefined)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const championMap = useChampionMap()
  const profileIconUrl = useProfileIconUrl(pinned?.profile_icon_id ?? null)

  useEffect(() => {
    if (!id) return
    getPinnedUser(Number(id)).then((p) => {
      setPinned(p)
      setNote(p?.note ?? '')
    })
  }, [id])

  async function saveNote() {
    if (!pinned || note === (pinned.note ?? '')) return
    setSaving(true)
    try {
      const updated = await updatePinnedNote(pinned.id, note.trim() || null)
      setPinned(updated)
    } finally {
      setSaving(false)
    }
  }

  async function handleUnpin() {
    if (!pinned) return
    await deletePinnedUser(pinned.id)
    navigate('/pinned')
  }

  if (pinned === undefined || championMap == null) {
    return <PageLoading />
  }

  if (pinned === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <p className="text-sm text-text-secondary">This pinned player doesn't exist, or you already unpinned them.</p>
        <Link to="/pinned" className="text-sm text-accent hover:opacity-80">
          Back to Pinned
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-6">
      <div className="flex w-[720px] flex-col gap-3">
        <Link to="/pinned" className="text-[11px] text-text-secondary hover:text-text-primary">
          ← Back to Pinned
        </Link>

        <div className="flex items-center gap-4 rounded-card border border-card-border bg-card p-4.5">
          {profileIconUrl ? (
            <img src={profileIconUrl} alt="" className="h-16 w-16 rounded-full" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-chip" />
          )}
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-lg font-bold text-text-headline">
              {pinned.game_name}
              <span className="text-text-muted">#{pinned.tag_line}</span>
            </div>
            <div className="flex items-center gap-2">
              <img src={getRankEmblemUrl(pinned.tier)} alt="" className="h-6 w-6 object-scale-down" />
              <span className="text-sm font-bold" style={{ color: getTierColor(pinned.tier) }}>
                {formatRankLabel(pinned.tier, pinned.division)}
              </span>
              {pinned.lp != null && <span className="text-[11px] text-text-secondary">{pinned.lp} LP</span>}
            </div>
            <div className="text-[11px] text-text-muted">
              {pinned.platform.toUpperCase()} · synced {formatRelativeTime(pinned.synced_at)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleUnpin}
            className="self-start text-[11px] text-text-secondary hover:text-loss-text"
          >
            Unpin
          </button>
        </div>

        <div className="flex flex-col gap-1.5 rounded-card border border-card-border bg-card p-4.5">
          <span className="text-[11px] text-text-secondary">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            disabled={saving}
            rows={2}
            placeholder="What do you want to remember about them?"
            className="resize-none rounded-card border border-chip-border bg-inset px-2.5 py-2 text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <div className="rounded-card border border-card-border bg-card">
          <div className="border-b border-header-border px-4.5 py-3 text-xs text-text-secondary">
            Recent ranked games
          </div>
          {pinned.recent_matches.map((m) => (
            <div
              key={m.match_id}
              className="flex items-center gap-3 border-b border-divider px-4.5 py-2.5 last:border-b-0"
            >
              <ChampionIcon championId={m.champion_id} championMap={championMap} size={32} />
              <div className="w-24 text-[11px]" style={{ color: m.win ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}>
                {m.win ? 'Victory' : 'Defeat'}
                <div className="text-text-muted">{getQueueLabel(m.queue_id)}</div>
              </div>
              <div className="w-28 text-xs text-text-secondary-3">
                {m.kills} / <span className="text-loss">{m.deaths}</span> / {m.assists}
                <div className="text-[11px] text-text-secondary-5">{formatKda(m.kills, m.deaths, m.assists)} KDA</div>
              </div>
              <div className="flex-1" />
              <div className="text-[11px] text-text-muted">{formatDuration(m.game_duration)}</div>
              <div className="w-16 text-right text-[11px] text-text-muted">{formatRelativeTime(m.game_creation)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
