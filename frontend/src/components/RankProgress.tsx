import { getRankEmblemUrl, getTierColor } from '../lib/rankIcons'
import { getNextCheckpoint, getRankSections } from '../lib/rankProgress'

interface Props {
  tier: string | null
  division: string | null
  lp: number | null
  avgLpPerWin: number | null
}

export function RankProgress({ tier, division, lp, avgLpPerWin }: Props) {
  if (!tier || lp == null) {
    return (
      <div className="flex h-20 items-center justify-center rounded-card border border-card-border bg-card p-3.5 text-center text-xs text-text-secondary">
        Sync ranked solo games to see rank progress.
      </div>
    )
  }

  const { current, next } = getRankSections(tier, division, lp)
  const checkpoint = getNextCheckpoint(tier, division, lp)
  const avgWinLp = avgLpPerWin ?? 20
  const winsToGo = checkpoint ? Math.max(1, Math.ceil(checkpoint.lpNeeded / avgWinLp)) : 0

  const tierColor = getTierColor(current.tier)
  const nextColor = next ? getTierColor(next.tier) : tierColor
  const apexPct = checkpoint
    ? Math.max(0, Math.min(100, Math.round(((checkpoint.target - checkpoint.lpNeeded) / checkpoint.target) * 100)))
    : 100

  return (
    <div className="flex flex-col gap-3 rounded-card border border-card-border bg-card p-3.5">
      <span className="text-xs text-text-secondary">Rank progress</span>

      {}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <img src={getRankEmblemUrl(current.tier)} alt="" className="h-[26px] w-[26px] object-scale-down" />
          <span className="text-[13px] font-bold" style={{ color: tierColor }}>
            {current.label}
          </span>
          <div className="flex-1" />
          <span className="text-[11px] font-bold text-text-primary">{lp} LP</span>
        </div>

        {current.divisions.length > 0 ? (
          <div className="flex gap-1">
            {current.divisions.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={`text-[10px] ${d.state === 'current' ? 'font-bold' : ''}`}
                  style={{ color: d.state === 'upcoming' ? 'var(--color-text-muted)' : d.state === 'current' ? tierColor : 'var(--color-text-secondary)' }}
                >
                  {d.label}
                </span>
                <div
                  className="box-border h-2 w-full overflow-hidden rounded-full"
                  style={{
                    background: 'var(--color-chip)',
                    border: `1px solid ${d.state === 'current' ? tierColor : 'transparent'}`,
                  }}
                >
                  <div className="h-full rounded-full" style={{ width: `${d.fillPct}%`, background: tierColor }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="box-border h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--color-chip)' }}>
            <div className="h-full rounded-full" style={{ width: `${apexPct}%`, background: tierColor }} />
          </div>
        )}
      </div>

      {}
      {next && checkpoint ? (
        <div className="flex flex-col gap-1.5 border-t border-header-border pt-2.5">
          <div className="flex items-center gap-2">
            <img
              src={getRankEmblemUrl(next.tier)}
              alt=""
              className="h-5 w-5 object-scale-down opacity-60"
            />
            <span className="text-[12px] font-bold" style={{ color: nextColor, opacity: 0.75 }}>
              {next.label}
            </span>
            <div className="flex-1" />
            <span className="text-[10px] text-text-muted">next tier</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-secondary">
              {checkpoint.lpNeeded} LP to {checkpoint.label}
            </span>
            <span className="text-[11px] font-bold text-text-primary">
              ~{winsToGo} win{winsToGo === 1 ? '' : 's'} to go
            </span>
          </div>
        </div>
      ) : (
        <div className="border-t border-header-border pt-2.5 text-[11px] text-text-secondary">
          You've reached the top of the ladder.
        </div>
      )}

      <span className="text-[10px] text-text-muted">
        {avgLpPerWin == null
          ? 'Assuming ~20 LP a win until more rank history is recorded'
          : `Based on ${avgLpPerWin} LP a win across your recorded history`}
      </span>
    </div>
  )
}
