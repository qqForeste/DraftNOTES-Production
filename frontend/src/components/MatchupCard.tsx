import { useState } from 'react'
import { deleteMatchup, updateMatchup } from '../api/client'
import type { MatchupOut, MatchupTagTaxonomyEntry, MatchupWeaknessTaxonomyEntry } from '../api/types'
import type { ChampionInfo, ItemInfo, RuneMaps } from '../lib/ddragon'
import { useMatchupRecommendation } from '../lib/recommendation'
import { isRunePageEmpty, isSkillOrderEmpty, normalizeRunePage, normalizeSkillOrder } from '../lib/runes'
import { ChampionIcon } from './ChampionIcon'
import { ConfirmButton } from './ConfirmButton'
import { HoverCard } from './HoverCard'
import { ItemTooltip } from './ItemTooltip'
import type { MatchupFormState } from '../lib/matchupForm'
import { MatchupFields } from './MatchupFields'
import { RunePageView } from './RunePageView'
import { SkillMaxOrder, SkillOrderGrid } from './SkillOrderGrid'
import { getMatchupTagColor } from '../lib/matchupTagColors'
import { getPositionLabel } from '../lib/positions'

interface Props {
  matchup: MatchupOut
  championMap: Map<number, ChampionInfo> | null
  itemMap: Map<number, ItemInfo> | null
  runeMaps: RuneMaps | null
  taxonomy: MatchupTagTaxonomyEntry[]
  weaknessTaxonomy: MatchupWeaknessTaxonomyEntry[]
  onUpdate: (matchup: MatchupOut) => void
  onDelete: (id: number) => void
}

function toFormState(matchup: MatchupOut): MatchupFormState {
  return {
    role: matchup.role,
    yourChampionId: matchup.your_champion_id,
    enemyChampionId: matchup.enemy_champion_id,
    tags: matchup.tags,
    weaknesses: matchup.weaknesses,
    body: matchup.body ?? '',
    coreItemIds: matchup.core_item_ids.length === 3 ? matchup.core_item_ids : [null, null, null],
    optionalItemIds: matchup.optional_item_ids.length === 3 ? matchup.optional_item_ids : [null, null, null],
    bootItemId: matchup.boot_item_id,
    optionalBootItemId: matchup.optional_boot_item_id,
    runes: normalizeRunePage(matchup.runes),
    skillOrder: normalizeSkillOrder(matchup.skill_order),
  }
}

function ChampionBadge({
  championId,
  championMap,
}: {
  championId: number
  championMap: Map<number, ChampionInfo> | null
}) {
  return (
    <div className="flex items-center gap-1">
      <ChampionIcon championId={championId} championMap={championMap} size={24} />
      <span className="truncate text-[11px] text-text-primary">{championMap?.get(championId)?.name ?? '...'}</span>
    </div>
  )
}

function ItemIcon({ itemId, itemMap }: { itemId: number; itemMap: Map<number, ItemInfo> | null }) {
  const item = itemMap?.get(itemId)
  if (!item) return <div className="h-5 w-5 rounded-sm bg-chip" />
  return (
    <HoverCard content={<ItemTooltip item={item} />} interactive>
      <img src={item.iconUrl} alt="" className="h-5 w-5 rounded-sm" />
    </HoverCard>
  )
}

export function MatchupCard({
  matchup,
  championMap,
  itemMap,
  runeMaps,
  taxonomy,
  weaknessTaxonomy,
  onUpdate,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [showFullGuide, setShowFullGuide] = useState(false)
  const [form, setForm] = useState<MatchupFormState>(() => toFormState(matchup))
  const [saving, setSaving] = useState(false)
  const recommendation = useMatchupRecommendation(
    editing ? form.yourChampionId : null,
    editing ? form.enemyChampionId : null,
  )

  function startEdit() {
    setForm(toFormState(matchup))
    setEditing(true)
  }

  async function handleSave() {
    if (!form.yourChampionId || !form.enemyChampionId) return
    setSaving(true)
    try {
      const updated = await updateMatchup(matchup.id, {
        role: form.role,
        your_champion_id: form.yourChampionId,
        enemy_champion_id: form.enemyChampionId,
        tags: form.tags,
        weaknesses: form.weaknesses,
        body: form.body.trim() || null,
        core_item_ids: form.coreItemIds,
        optional_item_ids: form.optionalItemIds,
        boot_item_id: form.bootItemId,
        optional_boot_item_id: form.optionalBootItemId,
        runes: form.runes,
        skill_order: form.skillOrder,
      })
      onUpdate(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteMatchup(matchup.id)
      onDelete(matchup.id)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="col-span-3 flex flex-col gap-3 rounded-card border border-card-border bg-card p-4.5">
        <MatchupFields
          state={form}
          onChange={setForm}
          championMap={championMap}
          itemMap={itemMap}
          runeMaps={runeMaps}
          taxonomy={taxonomy}
          weaknessTaxonomy={weaknessTaxonomy}
          recommendation={recommendation}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-card bg-accent px-3 py-1.5 text-[11px] font-bold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded-card border border-chip-border px-2.5 py-1.5 text-[11px] text-text-secondary hover:border-text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex-1" />
          <ConfirmButton
            label="Delete matchup"
            confirmLabel="Delete"
            message="Delete this matchup? This can't be undone."
            onConfirm={handleDelete}
            disabled={saving}
          />
        </div>
      </div>
    )
  }

  const buildItemIds = [
    ...matchup.core_item_ids,
    matchup.boot_item_id,
    matchup.optional_boot_item_id,
    ...matchup.optional_item_ids,
  ].filter((id): id is number => id != null)

  const runes = normalizeRunePage(matchup.runes)
  const skillOrder = normalizeSkillOrder(matchup.skill_order)
  const hasRunes = !isRunePageEmpty(runes)
  const hasSkills = !isSkillOrderEmpty(skillOrder)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          startEdit()
        }
      }}
      className="flex cursor-pointer flex-col gap-1.5 rounded-card border border-card-border bg-card p-2.5 text-left transition-colors hover:border-text-muted"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-card border border-chip-border px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
          {getPositionLabel(matchup.role)}
        </span>
        <div className="flex-1 truncate">
          <ChampionBadge championId={matchup.your_champion_id} championMap={championMap} />
        </div>
        <span className="shrink-0 text-[10px] font-bold text-text-muted">vs</span>
        <div className="flex-1 truncate">
          <ChampionBadge championId={matchup.enemy_champion_id} championMap={championMap} />
        </div>
      </div>

      {(matchup.tags.length > 0 || matchup.weaknesses.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {matchup.tags.map((tag) => (
            <div
              key={tag}
              className="whitespace-nowrap rounded-card px-1.5 py-0.5 text-[9px] font-bold text-white"
              style={{ background: getMatchupTagColor(tag) }}
            >
              {taxonomy.find((t) => t.tag_key === tag)?.label ?? tag}
            </div>
          ))}
          {matchup.weaknesses.map((tag) => (
            <div
              key={tag}
              className="whitespace-nowrap rounded-card border px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                background: 'var(--color-loss-bg)',
                borderColor: 'var(--color-loss-border)',
                color: 'var(--color-loss-text)',
              }}
            >
              {weaknessTaxonomy.find((t) => t.tag_key === tag)?.label ?? tag}
            </div>
          ))}
        </div>
      )}

      {(buildItemIds.length > 0 || hasRunes || hasSkills) && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {hasRunes && <RunePageView page={runes} runeMaps={runeMaps} variant="compact" />}
          {hasRunes && buildItemIds.length > 0 && <span className="h-4 w-px bg-chip-border" />}
          {buildItemIds.map((id, i) => (
            <ItemIcon key={`${id}-${i}`} itemId={id} itemMap={itemMap} />
          ))}
          {hasSkills && (
            <>
              <div className="flex-1" />
              <SkillMaxOrder order={skillOrder} championId={matchup.your_champion_id} />
            </>
          )}
        </div>
      )}

      <p className={`text-[11px] leading-snug text-text-secondary-4 ${showFullGuide ? '' : 'line-clamp-1'}`}>
        {matchup.body?.trim() || 'No note yet.'}
      </p>

      {(hasRunes || hasSkills) && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowFullGuide((v) => !v)
            }}
            className="flex items-center gap-1 self-start text-[10px] text-text-secondary hover:text-text-primary"
          >
            <svg
              width={10}
              height={10}
              viewBox="0 0 16 16"
              className="transition-transform"
              style={{ transform: showFullGuide ? 'rotate(180deg)' : undefined }}
              aria-hidden="true"
            >
              <path
                d="M4 6.5 8 10.5 12 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {showFullGuide ? 'Hide full guide' : 'Show full guide'}
          </button>

          {showFullGuide && (
            <div className="flex flex-col gap-2.5 rounded-card border border-chip-border bg-inset p-3">
              {hasRunes && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-text-secondary">RUNES</span>
                  <RunePageView page={runes} runeMaps={runeMaps} />
                </div>
              )}
              {hasSkills && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-text-secondary">SKILL ORDER</span>
                  <SkillOrderGrid
                    value={skillOrder}
                    championId={matchup.your_champion_id}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
