import type { RunePage, SkillKey, SkillOrder } from '../api/types'
import type { RuneTreeInfo } from './ddragon'

export const MINOR_SLOT_COUNT = 3
export const SECONDARY_PICK_COUNT = 2
export const SHARD_ROW_COUNT = 3

export function emptyRunePage(): RunePage {
  return {
    primary_style_id: null,
    primary_rune_ids: [null, null, null, null],
    secondary_style_id: null,
    secondary_rune_ids: [null, null],
    stat_shard_ids: [null, null, null],
  }
}

export function normalizeRunePage(page: RunePage | null | undefined): RunePage {
  const empty = emptyRunePage()
  if (!page) return empty
  const fill = (ids: (number | null)[] | undefined, length: number) =>
    Array.from({ length }, (_, i) => ids?.[i] ?? null)
  return {
    primary_style_id: page.primary_style_id ?? null,
    primary_rune_ids: fill(page.primary_rune_ids, MINOR_SLOT_COUNT + 1),
    secondary_style_id: page.secondary_style_id ?? null,
    secondary_rune_ids: fill(page.secondary_rune_ids, SECONDARY_PICK_COUNT),
    stat_shard_ids: fill(page.stat_shard_ids, SHARD_ROW_COUNT),
  }
}

export function isRunePageEmpty(page: RunePage): boolean {
  return (
    page.primary_style_id == null &&
    page.secondary_style_id == null &&
    [...page.primary_rune_ids, ...page.secondary_rune_ids, ...page.stat_shard_ids].every((id) => id == null)
  )
}

export function secondaryRowIndex(tree: RuneTreeInfo | undefined, runeId: number | null): number | null {
  if (!tree || runeId == null) return null
  for (let i = 1; i < tree.slots.length; i++) {
    if (tree.slots[i].runes.some((r) => r.id === runeId)) return i
  }
  return null
}

export function applySecondaryPick(
  page: RunePage,
  tree: RuneTreeInfo | undefined,
  runeId: number,
): (number | null)[] {
  const picks = [...page.secondary_rune_ids]
  const row = secondaryRowIndex(tree, runeId)
  const existingIndex = picks.findIndex((id) => id != null && secondaryRowIndex(tree, id) === row)
  if (picks.includes(runeId)) return picks.map((id) => (id === runeId ? null : id))
  if (existingIndex >= 0) {
    picks[existingIndex] = runeId
    return picks
  }
  const emptyIndex = picks.findIndex((id) => id == null)
  picks[emptyIndex >= 0 ? emptyIndex : 0] = runeId
  return picks
}

export const MAX_LEVEL = 18
export const ULTIMATE_LEVELS = [6, 11, 16]
export const SKILL_KEYS: SkillKey[] = ['Q', 'W', 'E', 'R']
const MAX_POINTS: Record<SkillKey, number> = { Q: 5, W: 5, E: 5, R: 3 }

export function emptySkillOrder(): SkillOrder {
  return Array.from({ length: MAX_LEVEL }, () => null)
}

export function normalizeSkillOrder(order: SkillOrder | null | undefined): SkillOrder {
  return Array.from({ length: MAX_LEVEL }, (_, i) => order?.[i] ?? null)
}

export function isSkillOrderEmpty(order: SkillOrder): boolean {
  return order.every((key) => key == null)
}

export function pointsSpent(order: SkillOrder, key: SkillKey): number {
  return order.filter((k) => k === key).length
}

export function canAssign(order: SkillOrder, level: number, key: SkillKey): boolean {
  const isUltimateLevel = ULTIMATE_LEVELS.includes(level)
  if (key === 'R' ? !isUltimateLevel : isUltimateLevel) return false
  if (order[level - 1] === key) return true
  return pointsSpent(order, key) < MAX_POINTS[key]
}

export function assignSkill(order: SkillOrder, level: number, key: SkillKey): SkillOrder {
  if (!canAssign(order, level, key)) return order
  const next = [...order]
  next[level - 1] = next[level - 1] === key ? null : key
  return next
}

export function maxOrder(order: SkillOrder): SkillKey[] {
  const seen: SkillKey[] = []
  const counts: Record<string, number> = {}
  for (const key of order) {
    if (key == null || key === 'R') continue
    counts[key] = (counts[key] ?? 0) + 1
    if (counts[key] === 3 && !seen.includes(key)) seen.push(key)
  }
  for (const key of order) {
    if (key == null || key === 'R' || seen.includes(key)) continue
    seen.push(key)
  }
  return seen
}

export function fillEmptyItemSlots(
  current: (number | null)[],
  recommended: (number | null)[],
): (number | null)[] {
  return current.map((id, i) => id ?? recommended[i] ?? null)
}

export function fillEmptyRunePage(existing: RunePage, recommended: RunePage): RunePage {
  const primaryMatches = existing.primary_style_id == null || existing.primary_style_id === recommended.primary_style_id
  const secondaryMatches =
    existing.secondary_style_id == null || existing.secondary_style_id === recommended.secondary_style_id
  return {
    primary_style_id: existing.primary_style_id ?? recommended.primary_style_id,
    primary_rune_ids: primaryMatches
      ? fillEmptyItemSlots(existing.primary_rune_ids, recommended.primary_rune_ids)
      : existing.primary_rune_ids,
    secondary_style_id: existing.secondary_style_id ?? recommended.secondary_style_id,
    secondary_rune_ids: secondaryMatches
      ? fillEmptyItemSlots(existing.secondary_rune_ids, recommended.secondary_rune_ids)
      : existing.secondary_rune_ids,
    stat_shard_ids: fillEmptyItemSlots(existing.stat_shard_ids, recommended.stat_shard_ids),
  }
}

export function fillEmptySkillOrder(existing: SkillOrder, recommended: SkillOrder): SkillOrder {
  const next = [...existing]
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const key = recommended[level - 1]
    if (next[level - 1] != null || key == null) continue
    if (canAssign(next, level, key)) next[level - 1] = key
  }
  return next
}
