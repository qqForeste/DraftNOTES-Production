import { useMemo, useRef, useState } from 'react'
import HighchartsReact from 'highcharts-react-official'
import type { MistakeTag, TagChampionCount, TagCount, TagTaxonomyEntry } from '../api/types'
import type { ChampionInfo } from '../lib/ddragon'
import { Highcharts } from '../lib/highchartsSetup'
import { getTagColor } from '../lib/tagColors'
import { ChampionIcon } from './ChampionIcon'

interface Props {
  tagCounts: TagCount[]
  taxonomy: TagTaxonomyEntry[]
  tagChampions: TagChampionCount[]
  championMap: Map<number, ChampionInfo> | null
}

const SIZE = 188

interface SliceCustom {
  tagKey: MistakeTag
  pct: number
}

export function MistakePieChart({ tagCounts, taxonomy, tagChampions, championMap }: Props) {
  const labelByKey = new Map(taxonomy.map((t) => [t.tag_key, t.label]))
  const sorted = [...tagCounts].sort((a, b) => b.count - a.count)
  const total = sorted.reduce((sum, t) => sum + t.count, 0)
  const [hovered, setHovered] = useState<MistakeTag | null>(null)
  const [selected, setSelected] = useState<MistakeTag | null>(null)
  const chartRef = useRef<HighchartsReact.RefObject>(null)

  const championsForSelected = useMemo(() => {
    if (!selected) return []
    return tagChampions
      .filter((row) => row.tag_key === selected)
      .map((row) => ({ championId: row.champion_id, count: row.count }))
      .sort((a, b) => b.count - a.count)
  }, [selected, tagChampions])

  const slices = useMemo(
    () =>
      sorted.map((row) => ({
        tagKey: row.tag_key,
        count: row.count,
        pct: total > 0 ? Math.round((row.count / total) * 100) : 0,
        color: getTagColor(row.tag_key),
        label: labelByKey.get(row.tag_key) ?? row.tag_key,
      })),
    [tagCounts, taxonomy],
  )

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'pie', height: SIZE, width: SIZE, margin: [0, 0, 0, 0] },
      tooltip: { enabled: false },
      plotOptions: {
        pie: {
          borderWidth: 1,
          borderColor: 'var(--color-card)',
          dataLabels: { enabled: false },
          states: {
            hover: { halo: { size: 0 } },
            inactive: { opacity: 0.35 },
          },
          point: {
            events: {
              mouseOver: function () {
                const point = this as unknown as Highcharts.Point & { custom: SliceCustom }
                setHovered(point.custom.tagKey)
              },
              mouseOut: function () {
                setHovered(null)
              },
              click: function () {
                const point = this as unknown as Highcharts.Point & { custom: SliceCustom }
                setSelected((prev) => (prev === point.custom.tagKey ? null : point.custom.tagKey))
              },
            },
          },
        },
      },
      series: [
        {
          type: 'pie',
          data: slices.map((s) => ({
            name: s.label,
            y: s.count,
            color: s.color,
            borderWidth: selected === s.tagKey ? 2.5 : 1,
            borderColor: selected === s.tagKey ? s.color : 'var(--color-card)',
            custom: { tagKey: s.tagKey, pct: s.pct } satisfies SliceCustom,
          })),
        },
      ],
    }),
    [slices, selected],
  )

  if (sorted.length === 0 || total === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-card border border-card-border text-xs text-text-secondary">
        No tagged games yet.
      </div>
    )
  }

  const activeSlice = slices.find((s) => s.tagKey === hovered) ?? null

  function toggleSelected(tag: MistakeTag) {
    setSelected((prev) => (prev === tag ? null : tag))
  }

  function setChartHover(tagKey: MistakeTag | null) {
    const chart = chartRef.current?.chart
    if (!chart) return
    for (const point of chart.series[0]?.points ?? []) {
      const custom = (point as Highcharts.Point & { custom: SliceCustom }).custom
      if (tagKey != null && custom.tagKey === tagKey) point.setState('hover')
      else point.setState('')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <HighchartsReact highcharts={Highcharts} options={options} ref={chartRef} />
          {activeSlice && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-card bg-page px-2.5 py-1.5 text-center shadow-lg"
              style={{ border: `1px solid ${activeSlice.color}` }}
            >
              <span className="text-sm font-bold text-text-primary">{activeSlice.pct}%</span>
              <span className="text-[10px] text-text-secondary">{activeSlice.count} games</span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          {slices.map((s) => (
            <div
              key={s.tagKey}
              onMouseEnter={() => {
                setHovered(s.tagKey)
                setChartHover(s.tagKey)
              }}
              onMouseLeave={() => {
                setHovered(null)
                setChartHover(null)
              }}
              onClick={() => toggleSelected(s.tagKey)}
              className="flex cursor-pointer items-center gap-2 rounded-card px-1 py-0.5 transition-colors"
              style={{
                background: selected === s.tagKey ? 'var(--color-chip)' : hovered === s.tagKey ? 'var(--color-inset)' : 'transparent',
                outline: selected === s.tagKey ? `1px solid ${s.color}` : 'none',
              }}
            >
              <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-[11px] text-text-primary">{s.label}</span>
              <span className="text-[10px] text-text-secondary">
                {s.count} · {s.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="flex flex-col gap-1.5 rounded-card border border-chip-border bg-inset p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: getTagColor(selected) }} />
            <span className="text-[11px] font-bold text-text-primary">
              {labelByKey.get(selected) ?? selected} by champion
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[11px] text-text-secondary hover:text-text-primary"
            >
              Close
            </button>
          </div>
          {championsForSelected.length === 0 ? (
            <p className="text-[11px] text-text-secondary">No games with this tag in the loaded notes.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {championsForSelected.map((c) => (
                <div
                  key={c.championId}
                  className="flex items-center gap-1.5 rounded-card border border-chip-border bg-card px-2 py-1"
                >
                  <ChampionIcon championId={c.championId} championMap={championMap} size={20} />
                  <span className="text-[11px] text-text-primary">{championMap?.get(c.championId)?.name ?? '...'}</span>
                  <span className="text-[10px] text-text-secondary">×{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
