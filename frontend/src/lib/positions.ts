export const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

export function comparePositions(a: string | null, b: string | null): number {
  const ai = a ? ROLE_ORDER.indexOf(a) : -1
  const bi = b ? ROLE_ORDER.indexOf(b) : -1
  return (ai === -1 ? ROLE_ORDER.length : ai) - (bi === -1 ? ROLE_ORDER.length : bi)
}

const POSITION_LABELS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bottom',
  UTILITY: 'Support',
}

export function getPositionLabel(position: string | null): string {
  if (!position) return 'Unknown'
  return POSITION_LABELS[position] ?? position
}
