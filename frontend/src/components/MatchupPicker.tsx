import { useMemo, useState, type ReactNode } from 'react'
import type { MatchupRole } from '../api/types'
import type { ChampionInfo } from '../lib/ddragon'
import { championWinRate, topCounters } from '../lib/matchupStats'
import { ChampionIcon } from './ChampionIcon'
import { ChampionSelect } from './ChampionSelect'
import { EstimatedBadge } from './EstimateNote'
import { RoleIconSelect } from './RoleIconSelect'

const LANE_ROLES: MatchupRole[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

export interface MatchupPickerState {
  role: MatchupRole
  yourChampionId: number | null
  enemyChampionId: number | null
}

interface Props {
  state: MatchupPickerState
  onChange: (state: MatchupPickerState) => void
  championMap: Map<number, ChampionInfo> | null
  yourSlot?: ReactNode
  enemySlot?: ReactNode
}

export function MatchupPicker({ state, onChange, championMap, yourSlot, enemySlot }: Props) {
  const set = (patch: Partial<MatchupPickerState>) => onChange({ ...state, ...patch })
  const [spins, setSpins] = useState(0)
  const [swapping, setSwapping] = useState(false)

  function swapSides() {
    set({ yourChampionId: state.enemyChampionId, enemyChampionId: state.yourChampionId })
    setSpins((n) => n + 1)
    setSwapping(true)
    setTimeout(() => setSwapping(false), 220)
  }

  const chosenIds = [state.yourChampionId, state.enemyChampionId].filter((id): id is number => id != null)
  const otherThan = (id: number | null) => chosenIds.filter((c) => c !== id)

  const championIds = useMemo(() => [...(championMap?.keys() ?? [])], [championMap])
  const counters = useMemo(() => {
    if (state.enemyChampionId == null || state.yourChampionId != null) return []
    return topCounters(state.enemyChampionId, championIds, 6).filter((c) => !chosenIds.includes(c.championId))
  }, [state.enemyChampionId, state.yourChampionId, championIds, chosenIds])

  const preview =
    state.yourChampionId != null && state.enemyChampionId != null
      ? {
          yourWinRatePct: championWinRate(state.yourChampionId, state.enemyChampionId),
        }
      : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-text-secondary">Role</span>
        <RoleIconSelect value={state.role} onChange={(role) => role !== 'DUO' && set({ role })} options={LANE_ROLES} />
      </div>

      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div
            className="flex flex-col gap-2 rounded-card border border-accent/30 bg-accent/10 p-3 transition-transform duration-200 ease-out"
            style={swapping ? { transform: 'translateX(6px) scale(0.98)' } : undefined}
          >
            <span className="text-[11px] font-bold text-accent">YOU</span>
            <ChampionSelect
              championMap={championMap}
              value={state.yourChampionId}
              onChange={(id) => set({ yourChampionId: id })}
              onClear={() => set({ yourChampionId: null })}
              placeholder="Your champion"
              disabledIds={otherThan(state.yourChampionId)}
            />
          </div>
          {preview && (
            <div
              className="flex w-fit items-center gap-2 rounded-card border px-3 py-2"
              style={{
                borderColor: preview.yourWinRatePct >= 50 ? 'var(--color-win-border)' : 'var(--color-loss-border)',
                background: preview.yourWinRatePct >= 50 ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
              }}
            >
              <span
                className="text-sm font-bold"
                style={{ color: preview.yourWinRatePct >= 50 ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}
              >
                {preview.yourWinRatePct}%
              </span>
              <span className="text-[11px] text-text-secondary">projected win rate for you</span>
              <EstimatedBadge />
            </div>
          )}
          {yourSlot}
        </div>

        <div className="mt-6 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={swapSides}
            title="Swap sides"
            aria-label="Swap sides"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-chip-border bg-inset text-text-secondary transition-colors hover:border-accent hover:bg-accent/15 hover:text-accent active:scale-90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: `rotate(${spins * 180}deg)`, transition: 'transform 300ms ease' }}
            >
              <path d="M2.5 5.5h9M8.5 2.5l3 3-3 3" />
              <path d="M13.5 10.5h-9M7.5 13.5l-3-3 3-3" />
            </svg>
          </button>
          <span className="text-[10px] font-bold text-text-muted">VS</span>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div
            className="flex flex-col gap-2 rounded-card border border-loss/30 bg-loss/10 p-3 transition-transform duration-200 ease-out"
            style={swapping ? { transform: 'translateX(-6px) scale(0.98)' } : undefined}
          >
            <span className="text-[11px] font-bold text-loss">ENEMY</span>
            <ChampionSelect
              championMap={championMap}
              value={state.enemyChampionId}
              onChange={(id) => set({ enemyChampionId: id })}
              onClear={() => set({ enemyChampionId: null })}
              placeholder="Enemy champion"
              disabledIds={otherThan(state.enemyChampionId)}
            />
          </div>
          {enemySlot}
        </div>
      </div>

      {counters.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-text-secondary">
            Suggested picks against {championMap?.get(state.enemyChampionId!)?.name} <EstimatedBadge />
          </span>
          <div className="flex flex-wrap gap-1.5">
            {counters.map((c) => (
              <button
                key={c.championId}
                type="button"
                onClick={() => set({ yourChampionId: c.championId })}
                className="flex items-center gap-1.5 rounded-card border border-chip-border px-1.5 py-1 hover:border-accent/50 hover:bg-accent/10"
              >
                <ChampionIcon championId={c.championId} championMap={championMap} size={20} />
                <span className="text-[11px] text-text-primary">{championMap?.get(c.championId)?.name}</span>
                <span className="text-[11px] font-bold text-accent">{c.winRatePct}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
