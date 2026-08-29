import { useMemo, useState } from 'react'
import type { ChampionInfo } from '../lib/ddragon'
import { duoSynergyWinRate, topSynergyPartners } from '../lib/matchupStats'
import { ChampionIcon } from './ChampionIcon'
import { ChampionSelect } from './ChampionSelect'
import { EstimatedBadge } from './EstimateNote'

interface Props {
  championMap: Map<number, ChampionInfo> | null
}

export function DuoSynergyPreview({ championMap }: Props) {
  const [spins, setSpins] = useState(0)
  const [swapping, setSwapping] = useState(false)
  const [botId, setBotId] = useState<number | null>(null)
  const [supportId, setSupportId] = useState<number | null>(null)

  const championIds = useMemo(() => [...(championMap?.keys() ?? [])], [championMap])

  function swapSides() {
    const top = botId
    setBotId(supportId)
    setSupportId(top)
    setSpins((n) => n + 1)
    setSwapping(true)
    setTimeout(() => setSwapping(false), 220)
  }

  function clear() {
    setBotId(null)
    setSupportId(null)
  }

  const anchorId = botId != null && supportId == null ? botId : supportId != null && botId == null ? supportId : null
  const suggestionsFillBot = botId == null

  const suggestions = useMemo(() => {
    if (anchorId == null) return []
    return topSynergyPartners(anchorId, championIds, 6)
  }, [anchorId, championIds])

  const preview =
    botId != null && supportId != null
      ? { winRatePct: duoSynergyWinRate(botId, supportId) }
      : null

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex w-[288px] shrink-0 flex-col gap-2">
        <div
          className="flex flex-col gap-2 rounded-card border border-accent/30 bg-accent/10 p-3 transition-transform duration-200 ease-out"
          style={swapping ? { transform: 'translateY(6px) scale(0.98)' } : undefined}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold text-accent">BOT</span>
            {(botId != null || supportId != null) && (
              <button
                type="button"
                onClick={clear}
                className="text-[10px] text-text-secondary hover:text-text-primary"
              >
                Clear
              </button>
            )}
          </div>
          <ChampionSelect
            championMap={championMap}
            value={botId}
            onChange={setBotId}
            onClear={() => setBotId(null)}
            placeholder="Bot laner"
            disabledIds={supportId != null ? [supportId] : []}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-chip-border" />
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
              <path d="M5.5 2.5v9M2.5 8.5l3 3 3-3" />
              <path d="M10.5 13.5v-9M13.5 7.5l-3-3-3 3" />
            </svg>
          </button>
          <span className="text-[10px] font-bold text-text-muted">+</span>
          <div className="h-px flex-1 bg-chip-border" />
        </div>

        <div
          className="flex flex-col gap-2 rounded-card border border-accent/30 bg-accent/10 p-3 transition-transform duration-200 ease-out"
          style={swapping ? { transform: 'translateY(-6px) scale(0.98)' } : undefined}
        >
          <span className="text-[11px] font-bold text-accent">SUPPORT</span>
          <ChampionSelect
            championMap={championMap}
            value={supportId}
            onChange={setSupportId}
            onClear={() => setSupportId(null)}
            placeholder="Support"
            disabledIds={botId != null ? [botId] : []}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 rounded-card border border-chip-border bg-inset p-3">
        {botId == null && supportId == null ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-[11px] text-text-muted">Pick a champion to see synergy.</p>
          </div>
        ) : (
          <>
            {preview && (
              <div
                className="flex w-fit items-center gap-2 rounded-card border px-3 py-2"
                style={{
                  borderColor: preview.winRatePct >= 50 ? 'var(--color-win-border)' : 'var(--color-loss-border)',
                  background: preview.winRatePct >= 50 ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                }}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: preview.winRatePct >= 50 ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}
                >
                  {preview.winRatePct}%
                </span>
                <span className="text-[11px] text-text-secondary">projected win rate together</span>
                <EstimatedBadge />
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-secondary">
                  Suggested {suggestionsFillBot ? 'bot laners' : 'supports'} with {championMap?.get(anchorId!)?.name}{' '}
                  <EstimatedBadge />
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s.championId}
                      type="button"
                      onClick={() => (suggestionsFillBot ? setBotId(s.championId) : setSupportId(s.championId))}
                      className="flex items-center gap-1.5 rounded-card border border-chip-border px-1.5 py-1 hover:border-accent/50 hover:bg-accent/10"
                    >
                      <ChampionIcon championId={s.championId} championMap={championMap} size={20} />
                      <span className="text-[11px] text-text-primary">{championMap?.get(s.championId)?.name}</span>
                      <span className="text-[11px] font-bold text-accent">{s.winRatePct}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
