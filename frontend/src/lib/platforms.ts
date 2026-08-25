export const PLATFORMS: { value: string; label: string }[] = [
  { value: 'na1', label: 'NA (North America)' },
  { value: 'euw1', label: 'EUW (Europe West)' },
  { value: 'eun1', label: 'EUNE (Europe Nordic & East)' },
  { value: 'kr', label: 'KR (Korea)' },
  { value: 'jp1', label: 'JP (Japan)' },
  { value: 'br1', label: 'BR (Brazil)' },
  { value: 'la1', label: 'LAN (Latin America North)' },
  { value: 'la2', label: 'LAS (Latin America South)' },
  { value: 'oc1', label: 'OCE (Oceania)' },
  { value: 'tr1', label: 'TR (Turkey)' },
  { value: 'ru', label: 'RU (Russia)' },
  { value: 'ph2', label: 'PH (Philippines)' },
  { value: 'sg2', label: 'SG (Singapore)' },
  { value: 'th2', label: 'TH (Thailand)' },
  { value: 'tw2', label: 'TW (Taiwan)' },
  { value: 'vn2', label: 'VN (Vietnam)' },
]

export const DEFAULT_PLATFORM = 'euw1'

export function platformFromMatchId(matchId: string): string | null {
  const prefix = matchId.split('_')[0]?.toLowerCase()
  if (!prefix) return null
  return PLATFORMS.some((p) => p.value === prefix) ? prefix : null
}
