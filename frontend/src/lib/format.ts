export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDate(iso)
}

export function formatKda(kills: number, deaths: number, assists: number): string {
  const ratio = deaths === 0 ? kills + assists : (kills + assists) / deaths
  return ratio.toFixed(2)
}

const PHASE_LABELS: Record<string, string> = {
  early: 'Early game',
  mid: 'Mid game',
  late: 'Late game',
}

export function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase
}
