import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getMatch, getMatchupTagTaxonomy, getMatchupWeaknessTaxonomy, listMatchups } from '../api/client'
import type { MatchListItem, MatchupOut, MatchupTagTaxonomyEntry, MatchupWeaknessTaxonomyEntry } from '../api/types'
import { ChampionSelect } from '../components/ChampionSelect'
import { MatchupCard } from '../components/MatchupCard'
import { MatchupBuilder } from '../components/MatchupBuilder'
import { PageLoading } from '../components/PageLoading'
import { QuickPreview } from '../components/QuickPreview'
import { useChampionMap, useItemMap, useRuneMaps } from '../lib/ddragon'

type FilterSide = 'either' | 'you' | 'enemy'

const FILTER_SIDES: { side: FilterSide; label: string }[] = [
  { side: 'either', label: 'Either side' },
  { side: 'you', label: 'You' },
  { side: 'enemy', label: 'Enemy' },
]

export function MatchupsPage() {
  const [matchups, setMatchups] = useState<MatchupOut[] | null>(null)
  const [taxonomy, setTaxonomy] = useState<MatchupTagTaxonomyEntry[]>([])
  const [weaknessTaxonomy, setWeaknessTaxonomy] = useState<MatchupWeaknessTaxonomyEntry[]>([])
  const [filterChampionId, setFilterChampionId] = useState<number | null>(null)
  const [filterSide, setFilterSide] = useState<FilterSide>('either')
  const [importedMatch, setImportedMatch] = useState<MatchListItem | null>(null)
  const championMap = useChampionMap()
  const itemMap = useItemMap()
  const runeMaps = useRuneMaps()
  const [searchParams, setSearchParams] = useSearchParams()
  const savedRef = useRef<HTMLDivElement>(null)
  const [scrollToSaved, setScrollToSaved] = useState(false)

  useEffect(() => {
    listMatchups().then(setMatchups)
    getMatchupTagTaxonomy().then(setTaxonomy)
    getMatchupWeaknessTaxonomy().then(setWeaknessTaxonomy)
  }, [])

  useEffect(() => {
    const matchId = searchParams.get('importMatch')
    if (!matchId) return
    getMatch(matchId)
      .then(setImportedMatch)
      .catch(() => undefined)
    const next = new URLSearchParams(searchParams)
    next.delete('importMatch')
    setSearchParams(next, { replace: true })
  }, [])

  useEffect(() => {
    const championId = searchParams.get('champion')
    if (!championId) return
    setFilterChampionId(Number(championId))
    setFilterSide('either')
    setScrollToSaved(true)
    const next = new URLSearchParams(searchParams)
    next.delete('champion')
    setSearchParams(next, { replace: true })
  }, [])

  useEffect(() => {
    if (!scrollToSaved || matchups === null || championMap == null) return
    savedRef.current?.scrollIntoView({ block: 'start' })
    setScrollToSaved(false)
  }, [scrollToSaved, matchups, championMap])

  const visible = useMemo(() => {
    return (matchups ?? []).filter((m) => {
      if (filterChampionId == null) return true
      if (filterSide === 'you') return m.your_champion_id === filterChampionId
      if (filterSide === 'enemy') return m.enemy_champion_id === filterChampionId
      return m.your_champion_id === filterChampionId || m.enemy_champion_id === filterChampionId
    })
  }, [matchups, filterChampionId, filterSide])

  function upsertMatchup(matchup: MatchupOut) {
    setMatchups((prev) => {
      if (!prev) return [matchup]
      const exists = prev.some((m) => m.id === matchup.id)
      return exists ? prev.map((m) => (m.id === matchup.id ? matchup : m)) : [matchup, ...prev]
    })
  }

  function handleDelete(id: number) {
    setMatchups((prev) => prev?.filter((m) => m.id !== id) ?? prev)
  }

  if (matchups === null || championMap == null || itemMap == null || runeMaps == null) {
    return <PageLoading />
  }

  return (
    <div className="flex flex-col items-center py-6">
      <div className="flex w-[1012px] flex-col gap-3">
        <div className="flex items-baseline gap-2.5">
          <div className="text-xl font-bold text-text-headline">Matchups</div>
        </div>

        <QuickPreview
          championMap={championMap}
          runeMaps={runeMaps}
          matchups={matchups ?? []}
          taxonomy={taxonomy}
          weaknessTaxonomy={weaknessTaxonomy}
        />

        <MatchupBuilder
          championMap={championMap}
          itemMap={itemMap}
          runeMaps={runeMaps}
          taxonomy={taxonomy}
          weaknessTaxonomy={weaknessTaxonomy}
          matchups={matchups ?? []}
          onSaved={upsertMatchup}
          importedMatch={importedMatch}
          onImportConsumed={() => setImportedMatch(null)}
        />

        <div ref={savedRef} className="flex flex-col gap-3 rounded-card border border-card-border bg-card p-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-text-primary">Saved matchups</span>
            <div className="flex-1" />
            <span className="text-[11px] text-text-secondary">Filter by champion</span>
            <div className="w-52">
              <ChampionSelect
                championMap={championMap}
                value={filterChampionId}
                onChange={setFilterChampionId}
                onClear={() => setFilterChampionId(null)}
                placeholder="All champions"
              />
            </div>
            <div className="flex gap-1">
              {FILTER_SIDES.map((f) => (
                <button
                  key={f.side}
                  type="button"
                  onClick={() => setFilterSide(f.side)}
                  className={`rounded-card border px-2 py-1 text-[11px] font-bold transition-colors ${
                    filterSide === f.side
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-chip-border text-text-secondary hover:border-text-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-secondary">
              {filterChampionId != null
                ? `No matchups found for ${championMap?.get(filterChampionId)?.name ?? 'that champion'}.`
                : 'No saved matchups yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {visible.map((matchup) => (
                <MatchupCard
                  key={matchup.id}
                  matchup={matchup}
                  championMap={championMap}
                  itemMap={itemMap}
                  runeMaps={runeMaps}
                  taxonomy={taxonomy}
                  weaknessTaxonomy={weaknessTaxonomy}
                  onUpdate={upsertMatchup}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
