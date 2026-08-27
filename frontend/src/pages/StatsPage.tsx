import { useEffect, useMemo, useState } from 'react'
import {
  getChampionSummary,
  getRecentNotes,
  getTagChampionCounts,
  getTagCounts,
  getTagTaxonomy,
  getTrend,
} from '../api/client'
import type {
  ChampionSummary,
  RecentNoteItem,
  TagChampionCount,
  TagCountsResponse,
  TagTaxonomyEntry,
  TrendResponse,
} from '../api/types'
import { ChampionIcon } from '../components/ChampionIcon'
import { MistakePieChart } from '../components/MistakePieChart'
import { PageLoading } from '../components/PageLoading'
import { TrendChart } from '../components/TrendChart'
import { useChampionMap } from '../lib/ddragon'
import { formatRelativeTime } from '../lib/format'
import { getTagColor } from '../lib/tagColors'

export function StatsPage() {
  const [champions, setChampions] = useState<ChampionSummary[] | null>(null)
  const [taxonomy, setTaxonomy] = useState<TagTaxonomyEntry[]>([])
  const [championId, setChampionId] = useState<number | null>(null)
  const [stats, setStats] = useState<TagCountsResponse | null>(null)
  const [trend, setTrend] = useState<TrendResponse | null>(null)
  const [allNotes, setAllNotes] = useState<RecentNoteItem[]>([])
  const [tagChampions, setTagChampions] = useState<TagChampionCount[]>([])
  const championMap = useChampionMap()

  useEffect(() => {
    async function load() {
      const [champs, tax, trendData, notes, byChampion] = await Promise.all([
        getChampionSummary(),
        getTagTaxonomy(),
        getTrend(20),
        getRecentNotes(10),
        getTagChampionCounts(),
      ])
      setTaxonomy(tax)
      setTrend(trendData)
      setAllNotes(notes)
      setTagChampions(byChampion)
      setChampions(champs)
    }
    load()
  }, [])

  useEffect(() => {
    getTagCounts(championId).then(setStats)
  }, [championId])

  const championOptions = useMemo(
    () => (champions ?? []).map((c) => [c.champion_id, c.games] as const),
    [champions],
  )

  const tagChampionsForChart = useMemo(
    () => (championId == null ? tagChampions : tagChampions.filter((t) => t.champion_id === championId)),
    [tagChampions, championId],
  )
  const recentNotes = allNotes

  if (champions === null || championMap == null) {
    return <PageLoading />
  }

  if (champions.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <p className="text-sm text-text-secondary">Sync your matches first to see stats.</p>
      </div>
    )
  }

  const taggedInTrend = trend?.points.filter((p) => p.tags.length > 0).length ?? 0

  return (
    <div className="flex flex-col items-center py-6">
      <div className="flex w-[1012px] flex-col gap-3">
        <div className="flex items-baseline gap-2.5">
          <div className="text-xl font-bold text-text-headline">Review</div>
          <div className="text-xs text-text-secondary">
            Last {trend?.points.length ?? 0} ranked games · {taggedInTrend} with notes
          </div>
          <div className="flex-1" />
          <select
            value={championId ?? ''}
            onChange={(e) => setChampionId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-card border border-chip-border bg-inset px-2.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="">All champions</option>
            {championOptions.map(([id, count]) => (
              <option key={id} value={id}>
                {championMap?.get(id)?.name ?? id} ({count})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4 rounded-card border border-card-border bg-card p-4.5">
          <div className="flex flex-1 flex-col gap-3.5">
            <div className="text-xs text-text-secondary">Top recurring mistakes</div>
            {stats && (
              <MistakePieChart
                tagCounts={stats.tag_counts}
                taxonomy={taxonomy}
                tagChampions={tagChampionsForChart}
                championMap={championMap}
              />
            )}
          </div>

          <div className="w-px self-stretch bg-header-border" />

          <div className="flex w-[420px] shrink-0 flex-col gap-3.5">
            <div className="flex items-baseline justify-between">
              <div className="text-xs text-text-secondary">Trend over last {trend?.points.length ?? 0} games</div>
              <div className="text-[11px] text-text-secondary-5">oldest → newest</div>
            </div>
            <TrendChart points={trend?.points ?? []} taxonomy={taxonomy} />
            {trend && (
              <div className="flex gap-6 border-t border-header-border pt-3">
                <div className="flex flex-col gap-0.5">
                  <div className="text-[11px] text-text-secondary">Tagged games, last 10</div>
                  <div className="text-lg font-bold text-text-primary">
                    {trend.tagged_games_last10}{' '}
                    <span className="text-[11px] font-normal text-text-secondary-5">
                      {trend.tagged_games_last10 === trend.tagged_games_prev10
                        ? ''
                        : trend.tagged_games_last10 > trend.tagged_games_prev10
                          ? `↑ from ${trend.tagged_games_prev10}`
                          : `↓ from ${trend.tagged_games_prev10}`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[11px] text-text-secondary">Win rate in noted games</div>
                  <div className="text-lg font-bold text-text-primary">
                    {trend.win_rate_in_noted_games_pct != null ? `${trend.win_rate_in_noted_games_pct}%` : '-'}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[11px] text-text-secondary">Clean games streak</div>
                  <div className="text-lg font-bold text-text-primary">{trend.clean_games_streak}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-card border border-card-border bg-card">
          <div className="border-b border-header-border px-4.5 py-3.5 text-xs text-text-secondary">
            Recent notes
          </div>
          {recentNotes.length === 0 ? (
            <div className="px-4.5 py-6 text-xs text-text-secondary">No tagged games yet.</div>
          ) : (
            recentNotes.map((n) => (
              <div
                key={n.match_id}
                className="flex items-start gap-3.5 border-b border-divider px-4.5 py-3.5 last:border-b-0"
              >
                <ChampionIcon championId={n.champion_id} championMap={championMap} size={34} />
                <div className="flex w-30 flex-col gap-0.5">
                  <div className="text-xs text-text-primary">{championMap?.get(n.champion_id)?.name ?? '...'}</div>
                  <div
                    className="text-[11px]"
                    style={{ color: n.win ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}
                  >
                    {n.win ? 'Victory' : 'Defeat'} · {formatRelativeTime(n.game_creation)}
                  </div>
                </div>
                <div className="flex w-56 flex-wrap gap-1.5">
                  {n.tags.map((t) => (
                    <div
                      key={t.tag_key}
                      className="whitespace-nowrap rounded-card px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: getTagColor(t.tag_key) }}
                    >
                      {taxonomy.find((tx) => tx.tag_key === t.tag_key)?.label ?? t.tag_key}
                    </div>
                  ))}
                </div>
                <div className="flex-1 text-xs leading-relaxed text-text-secondary-4">
                  {n.body?.trim() || 'No written note, tags only.'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
