import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deletePinnedUser, updatePinnedNote } from '../api/client'
import type { PinnedUserOut } from '../api/types'
import type { ChampionInfo } from '../lib/ddragon'
import { useProfileIconUrl } from '../lib/ddragon'
import { formatRankLabel, getTierColor } from '../lib/rankIcons'
import { ChampionIcon } from './ChampionIcon'
import { PlayerHoverName } from './PlayerHoverName'

interface Props {
  pinned: PinnedUserOut
  championMap: Map<number, ChampionInfo> | null
  onUpdate: (pinned: PinnedUserOut) => void
  onRemove: (id: number) => void
}

export function PinnedUserRow({ pinned, championMap, onUpdate, onRemove }: Props) {
  const navigate = useNavigate()
  const iconUrl = useProfileIconUrl(pinned.profile_icon_id)
  const [note, setNote] = useState(pinned.note ?? '')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function saveNote() {
    if (note === (pinned.note ?? '')) return
    setSaving(true)
    try {
      const updated = await updatePinnedNote(pinned.id, note.trim() || null)
      onUpdate(updated)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await deletePinnedUser(pinned.id)
      onRemove(pinned.id)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-card border border-card-border bg-card px-3 py-2">
      <button
        type="button"
        onClick={() => navigate(`/pinned/${pinned.id}`)}
        title="View overview"
        className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80"
      >
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
        ) : (
          <div className="h-8 w-8 shrink-0 rounded-full bg-chip" />
        )}
        <div className="flex w-40 shrink-0 flex-col gap-0.5">
          <PlayerHoverName
            gameName={pinned.game_name}
            tagLine={pinned.tag_line}
            platform={pinned.platform}
            className="truncate text-xs text-text-primary hover:text-accent hover:underline"
          >
            {pinned.game_name}
            <span className="text-text-muted">#{pinned.tag_line}</span>
          </PlayerHoverName>
          <span className="text-[11px] font-bold" style={{ color: getTierColor(pinned.tier) }}>
            {formatRankLabel(pinned.tier, pinned.division)}
            {pinned.lp != null && ` · ${pinned.lp} LP`}
          </span>
        </div>
        <div className="flex shrink-0 gap-1">
          {pinned.recent_matches.slice(0, 3).map((m) => (
            <div
              key={m.match_id}
              className="rounded-full border-2 p-px"
              style={{ borderColor: m.win ? 'var(--color-win)' : 'var(--color-loss)' }}
            >
              <ChampionIcon championId={m.champion_id} championMap={championMap} size={20} />
            </div>
          ))}
        </div>
      </button>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        placeholder="Add a note…"
        disabled={saving}
        className="w-56 rounded-card border border-chip-border bg-inset px-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
      />

      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        title="Unpin"
        className="shrink-0 text-[11px] text-text-secondary hover:text-loss-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        Unpin
      </button>
    </div>
  )
}
