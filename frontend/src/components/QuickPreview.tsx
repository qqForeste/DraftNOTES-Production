import { useState } from 'react'
import type { MatchupOut, MatchupRole, MatchupTagTaxonomyEntry, MatchupWeaknessTaxonomyEntry } from '../api/types'
import type { ChampionInfo, RuneMaps } from '../lib/ddragon'
import { DuoSynergyPreview } from './DuoSynergyPreview'
import { MatchupPairPreview } from './MatchupPairPreview'
import { RoleIconSelect, type RoleSelection } from './RoleIconSelect'

const ROLE_NOUN: Record<MatchupRole, string> = {
  TOP: 'top laner',
  JUNGLE: 'jungler',
  MIDDLE: 'mid laner',
  BOTTOM: 'bot laner',
  UTILITY: 'support',
}

const BOT_LANE_ROLES: MatchupRole[] = ['BOTTOM', 'UTILITY']

interface Props {
  championMap: Map<number, ChampionInfo> | null
  runeMaps: RuneMaps | null
  matchups: MatchupOut[]
  taxonomy: MatchupTagTaxonomyEntry[]
  weaknessTaxonomy: MatchupWeaknessTaxonomyEntry[]
}

export function QuickPreview({ championMap, runeMaps, matchups, taxonomy, weaknessTaxonomy }: Props) {
  const [selection, setSelection] = useState<RoleSelection>('TOP')
  const [yourId, setYourId] = useState<number | null>(null)
  const [enemyId, setEnemyId] = useState<number | null>(null)

  const isDuoOnly = selection === 'DUO'
  const role: MatchupRole = isDuoOnly ? 'BOTTOM' : selection
  const showBotLaneEmbed = !isDuoOnly && BOT_LANE_ROLES.includes(role)

  const synergyPanel = <DuoSynergyPreview championMap={championMap} />

  return (
    <div className="flex flex-col rounded-card border border-card-border bg-card p-4.5">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex w-[288px] shrink-0 items-baseline">
          <span className="text-xs font-bold text-text-primary">Quick preview</span>
        </div>
        {}
        <div className="ml-3">
          <RoleIconSelect value={selection} onChange={setSelection} />
        </div>
      </div>

      {isDuoOnly ? (
        synergyPanel
      ) : (
        <>
          <MatchupPairPreview
            role={role}
            topId={yourId}
            bottomId={enemyId}
            onTopChange={setYourId}
            onBottomChange={setEnemyId}
            topLabel="YOU"
            bottomLabel="ENEMY"
            topPlaceholder={`Your ${ROLE_NOUN[role]}`}
            bottomPlaceholder={`Enemy ${ROLE_NOUN[role]}`}
            emptyHint="Pick a champion to see stats."
            championMap={championMap}
            runeMaps={runeMaps}
            matchups={matchups}
            taxonomy={taxonomy}
            weaknessTaxonomy={weaknessTaxonomy}
          />

          {showBotLaneEmbed && (
            <div className="mt-3 flex flex-col gap-2 rounded-card border border-chip-border bg-inset/60 p-3">
              <span className="text-[11px] font-bold text-text-secondary">Bot lane synergy</span>
              {synergyPanel}
            </div>
          )}
        </>
      )}
    </div>
  )
}
