import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteNote, upsertNote } from '../api/client'
import type {
  GamePhase,
  MatchListItem,
  MatchupOut,
  MatchupTagTaxonomyEntry,
  MatchupWeaknessTaxonomyEntry,
  MistakeTag,
  NoteOut,
  TagTaxonomyEntry,
} from '../api/types'
import type { ChampionInfo } from '../lib/ddragon'
import { expectedMatchupContext } from '../lib/matchupIds'
import { enemyChampionIds } from '../lib/scoreboard'
import { MatchupSummaryRow } from './MatchupSummaryRow'
import { TagPicker } from './TagPicker'

interface Props {
  match: MatchListItem
  taxonomy: TagTaxonomyEntry[]
  matchups: MatchupOut[]
  matchupTaxonomy: MatchupTagTaxonomyEntry[]
  matchupWeaknessTaxonomy: MatchupWeaknessTaxonomyEntry[]
  championMap: Map<number, ChampionInfo> | null
  onNoteChange: (note: NoteOut | null) => void
}

export function InlineNoteEditor({
  match,
  taxonomy,
  matchups,
  matchupTaxonomy,
  matchupWeaknessTaxonomy,
  championMap,
  onNoteChange,
}: Props) {
  const navigate = useNavigate()
  const [selectedTags, setSelectedTags] = useState<MistakeTag[]>(
    match.note ? [...new Set(match.note.tags.map((t) => t.tag_key))] : [],
  )
  const phase: GamePhase = match.note?.tags[0]?.phase ?? 'mid'
  const [body, setBody] = useState(match.note?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const matchupNote = useMemo(() => {
    const enemies = enemyChampionIds(match)
    const context = expectedMatchupContext(match)
    return matchups.find(
      (m) =>
        m.your_champion_id === match.champion_id &&
        enemies.includes(m.enemy_champion_id) &&
        (context == null || m.role === context.role),
    )
  }, [matchups, match])

  async function persist() {
    setSaving(true)
    try {
      if (selectedTags.length === 0) {
        await deleteNote(match.match_id)
        onNoteChange(null)
      } else {
        const note = await upsertNote(match.match_id, {
          body: body.trim() || null,
          tags: selectedTags.map((tag_key) => ({ tag_key, phase, timestamp_seconds: null })),
        })
        onNoteChange(note)
      }
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSelectedTags([])
    setBody('')
    setSaving(true)
    try {
      await deleteNote(match.match_id)
      onNoteChange(null)
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 bg-panel px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <div className="text-xs font-bold text-text-primary">Game review</div>
        <div className="text-[11px] text-text-secondary-5">{match.win ? 'Victory' : 'Defeat'}</div>
        <div className="flex-1" />
        <div className="text-[11px] text-text-muted">
          {savedAt && !saving ? 'Saved' : match.note ? 'Saved' : 'Not saved yet'}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <TagPicker taxonomy={taxonomy} selected={selectedTags} onChange={setSelectedTags} />
          <div className="mt-0.5 text-[11px] text-text-muted">Tags roll up into your Review page</div>
        </div>

        <div className="flex flex-[1.4] flex-col gap-1.5">
          <div className="text-[11px] text-text-secondary">Note</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Died on the 8-minute wave pushing without vision. Ward the river before the 3rd wave crashes."
            className="resize-none rounded-card border border-chip-border bg-inset px-2.5 py-2 text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={persist}
              disabled={saving}
              className="rounded-card bg-accent px-3 py-1.5 text-[11px] font-bold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={saving}
              className="rounded-card border border-chip-border px-2.5 py-1.5 text-[11px] text-text-secondary hover:border-text-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <div className="mt-1.5 flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-bold text-text-primary">Matchup notes</div>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => navigate(`/matchups?importMatch=${match.match_id}`)}
                className="text-[11px] font-medium text-accent hover:opacity-80"
              >
                {matchupNote ? 'Edit matchup note →' : 'Add matchup notes →'}
              </button>
            </div>
            {matchupNote ? (
              <MatchupSummaryRow
                matchup={matchupNote}
                championMap={championMap}
                taxonomy={matchupTaxonomy}
                weaknessTaxonomy={matchupWeaknessTaxonomy}
              />
            ) : (
              <p className="text-[11px] text-text-muted">No matchup notes for this game yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
