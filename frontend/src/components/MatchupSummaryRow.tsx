import type { MatchupOut, MatchupTagTaxonomyEntry, MatchupWeaknessTaxonomyEntry } from '../api/types'
import type { ChampionInfo } from '../lib/ddragon'
import { getMatchupTagColor } from '../lib/matchupTagColors'
import { getPositionLabel } from '../lib/positions'
import { ChampionIcon } from './ChampionIcon'

interface Props {
  matchup: MatchupOut
  championMap: Map<number, ChampionInfo> | null
  taxonomy: MatchupTagTaxonomyEntry[]
  weaknessTaxonomy: MatchupWeaknessTaxonomyEntry[]
  onClick?: () => void
  selected?: boolean
}

export function MatchupSummaryRow({ matchup, championMap, taxonomy, weaknessTaxonomy, onClick, selected }: Props) {
  const Root = onClick ? 'button' : 'div'

  return (
    <Root
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full flex-col gap-1.5 rounded-card border px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'border-accent/60 bg-accent/10'
          : onClick
            ? 'border-chip-border bg-inset hover:border-text-muted'
            : 'border-chip-border bg-inset'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-card border border-chip-border px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
          {getPositionLabel(matchup.role)}
        </span>
        <div className="flex items-center gap-1">
          <ChampionIcon championId={matchup.your_champion_id} championMap={championMap} size={18} />
        </div>
        <span className="text-[10px] text-text-muted">vs</span>
        <div className="flex items-center gap-1">
          <ChampionIcon championId={matchup.enemy_champion_id} championMap={championMap} size={18} />
        </div>
      </div>
      {(matchup.tags.length > 0 || matchup.weaknesses.length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 text-[9px] font-bold uppercase tracking-wide text-text-muted">Enemy:</span>
          {matchup.tags.map((tag) => (
            <span
              key={tag}
              className="whitespace-nowrap rounded-card px-1.5 py-0.5 text-[9px] font-bold text-white"
              style={{ background: getMatchupTagColor(tag) }}
            >
              {taxonomy.find((t) => t.tag_key === tag)?.label ?? tag}
            </span>
          ))}
          {matchup.weaknesses.map((tag) => (
            <span
              key={tag}
              className="whitespace-nowrap rounded-card border px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                background: 'var(--color-loss-bg)',
                borderColor: 'var(--color-loss-border)',
                color: 'var(--color-loss-text)',
              }}
            >
              {weaknessTaxonomy.find((t) => t.tag_key === tag)?.label ?? tag}
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-text-secondary-4">{matchup.body?.trim() || 'No note yet.'}</p>
    </Root>
  )
}
