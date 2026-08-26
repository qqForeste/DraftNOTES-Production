import { useNavigate } from 'react-router-dom'
import type { ChampionInfo } from '../lib/ddragon'
import { ChampionIcon } from './ChampionIcon'
import { HoverCard } from './HoverCard'

interface Props {
  championId: number
  championMap: Map<number, ChampionInfo> | null
  size?: number
  rounded?: boolean
  className?: string
  showNameTooltip?: boolean
}

export function ClickableChampionIcon({
  championId,
  championMap,
  size,
  rounded,
  className,
  showNameTooltip = true,
}: Props) {
  const navigate = useNavigate()
  const name = championMap?.get(championId)?.name ?? '...'
  const icon = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/matchups?champion=${championId}`)
      }}
      className={`block shrink-0 cursor-pointer transition-transform duration-100 hover:scale-[1.12] ${className ?? ''}`}
    >
      <ChampionIcon championId={championId} championMap={championMap} size={size} rounded={rounded} />
    </button>
  )

  if (!showNameTooltip) return icon
  return <HoverCard content={<div className="font-bold text-text-primary">{name}</div>}>{icon}</HoverCard>
}
