import type { MatchListItem } from '../api/types'

export function enemyChampionIds(match: MatchListItem): number[] {
  const self = match.scoreboard.find((p) => p.is_self)
  if (!self) return []
  return match.scoreboard.filter((p) => p.team_id !== self.team_id).map((p) => p.champion_id)
}
