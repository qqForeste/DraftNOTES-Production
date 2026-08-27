import type { ChampionSummary } from '../api/types'
import type { ChampionInfo } from '../lib/ddragon'
import { formatKda } from '../lib/format'
import { ChampionIcon } from './ChampionIcon'

interface Props {
  summaries: ChampionSummary[]
  championMap: Map<number, ChampionInfo> | null
}

export function ChampionWinRateTable({ summaries, championMap }: Props) {
  if (summaries.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-text-secondary">
        No synced games yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {summaries.map((s) => (
        <div
          key={s.champion_id}
          className="flex items-center gap-2 border-t border-header-border px-2 py-1.5 first:border-t-0"
        >
          <ChampionIcon championId={s.champion_id} championMap={championMap} size={30} />
          <div className="w-16 text-[11px] text-text-secondary-3">
            {championMap?.get(s.champion_id)?.name ?? '...'}
          </div>
          <div className="w-8 text-center text-[11px] text-text-secondary-3">{s.win_rate_pct}%</div>
          <div className="flex w-20 text-[11px]">
            <div className="rounded-l bg-win px-1.5 py-0.5 text-white">{s.wins}W</div>
            <div className="rounded-r bg-loss px-1.5 py-0.5 text-right text-white">{s.losses}L</div>
          </div>
          <div className="flex flex-1 flex-col items-end">
            <div className="text-xs font-bold text-text-secondary-3">
              {formatKda(s.avg_kills, s.avg_deaths, s.avg_assists)}
            </div>
            <div className="text-[10px] text-text-secondary-5">{s.note_count} notes</div>
          </div>
        </div>
      ))}
    </div>
  )
}
