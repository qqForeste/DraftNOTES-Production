import HighchartsReact from 'highcharts-react-official'
import type { PositionSummary } from '../api/types'
import { Highcharts } from '../lib/highchartsSetup'
import { ROLE_ORDER } from '../lib/positions'
import { POSITION_ICON_URLS } from '../lib/positionIcons'

interface Props {
  summaries: PositionSummary[]
  height?: number
}

interface PointCustom {
  games: number
  winRatePct: number
}

export function PositionBarChart({ summaries, height = 100 }: Props) {
  const byRole = new Map(summaries.map((s) => [s.team_position, s]))
  const roles = ROLE_ORDER.filter((r) => byRole.has(r))

  if (roles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-text-secondary">
        No synced games yet.
      </div>
    )
  }

  const options: Highcharts.Options = {
    chart: { type: 'column', height, margin: [8, 6, 30, 6] },
    xAxis: {
      categories: roles,
      lineColor: 'var(--color-header-border)',
      tickLength: 0,
      labels: {
        useHTML: true,
        y: 20,
        formatter: function () {
          const role = String(this.value)
          return `<img src="${POSITION_ICON_URLS[role]}" width="18" height="18" alt="" />`
        },
      },
    },
    yAxis: {
      title: { text: undefined },
      labels: { enabled: false },
      gridLineWidth: 0,
      min: 0,
      endOnTick: false,
      maxPadding: 0.22,
    },
    legend: { enabled: false },
    tooltip: {
      useHTML: true,
      backgroundColor: 'var(--color-page)',
      borderColor: 'var(--color-chip-border)',
      borderRadius: 6,
      formatter: function () {
        const point = this as unknown as Highcharts.Point & { custom: PointCustom }
        return `
          <div style="padding:4px 6px">
            <div style="font-size:11px;font-weight:bold;color:var(--color-text-primary)">${point.custom.games} games</div>
            <div style="font-size:10px;color:var(--color-text-secondary)">${point.custom.winRatePct}% win rate</div>
          </div>
        `
      },
    },
    plotOptions: {
      column: {
        borderRadius: 3,
        borderWidth: 0,
        pointPadding: 0.15,
        groupPadding: 0.1,
        dataLabels: {
          enabled: true,
          crop: false,
          overflow: 'allow',
          format: '{y}%',
          style: { fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-secondary-3)', textOutline: 'none' },
        },
      },
    },
    series: [
      {
        type: 'column',
        data: roles.map((role) => {
          const s = byRole.get(role)!
          return {
            y: s.pick_rate_pct,
            color: 'var(--color-accent)',
            custom: { games: s.games, winRatePct: s.win_rate_pct } satisfies PointCustom,
          }
        }),
      },
    ],
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />
}
