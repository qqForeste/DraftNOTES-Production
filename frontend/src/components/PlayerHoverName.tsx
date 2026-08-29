import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { useLookupNavigate } from '../lib/useLookupNavigate'
import { HoverCard } from './HoverCard'

interface Props {
  gameName: string
  tagLine: string
  platform: string | null
  isSelf?: boolean
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function PlayerHoverName({
  gameName,
  tagLine,
  platform,
  isSelf,
  children,
  className,
  style,
}: Props) {
  const riotId = `${gameName}#${tagLine}`
  const canView = !isSelf && platform != null && tagLine !== ''
  const { go } = useLookupNavigate()

  function handleClick(e: MouseEvent) {
    if (platform == null) return
    e.stopPropagation()
    go(gameName, tagLine, platform)
  }

  return (
    <HoverCard
      className={`${canView ? 'cursor-pointer' : ''} ${className ?? ''}`}
      style={style}
      onClick={canView ? handleClick : undefined}
      content={
        canView ? (
          <div className="flex flex-col gap-1">
            <span className="text-text-primary">{riotId}</span>
            <span className="text-accent">View match history →</span>
          </div>
        ) : (
          <div className="text-text-secondary-2">{riotId}</div>
        )
      }
    >
      {children}
    </HoverCard>
  )
}
