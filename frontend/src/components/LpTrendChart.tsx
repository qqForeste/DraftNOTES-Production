import { useMemo, useState } from 'react'
import HighchartsReact from 'highcharts-react-official'
import type { LpHistoryPoint } from '../api/types'
import { Highcharts } from '../lib/highchartsSetup'
import { formatRelativeTime } from '../lib/format'
import { formatRankLabel } from '../lib/rankIcons'
import { rankFromAbsoluteLp } from '../lib/rankProgress'

interface Props {
  points: LpHistoryPoint[]
  tier: string | null
  division: string | null
}

type Range = 'games20' | 'day' | 'week' | 'month' | 'all'

const RANGES: { key: Range; label: string }[] = [
  { key: 'games20', label: '20 games' },
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All' },
]

const RANGE_MS: Record<Exclude<Range, 'games20'>, number | null> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  all: null,
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

interface PointCustom {
  lpDelta: number | null
  gamesDelta: number | null
  isCurrent: boolean
  label: string
}

function LpChart({ points }: { points: (LpHistoryPoint & { time: number; absolute: number })[] }) {
  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'line', height: 130, spacing: [16, 10, 10, 8] },
      xAxis: {
        type: 'datetime',
        labels: { enabled: false },
        lineColor: 'var(--color-header-border)',
        tickLength: 0,
        crosshair: { color: 'var(--color-chip-border)', width: 1, dashStyle: 'Solid' },
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: 'var(--color-header-border)',
        lineWidth: 0,
        allowDecimals: false,
        minTickInterval: 1,
        labels: {
          style: { color: 'var(--color-text-muted)', fontSize: '10px' },
          formatter: function () {
            const rank = rankFromAbsoluteLp(Number(this.value))
            return rank ? formatRankLabel(rank.tier, rank.division) : String(this.value)
          },
        },
      },
      legend: { enabled: false },
      tooltip: {
        useHTML: true,
        backgroundColor: 'var(--color-page)',
        borderColor: 'var(--color-chip-border)',
        borderRadius: 6,
        padding: 0,
        shadow: true,
        formatter: function () {
          const point = this as unknown as Highcharts.Point & { custom: PointCustom }
          const c = point.custom
          const gained = (c.lpDelta ?? 0) >= 0
          const deltaColor = gained ? 'var(--color-win-text)' : 'var(--color-loss-text)'
          const timeLabel = c.isCurrent ? 'now' : formatRelativeTime(new Date(point.x!).toISOString())
          const deltaLine =
            c.lpDelta == null
              ? ''
              : `<span style="font-size:11px;font-weight:bold;color:${deltaColor}">${signed(c.lpDelta)}</span>`
          const gamesLine =
            c.gamesDelta == null || c.gamesDelta === 0
              ? ''
              : ` · ${c.gamesDelta} game${c.gamesDelta === 1 ? '' : 's'}`
          return `
            <div style="padding:6px 8px;font-family:inherit">
              <div style="display:flex;align-items:baseline;gap:8px">
                <span style="font-size:12px;font-weight:bold;color:var(--color-text-primary)">${c.label}</span>
                ${deltaLine}
              </div>
              <div style="font-size:10px;color:var(--color-text-muted)">${timeLabel}${gamesLine}</div>
            </div>
          `
        },
      },
      plotOptions: {
        line: {
          marker: { radius: 3, lineWidth: 0 },
          states: { hover: { lineWidthPlus: 0 } },
        },
      },
      series: [
        {
          type: 'line',
          name: 'LP',
          color: 'var(--color-accent)',
          lineWidth: 2,
          data: points.map((p, i) => ({
            x: p.time,
            y: p.absolute,
            color:
              p.lp_delta == null
                ? 'var(--color-accent)'
                : p.lp_delta >= 0
                  ? 'var(--color-win)'
                  : 'var(--color-loss)',
            custom: {
              lpDelta: p.lp_delta,
              gamesDelta: p.games_delta,
              isCurrent: i === points.length - 1,
              label: `${formatRankLabel(p.tier, p.division)} ${p.lp ?? 0} LP`,
            },
          })),
        },
      ],
    }),
    [points],
  )

  const first = points[0]
  const last = points[points.length - 1]
  const netDelta = last.absolute - first.absolute
  const games = points.reduce((sum, p) => sum + (p.games_delta ?? 0), 0)

  return (
    <div className="flex flex-col gap-1.5">
      <HighchartsReact highcharts={Highcharts} options={options} />
      <div className="flex items-center justify-between text-[10px] text-text-secondary">
        <span>
          {games > 0 ? `${games} ranked game${games === 1 ? '' : 's'}` : 'No games in this window'}
        </span>
        <span
          className="font-bold"
          style={{ color: netDelta >= 0 ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}
        >
          {signed(netDelta)} LP
        </span>
      </div>
    </div>
  )
}

export function LpTrendChart({ points, tier, division }: Props) {
  const [range, setRange] = useState<Range>('month')

  const series = useMemo(
    () =>
      points
        .filter((p) => p.absolute_lp != null)
        .map((p) => ({
          ...p,
          time: new Date(p.captured_at).getTime(),
          absolute: p.absolute_lp as number,
        })),
    [points],
  )

  const visible = useMemo(() => {
    if (range === 'games20') {
      if (series.length === 0) return series
      let total = 0
      let idx = series.length - 1
      for (; idx > 0; idx--) {
        total += series[idx].games_delta ?? 0
        if (total >= 20) break
      }
      return series.slice(idx)
    }
    const ms = RANGE_MS[range]
    const cutoff = ms != null ? Date.now() - ms : 0
    return series.filter((p) => p.time >= cutoff)
  }, [series, range])

  return (
    <div className="flex flex-col gap-2 rounded-card border border-card-border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary">LP trend</span>
        {tier && <span className="text-[11px] font-bold text-accent">{formatRankLabel(tier, division)}</span>}
        <div className="flex-1" />
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`cursor-pointer rounded-card border px-2 py-1 text-[11px] font-bold transition-colors ${
                range === r.key
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-chip-border text-text-secondary hover:border-text-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {series.length === 0 ? (
        <div className="flex h-20 items-center justify-center text-center text-xs text-text-secondary">
          LP history starts from your next sync.
        </div>
      ) : visible.length < 2 ? (
        <div className="flex h-20 items-center justify-center text-center text-xs text-text-secondary">
          Not enough history in this window yet.
        </div>
      ) : (
        <LpChart points={visible} />
      )}
    </div>
  )
}
