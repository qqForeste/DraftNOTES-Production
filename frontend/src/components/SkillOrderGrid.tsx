import type { SkillKey, SkillOrder } from '../api/types'
import { useChampionSpells } from '../lib/ddragon'
import { assignSkill, canAssign, MAX_LEVEL, maxOrder, SKILL_KEYS, ULTIMATE_LEVELS } from '../lib/runes'
import { HoverCard } from './HoverCard'

interface Props {
  value: SkillOrder
  onChange?: (order: SkillOrder) => void
  championId: number | null
  recommended?: SkillOrder | null
}

const LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1)

export function SkillMaxOrder({
  order,
  championId,
  className,
}: {
  order: SkillOrder
  championId: number | null
  className?: string
}) {
  const keys = maxOrder(order)
  const spells = useChampionSpells(championId)
  if (keys.length === 0) return null
  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      {keys.map((key, i) => {
        const spell = spells?.find((s) => s.key === key)
        return (
          <div key={key} className="flex items-center gap-1">
            {i > 0 && <span className="text-[10px] text-text-muted">›</span>}
            <div className="flex flex-col items-center gap-0.5">
              {spell ? (
                <img src={spell.iconUrl} alt="" className="h-4 w-4 rounded-sm" />
              ) : (
                <div className="h-4 w-4 rounded-sm border border-chip-border bg-inset" />
              )}
              <span className="text-[8px] font-bold leading-none text-text-secondary">{key}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SkillOrderGrid({ value, onChange, championId, recommended }: Props) {
  const spells = useChampionSpells(championId)
  const editable = onChange != null

  function cellState(key: SkillKey, level: number) {
    const assigned = value[level - 1] === key
    const suggested = !assigned && recommended?.[level - 1] === key
    return { assigned, suggested }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="w-[32px] shrink-0" />
        {LEVELS.map((level) => (
          <span
            key={level}
            className={`h-[20px] w-[20px] shrink-0 text-center text-[9px] leading-[20px] ${
              ULTIMATE_LEVELS.includes(level) ? 'font-bold text-text-secondary' : 'text-text-muted'
            }`}
          >
            {level}
          </span>
        ))}
      </div>

      {SKILL_KEYS.map((key, rowIndex) => {
        const spell = spells?.[rowIndex]
        return (
          <div key={key} className="flex items-center gap-1">
            <div className="flex w-[32px] shrink-0 flex-col items-center gap-0.5">
              <HoverCard
                content={
                  <>
                    <div className="mb-1 text-xs font-bold text-text-primary">
                      {key} · {spell?.name ?? 'Ability'}
                    </div>
                    <div>{spell?.description || 'No ability data loaded.'}</div>
                  </>
                }
              >
                {spell ? (
                  <img src={spell.iconUrl} alt="" className="h-[24px] w-[24px] rounded-sm" />
                ) : (
                  <div className="h-[24px] w-[24px] rounded-sm border border-chip-border bg-inset" />
                )}
              </HoverCard>
              <span className="text-[9px] font-bold leading-none text-text-secondary">{key}</span>
            </div>

            {LEVELS.map((level) => {
              const { assigned, suggested } = cellState(key, level)
              const allowed = editable && canAssign(value, level, key)
              const base = 'h-[20px] w-[20px] shrink-0 rounded-sm border text-[9px] font-bold leading-none'
              const tone = assigned
                ? 'border-accent bg-accent/25 text-accent'
                : suggested
                  ? 'border-dashed border-accent/50 bg-transparent text-accent/60'
                  : 'border-chip-border bg-inset text-transparent'

              if (!editable) {
                return (
                  <div key={level} className={`${base} ${tone} flex items-center justify-center`}>
                    {assigned ? level : ''}
                  </div>
                )
              }
              return (
                <button
                  key={level}
                  type="button"
                  disabled={!allowed}
                  onClick={() => onChange(assignSkill(value, level, key))}
                  title={`${key} at level ${level}`}
                  className={`${base} ${tone} flex items-center justify-center transition-colors ${
                    allowed ? 'cursor-pointer hover:border-accent/70' : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  {assigned ? level : ''}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
