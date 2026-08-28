import type { RunePage, SkillKey, SkillOrder } from '../api/types'
import type { RuneTreeInfo, StatShardInfo } from './ddragon'
import { emptySkillOrder, MAX_LEVEL, ULTIMATE_LEVELS } from './runes'

function hash01(a: number, b: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return h - Math.floor(h)
}

export function championWinRate(championId: number, opponentId: number): number {
  if (championId === opponentId) return 50
  const lo = Math.min(championId, opponentId)
  const hi = Math.max(championId, opponentId)
  const magnitude = 4 + hash01(lo, hi) * 12
  const loFavored = hash01(hi, lo) > 0.5
  const loWinRate = loFavored ? 50 + magnitude : 50 - magnitude
  const rate = championId === lo ? loWinRate : 100 - loWinRate
  return Math.round(rate * 10) / 10
}

export interface CounterSuggestion {
  championId: number
  winRatePct: number
}

export function topCounters(championId: number, championIds: number[], limit = 8): CounterSuggestion[] {
  return championIds
    .filter((id) => id !== championId)
    .map((id) => ({
      championId: id,
      winRatePct: championWinRate(id, championId),
    }))
    .sort((a, b) => b.winRatePct - a.winRatePct)
    .slice(0, limit)
}

export function duoSynergyWinRate(championId: number, partnerId: number): number {
  if (championId === partnerId) return 50
  const lo = Math.min(championId, partnerId)
  const hi = Math.max(championId, partnerId)
  const magnitude = hash01(lo + 5000, hi + 5000) * 16 - 8
  return Math.round((50 + magnitude) * 10) / 10
}

export interface SynergySuggestion {
  championId: number
  winRatePct: number
}

export function topSynergyPartners(championId: number, championIds: number[], limit = 8): SynergySuggestion[] {
  return championIds
    .filter((id) => id !== championId)
    .map((id) => ({
      championId: id,
      winRatePct: duoSynergyWinRate(championId, id),
    }))
    .sort((a, b) => b.winRatePct - a.winRatePct)
    .slice(0, limit)
}

export interface RecommendedBuild {
  coreItemIds: number[]
  bootItemId: number | null
  situationalItemIds: number[]
}

function pickDistinct(ids: number[], count: number, seedA: number, seedB: number): number[] {
  const pool = [...ids]
  const picked: number[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(hash01(seedA + i * 131, seedB + i * 197) * pool.length) % pool.length
    picked.push(pool[index])
    pool.splice(index, 1)
  }
  return picked
}

export function recommendedBuild(
  championId: number,
  opponentId: number,
  legendaryItemIds: number[],
  bootItemIds: number[],
): RecommendedBuild {
  const legendaries = pickDistinct(legendaryItemIds, 6, championId, opponentId)
  return {
    coreItemIds: legendaries.slice(0, 3),
    bootItemId: pickDistinct(bootItemIds, 1, championId + 700, opponentId + 700)[0] ?? null,
    situationalItemIds: legendaries.slice(3, 6),
  }
}

function pickIndex(length: number, seedA: number, seedB: number): number {
  if (length <= 0) return 0
  return Math.floor(hash01(seedA, seedB) * length) % length
}

export function recommendedRunePage(
  championId: number,
  opponentId: number,
  trees: RuneTreeInfo[],
  shardRows: StatShardInfo[][],
): RunePage | null {
  if (trees.length < 2) return null
  const primary = trees[pickIndex(trees.length, championId + 11, opponentId + 11)]
  const others = trees.filter((t) => t.id !== primary.id)
  const secondary = others[pickIndex(others.length, championId + 23, opponentId + 23)]

  const keystoneRow = primary.slots[0]?.runes ?? []
  const keystone = keystoneRow[pickIndex(keystoneRow.length, championId + 31, opponentId + 31)]?.id ?? null
  const minors = [1, 2, 3].map((slot) => {
    const runes = primary.slots[slot]?.runes ?? []
    return runes[pickIndex(runes.length, championId + slot * 41, opponentId + slot * 41)]?.id ?? null
  })

  const rowA = 1 + pickIndex(3, championId + 53, opponentId + 53)
  let rowB = 1 + pickIndex(3, championId + 67, opponentId + 67)
  if (rowB === rowA) rowB = 1 + (rowA % 3)
  const secondaryPicks = [rowA, rowB].map((slot) => {
    const runes = secondary.slots[slot]?.runes ?? []
    return runes[pickIndex(runes.length, championId + slot * 71, opponentId + slot * 71)]?.id ?? null
  })

  const shards = shardRows.map(
    (row, i) => row[pickIndex(row.length, championId + i * 83, opponentId + i * 83)]?.id ?? null,
  )

  return {
    primary_style_id: primary.id,
    primary_rune_ids: [keystone, ...minors],
    secondary_style_id: secondary.id,
    secondary_rune_ids: secondaryPicks,
    stat_shard_ids: shards,
  }
}

const BASIC_PRIORITIES: SkillKey[][] = [
  ['Q', 'W', 'E'],
  ['Q', 'E', 'W'],
  ['W', 'Q', 'E'],
  ['W', 'E', 'Q'],
  ['E', 'Q', 'W'],
  ['E', 'W', 'Q'],
]

export function recommendedSkillOrder(championId: number, opponentId: number): SkillOrder {
  const priority = BASIC_PRIORITIES[pickIndex(BASIC_PRIORITIES.length, championId + 97, opponentId + 97)]
  const remaining: Record<string, number> = { Q: 5, W: 5, E: 5 }
  const order = emptySkillOrder()

  for (let level = 1; level <= MAX_LEVEL; level++) {
    if (ULTIMATE_LEVELS.includes(level)) {
      order[level - 1] = 'R'
      continue
    }
    const opening = priority[level - 1]
    const key = level <= 3 ? opening : priority.find((k) => remaining[k] > 0)
    if (!key) continue
    remaining[key] -= 1
    order[level - 1] = key
  }
  return order
}
