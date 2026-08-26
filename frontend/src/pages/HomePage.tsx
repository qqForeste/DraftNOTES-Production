import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ApiError,
  getChampionSummary,
  getCurrentSummoner,
  getMatchupTagTaxonomy,
  getMatchupWeaknessTaxonomy,
  getPositionSummary,
  getSummoner,
  getTagTaxonomy,
  listMatches,
  getLpHistory,
  listMatchups,
  startLookupResolve,
  startLookupSync,
  startOlderMatchesSync,
  startSync,
} from '../api/client'
import {
  SyncTimeoutError,
  describeJobError,
  waitForLookupResolve,
  waitForLookupSync,
  waitForOlderMatchesSync,
  waitForSync,
} from '../api/sync'
import type {
  ChampionSummary,
  LpHistoryResponse,
  MatchListItem,
  MatchupOut,
  MatchupTagTaxonomyEntry,
  MatchupWeaknessTaxonomyEntry,
  MistakeTag,
  NoteOut,
  PositionSummary,
  SummonerOut,
  TagCount,
  TagTaxonomyEntry,
} from '../api/types'
import { ChampionWinRateTable } from '../components/ChampionWinRateTable'
import { DonutChart } from '../components/DonutChart'
import { LpTrendChart } from '../components/LpTrendChart'
import { MatchRow } from '../components/MatchRow'
import { PositionBarChart } from '../components/PositionBarChart'
import { RankProgress } from '../components/RankProgress'
import { PositionSummaryList } from '../components/PositionSummaryList'
import { RankCard } from '../components/RankCard'
import { RiotIdForm } from '../components/RiotIdForm'
import { TagProgressList } from '../components/TagProgressList'
import { useAuth } from '../auth/useAuth'
import { PageLoading } from '../components/PageLoading'
import { useChampionMap, useProfileIconUrl, useRuneMaps, useSummonerSpellMap } from '../lib/ddragon'
import { formatKda } from '../lib/format'
import { getCachedPuuid, setCachedPuuid } from '../lib/lookupCache'
import { DEFAULT_PLATFORM } from '../lib/platforms'
import { getQueueLabel } from '../lib/queue'

const QUEUE_TABS = ['Total', 'Ranked Solo', 'Ranked Flex'] as const
type QueueTab = (typeof QUEUE_TABS)[number]

export function HomePage() {
  const [summoner, setSummoner] = useState<SummonerOut | null | undefined>(undefined)
  const [matches, setMatches] = useState<MatchListItem[] | null>(null)
  const [taxonomy, setTaxonomy] = useState<TagTaxonomyEntry[]>([])
  const [championSummaries, setChampionSummaries] = useState<ChampionSummary[]>([])
  const [positionSummaries, setPositionSummaries] = useState<PositionSummary[]>([])
  const [lpHistory, setLpHistory] = useState<LpHistoryResponse | null>(null)
  const [matchups, setMatchups] = useState<MatchupOut[]>([])
  const [matchupTaxonomy, setMatchupTaxonomy] = useState<MatchupTagTaxonomyEntry[]>([])
  const [matchupWeaknessTaxonomy, setMatchupWeaknessTaxonomy] = useState<MatchupWeaknessTaxonomyEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [ready, setReady] = useState(false)
  const [matchesReady, setMatchesReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [queueTab, setQueueTab] = useState<QueueTab>('Total')
  const [onlyTagged, setOnlyTagged] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'champions' | 'tags'>('champions')
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null)
  const [flashMatchId, setFlashMatchId] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const { me } = useAuth()
  const isDemo = me?.provider === 'demo'
  const viewName = searchParams.get('name')
  const viewTag = searchParams.get('tag')
  const viewPlatform = searchParams.get('platform')
  const isViewingOther = viewName != null && viewTag != null && viewPlatform != null
  const viewKey = isViewingOther ? `${viewPlatform}:${viewName.toLowerCase()}#${viewTag.toLowerCase()}` : null
  const [resolvedPuuid, setResolvedPuuid] = useState<string | null>(null)
  const [refreshingViewed, setRefreshingViewed] = useState(false)
  const [awaitingMatches, setAwaitingMatches] = useState(false)
  const [historyExhausted, setHistoryExhausted] = useState(false)
  const latestRequestRef = useRef<string | null>(null)
  const championMap = useChampionMap()
  const spellMap = useSummonerSpellMap()
  const runeMaps = useRuneMaps()
  const profileIconUrl = useProfileIconUrl(summoner?.profile_icon_id ?? null)

  function fetchInitialMatches(puuid: string | null | undefined, key: string | null) {
    listMatches(undefined, undefined, puuid ?? undefined)
      .then((firstPage) => {
        if (latestRequestRef.current !== key) return
        setMatches(firstPage?.items ?? null)
        setNextCursor(firstPage?.next_cursor ?? null)
        setMatchesReady(true)
      })
      .catch(() => {
        if (latestRequestRef.current === key) setMatchesReady(true)
      })
  }

  async function loadExisting() {
    latestRequestRef.current = viewKey

    if (isViewingOther && viewName && viewTag && viewPlatform) {
      setResolvedPuuid(null)
      setMatchesReady(false)
      const puuid = await resolveViewTarget(viewName, viewTag, viewPlatform)
      if (latestRequestRef.current !== viewKey) return
      if (puuid == null) {
        setSummoner(null)
        setMatches(null)
        setReady(true)
        setMatchesReady(true)
        return
      }
      setResolvedPuuid(puuid)
      syncViewedAccount(viewName, viewTag, viewPlatform, puuid, viewKey)

      const currentSummoner = await fetchSummonerWithRetry(puuid)
      if (latestRequestRef.current !== viewKey) return
      setSummoner(currentSummoner)
      if (currentSummoner) {
        fetchInitialMatches(puuid, viewKey)
        const [champs, positions, lp] = await Promise.all([
          getChampionSummary(puuid),
          getPositionSummary(puuid),
          getLpHistory('solo', puuid),
        ])
        if (latestRequestRef.current !== viewKey) return
        setLpHistory(lp)
        setChampionSummaries(champs)
        setPositionSummaries(positions)
        setMatchups([])
        setMatchupTaxonomy([])
        setMatchupWeaknessTaxonomy([])
      } else {
        setMatches(null)
        setNextCursor(null)
        setMatchesReady(true)
      }
      setReady(true)
      return
    }

    setResolvedPuuid(null)
    setMatchesReady(false)
    fetchInitialMatches(null, viewKey)
    const currentSummoner = await getCurrentSummoner()
    if (latestRequestRef.current !== viewKey) return
    setSummoner(currentSummoner)
    if (currentSummoner) {
      const [tax, champs, positions, matchupList, matchupTax, matchupWeaknessTax, lp] =
        await Promise.all([
          getTagTaxonomy(),
          getChampionSummary(),
          getPositionSummary(),
          listMatchups(),
          getMatchupTagTaxonomy(),
          getMatchupWeaknessTaxonomy(),
          getLpHistory('solo'),
        ])
      if (latestRequestRef.current !== viewKey) return
      setLpHistory(lp)
      setTaxonomy(tax)
      setChampionSummaries(champs)
      setPositionSummaries(positions)
      setMatchups(matchupList)
      setMatchupTaxonomy(matchupTax)
      setMatchupWeaknessTaxonomy(matchupWeaknessTax)
    }
    setReady(true)
  }

  useEffect(() => {
    setReady(false)
    setHistoryExhausted(false)
    loadExisting()
  }, [viewKey])

  async function syncViewedAccount(
    gameName: string,
    tagLine: string,
    platform: string,
    puuid: string,
    key: string | null,
  ) {
    setAwaitingMatches(true)
    try {
      try {
        const queued = await startLookupSync(gameName, tagLine, platform)
        await waitForLookupSync(queued.job_id)
      } catch {
        await waitForMatchesToStabilize(puuid, key)
      }
      if (latestRequestRef.current !== key) return
      const [updatedSummoner, page, champs, positions, lp] = await Promise.all([
        getSummoner(puuid),
        listMatches(undefined, undefined, puuid),
        getChampionSummary(puuid),
        getPositionSummary(puuid),
        getLpHistory('solo', puuid),
      ])
      if (latestRequestRef.current !== key) return
      if (updatedSummoner) setSummoner(updatedSummoner)
      setMatches(page?.items ?? null)
      setNextCursor(page?.next_cursor ?? null)
      setChampionSummaries(champs)
      setPositionSummaries(positions)
      setLpHistory(lp)
    } catch {
      void 0
    } finally {
      if (latestRequestRef.current === key) setAwaitingMatches(false)
    }
  }

  async function waitForMatchesToStabilize(puuid: string, key: string | null) {
    let lastCount = -1
    for (let attempt = 0; attempt < 10; attempt++) {
      if (latestRequestRef.current !== key) return
      await new Promise((resolve) => setTimeout(resolve, 3000))
      if (latestRequestRef.current !== key) return
      const page = await listMatches(undefined, undefined, puuid)
      const count = page?.items.length ?? 0
      if (count > 0 && count === lastCount) return
      lastCount = count
    }
  }

  useEffect(() => {
    const expand = searchParams.get('expand')
    if (expand) {
      setExpandedMatchId(expand)
      setPendingScrollId(expand)
      setQueueTab('Total')
      setOnlyTagged(false)
      const next = new URLSearchParams(searchParams)
      next.delete('expand')
      setSearchParams(next, { replace: true })
    }
  }, [])

  useEffect(() => {
    if (!ready || !pendingScrollId || !matches) return
    const row = document.getElementById(`match-${pendingScrollId}`)
    setPendingScrollId(null)
    if (!row) return
    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashMatchId(pendingScrollId)
    const timer = setTimeout(() => setFlashMatchId(null), 1600)
    return () => clearTimeout(timer)
  }, [ready, pendingScrollId, matches])

  useEffect(() => {
    if (!flashMatchId) return
    function handleOutsideClick(e: MouseEvent) {
      const row = document.getElementById(`match-${flashMatchId}`)
      if (row && !row.contains(e.target as Node)) setFlashMatchId(null)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [flashMatchId])

  async function handleSync(gameName: string, tagLine: string, platform: string) {
    setSyncing(true)
    setError(null)
    setSyncStatus(null)
    try {
      const queued = await startSync(gameName, tagLine, platform)
      if (queued.queue_position > 1) {
        setSyncStatus(`Queued, about ${queued.queue_position} ahead of you…`)
      }
      let job
      try {
        job = await waitForSync(queued.job_id, (j) => {
          if (j.status === 'in_progress') setSyncStatus('Fetching your matches…')
        })
      } catch (pollErr) {
        await loadExisting()
        setSyncStatus(null)
        setError(
          pollErr instanceof SyncTimeoutError
            ? 'Still syncing in the background. Your matches will update automatically.'
            : "Lost track of the sync's progress, but it may have finished. Check the list below.",
        )
        return
      }
      if (job.status === 'failed') {
        setError(describeJobError(job.error))
        return
      }
      setSyncStatus(job.matches_new ? `Added ${job.matches_new} new games.` : 'Already up to date.')
      await loadExisting()
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err) : 'Something went wrong. Check that the backend is running.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleRefreshViewed() {
    if (!summoner) return
    setRefreshingViewed(true)
    setError(null)
    try {
      const queued = await startLookupSync(summoner.game_name, summoner.tag_line, summoner.platform ?? '')
      const job = await waitForLookupSync(queued.job_id)
      if (job.status === 'failed' || job.puuid == null) {
        setError(describeJobError(job.error))
        return
      }
      await loadExisting()
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setSyncStatus('Already syncing this account in the background. Matches will appear automatically.')
      } else {
        setError(
          err instanceof SyncTimeoutError
            ? err.message
            : err instanceof ApiError
              ? describeError(err)
              : 'Something went wrong refreshing this account.',
        )
      }
    } finally {
      setRefreshingViewed(false)
    }
  }

  async function loadMore() {
    if (loadingMore) return
    if (nextCursor) {
      setLoadingMore(true)
      try {
        const page = await listMatches(nextCursor, undefined, resolvedPuuid)
        if (page) {
          setMatches((prev) => [...(prev ?? []), ...page.items])
          setNextCursor(page.next_cursor)
        }
      } catch (err) {
        setError(err instanceof ApiError ? `Could not load more games (${err.status}).` : 'Could not load more games.')
      } finally {
        setLoadingMore(false)
      }
      return
    }

    if (historyExhausted) return
    setLoadingMore(true)
    try {
      const queued = await startOlderMatchesSync(resolvedPuuid)
      const job = await waitForOlderMatchesSync(queued.job_id)
      if (job.status === 'failed' || job.exhausted || !job.matches_new) {
        setHistoryExhausted(true)
        return
      }
      const total = Math.min((matches?.length ?? 0) + job.matches_new, 100)
      const page = await listMatches(undefined, total, resolvedPuuid)
      setMatches(page?.items ?? null)
      setNextCursor(page?.next_cursor ?? null)
    } catch {
      setHistoryExhausted(true)
    } finally {
      setLoadingMore(false)
    }
  }

  function handleNoteChange(matchId: string, note: NoteOut | null) {
    setMatches((prev) => prev?.map((m) => (m.match_id === matchId ? { ...m, note } : m)) ?? prev)
  }

  const filteredMatches = useMemo(() => {
    if (!matches) return []
    return matches
      .filter((m) => queueTab === 'Total' || getQueueLabel(m.queue_id) === queueTab)
      .filter((m) => !onlyTagged || m.note != null)
  }, [matches, queueTab, onlyTagged])

  const summaryTagCounts = useMemo<TagCount[]>(() => {
    const counts = new Map<MistakeTag, number>()
    for (const m of filteredMatches) {
      for (const t of m.note?.tags ?? []) counts.set(t.tag_key, (counts.get(t.tag_key) ?? 0) + 1)
    }
    return [...counts.entries()].map(([tag_key, count]) => ({ tag_key, count }))
  }, [filteredMatches])

  const overallTagCounts = useMemo<TagCount[]>(() => {
    const counts = new Map<MistakeTag, number>()
    for (const m of matches ?? []) {
      for (const t of m.note?.tags ?? []) counts.set(t.tag_key, (counts.get(t.tag_key) ?? 0) + 1)
    }
    return [...counts.entries()].map(([tag_key, count]) => ({ tag_key, count }))
  }, [matches])

  const notesCount = matches?.filter((m) => m.note).length ?? 0

  const wins = filteredMatches.filter((m) => m.win).length
  const losses = filteredMatches.length - wins
  const avgKills = filteredMatches.reduce((s, m) => s + m.kills, 0) / (filteredMatches.length || 1)
  const avgDeaths = filteredMatches.reduce((s, m) => s + m.deaths, 0) / (filteredMatches.length || 1)
  const avgAssists = filteredMatches.reduce((s, m) => s + m.assists, 0) / (filteredMatches.length || 1)
  const notedInFiltered = filteredMatches.filter((m) => m.note).length

  if (!ready || championMap == null || spellMap == null || runeMaps == null) {
    return <PageLoading label={!ready && isViewingOther ? 'Loading their match history…' : undefined} />
  }

  if (!summoner) {
    if (isViewingOther) {
      return (
        <div className="flex flex-col items-center gap-2 py-10">
          <p className="text-sm text-text-secondary">This account could not be found.</p>
          <button
            type="button"
            onClick={() => setSearchParams({}, { replace: true })}
            className="text-sm text-accent hover:opacity-80"
          >
            ← Back to my account
          </button>
        </div>
      )
    }
    return (
      <div className="flex justify-center py-10">
        <div className="w-[520px] rounded-card border border-card-border bg-card p-6">
          <h1 className="mb-1 text-xl font-semibold text-text-headline">Enter your Riot ID</h1>
          <p className="mb-4 text-sm text-text-secondary">
            We'll pull your last 20 ranked games so you can start tagging what went wrong.
          </p>
          <RiotIdForm onSubmit={handleSync} busy={syncing} />
          {syncStatus && <p className="mt-2 text-sm text-text-secondary">{syncStatus}</p>}
          {error && <p className="mt-2 text-sm text-loss-text">{error}</p>}
        </div>
      </div>
    )
  }

  const initials = summoner.game_name.slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col items-center">
      {}
      <div className="flex w-[1012px] flex-col gap-3.5 border-b border-header-border py-3.5">
        <div className="flex items-start gap-4">
          {profileIconUrl ? (
            <img src={profileIconUrl} alt="" className="h-[100px] w-[100px] rounded-card" />
          ) : (
            <div className="flex h-[100px] w-[100px] items-center justify-center rounded-card bg-chip text-2xl font-bold text-text-secondary-3">
              {initials}
            </div>
          )}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="text-xl font-bold text-text-headline">
              {summoner.game_name}
              <span className="text-text-muted">#{summoner.tag_line}</span>
            </div>
            {isViewingOther ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-card bg-chip px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                  Viewing
                </span>
                <button
                  type="button"
                  onClick={handleRefreshViewed}
                  disabled={refreshingViewed || awaitingMatches}
                  title={awaitingMatches ? 'Already syncing in the background' : undefined}
                  className="rounded-card bg-accent px-3 py-1.5 text-xs font-bold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {refreshingViewed ? 'Refreshing…' : awaitingMatches ? 'Syncing…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  onClick={() => setSearchParams({}, { replace: true })}
                  className="text-[11px] text-text-secondary hover:text-text-primary"
                >
                  ← Back to my account
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <div className="text-[11px] text-text-secondary">Notes on synced games</div>
                <div className="text-[11px] font-bold text-text-primary">{notesCount} games reviewed</div>
              </div>
            )}
            {!isViewingOther &&
              (isDemo ? (
                <div className="mt-1 text-[11px] text-text-muted">
                  Demo data is fixed. Sign in with your own account to sync a Riot ID.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    handleSync(summoner.game_name, summoner.tag_line, summoner.platform ?? DEFAULT_PLATFORM)
                  }
                  disabled={syncing}
                  className="mt-1 w-fit rounded-card bg-accent px-3 py-1.5 text-xs font-bold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncing ? 'Syncing…' : 'Resync'}
                </button>
              ))}
          </div>
        </div>
        {syncStatus && <p className="text-sm text-text-secondary">{syncStatus}</p>}
        {error && <p className="text-sm text-loss-text">{error}</p>}
      </div>

      <main className="mt-3 flex items-start justify-center gap-3 pb-10">
        {}
        <div className="flex w-[300px] flex-col gap-3">
          <RankCard
            queueLabel="Ranked Solo"
            tier={summoner.solo_tier}
            division={summoner.solo_division}
            lp={summoner.solo_lp}
            wins={summoner.solo_wins}
            losses={summoner.solo_losses}
            tracked={summoner.platform != null}
          />
          <LpTrendChart
            points={lpHistory?.points ?? []}
            tier={summoner.solo_tier}
            division={summoner.solo_division}
          />
          <RankProgress
            tier={summoner.solo_tier}
            division={summoner.solo_division}
            lp={summoner.solo_lp}
            avgLpPerWin={lpHistory?.avg_lp_per_win ?? null}
          />
          <RankCard
            queueLabel="Flex 5:5 Rank"
            tier={summoner.flex_tier}
            division={summoner.flex_division}
            lp={summoner.flex_lp}
            wins={summoner.flex_wins}
            losses={summoner.flex_losses}
            tracked={summoner.platform != null}
          />

          <div className="overflow-hidden rounded-card border border-card-border bg-card">
            {!isViewingOther && (
              <div className="flex h-[38px] gap-px bg-card-border">
                <button
                  type="button"
                  onClick={() => setSidebarTab('champions')}
                  className="flex-1 cursor-pointer text-xs transition-opacity hover:opacity-75"
                  style={{
                    background: sidebarTab === 'champions' ? 'var(--color-inset-alt)' : 'var(--color-card)',
                    color: sidebarTab === 'champions' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  Champions
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('tags')}
                  className="flex-1 cursor-pointer text-xs transition-opacity hover:opacity-75"
                  style={{
                    background: sidebarTab === 'tags' ? 'var(--color-inset-alt)' : 'var(--color-card)',
                    color: sidebarTab === 'tags' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  Mistake tags
                </button>
              </div>
            )}
            {isViewingOther || sidebarTab === 'champions' ? (
              <ChampionWinRateTable summaries={championSummaries} championMap={championMap} />
            ) : (
              <div className="p-3">
                <TagProgressList
                  tagCounts={overallTagCounts}
                  taxonomy={taxonomy}
                  gamesConsidered={matches?.length ?? 0}
                  size="compact"
                />
              </div>
            )}
          </div>

          <PositionSummaryList summaries={positionSummaries} />
        </div>

        {}
        <div className="flex w-[700px] flex-col">
          <div className="flex h-[34px] items-center gap-4 rounded-t-card border border-b-0 border-card-border bg-card pl-3">
            {QUEUE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setQueueTab(tab)}
                className="cursor-pointer border-b-2 py-2 text-xs transition-opacity hover:opacity-75"
                style={{
                  color: queueTab === tab ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  borderColor: queueTab === tab ? 'var(--color-accent)' : 'transparent',
                }}
              >
                {tab}
              </button>
            ))}
            <div className="flex-1" />
            {!isViewingOther && (
              <button
                type="button"
                onClick={() => setOnlyTagged((v) => !v)}
                className="mr-2.5 cursor-pointer rounded-card border px-2 py-1 text-[11px] transition-opacity hover:opacity-75"
                style={{
                  color: onlyTagged ? 'var(--color-page)' : 'var(--color-text-secondary)',
                  background: onlyTagged ? 'var(--color-accent)' : 'transparent',
                  borderColor: onlyTagged ? 'var(--color-accent)' : 'var(--color-chip-border)',
                }}
              >
                {onlyTagged ? 'Showing tagged only' : 'Only games with notes'}
              </button>
            )}
          </div>

          {filteredMatches.length > 0 && (
            <div className="mb-3 flex min-h-[112px] border border-card-border bg-card">
              <div className="flex w-[210px] border-r border-card-border">
                <div className="flex flex-col items-center justify-center gap-1.5 px-3">
                  <div className="text-xs text-text-secondary">
                    {filteredMatches.length}G {wins}W {losses}L
                  </div>
                  <DonutChart wins={wins} losses={losses} size={84} />
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
                  <div className="text-[11px] font-bold text-text-secondary-3">
                    {avgKills.toFixed(1)} / <span className="text-loss">{avgDeaths.toFixed(1)}</span> /{' '}
                    {avgAssists.toFixed(1)}
                  </div>
                  <div className="text-sm text-text-primary">
                    <span className="font-bold">{formatKda(avgKills, avgDeaths, avgAssists)}:1</span>
                  </div>
                  {!isViewingOther && (
                    <div className="text-[11px] text-text-secondary-5">
                      {notedInFiltered} of {filteredMatches.length} games have notes
                    </div>
                  )}
                </div>
              </div>
              <div
                className={`flex flex-col justify-center gap-1 px-2 ${isViewingOther ? 'flex-1' : 'w-[250px] border-r border-card-border'}`}
              >
                <div className="text-center text-[11px] text-text-secondary">Preferred position</div>
                <PositionBarChart summaries={positionSummaries} height={104} />
              </div>
              {!isViewingOther && (
                <div className="flex-1 px-4.5 py-2.5">
                  <TagProgressList
                    tagCounts={summaryTagCounts}
                    taxonomy={taxonomy}
                    gamesConsidered={filteredMatches.length}
                    size="compact"
                    maxRows={3}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {syncing ? (
              <PageLoading label={syncStatus ?? 'Syncing your matches…'} />
            ) : !matchesReady ? (
              <PageLoading label="Loading match history…" />
            ) : (
              <>
                {filteredMatches.map((match) => (
                  <MatchRow
                    key={match.match_id}
                    match={match}
                    championMap={championMap}
                    spellMap={spellMap}
                    runeMaps={runeMaps}
                    taxonomy={taxonomy}
                    matchups={matchups}
                    matchupTaxonomy={matchupTaxonomy}
                    matchupWeaknessTaxonomy={matchupWeaknessTaxonomy}
                    expanded={expandedMatchId === match.match_id}
                    flash={flashMatchId === match.match_id}
                    readOnly={isViewingOther}
                    onToggleExpand={() =>
                      setExpandedMatchId((prev) => (prev === match.match_id ? null : match.match_id))
                    }
                    onNoteChange={(note) => handleNoteChange(match.match_id, note)}
                  />
                ))}
                {filteredMatches.length === 0 && awaitingMatches && (
                  <PageLoading label="Fetching their matches…" />
                )}
                {filteredMatches.length === 0 && !awaitingMatches && (
                  <p className="text-sm text-text-secondary">No matches found for this filter.</p>
                )}
                {matches &&
                  matches.length > 0 &&
                  (nextCursor || (!historyExhausted && !isDemo)) && (
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="rounded-card border border-card-border bg-card py-2.5 text-xs text-text-secondary disabled:opacity-50"
                    >
                      {loadingMore
                        ? 'Loading…'
                        : nextCursor
                          ? 'Load more games'
                          : 'Load older games'}
                    </button>
                  )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

async function resolveViewTarget(gameName: string, tagLine: string, platform: string): Promise<string | null> {
  const cached = getCachedPuuid(platform, gameName, tagLine)
  if (cached) return cached
  try {
    const queued = await startLookupResolve(gameName, tagLine, platform)
    const job = await waitForLookupResolve(queued.job_id)
    if (job.status === 'failed' || job.puuid == null) return null
    setCachedPuuid(platform, gameName, tagLine, job.puuid)
    return job.puuid
  } catch {
    return null
  }
}

async function fetchSummonerWithRetry(puuid: string): Promise<SummonerOut | null> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const summoner = await getSummoner(puuid)
    if (summoner) return summoner
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return null
}

function describeError(err: ApiError): string {
  if (err.status === 404) return 'Riot ID not found. Double check the spelling and tag line.'
  if (err.status === 429) return 'You just synced. Give it a minute before trying again.'
  if (err.status === 503) return 'Sync queue is busy right now. Try again shortly.'
  if (err.status === 502) return 'Riot API key was rejected. Development keys expire every 24h, get a fresh one.'
  return `Sync failed (${err.status}): ${err.message}`
}
