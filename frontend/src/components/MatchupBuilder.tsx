import { useEffect, useMemo, useState } from 'react'
import { createMatchup, listMatches, updateMatchup } from '../api/client'
import type {
  MatchListItem,
  MatchupOut,
  MatchupPlaystyleTag,
  MatchupRole,
  MatchupTagTaxonomyEntry,
  MatchupWeaknessTag,
  MatchupWeaknessTaxonomyEntry,
  RunePage,
  SkillOrder,
} from '../api/types'
import type { ChampionInfo, ItemInfo, RuneMaps } from '../lib/ddragon'
import { formatRelativeTime } from '../lib/format'
import { expectedMatchupContext, findExistingMatchup } from '../lib/matchupIds'
import { getPositionLabel } from '../lib/positions'
import { getQueueLabel } from '../lib/queue'
import { useMatchupRecommendation } from '../lib/recommendation'
import { isRunePageEmpty, isSkillOrderEmpty, normalizeRunePage, normalizeSkillOrder } from '../lib/runes'
import { enemyChampionIds } from '../lib/scoreboard'
import { ChampionIcon } from './ChampionIcon'
import { emptyMatchupForm, type MatchupFormState } from '../lib/matchupForm'
import { MatchupFields } from './MatchupFields'
import { MatchupSummaryRow } from './MatchupSummaryRow'
import { RecommendedLoadout } from './RecommendedLoadout'

const MAX_TAGS = 4

function emptyForm(role: MatchupRole): MatchupFormState {
  return emptyMatchupForm(role)
}

function mergeItemSlots(existing: (number | null)[], incoming: (number | null)[]): (number | null)[] {
  return existing.map((existingId, i) => incoming[i] ?? existingId)
}

function mergeRunes(existing: RunePage, incoming: RunePage): RunePage {
  if (isRunePageEmpty(incoming)) return existing
  const primarySwapped =
    incoming.primary_style_id != null && incoming.primary_style_id !== existing.primary_style_id
  const secondarySwapped =
    incoming.secondary_style_id != null && incoming.secondary_style_id !== existing.secondary_style_id
  return {
    primary_style_id: incoming.primary_style_id ?? existing.primary_style_id,
    primary_rune_ids: primarySwapped
      ? incoming.primary_rune_ids
      : mergeItemSlots(existing.primary_rune_ids, incoming.primary_rune_ids),
    secondary_style_id: incoming.secondary_style_id ?? existing.secondary_style_id,
    secondary_rune_ids: secondarySwapped
      ? incoming.secondary_rune_ids
      : mergeItemSlots(existing.secondary_rune_ids, incoming.secondary_rune_ids),
    stat_shard_ids: mergeItemSlots(existing.stat_shard_ids, incoming.stat_shard_ids),
  }
}

function mergeSkillOrder(existing: SkillOrder, incoming: SkillOrder): SkillOrder {
  return isSkillOrderEmpty(incoming) ? existing : incoming
}

function mergeNote(
  existing: MatchupOut,
  form: MatchupFormState,
): {
  tags: MatchupPlaystyleTag[]
  weaknesses: MatchupWeaknessTag[]
  body: string | null
  core_item_ids: (number | null)[]
  optional_item_ids: (number | null)[]
  boot_item_id: number | null
  optional_boot_item_id: number | null
  runes: RunePage
  skill_order: SkillOrder
} {
  const tags = [...new Set([...existing.tags, ...form.tags])].slice(0, MAX_TAGS)
  const weaknesses = [...new Set([...existing.weaknesses, ...form.weaknesses])].slice(0, MAX_TAGS)
  const existingBody = existing.body?.trim() ?? ''
  const incoming = form.body.trim()
  let body: string
  if (!existingBody) body = incoming
  else if (!incoming || incoming === existingBody) body = existingBody
  else body = `${existingBody}\n\n${incoming}`
  return {
    tags,
    weaknesses,
    body: body || null,
    core_item_ids: mergeItemSlots(existing.core_item_ids, form.coreItemIds),
    optional_item_ids: mergeItemSlots(existing.optional_item_ids, form.optionalItemIds),
    boot_item_id: form.bootItemId ?? existing.boot_item_id,
    optional_boot_item_id: form.optionalBootItemId ?? existing.optional_boot_item_id,
    runes: mergeRunes(normalizeRunePage(existing.runes), form.runes),
    skill_order: mergeSkillOrder(normalizeSkillOrder(existing.skill_order), form.skillOrder),
  }
}

interface Props {
  championMap: Map<number, ChampionInfo> | null
  itemMap: Map<number, ItemInfo> | null
  runeMaps: RuneMaps | null
  taxonomy: MatchupTagTaxonomyEntry[]
  weaknessTaxonomy: MatchupWeaknessTaxonomyEntry[]
  matchups: MatchupOut[]
  onSaved: (matchup: MatchupOut) => void
  importedMatch?: MatchListItem | null
  onImportConsumed?: () => void
}

export function MatchupBuilder({
  championMap,
  itemMap,
  runeMaps,
  taxonomy,
  weaknessTaxonomy,
  matchups,
  onSaved,
  importedMatch,
  onImportConsumed,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState<MatchupFormState>(() => emptyForm('TOP'))
  const [saving, setSaving] = useState(false)
  const [activeImport, setActiveImport] = useState<MatchListItem | null>(null)
  const [importPickerOpen, setImportPickerOpen] = useState(false)
  const [recentMatches, setRecentMatches] = useState<MatchListItem[] | null>(null)

  function applyImport(match: MatchListItem) {
    const context = expectedMatchupContext(match)
    const nextRole = context?.role ?? 'TOP'
    setForm({ ...emptyForm(nextRole), yourChampionId: match.champion_id })
    setExpanded(true)
    setActiveImport(match)
    setImportPickerOpen(false)
  }

  useEffect(() => {
    if (importedMatch) {
      applyImport(importedMatch)
      onImportConsumed?.()
    }
  }, [importedMatch])

  function toggleImportPicker() {
    setImportPickerOpen((v) => (expanded ? !v : true))
    setExpanded(true)
    if (recentMatches === null) {
      listMatches().then((page) => setRecentMatches(page?.items ?? []))
    }
  }

  const canSave = form.yourChampionId != null && form.enemyChampionId != null

  const existingMatch = useMemo(() => {
    if (form.yourChampionId == null || form.enemyChampionId == null) return undefined
    return findExistingMatchup(matchups, form.role, form.yourChampionId, form.enemyChampionId)
  }, [matchups, form.role, form.yourChampionId, form.enemyChampionId])

  const recommendation = useMatchupRecommendation(form.yourChampionId, form.enemyChampionId)

  useEffect(() => {
    if (!existingMatch) return
    setForm((f) => ({
      ...f,
      tags: f.tags.length > 0 ? f.tags : existingMatch.tags,
      weaknesses: f.weaknesses.length > 0 ? f.weaknesses : existingMatch.weaknesses,
      body: f.body.trim() ? f.body : (existingMatch.body ?? ''),
      coreItemIds: mergeItemSlots(normalizeSlots(existingMatch.core_item_ids), f.coreItemIds),
      optionalItemIds: mergeItemSlots(normalizeSlots(existingMatch.optional_item_ids), f.optionalItemIds),
      bootItemId: f.bootItemId ?? existingMatch.boot_item_id,
      optionalBootItemId: f.optionalBootItemId ?? existingMatch.optional_boot_item_id,
      runes: isRunePageEmpty(f.runes) ? normalizeRunePage(existingMatch.runes) : f.runes,
      skillOrder: isSkillOrderEmpty(f.skillOrder) ? normalizeSkillOrder(existingMatch.skill_order) : f.skillOrder,
    }))
  }, [existingMatch])

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = {
        role: form.role,
        your_champion_id: form.yourChampionId!,
        enemy_champion_id: form.enemyChampionId!,
      }
      const saved = existingMatch
        ? await updateMatchup(existingMatch.id, { ...payload, ...mergeNote(existingMatch, form) })
        : await createMatchup({
            ...payload,
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
      onSaved(saved)
      setForm(emptyForm('TOP'))
      setActiveImport(null)
    } finally {
      setSaving(false)
    }
  }

  const importEnemies = activeImport ? enemyChampionIds(activeImport) : []

  return (
    <div className="flex flex-col gap-3 rounded-card border border-card-border bg-card p-4.5">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
        className="-m-1 flex cursor-pointer flex-wrap items-baseline gap-2 rounded-card p-1 hover:bg-chip/40"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
          <svg
            width={14}
            height={14}
            viewBox="0 0 16 16"
            className="transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
            aria-hidden="true"
          >
            <path
              d="M4 6.5 8 10.5 12 6.5"
              fill="none"
              stroke="var(--color-text-secondary)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Matchup builder
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleImportPicker()
          }}
          className={`rounded-card border px-2.5 py-1 text-[11px] font-bold transition-colors ${
            importPickerOpen
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-chip-border text-text-secondary hover:border-text-muted'
          }`}
        >
          Import game
        </button>
      </div>

      {expanded && (
        <>
          {importPickerOpen && (
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-card border border-chip-border bg-inset p-2">
              {recentMatches === null ? (
                <span className="px-1.5 py-2 text-[11px] text-text-muted">Loading…</span>
              ) : recentMatches.length === 0 ? (
                <span className="px-1.5 py-2 text-[11px] text-text-muted">No games synced yet.</span>
              ) : (
                recentMatches.map((m) => (
                  <button
                    key={m.match_id}
                    type="button"
                    onClick={() => applyImport(m)}
                    className="flex items-center gap-2 rounded-card px-1.5 py-1 text-left text-xs hover:bg-chip"
                  >
                    <ChampionIcon championId={m.champion_id} championMap={championMap} size={22} />
                    <span className="text-text-primary">{championMap?.get(m.champion_id)?.name ?? '...'}</span>
                    <span className="text-text-secondary">{getPositionLabel(m.team_position)}</span>
                    <span
                      className="font-bold"
                      style={{ color: m.win ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}
                    >
                      {m.win ? 'Win' : 'Loss'}
                    </span>
                    <div className="flex-1" />
                    <span className="text-text-muted">{formatRelativeTime(m.game_creation)}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {activeImport && (
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-chip-border bg-inset px-3 py-2">
              <ChampionIcon championId={activeImport.champion_id} championMap={championMap} size={20} />
              <span className="text-[11px] text-text-secondary">
                Imported {activeImport.win ? 'a win' : 'a loss'} on {championMap?.get(activeImport.champion_id)?.name}{' '}
                · {getQueueLabel(activeImport.queue_id)} · {formatRelativeTime(activeImport.game_creation)}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setActiveImport(null)}
                className="text-[11px] text-text-secondary hover:text-text-primary"
              >
                Clear import
              </button>
            </div>
          )}

          {activeImport && form.enemyChampionId == null && importEnemies.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-text-secondary">Enemy team in this game</span>
              <div className="flex flex-wrap gap-1.5">
                {importEnemies.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, enemyChampionId: id }))}
                    className="flex items-center gap-1.5 rounded-card border border-chip-border px-1.5 py-1 hover:border-loss/50 hover:bg-loss/10"
                  >
                    <ChampionIcon championId={id} championMap={championMap} size={20} />
                    <span className="text-[11px] text-text-primary">{championMap?.get(id)?.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {recommendation && form.yourChampionId != null && (
            <div className="rounded-card border border-chip-border bg-inset p-3">
              <RecommendedLoadout
                recommendation={recommendation}
                championId={form.yourChampionId}
                championMap={championMap}
                runeMaps={runeMaps}
              />
            </div>
          )}

          {existingMatch && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-text-secondary">Updating</span>
              <MatchupSummaryRow
                matchup={existingMatch}
                championMap={championMap}
                taxonomy={taxonomy}
                weaknessTaxonomy={weaknessTaxonomy}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canSave}
              className="rounded-card bg-accent px-3 py-1.5 text-[11px] font-bold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : existingMatch ? 'Update matchup' : 'Save matchup'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm('TOP'))
                setActiveImport(null)
              }}
              disabled={saving}
              className="rounded-card border border-chip-border px-2.5 py-1.5 text-[11px] text-text-secondary hover:border-text-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function normalizeSlots(ids: (number | null)[]): (number | null)[] {
  return [0, 1, 2].map((i) => ids[i] ?? null)
}
