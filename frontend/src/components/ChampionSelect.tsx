import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChampionInfo } from '../lib/ddragon'
import { ChampionIcon } from './ChampionIcon'

interface Props {
  championMap: Map<number, ChampionInfo> | null
  value: number | null
  onChange: (championId: number) => void
  placeholder?: string
  disabledIds?: number[]
  onClear?: () => void
}

export function ChampionSelect({
  championMap,
  value,
  onChange,
  placeholder = 'Select champion',
  disabledIds,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value != null ? (championMap?.get(value) ?? null) : null
  const disabledSet = useMemo(() => new Set(disabledIds ?? []), [disabledIds])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const options = useMemo(() => {
    const all = [...(championMap?.entries() ?? [])].sort((a, b) => a[1].name.localeCompare(b[1].name))
    const q = query.trim().toLowerCase()
    const filtered = q ? all.filter(([, champ]) => champ.name.toLowerCase().includes(q)) : all
    return filtered.filter(([id]) => id === value || !disabledSet.has(id))
  }, [championMap, query, disabledSet, value])

  function pick(id: number) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function openDropdown() {
    setOpen(true)
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.select())
  }

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && options.length > 0) pick(options[0][0])
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery('')
            }
          }}
          placeholder={selected ? selected.name : placeholder}
          className="w-full rounded-card border border-accent bg-inset px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      ) : (
        <div className="flex items-stretch gap-1">
          <button
            type="button"
            onClick={openDropdown}
            className="flex flex-1 items-center gap-2 rounded-card border border-chip-border bg-inset px-2.5 py-1.5 text-xs text-text-primary hover:border-text-muted"
          >
            {selected ? (
              <>
                <ChampionIcon championId={value!} championMap={championMap} size={20} />
                <span>{selected.name}</span>
              </>
            ) : (
              <span className="text-text-muted">{placeholder}</span>
            )}
          </button>
          {selected && onClear && (
            <button
              type="button"
              onClick={onClear}
              title="Clear"
              className="rounded-card border border-chip-border px-2 text-xs text-text-secondary hover:border-text-muted hover:text-text-primary"
            >
              ×
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 flex max-h-60 w-56 flex-col overflow-y-auto rounded-card border border-chip-border bg-card p-1.5 shadow-lg">
          {options.length === 0 && (
            <div className="px-1.5 py-2 text-[11px] text-text-muted">No champions match.</div>
          )}
          {options.map(([id, champ]) => (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className={`flex items-center gap-2 rounded-card px-1.5 py-1 text-left text-xs hover:bg-chip ${
                id === value ? 'bg-chip text-text-primary' : 'text-text-secondary'
              }`}
            >
              <ChampionIcon championId={id} championMap={championMap} size={22} />
              <span>{champ.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
