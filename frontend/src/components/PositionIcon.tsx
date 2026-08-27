import { POSITION_ICON_URLS } from '../lib/positionIcons'

interface Props {
  position: string | null
  size?: number
  color?: string
}

export function PositionIcon({ position, size = 16, color }: Props) {
  const iconUrl = position ? POSITION_ICON_URLS[position] : undefined
  if (!iconUrl) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ color: color ?? 'currentColor' }} aria-hidden="true">
        <circle cx={8} cy={8} r={4} fill="none" stroke="currentColor" strokeWidth={1.6} />
      </svg>
    )
  }
  return <img src={iconUrl} alt="" width={size} height={size} aria-hidden="true" />
}
