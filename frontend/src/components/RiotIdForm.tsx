import { useState } from 'react'
import { DEFAULT_PLATFORM, PLATFORMS } from '../lib/platforms'

interface Props {
  onSubmit: (gameName: string, tagLine: string, platform: string) => void
  busy: boolean
  initialValue?: string
  initialPlatform?: string
  compact?: boolean
  submitLabel?: string
}

export function RiotIdForm({
  onSubmit,
  busy,
  initialValue = '',
  initialPlatform,
  compact = false,
  submitLabel,
}: Props) {
  const [riotId, setRiotId] = useState(initialValue)
  const [platform, setPlatform] = useState(initialPlatform ?? DEFAULT_PLATFORM)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parts = riotId.split('#')
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      setError('Enter a Riot ID as gameName#tagLine')
      return
    }
    setError(null)
    onSubmit(parts[0].trim(), parts[1].trim(), platform)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          placeholder="gameName#tagLine, e.g. Hide on bush#KR1"
          className="min-w-0 flex-1 rounded-card border border-chip-border bg-inset px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="shrink-0 rounded-card border border-chip-border bg-inset px-2 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 whitespace-nowrap rounded-card bg-accent px-4 py-2 text-sm font-bold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Syncing…' : (submitLabel ?? (compact ? 'Resync' : 'Sync matches'))}
        </button>
      </div>
      {error && <p className="text-sm text-loss-text">{error}</p>}
    </form>
  )
}
