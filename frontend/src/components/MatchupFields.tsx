import type { MatchupTagTaxonomyEntry, MatchupWeaknessTaxonomyEntry } from '../api/types'
import type { ChampionInfo, ItemInfo, RuneMaps } from '../lib/ddragon'
import {
  applyItemRecommendationFill,
  applyRuneRecommendationFill,
  applySkillRecommendationFill,
  clearItemFields,
  clearRuneFields,
  clearSkillFields,
  type MatchupFormState,
} from '../lib/matchupForm'
import { getMatchupTagColor } from '../lib/matchupTagColors'
import type { MatchupRecommendation } from '../lib/recommendation'
import { ConfirmButton } from './ConfirmButton'
import { ItemSelect } from './ItemSelect'
import { MatchupPicker } from './MatchupPicker'
import { MatchupTagPicker } from './MatchupTagPicker'
import { RunePageEditor } from './RunePageEditor'
import { SkillMaxOrder, SkillOrderGrid } from './SkillOrderGrid'

interface Props {
  state: MatchupFormState
  onChange: (state: MatchupFormState) => void
  championMap: Map<number, ChampionInfo> | null
  itemMap: Map<number, ItemInfo> | null
  runeMaps: RuneMaps | null
  taxonomy: MatchupTagTaxonomyEntry[]
  weaknessTaxonomy: MatchupWeaknessTaxonomyEntry[]
  recommendation?: MatchupRecommendation | null
}

function replaceAt<T>(arr: T[], index: number, value: T): T[] {
  const next = [...arr]
  next[index] = value
  return next
}

const SECTION_HEADER_HEIGHT = 'min-h-[28px]'

function Section({
  label,
  actions,
  children,
  className,
}: {
  label: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className={`flex flex-wrap items-center gap-2 ${SECTION_HEADER_HEIGHT}`}>
        <span className="text-xs font-bold text-text-primary">{label}</span>
        <div className="flex-1" />
        {actions}
      </div>
      {children}
    </div>
  )
}

function FillClearActions({
  onFill,
  onClear,
  disabled,
  confirmMessage,
}: {
  onFill: () => void
  onClear: () => void
  disabled: boolean
  confirmMessage: string
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onFill}
        disabled={disabled}
        className="rounded-card border border-chip-border px-2 py-1 text-[10px] font-bold text-text-secondary hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        Fill recommended
      </button>
      <ConfirmButton
        label="Clear"
        confirmLabel="Clear"
        message={confirmMessage}
        onConfirm={onClear}
        className="rounded-card border border-chip-border px-2 py-1 text-[10px] font-bold text-text-secondary hover:border-loss/60 hover:text-loss-text"
      />
    </div>
  )
}

export function MatchupFields({
  state,
  onChange,
  championMap,
  itemMap,
  runeMaps,
  taxonomy,
  weaknessTaxonomy,
  recommendation,
}: Props) {
  const set = (patch: Partial<MatchupFormState>) => onChange({ ...state, ...patch })
  const build = recommendation?.build
  const itemSuggestions = recommendation?.allItemIds ?? []

  return (
    <div className="flex flex-col gap-3">
      <MatchupPicker
        state={state}
        onChange={(picker) => set(picker)}
        championMap={championMap}
        yourSlot={
          <div className="flex flex-col gap-2 border-t border-accent/20 pt-2">
            <Section
              label="Item build"
              actions={
                <FillClearActions
                  onFill={() => recommendation && onChange(applyItemRecommendationFill(state, recommendation))}
                  onClear={() => onChange(clearItemFields(state))}
                  disabled={!recommendation}
                  confirmMessage="Clear the item build? This can't be undone."
                />
              }
            >
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-text-muted">Core items</span>
                  <div className="flex gap-1">
                    {state.coreItemIds.map((id, i) => (
                      <ItemSelect
                        key={i}
                        itemMap={itemMap}
                        value={id}
                        label="Core item"
                        excludeTag="Boots"
                        recommendedId={build?.coreItemIds[i] ?? null}
                        recommendedIds={itemSuggestions}
                        onChange={(itemId) => set({ coreItemIds: replaceAt(state.coreItemIds, i, itemId) })}
                        onClear={() => set({ coreItemIds: replaceAt(state.coreItemIds, i, null) })}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-text-muted">Optional items</span>
                  <div className="flex gap-1">
                    {state.optionalItemIds.map((id, i) => (
                      <ItemSelect
                        key={i}
                        itemMap={itemMap}
                        value={id}
                        label="Optional item"
                        excludeTag="Boots"
                        recommendedId={build?.situationalItemIds[i] ?? null}
                        recommendedIds={itemSuggestions}
                        onChange={(itemId) => set({ optionalItemIds: replaceAt(state.optionalItemIds, i, itemId) })}
                        onClear={() => set({ optionalItemIds: replaceAt(state.optionalItemIds, i, null) })}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-text-muted">Boots</span>
                  <div className="flex gap-1">
                    <ItemSelect
                      itemMap={itemMap}
                      value={state.bootItemId}
                      label="Main boots"
                      includeTag="Boots"
                      recommendedId={build?.bootItemId ?? null}
                      recommendedIds={build?.bootItemId != null ? [build.bootItemId] : []}
                      onChange={(itemId) => set({ bootItemId: itemId })}
                      onClear={() => set({ bootItemId: null })}
                    />
                    <ItemSelect
                      itemMap={itemMap}
                      value={state.optionalBootItemId}
                      label="Optional boots"
                      includeTag="Boots"
                      onChange={(itemId) => set({ optionalBootItemId: itemId })}
                      onClear={() => set({ optionalBootItemId: null })}
                    />
                  </div>
                </div>
              </div>
            </Section>
          </div>
        }
        enemySlot={
          <div className="flex flex-col gap-2 border-t border-loss/20 pt-2">
            <MatchupTagPicker
              label="Enemy strengths"
              taxonomy={taxonomy}
              selected={state.tags}
              onChange={(tags) => set({ tags })}
              getColor={getMatchupTagColor}
            />
            <MatchupTagPicker
              label="Enemy weaknesses"
              taxonomy={weaknessTaxonomy}
              selected={state.weaknesses}
              onChange={(weaknesses) => set({ weaknesses })}
            />
          </div>
        }
      />

      <Section
        label="Runes"
        actions={
          <FillClearActions
            onFill={() => recommendation && onChange(applyRuneRecommendationFill(state, recommendation))}
            onClear={() => onChange(clearRuneFields(state))}
            disabled={!recommendation?.runes}
            confirmMessage="Clear the rune page? This can't be undone."
          />
        }
      >
        <RunePageEditor
          value={state.runes}
          onChange={(runes) => set({ runes })}
          runeMaps={runeMaps}
          recommended={recommendation?.runes ?? null}
        />
      </Section>

      <div className="flex gap-3">
        <Section
          label="Skill priority"
          actions={
            <FillClearActions
              onFill={() => recommendation && onChange(applySkillRecommendationFill(state, recommendation))}
              onClear={() => onChange(clearSkillFields(state))}
              disabled={!recommendation}
              confirmMessage="Clear the skill order? This can't be undone."
            />
          }
        >
          <div className="flex shrink-0 flex-col gap-2 rounded-card border border-chip-border bg-inset p-2.5">
            <SkillOrderGrid
              value={state.skillOrder}
              onChange={(skillOrder) => set({ skillOrder })}
              championId={state.yourChampionId}
              recommended={recommendation?.skillOrder ?? null}
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">Max order</span>
              <SkillMaxOrder order={state.skillOrder} championId={state.yourChampionId} />
            </div>
          </div>
        </Section>

        <Section label="Note" className="flex-1">
          <textarea
            value={state.body}
            onChange={(e) => set({ body: e.target.value })}
            placeholder="Freeze near your tower until 6. Watch for jungle ganks on the second wave."
            className="w-full flex-1 resize-none rounded-card border border-chip-border bg-inset px-2.5 py-2 text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </Section>
      </div>
    </div>
  )
}
