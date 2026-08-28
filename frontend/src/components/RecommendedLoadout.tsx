import type { ChampionInfo, RuneMaps } from '../lib/ddragon'
import type { MatchupRecommendation } from '../lib/recommendation'
import { LoadoutView } from './LoadoutView'

interface Props {
  recommendation: MatchupRecommendation
  championId: number
  championMap: Map<number, ChampionInfo> | null
  runeMaps: RuneMaps | null
  compactSkills?: boolean
}

export function RecommendedLoadout({ recommendation, championId, championMap, runeMaps, compactSkills }: Props) {
  const { build, runes, skillOrder } = recommendation

  return (
    <LoadoutView
      title={`Recommended for ${championMap?.get(championId)?.name ?? 'this champion'}`}
      championId={championId}
      runeMaps={runeMaps}
      coreItemIds={build.coreItemIds}
      bootItemId={build.bootItemId}
      situationalItemIds={build.situationalItemIds}
      runes={runes}
      skillOrder={skillOrder}
      compactSkills={compactSkills}
    />
  )
}
