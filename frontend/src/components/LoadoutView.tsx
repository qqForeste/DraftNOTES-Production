import type { RunePage, SkillOrder } from '../api/types'
import type { RuneMaps } from '../lib/ddragon'
import { isRunePageEmpty, isSkillOrderEmpty } from '../lib/runes'
import { ItemSlot } from './ItemSlot'
import { RunePageView } from './RunePageView'
import { SkillOrderGrid } from './SkillOrderGrid'

interface Props {
  title: React.ReactNode
  championId: number
  runeMaps: RuneMaps | null
  coreItemIds: (number | null)[]
  bootItemId: number | null
  optionalBootItemId?: number | null
  situationalItemIds: (number | null)[]
  runes: RunePage | null
  skillOrder: SkillOrder
  compactSkills?: boolean
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-1 w-[68px] shrink-0 text-[10px] text-text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

export function LoadoutView({
  title,
  championId,
  runeMaps,
  coreItemIds,
  bootItemId,
  optionalBootItemId,
  situationalItemIds,
  runes,
  skillOrder,
  compactSkills,
}: Props) {
  const coreIds = coreItemIds.filter((id): id is number => id != null)
  const situationalIds = situationalItemIds.filter((id): id is number => id != null)
  const hasCoreRow = coreIds.length > 0 || bootItemId != null || optionalBootItemId != null
  const hasRunes = runes != null && !isRunePageEmpty(runes)
  const hasSkills = !isSkillOrderEmpty(skillOrder)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold text-text-secondary">{title}</span>

      {hasCoreRow && (
        <Row label="Core">
          {coreIds.map((id, i) => (
            <ItemSlot key={`core-${id}-${i}`} itemId={id} size={28} />
          ))}
          {bootItemId != null && (
            <>
              <span className="px-1 text-[10px] text-text-muted">+</span>
              <ItemSlot itemId={bootItemId} size={28} />
            </>
          )}
          {optionalBootItemId != null && <ItemSlot itemId={optionalBootItemId} size={28} />}
        </Row>
      )}

      {situationalIds.length > 0 && (
        <Row label="Situational">
          {situationalIds.map((id, i) => (
            <ItemSlot key={`sit-${id}-${i}`} itemId={id} size={28} />
          ))}
        </Row>
      )}

      {hasRunes && (
        <Row label="Runes">
          <RunePageView page={runes!} runeMaps={runeMaps} />
        </Row>
      )}

      {!compactSkills && hasSkills && (
        <Row label="Skills">
          <SkillOrderGrid value={skillOrder} championId={championId} />
        </Row>
      )}

      {!hasCoreRow && situationalIds.length === 0 && !hasRunes && !hasSkills && (
        <p className="text-[11px] text-text-muted">No build saved for this guide yet.</p>
      )}
    </div>
  )
}
