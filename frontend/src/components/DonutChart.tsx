interface Props {
  wins: number
  losses: number
  size?: number
}

export function DonutChart({ wins, losses, size = 92 }: Props) {
  const total = wins + losses
  const winPct = total > 0 ? (wins / total) * 100 : 0
  const thickness = Math.max(4, Math.round(size * 0.152))
  const inset = 1
  const outerRadius = size / 2 - inset
  const radius = outerRadius - thickness / 2
  const circumference = 2 * Math.PI * radius
  const winLength = (winPct / 100) * circumference
  const innerRadius = outerRadius - thickness
  const hole = innerRadius * 2
  const holeOffset = size / 2 - innerRadius

  return (
    <div className="relative" style={{ height: size, width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={total > 0 ? 'var(--color-loss)' : 'var(--color-card-border)'}
          strokeWidth={thickness}
        />
        {total > 0 && winPct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-win)"
            strokeWidth={thickness}
            strokeDasharray={`${winLength} ${circumference - winLength}`}
            strokeLinecap="butt"
          />
        )}
      </svg>
      <div
        className="absolute rounded-full bg-card"
        style={{ left: holeOffset, top: holeOffset, height: hole, width: hole }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center rounded-full text-text-secondary-3"
        style={{ fontSize: Math.max(10, Math.round(size * 0.141)) }}
      >
        {total > 0 ? `${Math.round(winPct)}%` : '-'}
      </div>
    </div>
  )
}
