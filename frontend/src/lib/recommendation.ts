import { useMemo } from 'react'
import type { RunePage, SkillOrder } from '../api/types'
import { STAT_SHARD_ROWS, useItemMap, useRuneMaps } from './ddragon'
import { recommendedBuild, recommendedRunePage, recommendedSkillOrder, type RecommendedBuild } from './matchupStats'

export interface MatchupRecommendation {
  build: RecommendedBuild
  runes: RunePage | null
  skillOrder: SkillOrder
  allItemIds: number[]
}

export function useMatchupRecommendation(
  championId: number | null,
  opponentId: number | null,
): MatchupRecommendation | null {
  const itemMap = useItemMap()
  const runeMaps = useRuneMaps()

  const itemPools = useMemo(() => {
    const legendary: number[] = []
    const boots: number[] = []
    for (const [id, item] of itemMap ?? []) {
      if (item.tags.includes('Boots')) {
        if (item.totalCost >= 1000) boots.push(id)
      } else if (item.totalCost >= 2500) {
        legendary.push(id)
      }
    }
    return { legendary: legendary.sort((a, b) => a - b), boots: boots.sort((a, b) => a - b) }
  }, [itemMap])

  return useMemo(() => {
    if (championId == null || opponentId == null || itemPools.legendary.length === 0) return null
    const build = recommendedBuild(championId, opponentId, itemPools.legendary, itemPools.boots)
    return {
      build,
      runes: runeMaps ? recommendedRunePage(championId, opponentId, runeMaps.trees, STAT_SHARD_ROWS) : null,
      skillOrder: recommendedSkillOrder(championId, opponentId),
      allItemIds: [...build.coreItemIds, ...(build.bootItemId != null ? [build.bootItemId] : []), ...build.situationalItemIds],
    }
  }, [championId, opponentId, itemPools, runeMaps])
}
