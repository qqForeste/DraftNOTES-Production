import { useState } from 'react'
import type {
  MatchListItem,
  MatchupOut,
  MatchupTagTaxonomyEntry,
  MatchupWeaknessTaxonomyEntry,
  NoteOut,
  TagTaxonomyEntry,
} from '../api/types'
import type { ChampionInfo, RuneMaps, SummonerSpellInfo } from '../lib/ddragon'
import { formatDuration, formatKda, formatRelativeTime } from '../lib/format'
import { getQueueLabel } from '../lib/queue'
import { getTagColor } from '../lib/tagColors'
import { ClickableChampionIcon } from './ClickableChampionIcon'
import { DescriptionLines, HoverCard } from './HoverCard'
import { InlineNoteEditor } from './InlineNoteEditor'
import { ItemSlot } from './ItemSlot'
import { MatchAnalysisTab } from './MatchAnalysisTab'
import { NoteIcon } from './NoteIcon'
import { PlayerHoverName } from './PlayerHoverName'
import { platformFromMatchId } from '../lib/platforms'
import { RoleQuestBadge } from './RoleQuestBadge'

interface Props {
  match: MatchListItem
  championMap: Map<number, ChampionInfo> | null
  spellMap: Map<number, SummonerSpellInfo> | null
  runeMaps: RuneMaps | null
  taxonomy: TagTaxonomyEntry[]
  matchups: MatchupOut[]
  matchupTaxonomy: MatchupTagTaxonomyEntry[]
  matchupWeaknessTaxonomy: MatchupWeaknessTaxonomyEntry[]
  expanded: boolean
  flash?: boolean
  readOnly?: boolean
  onToggleExpand: () => void
  onNoteChange: (note: NoteOut | null) => void
}

const ITEM_SLOTS = 7

function killBadge(m: MatchListItem): { label: string; color: string } | null {
  if (m.penta_kills > 0) return { label: 'Pentakill', color: '#8c51c5' }
  if (m.quadra_kills > 0) return { label: 'Quadra Kill', color: '#8c51c5' }
  if (m.triple_kills > 0) return { label: 'Triple Kill', color: '#ec4f48' }
  if (m.double_kills > 0) return { label: 'Double Kill', color: '#ec4f48' }
  return null
}

export function MatchRow({
  match,
  championMap,
  spellMap,
  runeMaps,
  taxonomy,
  matchups,
  matchupTaxonomy,
  matchupWeaknessTaxonomy,
  expanded,
  flash = false,
  readOnly = false,
  onToggleExpand,
  onNoteChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'notes'>('analysis')
  const badge = killBadge(match)
  const hasNote = !!match.note && (!!match.note.body?.trim() || match.note.tags.length > 0)
  const items = match.items.length > 0 ? match.items : Array(ITEM_SLOTS).fill(0)

  const allyNames = match.scoreboard.filter((p) => p.team_id === match.scoreboard[0]?.team_id)
  const enemyNames = match.scoreboard.filter((p) => p.team_id !== match.scoreboard[0]?.team_id)

  return (
    <div
      id={`match-${match.match_id}`}
      className="overflow-hidden rounded-card border transition-shadow"
      style={{
        borderColor: flash
          ? 'var(--color-accent)'
          : match.win
            ? 'var(--color-win-border)'
            : 'var(--color-loss-border)',
        background: match.win ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
        boxShadow: flash ? '0 0 0 2px var(--color-accent)' : undefined,
      }}
    >
      <div className="flex">
        <div className="min-w-0 flex-1">
          <div className="flex h-[100px] items-center gap-1 py-3 pl-2">
          {}
          <div className="flex w-[70px] shrink-0 flex-col items-center text-center text-[11px] text-text-secondary-4">
            <div className="mb-0.5 font-bold">{getQueueLabel(match.queue_id)}</div>
            <div className="text-text-secondary">{formatRelativeTime(match.game_creation)}</div>
            <div className="my-1.5 w-2/5 border-b border-white/10" />
            <div
              className="mb-0.5 font-bold"
              style={{ color: match.win ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}
            >
              {match.win ? 'Victory' : 'Defeat'}
            </div>
            <div className="text-text-secondary">{formatDuration(match.game_duration)}</div>
          </div>

          {}
          <div className="relative flex w-[96px] shrink-0 flex-col items-center justify-center">
            <div className="flex h-[46px] items-center gap-1">
              <ClickableChampionIcon championId={match.champion_id} championMap={championMap} size={46} />
              <div className="flex flex-col gap-0.5">
                {[match.summoner_1_id, match.summoner_2_id].map((spellId, i) => {
                  const spell = spellId ? spellMap?.get(spellId) : undefined
                  return spell ? (
                    <HoverCard
                      key={i}
                      content={
                        <>
                          <div className="mb-1 font-bold text-text-primary">{spell.name}</div>
                          {spell.description && <DescriptionLines text={spell.description} />}
                        </>
                      }
                    >
                      <img src={spell.iconUrl} alt="" className="w-5 rounded-sm" />
                    </HoverCard>
                  ) : (
                    <div key={i} className="h-5 w-5 rounded-sm bg-black/25" />
                  )
                })}
              </div>
              <div className="flex flex-col gap-0.5">
                {match.primary_rune_id && runeMaps?.keystones.get(match.primary_rune_id) ? (
                  <HoverCard
                    content={
                      <>
                        <div className="mb-1 font-bold text-text-primary">
                          {runeMaps.keystones.get(match.primary_rune_id)!.name}
                        </div>
                        <DescriptionLines text={runeMaps.keystones.get(match.primary_rune_id)!.description} />
                      </>
                    }
                  >
                    <img src={runeMaps.keystones.get(match.primary_rune_id)!.iconUrl} alt="" className="w-5" />
                  </HoverCard>
                ) : (
                  <div className="h-5 w-5 rounded-full bg-black/25" />
                )}
                {match.secondary_style_id && runeMaps?.styles.get(match.secondary_style_id) ? (
                  <HoverCard
                    content={
                      <div className="font-bold text-text-primary">
                        {runeMaps.styles.get(match.secondary_style_id)!.name}
                      </div>
                    }
                  >
                    <img
                      src={runeMaps.styles.get(match.secondary_style_id)!.iconUrl}
                      alt=""
                      className="w-5 rounded-full bg-black/20 p-0.5"
                    />
                  </HoverCard>
                ) : (
                  <div className="h-5 w-5 rounded-full bg-black/25" />
                )}
              </div>
            </div>
          </div>

          {}
          <div className="flex w-[86px] shrink-0 flex-col items-center justify-center gap-1">
            <div className="text-[15px] font-bold text-text-secondary">
              <span className="text-text-primary">{match.kills}</span> /{' '}
              <span className="text-loss">{match.deaths}</span> /{' '}
              <span className="text-text-primary">{match.assists}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="whitespace-nowrap text-[11px] font-bold text-text-secondary-3">
                {formatKda(match.kills, match.deaths, match.assists)} KDA
              </div>
              {badge && (
                <div
                  className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                  style={{ background: badge.color }}
                >
                  {badge.label}
                </div>
              )}
            </div>
          </div>

          {}
          <div className="relative flex w-[76px] shrink-0 flex-col items-center justify-center text-[11px] text-text-secondary-4">
            <div>{match.cs} CS</div>
            {match.champion_level != null && (
              <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap">
                Level {match.champion_level}
              </div>
            )}
            {match.kill_participation_pct != null && (
              <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-loss">
                P/Kill {match.kill_participation_pct}%
              </div>
            )}
          </div>

          {}
          <div className="relative flex w-[116px] shrink-0 flex-col items-center justify-center">
            <div className="flex items-center gap-1">
              <div className="grid grid-cols-3 grid-rows-2 gap-[3px]">
                {items.slice(0, 6).map((itemId, i) => (
                  <ItemSlot key={i} itemId={itemId} />
                ))}
              </div>
              <ItemSlot itemId={items[6] ?? 0} />
              <RoleQuestBadge itemId={match.role_quest_item_id} />
            </div>
          </div>

          {}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-1.5">
            {[allyNames, enemyNames].map((team, i) => (
              <div key={i} className="grid min-w-0 grid-rows-5">
                {team.map((p, j) => (
                  <div key={j} className="flex min-w-0 items-center gap-1">
                    <ClickableChampionIcon championId={p.champion_id} championMap={championMap} size={14} rounded={false} />
                    <PlayerHoverName
                      gameName={p.game_name}
                      tagLine={p.tag_line}
                      platform={platformFromMatchId(match.match_id)}
                      isSelf={p.is_self}
                      className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] hover:text-text-primary"
                      style={{ color: p.is_self ? 'var(--color-text-primary)' : 'var(--color-text-secondary-2)' }}
                    >
                      {p.game_name}
                    </PlayerHoverName>
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>

          {!expanded && hasNote && (
            <div className="flex w-full items-center gap-1.5 overflow-hidden border-t border-white/10 bg-black/20 px-3 py-1">
              {match.note!.tags.map((t) => (
                <span
                  key={t.tag_key}
                  className="shrink-0 whitespace-nowrap rounded-card px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: getTagColor(t.tag_key) }}
                >
                  {taxonomy.find((tx) => tx.tag_key === t.tag_key)?.label ?? t.tag_key}
                </span>
              ))}
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-text-secondary-6">
                {match.note!.body?.trim() || 'Tagged, no note written yet'}
              </span>
            </div>
          )}

          <div className="grid" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
            <div className="overflow-hidden bg-card">
              {readOnly ? (
                <div className="border-t border-card-border">
                  <MatchAnalysisTab match={match} championMap={championMap} spellMap={spellMap} runeMaps={runeMaps} />
                </div>
              ) : (
                <>
                  <div className="flex gap-1 border-t border-card-border px-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('analysis')}
                      className={`cursor-pointer rounded-t-sm px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        activeTab === 'analysis'
                          ? 'bg-white/10 text-text-primary'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Match Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('notes')}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-t-sm border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        activeTab === 'notes'
                          ? 'border-accent/40 bg-accent/20 text-accent'
                          : 'border-accent/20 bg-accent/[0.08] text-accent hover:bg-accent/15'
                      }`}
                    >
                      <NoteIcon size={13} color="var(--color-accent)" />
                      Notes
                      {hasNote && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </button>
                  </div>
                  {activeTab === 'analysis' ? (
                    <MatchAnalysisTab match={match} championMap={championMap} spellMap={spellMap} runeMaps={runeMaps} />
                  ) : (
                    <InlineNoteEditor
                      match={match}
                      taxonomy={taxonomy}
                      matchups={matchups}
                      matchupTaxonomy={matchupTaxonomy}
                      matchupWeaknessTaxonomy={matchupWeaknessTaxonomy}
                      championMap={championMap}
                      onNoteChange={onNoteChange}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {}
        <button
          type="button"
          onClick={onToggleExpand}
          title={expanded ? 'Close' : readOnly ? 'View match analysis' : hasNote ? 'View note' : 'Add a note'}
          className={`group flex w-11 shrink-0 cursor-pointer items-center justify-center border-l border-white/10 transition-colors ${
            hasNote ? 'bg-accent/[0.14] hover:bg-accent/25' : 'bg-transparent hover:bg-white/10'
          }`}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 16 16"
            className="transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
            aria-hidden="true"
          >
            <path
              d="M4 6.5 8 10.5 12 6.5"
              fill="none"
              stroke={hasNote ? 'var(--color-accent)' : 'var(--color-text-secondary-5)'}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
