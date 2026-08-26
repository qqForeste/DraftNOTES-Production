import type { ChampionInfo } from '../lib/ddragon'

interface Props {
  championId: number
  championMap: Map<number, ChampionInfo> | null
  size?: number
  rounded?: boolean
}

export function ChampionIcon({ championId, championMap, size = 40, rounded = true }: Props) {
  const champ = championMap?.get(championId)
  const style = { width: size, height: size }
  const roundedClass = rounded ? 'rounded-md' : ''

  if (!champ) {
    return (
      <div
        style={style}
        className={`${roundedClass} bg-chip animate-pulse shrink-0`}
        aria-label="loading champion icon"
      />
    )
  }

  return <img src={champ.iconUrl} alt={champ.name} style={style} className={`${roundedClass} shrink-0`} />
}
