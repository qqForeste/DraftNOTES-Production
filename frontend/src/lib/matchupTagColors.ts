import type { MatchupPlaystyleTag } from '../api/types'

export const MATCHUP_TAG_COLORS: Record<MatchupPlaystyleTag, string> = {
  lane_bully: '#ee5a52',
  wins_level_1: '#d6549c',
  strong_level_2: '#e19205',
  strong_level_3: '#c9822a',
  strong_level_6: '#e2703a',
  scales_late: '#2f9e8f',
  all_in_threat: '#c9a227',
  poke_matchup: '#6c7ee1',
  engage_heavy: '#4fae5e',
  strong_waveclear: '#a97155',
  sustain_lane: '#5fb0a3',
  strong_prio: '#3f8fd6',
}

export function getMatchupTagColor(tag: MatchupPlaystyleTag): string {
  return MATCHUP_TAG_COLORS[tag]
}
