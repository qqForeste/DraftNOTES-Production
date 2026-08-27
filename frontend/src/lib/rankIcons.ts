export const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])

export function getRankEmblemUrl(tier: string | null): string {
  const slug = tier ? tier.toLowerCase() : 'unranked'
  return `/rank-emblems/${slug}.png`
}

export function formatRankLabel(tier: string | null, division: string | null): string {
  if (!tier) return 'Unranked'
  const name = tier.charAt(0) + tier.slice(1).toLowerCase()
  if (APEX_TIERS.has(tier) || !division) return name
  return `${name} ${division}`
}

export const TIER_COLORS: Record<string, string> = {
  IRON: '#7d7b78',
  BRONZE: '#a46628',
  SILVER: '#8c9ba5',
  GOLD: '#d4af37',
  PLATINUM: '#3fbfb1',
  EMERALD: '#2bb673',
  DIAMOND: '#576bce',
  MASTER: '#9d4dc3',
  GRANDMASTER: '#cd4545',
  CHALLENGER: '#f4c874',
}

export function getTierColor(tier: string | null): string {
  if (!tier) return 'var(--color-text-muted)'
  return TIER_COLORS[tier.toUpperCase()] ?? 'var(--color-text-muted)'
}
