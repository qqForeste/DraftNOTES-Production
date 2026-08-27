import type { PositionSummary } from '../api/types'
import { getPositionLabel } from '../lib/positions'
import { PositionIcon } from './PositionIcon'

interface Props {
  summaries: PositionSummary[]
}

export function PositionSummaryList({ summaries }: Props) {
  if (summaries.length === 0) {
    return <div className="text-xs text-text-secondary">No synced games yet.</div>
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-card-border bg-card p-3">
      <div className="mb-1 text-xs text-text-secondary">Preferred position</div>
      {summaries.map((s) => (
        <div key={s.team_position ?? 'unknown'} className="flex h-11 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-card border border-card-border text-text-secondary-3">
            <PositionIcon position={s.team_position} size={16} />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-[13px] text-text-primary">{getPositionLabel(s.team_position)}</div>
            <div className="text-[11px] text-text-secondary">
              <span className="text-[#4ab3f7]">{s.pick_rate_pct}%</span> pick · Win Ratio{' '}
              <span className="font-bold text-text-primary">{s.win_rate_pct}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
