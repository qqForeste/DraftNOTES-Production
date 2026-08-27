import { formatRankLabel, getRankEmblemUrl } from '../lib/rankIcons'

interface Props {
  queueLabel: string
  tier: string | null
  division: string | null
  lp: number | null
  wins: number | null
  losses: number | null
  tracked: boolean
}

export function RankCard({ queueLabel, tier, division, lp, wins, losses, tracked }: Props) {
  return (
    <div className="flex h-[140px] rounded-card border border-card-border bg-card">
      <div className="flex flex-[4] flex-col items-center justify-center">
        {tracked ? (
          <img src={getRankEmblemUrl(tier)} alt="" className="h-24 w-24 object-scale-down" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-card-border text-lg text-text-muted">
            ?
          </div>
        )}
      </div>
      <div className="flex flex-[6] flex-col justify-evenly gap-[3px] py-7">
        <div className="text-[11px] text-text-secondary-5">{queueLabel}</div>
        {!tracked ? (
          <div className="text-[13px] text-text-muted">Not synced yet</div>
        ) : tier ? (
          <>
            <div className="text-[15px] font-bold text-[#4ab3f7]">{formatRankLabel(tier, division)}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-text-secondary-3">{lp} LP</span>
              <span className="text-xs text-text-secondary-5">
                {wins}W {losses}L
              </span>
            </div>
            {wins != null && losses != null && wins + losses > 0 && (
              <div className="text-xs text-text-secondary-5">
                Win Ratio {Math.round((100 * wins) / (wins + losses))}%
              </div>
            )}
          </>
        ) : (
          <div className="text-[15px] font-bold text-text-secondary-5">Unranked</div>
        )}
      </div>
    </div>
  )
}
