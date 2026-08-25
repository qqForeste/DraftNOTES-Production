export type MistakeTag =
  | 'died_to_gank'
  | 'overextended'
  | 'missed_wave'
  | 'bad_recall_timing'
  | 'bad_teamfight'
  | 'tilted'
  | 'mechanical_misplay'
  | 'no_map_awareness'

export type GamePhase = 'early' | 'mid' | 'late'

export interface TagTaxonomyEntry {
  tag_key: MistakeTag
  label: string
}

export interface SummonerOut {
  puuid: string
  game_name: string
  tag_line: string
  region: string
  platform: string | null
  last_synced_at: string | null
  profile_icon_id: number | null

  solo_tier: string | null
  solo_division: string | null
  solo_lp: number | null
  solo_wins: number | null
  solo_losses: number | null

  flex_tier: string | null
  flex_division: string | null
  flex_lp: number | null
  flex_wins: number | null
  flex_losses: number | null
}

export interface ScoreboardEntry {
  game_name: string
  tag_line: string
  tier: string | null
  division: string | null
  champion_id: number
  team_id: number
  is_self: boolean
  team_position: string | null
  champion_level: number
  kills: number
  deaths: number
  assists: number
  cs: number
  gold_earned: number
  damage_dealt: number
  items: number[]
  role_quest_item_id: number | null
  summoner_1_id: number | null
  summoner_2_id: number | null
  primary_rune_id: number | null
  secondary_style_id: number | null
}

export interface MatchListItem {
  match_id: string
  champion_id: number
  team_position: string | null
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  gold_earned: number
  game_duration: number
  game_creation: string
  queue_id: number
  patch: string

  items: number[]
  role_quest_item_id: number | null
  summoner_1_id: number | null
  summoner_2_id: number | null
  primary_rune_id: number | null
  secondary_style_id: number | null
  champion_level: number | null
  double_kills: number
  triple_kills: number
  quadra_kills: number
  penta_kills: number
  wards_placed: number | null
  control_wards_purchased: number | null
  kill_participation_pct: number | null
  scoreboard: ScoreboardEntry[]

  note: NoteOut | null
}

export interface NoteTagOut {
  tag_key: MistakeTag
  phase: GamePhase
  timestamp_seconds: number | null
}

export interface NoteOut {
  id: number
  match_id: string
  puuid: string
  body: string | null
  created_at: string
  updated_at: string
  tags: NoteTagOut[]
}

export interface MatchDetail extends MatchListItem {
  cs_at_14: number | null
  gold_diff_at_14: number | null
}

export interface MatchPage {
  items: MatchListItem[]
  next_cursor: string | null
}

export interface NoteTagIn {
  tag_key: MistakeTag
  phase: GamePhase
  timestamp_seconds?: number | null
}

export interface NoteIn {
  body: string | null
  tags: NoteTagIn[]
}

export interface TagCount {
  tag_key: MistakeTag
  count: number
}

export interface TagCountsResponse {
  tag_counts: TagCount[]
  games_considered: number
}

export interface ChampionSummary {
  champion_id: number
  games: number
  wins: number
  losses: number
  win_rate_pct: number
  avg_kills: number
  avg_deaths: number
  avg_assists: number
  note_count: number
}

export interface PositionSummary {
  team_position: string | null
  games: number
  wins: number
  win_rate_pct: number
  pick_rate_pct: number
}

export interface TrendPoint {
  match_id: string
  game_creation: string
  win: boolean
  tags: MistakeTag[]
}

export interface TrendResponse {
  points: TrendPoint[]
  tagged_games_last10: number
  tagged_games_prev10: number
  win_rate_in_noted_games_pct: number | null
  clean_games_streak: number
}

export interface RecentNoteItem {
  match_id: string
  champion_id: number
  win: boolean
  game_creation: string
  body: string | null
  tags: NoteTagOut[]
}

export interface SyncEnqueued {
  job_id: string
  status: string
  queue_position: number
}

export interface SyncJob {
  job_id: string
  status: 'queued' | 'deferred' | 'in_progress' | 'complete' | 'failed'
  matches_seen: number | null
  matches_new: number | null
  error: string | null
}

export interface LookupSyncEnqueued {
  job_id: string
  status: string
  queue_position: number
}

export interface LookupSyncJob {
  job_id: string
  status: string
  puuid: string | null
  error: string | null
}

export interface LookupResolveEnqueued {
  job_id: string
  status: string
  queue_position: number
}

export interface LookupResolveJob {
  job_id: string
  status: string
  puuid: string | null
  error: string | null
}

export interface OlderMatchesEnqueued {
  job_id: string
  status: string
  queue_position: number
}

export interface OlderMatchesJob {
  job_id: string
  status: string
  matches_new: number | null
  exhausted: boolean | null
  error: string | null
}

export interface AuthProviders {
  providers: string[]
  dev_login_enabled: boolean
  demo_enabled: boolean
  guest_enabled: boolean
}

export interface LinkedSummoner {
  puuid: string
  game_name: string
  tag_line: string
  platform: string | null
  is_primary: boolean
  verified: boolean
}

export interface MeOut {
  id: string
  email: string | null
  display_name: string | null
  provider: string
  summoners: LinkedSummoner[]
}

export type MatchupRole = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'

export type MatchupPlaystyleTag =
  | 'lane_bully'
  | 'wins_level_1'
  | 'strong_level_2'
  | 'strong_level_3'
  | 'strong_level_6'
  | 'scales_late'
  | 'all_in_threat'
  | 'poke_matchup'
  | 'engage_heavy'
  | 'strong_waveclear'
  | 'sustain_lane'
  | 'strong_prio'

export type MatchupWeaknessTag =
  | 'vulnerable_to_poke'
  | 'vulnerable_to_ganks'
  | 'weak_against_tanks'
  | 'weak_engage'
  | 'weak_waveclear'
  | 'mana_issues'
  | 'poor_scaling'
  | 'snowball_reliant'
  | 'high_mechanical_skill'
  | 'weak_prio'
  | 'weak_when_behind'

export interface MatchupTagTaxonomyEntry {
  tag_key: MatchupPlaystyleTag
  label: string
}

export interface MatchupWeaknessTaxonomyEntry {
  tag_key: MatchupWeaknessTag
  label: string
}

export type SkillKey = 'Q' | 'W' | 'E' | 'R'

export type SkillOrder = (SkillKey | null)[]

export interface RunePage {
  primary_style_id: number | null
  primary_rune_ids: (number | null)[]
  secondary_style_id: number | null
  secondary_rune_ids: (number | null)[]
  stat_shard_ids: (number | null)[]
}

export interface MatchupOut {
  id: number
  role: MatchupRole
  your_champion_id: number
  enemy_champion_id: number
  tags: MatchupPlaystyleTag[]
  weaknesses: MatchupWeaknessTag[]
  body: string | null
  core_item_ids: (number | null)[]
  optional_item_ids: (number | null)[]
  boot_item_id: number | null
  optional_boot_item_id: number | null
  runes: RunePage
  skill_order: SkillOrder
  created_at: string
  updated_at: string
}

export interface MatchupIn {
  role: MatchupRole
  your_champion_id: number
  enemy_champion_id: number
  tags: MatchupPlaystyleTag[]
  weaknesses: MatchupWeaknessTag[]
  body: string | null
  core_item_ids?: (number | null)[]
  optional_item_ids?: (number | null)[]
  boot_item_id?: number | null
  optional_boot_item_id?: number | null
  runes?: RunePage
  skill_order?: SkillOrder
}

export interface PinnedUserMatch {
  match_id: string
  champion_id: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  queue_id: number
  game_creation: string
  game_duration: number
}

export interface PinnedSyncJob {
  job_id: string
  status: string
  pinned_id: number | null
  error: string | null
}

export interface LpHistoryPoint {
  captured_at: string
  tier: string | null
  division: string | null
  lp: number | null
  wins: number | null
  losses: number | null
  absolute_lp: number | null
  lp_delta: number | null
  games_delta: number | null
}

export interface LpHistoryResponse {
  queue: string
  points: LpHistoryPoint[]
  avg_lp_per_win: number | null
}

export interface TagChampionCount {
  tag_key: MistakeTag
  champion_id: number
  count: number
}

export interface PinnedUserOut {
  id: number
  game_name: string
  tag_line: string
  platform: string
  profile_icon_id: number
  tier: string | null
  division: string | null
  lp: number | null
  note: string | null
  synced_at: string
  recent_matches: PinnedUserMatch[]
}
