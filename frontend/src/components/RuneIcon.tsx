import type { ReactNode } from 'react'
import { HoverCard } from './HoverCard'

interface Props {
  iconUrl: string | null | undefined
  name: string
  description?: string
  size?: number
  muted?: boolean
  recommended?: boolean
  round?: boolean
  onClick?: () => void
  disabled?: boolean
}

function Tooltip({ name, description }: { name: string; description?: string }): ReactNode {
  return (
    <>
      <div className="mb-1 text-xs font-bold text-text-primary">{name}</div>
      {description ? <div>{description}</div> : null}
    </>
  )
}

export function RuneIcon({
  iconUrl,
  name,
  description,
  size = 28,
  muted,
  recommended,
  round = true,
  onClick,
  disabled,
}: Props) {
  const dim = { width: size, height: size }
  const shape = round ? 'rounded-full' : 'rounded-card'

  const image = iconUrl ? (
    <img
      src={iconUrl}
      alt=""
      className={`${shape} transition-all`}
      style={{
        ...dim,
        opacity: muted ? 0.35 : 1,
        filter: muted ? 'grayscale(1)' : undefined,
      }}
    />
  ) : (
    <div className={`${shape} border border-dashed border-chip-border bg-inset`} style={dim} />
  )

  const ring = recommended && muted ? 'ring-1 ring-accent/70 ring-offset-1 ring-offset-card' : ''

  const content = (
    <HoverCard content={<Tooltip name={name} description={description} />}>
      <span className={`inline-flex ${shape} ${ring}`}>{image}</span>
    </HoverCard>
  )

  if (!onClick) return content

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={name}
      className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    >
      {content}
    </button>
  )
}
