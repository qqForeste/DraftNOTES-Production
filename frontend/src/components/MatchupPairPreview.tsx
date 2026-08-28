import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MatchupOut, MatchupRole, MatchupTagTaxonomyEntry, MatchupWeaknessTaxonomyEntry } from '../api/types'
import type { ChampionInfo, RuneMaps } from '../lib/ddragon'
import { championWinRate, topCounters } from '../lib/matchupStats'
import { useMatchupRecommendation } from '../lib/recommendation'
import { normalizeRunePage, normalizeSkillOrder } from '../lib/runes'
import { ChampionIcon } from './ChampionIcon'
import { EstimateNote, EstimatedBadge } from './EstimateNote'
import { ChampionSelect } from './ChampionSelect'
import { LoadoutView } from './LoadoutView'
import { MatchupSummaryRow } from './MatchupSummaryRow'
import { RecommendedLoadout } from './RecommendedLoadout'

function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-bold text-text-secondary">{children}</span>
}

interface Props {
  role: MatchupRole
  topId: number | null
  bottomId: number | null
  onTopChange: (id: number | null) => void
  onBottomChange: (id: number | null) => void
  topLabel: string
  bottomLabel: string
  topPlaceholder: string
  bottomPlaceholder: string
  emptyHint: string
  championMap: Map<number, ChampionInfo> | null
  runeMaps: RuneMaps | null
  matchups: MatchupOut[]
  taxonomy: MatchupTagTaxonomyEntry[]
  weaknessTaxonomy: MatchupWeaknessTaxonomyEntry[]
}

export function MatchupPairPreview({
  role,
  topId,
  bottomId,
  onTopChange,
  onBottomChange,
  topLabel,
  bottomLabel,
  topPlaceholder,
  bottomPlaceholder,
  emptyHint,
  championMap,
  runeMaps,
  matchups,
  taxonomy,
  weaknessTaxonomy,
}: Props) {
  const [spins, setSpins] = useState(0)
  const [swapping, setSwapping] = useState(false)
  const [selectedGuideId, setSelectedGuideId] = useState<number | null>(null)
  const [manualViewMode, setManualViewMode] = useState<'recommended' | 'guide' | null>(null)

  useEffect(() => {
    setManualViewMode(null)
  }, [topId, bottomId])

  const championIds = useMemo(() => [...(championMap?.keys() ?? [])], [championMap])

  function swapSides() {
    const top = topId
    onTopChange(bottomId)
    onBottomChange(top)
    setSpins((n) => n + 1)
    setSwapping(true)
    setTimeout(() => setSwapping(false), 220)
  }

  function clear() {
    onTopChange(null)
    onBottomChange(null)
  }

  const anchorId = topId == null ? bottomId : null
  const suggestions = useMemo(() => {
    if (anchorId == null) return []
    return topCounters(anchorId, championIds, 6)
  }, [anchorId, championIds])

  const preview =
    topId != null && bottomId != null
      ? { winRatePct: championWinRate(topId, bottomId) }
      : null

  const recommendation = useMatchupRecommendation(topId, bottomId)

  const guides = useMemo(() => {
    const relevant = matchups.filter((m) => m.role === role)

    if (topId != null && bottomId != null) {
      return relevant.filter((m) => m.your_champion_id === topId && m.enemy_champion_id === bottomId)
    }

    const anchor = topId ?? bottomId
    if (anchor == null) return []
    return relevant
      .filter((m) => m.your_champion_id === anchor || m.enemy_champion_id === anchor)
      .map((m) => {
        const other = m.your_champion_id === anchor ? m.enemy_champion_id : m.your_champion_id
        return { m, score: championWinRate(anchor, other) }
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.m)
  }, [matchups, topId, bottomId, role])

  const selectedGuide = selectedGuideId != null ? (guides.find((m) => m.id === selectedGuideId) ?? null) : null
  const autoGuide = guides.length === 1 && topId != null && bottomId != null ? guides[0] : null
  const activeGuide = selectedGuide ?? autoGuide

  const hasRecommended = recommendation != null && topId != null
  const hasGuide = activeGuide != null
  const viewMode: 'recommended' | 'guide' =
    hasGuide && hasRecommended ? (manualViewMode ?? 'guide') : hasGuide ? 'guide' : 'recommended'

  function selectGuide(m: MatchupOut) {
    if (topId == null || bottomId == null) {
      const anchor = topId ?? bottomId
      const other = m.your_champion_id === anchor ? m.enemy_champion_id : m.your_champion_id
      if (topId == null) onTopChange(other)
      else onBottomChange(other)
    }
    setSelectedGuideId(m.id)
    setManualViewMode('guide')
  }

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex w-[288px] shrink-0 flex-col gap-2">
        <div
          className="flex flex-col gap-2 rounded-card border border-accent/30 bg-accent/10 p-3 transition-transform duration-200 ease-out"
          style={swapping ? { transform: 'translateY(6px) scale(0.98)' } : undefined}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold text-accent">{topLabel}</span>
            {(topId != null || bottomId != null) && (
              <button
                type="button"
                onClick={clear}
                className="text-[10px] text-text-secondary hover:text-text-primary"
              >
                Clear
              </button>
            )}
          </div>
          <ChampionSelect
            championMap={championMap}
            value={topId}
            onChange={onTopChange}
            onClear={() => onTopChange(null)}
            placeholder={topPlaceholder}
            disabledIds={bottomId != null ? [bottomId] : []}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-chip-border" />
          <button
            type="button"
            onClick={swapSides}
            title="Swap sides"
            aria-label="Swap sides"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-chip-border bg-inset text-text-secondary transition-colors hover:border-accent hover:bg-accent/15 hover:text-accent active:scale-90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: `rotate(${spins * 180}deg)`, transition: 'transform 300ms ease' }}
            >
              <path d="M5.5 2.5v9M2.5 8.5l3 3 3-3" />
              <path d="M10.5 13.5v-9M13.5 7.5l-3-3-3 3" />
            </svg>
          </button>
          <span className="text-[10px] font-bold text-text-muted">VS</span>
          <div className="h-px flex-1 bg-chip-border" />
        </div>

        <div
          className="flex flex-col gap-2 rounded-card border border-loss/30 bg-loss/10 p-3 transition-transform duration-200 ease-out"
          style={swapping ? { transform: 'translateY(-6px) scale(0.98)' } : undefined}
        >
          <span className="text-[11px] font-bold text-loss">{bottomLabel}</span>
          <ChampionSelect
            championMap={championMap}
            value={bottomId}
            onChange={onBottomChange}
            onClear={() => onBottomChange(null)}
            placeholder={bottomPlaceholder}
            disabledIds={topId != null ? [topId] : []}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 rounded-card border border-chip-border bg-inset p-3">
        {topId == null && bottomId == null ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-[11px] text-text-muted">{emptyHint}</p>
          </div>
        ) : (
          <>
            {preview && (
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold text-text-primary">{preview.winRatePct}%</span>
                  <span className="text-[11px] text-text-secondary">projected win rate for you</span>
                  <EstimatedBadge />
                </div>
                <EstimateNote>Generated from the champion pairing, not from played games</EstimateNote>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <SectionLabel>Suggested picks against {championMap?.get(anchorId!)?.name}</SectionLabel>
                  <EstimatedBadge />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s.championId}
                      type="button"
                      onClick={() => onTopChange(s.championId)}
                      className="flex items-center gap-1.5 rounded-card border border-chip-border px-1.5 py-1 hover:border-accent/50 hover:bg-accent/10"
                    >
                      <ChampionIcon championId={s.championId} championMap={championMap} size={20} />
                      <span className="text-[11px] text-text-primary">{championMap?.get(s.championId)?.name}</span>
                      <span className="text-[11px] font-bold text-accent">{s.winRatePct}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(hasRecommended || hasGuide) && (
              <div className="flex flex-col gap-1.5">
                {hasRecommended && hasGuide && (
                  <div className="flex gap-1">
                    {(['recommended', 'guide'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setManualViewMode(m)}
                        className={`rounded-card border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                          viewMode === m
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-chip-border text-text-secondary hover:border-text-muted'
                        }`}
                      >
                        {m === 'recommended' ? 'Recommended' : 'Your guide'}
                      </button>
                    ))}
                  </div>
                )}

                {viewMode === 'recommended' && hasRecommended && (
                  <RecommendedLoadout
                    recommendation={recommendation!}
                    championId={topId!}
                    championMap={championMap}
                    runeMaps={runeMaps}
                  />
                )}

                {viewMode === 'guide' && activeGuide && (
                  <LoadoutView
                    title={`Your guide for ${championMap?.get(activeGuide.your_champion_id)?.name ?? 'this champion'}`}
                    championId={activeGuide.your_champion_id}
                    runeMaps={runeMaps}
                    coreItemIds={activeGuide.core_item_ids}
                    bootItemId={activeGuide.boot_item_id}
                    optionalBootItemId={activeGuide.optional_boot_item_id}
                    situationalItemIds={activeGuide.optional_item_ids}
                    runes={normalizeRunePage(activeGuide.runes)}
                    skillOrder={normalizeSkillOrder(activeGuide.skill_order)}
                  />
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <SectionLabel>Guides{guides.length > 0 ? ` · ${guides.length} saved` : ''}</SectionLabel>
              {guides.length === 0 ? (
                <p className="text-[11px] text-text-muted">No guide saved yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {guides.map((m) => (
                    <MatchupSummaryRow
                      key={m.id}
                      matchup={m}
                      championMap={championMap}
                      taxonomy={taxonomy}
                      weaknessTaxonomy={weaknessTaxonomy}
                      selected={activeGuide?.id === m.id}
                      onClick={() => selectGuide(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
