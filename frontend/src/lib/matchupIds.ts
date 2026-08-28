import type { MatchListItem, MatchupOut, MatchupRole } from '../api/types'

export function findExistingMatchup(
  matchups: MatchupOut[],
  role: MatchupRole,
  yourChampionId: number,
  enemyChampionId: number,
): MatchupOut | undefined {
  return matchups.find(
    (m) => m.role === role && m.your_champion_id === yourChampionId && m.enemy_champion_id === enemyChampionId,
  )
}

export function expectedMatchupContext(match: MatchListItem): { role: MatchupRole } | null {
  if (!match.team_position) return null
  return { role: match.team_position as MatchupRole }
}
