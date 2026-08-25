import type {
  AuthProviders,
  ChampionSummary,
  LookupResolveEnqueued,
  LookupResolveJob,
  LookupSyncEnqueued,
  LookupSyncJob,
  MatchDetail,
  MatchPage,
  MatchupIn,
  MatchupOut,
  MatchupTagTaxonomyEntry,
  MatchupWeaknessTaxonomyEntry,
  LpHistoryResponse,
  MeOut,
  NoteIn,
  NoteOut,
  OlderMatchesEnqueued,
  OlderMatchesJob,
  PinnedSyncJob,
  PinnedUserOut,
  PositionSummary,
  RecentNoteItem,
  SummonerOut,
  TagChampionCount,
  SyncEnqueued,
  SyncJob,
  TagCountsResponse,
  TagTaxonomyEntry,
  TrendResponse,
} from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, body || res.statusText)
  }
  return res.json() as Promise<T>
}

async function requestOrNull<T>(path: string): Promise<T | null> {
  try {
    return await request<T>(path)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export function startSync(
  gameName: string,
  tagLine: string,
  platform: string,
): Promise<SyncEnqueued> {
  return request<SyncEnqueued>('/summoners/sync', {
    method: 'POST',
    body: JSON.stringify({ game_name: gameName, tag_line: tagLine, platform }),
  })
}

export function getSyncJob(jobId: string): Promise<SyncJob> {
  return request<SyncJob>(`/summoners/sync/${jobId}`)
}

export function getCurrentSummoner(): Promise<SummonerOut | null> {
  return requestOrNull<SummonerOut>('/summoners/me')
}

export function getSummoner(puuid: string): Promise<SummonerOut | null> {
  return requestOrNull<SummonerOut>(`/summoners/${puuid}`)
}

export function listMatches(
  cursor?: string | null,
  limit?: number,
  puuid?: string | null,
): Promise<MatchPage | null> {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  if (puuid) params.set('puuid', puuid)
  const query = params.size ? `?${params}` : ''
  return requestOrNull<MatchPage>(`/matches${query}`)
}

export function getMatch(matchId: string): Promise<MatchDetail> {
  return request<MatchDetail>(`/matches/${matchId}`)
}

export function upsertNote(matchId: string, payload: NoteIn): Promise<NoteOut> {
  return request<NoteOut>(`/matches/${matchId}/note`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteNote(matchId: string): Promise<void> {
  const res = await fetch(`/api/matches/${matchId}/note`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, body || res.statusText)
  }
}

export function getTagCounts(championId: number | null): Promise<TagCountsResponse> {
  const query = championId != null ? `?champion_id=${championId}` : ''
  return request<TagCountsResponse>(`/stats/tag-counts${query}`)
}

export function getTagTaxonomy(): Promise<TagTaxonomyEntry[]> {
  return request<TagTaxonomyEntry[]>('/tags')
}

export function getChampionSummary(puuid?: string | null): Promise<ChampionSummary[]> {
  const query = puuid ? `?puuid=${encodeURIComponent(puuid)}` : ''
  return request<ChampionSummary[]>(`/stats/champions${query}`)
}

export function getPositionSummary(puuid?: string | null): Promise<PositionSummary[]> {
  const query = puuid ? `?puuid=${encodeURIComponent(puuid)}` : ''
  return request<PositionSummary[]>(`/stats/positions${query}`)
}

export function getTrend(count = 20): Promise<TrendResponse> {
  return request<TrendResponse>(`/stats/trend?count=${count}`)
}

export function getRecentNotes(limit = 10): Promise<RecentNoteItem[]> {
  return request<RecentNoteItem[]>(`/stats/recent-notes?limit=${limit}`)
}

export function getAuthProviders(): Promise<AuthProviders> {
  return request<AuthProviders>('/auth/providers')
}

export async function getMe(): Promise<MeOut | null> {
  try {
    return await request<MeOut>('/auth/me')
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

export function demoLogin(): Promise<MeOut> {
  return request<MeOut>('/auth/demo-login', { method: 'POST' })
}

export function guestLogin(): Promise<MeOut> {
  return request<MeOut>('/auth/guest-login', { method: 'POST' })
}

export function devLogin(email: string): Promise<MeOut> {
  return request<MeOut>('/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function deleteAccount(): Promise<void> {
  const res = await fetch('/api/auth/me', { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    throw new ApiError(res.status, (await res.text()) || res.statusText)
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export function getLpHistory(
  queue: 'solo' | 'flex' = 'solo',
  puuid?: string | null,
): Promise<LpHistoryResponse> {
  const params = new URLSearchParams({ queue })
  if (puuid) params.set('puuid', puuid)
  return request<LpHistoryResponse>(`/stats/lp-history?${params}`)
}

export function getTagChampionCounts(): Promise<TagChampionCount[]> {
  return request<TagChampionCount[]>('/stats/tag-champions')
}

export function oauthLoginUrl(provider: string): string {
  return `/api/auth/${provider}/login`
}

export function listMatchups(): Promise<MatchupOut[]> {
  return request<MatchupOut[]>('/matchups')
}

export function getMatchupTagTaxonomy(): Promise<MatchupTagTaxonomyEntry[]> {
  return request<MatchupTagTaxonomyEntry[]>('/matchups/tags')
}

export function getMatchupWeaknessTaxonomy(): Promise<MatchupWeaknessTaxonomyEntry[]> {
  return request<MatchupWeaknessTaxonomyEntry[]>('/matchups/weaknesses')
}

export function createMatchup(payload: MatchupIn): Promise<MatchupOut> {
  return request<MatchupOut>('/matchups', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMatchup(id: number, payload: MatchupIn): Promise<MatchupOut> {
  return request<MatchupOut>(`/matchups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteMatchup(id: number): Promise<void> {
  const res = await fetch(`/api/matchups/${id}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    throw new ApiError(res.status, (await res.text()) || res.statusText)
  }
}

export function startPinnedSync(
  gameName: string,
  tagLine: string,
  platform: string,
): Promise<SyncEnqueued> {
  return request<SyncEnqueued>('/pinned/sync', {
    method: 'POST',
    body: JSON.stringify({ game_name: gameName, tag_line: tagLine, platform }),
  })
}

export function getPinnedSyncJob(jobId: string): Promise<PinnedSyncJob> {
  return request<PinnedSyncJob>(`/pinned/sync/${jobId}`)
}

export function listPinnedUsers(): Promise<PinnedUserOut[]> {
  return request<PinnedUserOut[]>('/pinned')
}

export function getPinnedUser(id: number): Promise<PinnedUserOut | null> {
  return requestOrNull<PinnedUserOut>(`/pinned/${id}`)
}

export function updatePinnedNote(id: number, note: string | null): Promise<PinnedUserOut> {
  return request<PinnedUserOut>(`/pinned/${id}/note`, {
    method: 'PUT',
    body: JSON.stringify({ note }),
  })
}

export async function deletePinnedUser(id: number): Promise<void> {
  const res = await fetch(`/api/pinned/${id}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    throw new ApiError(res.status, (await res.text()) || res.statusText)
  }
}

export function startLookupSync(
  gameName: string,
  tagLine: string,
  platform: string,
): Promise<LookupSyncEnqueued> {
  return request<LookupSyncEnqueued>('/lookup/sync', {
    method: 'POST',
    body: JSON.stringify({ game_name: gameName, tag_line: tagLine, platform }),
  })
}

export function getLookupSyncJob(jobId: string): Promise<LookupSyncJob> {
  return request<LookupSyncJob>(`/lookup/sync/${jobId}`)
}

export function startLookupResolve(
  gameName: string,
  tagLine: string,
  platform: string,
): Promise<LookupResolveEnqueued> {
  return request<LookupResolveEnqueued>('/lookup/resolve', {
    method: 'POST',
    body: JSON.stringify({ game_name: gameName, tag_line: tagLine, platform }),
  })
}

export function getLookupResolveJob(jobId: string): Promise<LookupResolveJob> {
  return request<LookupResolveJob>(`/lookup/resolve/${jobId}`)
}

export function startOlderMatchesSync(puuid?: string | null): Promise<OlderMatchesEnqueued> {
  const query = puuid ? `?puuid=${encodeURIComponent(puuid)}` : ''
  return request<OlderMatchesEnqueued>(`/matches/older${query}`, { method: 'POST' })
}

export function getOlderMatchesJob(jobId: string): Promise<OlderMatchesJob> {
  return request<OlderMatchesJob>(`/matches/older/${jobId}`)
}
