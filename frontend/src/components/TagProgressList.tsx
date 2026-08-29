import HighchartsReact from 'highcharts-react-official'
import type { TagCount, TagTaxonomyEntry } from '../api/types'
import { Highcharts } from '../lib/highchartsSetup'
import { getTagColor } from '../lib/tagColors'

interface Props {
  tagCounts: TagCount[]
  taxonomy: TagTaxonomyEntry[]
  gamesConsidered: number
  size?: 'compact' | 'full'
  maxRows?: number
}

interface PointCustom {
  count: number
  pct: number
}

export function TagProgressList({ tagCounts, taxonomy, gamesConsidered, size = 'full', maxRows }: Props) {
  const labelByKey = new Map(taxonomy.map((t) => [t.tag_key, t.label]))
  const sorted = [...tagCounts].sort((a, b) => b.count - a.count)
  const rows = sorted.slice(0, maxRows ?? (size === 'compact' ? 5 : sorted.length))

  if (rows.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-card border border-card-border text-xs text-text-secondary">
        No tagged games yet.
      </div>
    )
  }

  const compact = size === 'compact'
  const rowHeight = compact ? 34 : 46
  const height = rows.length * rowHeight

  const options: Highcharts.Options = {
    chart: { type: 'bar', height, spacing: [4, 14, 4, 4] },
    xAxis: {
      categories: rows.map((r) => labelByKey.get(r.tag_key) ?? r.tag_key),
      reversed: true,
      lineWidth: 0,
      tickLength: 0,
      labels: {
        style: {
          fontSize: compact ? '11px' : '13px',
          color: compact ? 'var(--color-text-secondary-3)' : 'var(--color-text-primary)',
          width: compact ? 112 : 150,
        },
      },
    },
    yAxis: {
      title: { text: undefined },
      labels: { enabled: false },
      gridLineWidth: 0,
      min: 0,
      max: 100,
      endOnTick: false,
      maxPadding: 0.16,
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
          <div style="padding:4px 6px;font-size:11px;color:var(--color-text-primary)">
            ${point.custom.count} game${point.custom.count === 1 ? '' : 's'} · ${point.custom.pct}%
          </div>
        `
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 3,
        borderWidth: 0,
        pointPadding: compact ? 0.18 : 0.12,
        groupPadding: compact ? 0.12 : 0.18,
        dataLabels: {
          enabled: true,
          crop: false,
          overflow: 'allow',
          format: '{point.custom.count}',
          style: { fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-primary)', textOutline: 'none' },
        },
      },
    },
    series: [
      {
        type: 'bar',
        data: rows.map((row) => {
          const pct = gamesConsidered > 0 ? Math.round((row.count / gamesConsidered) * 100) : 0
          return {
            y: pct,
            color: getTagColor(row.tag_key),
            custom: { count: row.count, pct } satisfies PointCustom,
          }
        }),
      },
    ],
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />
}
