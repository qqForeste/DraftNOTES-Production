import { useMemo, useRef } from 'react'
import HighchartsReact from 'highcharts-react-official'
import { useNavigate } from 'react-router-dom'
import type { TagTaxonomyEntry, TrendPoint } from '../api/types'
import { Highcharts } from '../lib/highchartsSetup'
import { getTagColor } from '../lib/tagColors'

interface Props {
  points: TrendPoint[]
  taxonomy?: TagTaxonomyEntry[]
}

interface PointCustom {
  matchId: string
  win: boolean
  when: string
  tagsHtml: string
  dotsHtml: string
}

export function TrendChart({ points, taxonomy = [] }: Props) {
  const navigate = useNavigate()
  const chartRef = useRef<HighchartsReact.RefObject>(null)

  const options: Highcharts.Options = useMemo(() => {
    const labelFor = (tag: string) => taxonomy.find((t) => t.tag_key === tag)?.label ?? tag

    return {
      chart: { type: 'column', height: 120, margin: [22, 2, 2, 2] },
      xAxis: { visible: false },
      yAxis: { visible: false, min: 0, max: 62 },
      legend: { enabled: false },
      tooltip: {
        useHTML: true,
        animation: false,
        hideDelay: 0,
        backgroundColor: 'var(--color-page)',
        borderColor: 'var(--color-chip-border)',
        borderRadius: 6,
        formatter: function () {
          const point = this as unknown as Highcharts.Point & { custom: PointCustom }
          const c = point.custom
          const resultColor = c.win ? 'var(--color-win-text)' : 'var(--color-loss-text)'
          return `
            <div style="padding:6px 8px">
              <div style="font-size:11px;font-weight:bold;color:${resultColor}">${c.win ? 'Win' : 'Loss'} · ${c.when}</div>
              ${c.tagsHtml ? `<div style="display:flex;flex-direction:column;gap:2px;margin-top:4px">${c.tagsHtml}</div>` : ''}
              <div style="font-size:10px;color:var(--color-text-muted);margin-top:4px">Click to open in match history</div>
            </div>
          `
        },
      },
      plotOptions: {
        column: {
          borderRadius: 2,
          borderWidth: 0,
          pointPadding: 0.08,
          groupPadding: 0.06,
          cursor: 'pointer',
          states: { hover: { brightness: 0.25, animation: { duration: 60 } } },
          dataLabels: {
            enabled: true,
            useHTML: true,
            allowOverlap: true,
            crop: false,
            overflow: 'allow',
            formatter: function () {
              const point = this as unknown as Highcharts.Point & { custom: PointCustom }
              if (!point.custom.dotsHtml) return ''
              return `<div style="display:flex;flex-direction:column;gap:2px;align-items:center;pointer-events:none">${point.custom.dotsHtml}</div>`
            },
          },
        },
      },
      series: [
        {
          type: 'column',
          data: points.map((p) => {
            const when = new Date(p.game_creation).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            const dotsHtml = p.tags
              .map(
                (tag) =>
                  `<span style="display:block;width:5px;height:5px;border-radius:50%;background:${getTagColor(tag)}"></span>`,
              )
              .join('')
            const tagsHtml = p.tags
              .map(
                (tag) => `
                  <div style="display:flex;align-items:center;gap:5px">
                    <span style="display:block;width:6px;height:6px;border-radius:50%;background:${getTagColor(tag)};flex-shrink:0"></span>
                    <span style="font-size:10px;color:var(--color-text-secondary)">${labelFor(tag)}</span>
                  </div>
                `,
              )
              .join('')
            return {
              y: p.win ? 52 : 34,
              color: p.win ? 'var(--color-win)' : 'var(--color-loss)',
              custom: { matchId: p.match_id, win: p.win, when, tagsHtml, dotsHtml } satisfies PointCustom,
            }
          }),
        },
      ],
    }
  }, [points, taxonomy])

  if (points.length === 0) {
    return <div className="flex h-[120px] items-center justify-center text-xs text-text-secondary">No games yet.</div>
  }

  function handleClick() {
    const point = chartRef.current?.chart?.hoverPoint as (Highcharts.Point & { custom: PointCustom }) | undefined
    if (point) navigate(`/?expand=${point.custom.matchId}`)
  }

  return (
    <div onClick={handleClick}>
      <HighchartsReact highcharts={Highcharts} options={options} ref={chartRef} />
    </div>
  )
}
