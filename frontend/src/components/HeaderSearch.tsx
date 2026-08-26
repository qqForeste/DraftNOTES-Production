import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLookupNavigate } from '../lib/useLookupNavigate'
import { DEFAULT_PLATFORM, PLATFORMS } from '../lib/platforms'
import { SearchIcon } from './SearchIcon'

export function HeaderSearch() {
  const [riotId, setRiotId] = useState('')
  const [platform, setPlatform] = useState(DEFAULT_PLATFORM)
  const [formError, setFormError] = useState<string | null>(null)
  const { go } = useLookupNavigate()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parts = riotId.split('#')
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      setFormError('Enter a Riot ID as gameName#tagLine')
      return
    }
    setFormError(null)
    go(parts[0].trim(), parts[1].trim(), platform)
    setRiotId('')
  }

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1.5 rounded-card border border-accent/30 bg-card p-1 shadow-sm transition-colors focus-within:border-accent"
      >
        <div className="flex flex-1 items-center gap-1.5 rounded-card bg-inset px-2.5 py-1">
          <SearchIcon size={13} color="var(--color-text-muted)" />
          <input
            type="text"
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
            placeholder="Search a Riot ID, e.g. Hide on bush#KR1"
            className="w-56 bg-transparent text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="rounded-card border border-chip-border bg-inset px-1.5 py-1.5 text-[11px] text-text-primary focus:border-accent focus:outline-none"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-card bg-accent px-3 py-1.5 text-[11px] font-bold text-page hover:opacity-90"
        >
          Search
        </button>
      </form>
      {formError && (
        <p className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-card border border-chip-border bg-card px-2 py-1 text-[11px] text-loss-text shadow-sm">
          {formError}
        </p>
      )}
    </div>
  )
}
