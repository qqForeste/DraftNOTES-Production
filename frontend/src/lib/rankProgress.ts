const SUB_APEX_TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND']
const APEX_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER']
const DIVISIONS = ['IV', 'III', 'II', 'I']

const APEX_LP_THRESHOLD: Record<string, number> = { MASTER: 0, GRANDMASTER: 200, CHALLENGER: 500 }

function titleCase(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase()
}

export interface DivisionSegment {
  label: string
  state: 'passed' | 'current' | 'upcoming'
  fillPct: number
}

export interface RankSection {
  tier: string
  label: string
  divisions: DivisionSegment[]
}

export interface RankSections {
  current: RankSection
  next: { tier: string; label: string } | null
}

export function getRankSections(tier: string, division: string | null, lp: number): RankSections {
  const t = tier.toUpperCase()

  if (SUB_APEX_TIERS.includes(t)) {
    const divIdx = division ? Math.max(DIVISIONS.indexOf(division.toUpperCase()), 0) : 0
    const divisions: DivisionSegment[] = DIVISIONS.map((d, i) => ({
      label: d,
      state: i < divIdx ? 'passed' : i === divIdx ? 'current' : 'upcoming',
      fillPct: i < divIdx ? 100 : i === divIdx ? Math.max(0, Math.min(100, lp)) : 0,
    }))
    const tierIdx = SUB_APEX_TIERS.indexOf(t)
    const nextTier = tierIdx + 1 < SUB_APEX_TIERS.length ? SUB_APEX_TIERS[tierIdx + 1] : 'MASTER'
    return {
      current: { tier: t, label: titleCase(t), divisions },
      next: { tier: nextTier, label: titleCase(nextTier) },
    }
  }

  const apexIdx = APEX_TIERS.indexOf(t)
  if (apexIdx === -1) {
    return { current: { tier: t, label: titleCase(t), divisions: [] }, next: null }
  }
  const nextTier = APEX_TIERS[apexIdx + 1]
  return {
    current: { tier: t, label: titleCase(t), divisions: [] },
    next: nextTier ? { tier: nextTier, label: titleCase(nextTier) } : null,
  }
}

export interface NextCheckpoint {
  label: string
  lpNeeded: number
  target: number
}

export function getNextCheckpoint(tier: string | null, division: string | null, lp: number | null): NextCheckpoint | null {
  if (!tier || lp == null) return null
  const t = tier.toUpperCase()
  if (SUB_APEX_TIERS.includes(t)) {
    const divIdx = division ? Math.max(DIVISIONS.indexOf(division.toUpperCase()), 0) : 0
    if (divIdx < DIVISIONS.length - 1) {
      return { label: `${titleCase(t)} ${DIVISIONS[divIdx + 1]}`, lpNeeded: Math.max(0, 100 - lp), target: 100 }
    }
    const tierIdx = SUB_APEX_TIERS.indexOf(t)
    const nextTier = tierIdx + 1 < SUB_APEX_TIERS.length ? SUB_APEX_TIERS[tierIdx + 1] : 'MASTER'
    const nextLabel = nextTier === 'MASTER' ? 'Master' : `${titleCase(nextTier)} IV`
    return { label: nextLabel, lpNeeded: Math.max(0, 100 - lp), target: 100 }
  }
  if (t === 'CHALLENGER') return null
  const idx = APEX_TIERS.indexOf(t)
  const nextTier = APEX_TIERS[idx + 1]
  if (!nextTier) return null
  const from = APEX_LP_THRESHOLD[t] ?? 0
  const to = APEX_LP_THRESHOLD[nextTier] ?? from
  return { label: titleCase(nextTier), lpNeeded: Math.max(0, to - lp), target: Math.max(1, to - from) }
}

const APEX_FLOOR = SUB_APEX_TIERS.length * DIVISIONS.length * 100

export function rankFromAbsoluteLp(value: number): { tier: string; division: string | null } | null {
  if (!Number.isFinite(value) || value < 0) return null
  if (value >= APEX_FLOOR) return { tier: 'MASTER', division: null }
  const step = Math.floor(value / 100)
  const tier = SUB_APEX_TIERS[Math.floor(step / DIVISIONS.length)]
  if (!tier) return null
  return { tier, division: DIVISIONS[step % DIVISIONS.length] }
}
