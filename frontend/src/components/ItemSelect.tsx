import { useEffect, useMemo, useRef, useState } from 'react'
import type { ItemInfo } from '../lib/ddragon'

interface Props {
  itemMap: Map<number, ItemInfo> | null
  value: number | null
  onChange: (itemId: number) => void
  onClear: () => void
  includeTag?: string
  excludeTag?: string
  recommendedId?: number | null
  recommendedIds?: number[]
  label: string
}

export function ItemSelect({
  itemMap,
  value,
  onChange,
  onClear,
  includeTag,
  excludeTag,
  recommendedId,
  recommendedIds,
  label,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value != null ? (itemMap?.get(value) ?? null) : null
  const suggestion = value == null && recommendedId != null ? (itemMap?.get(recommendedId) ?? null) : null

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

  const recommendedOptions = useMemo(() => {
    return (recommendedIds ?? [])
      .filter((id, i, ids) => ids.indexOf(id) === i && id !== value)
      .map((id) => [id, itemMap?.get(id)] as const)
      .filter((entry): entry is readonly [number, ItemInfo] => entry[1] != null)
      .filter(([, item]) => (!includeTag || item.tags.includes(includeTag)) && (!excludeTag || !item.tags.includes(excludeTag)))
  }, [recommendedIds, itemMap, value, includeTag, excludeTag])

  const options = useMemo(() => {
    const all = [...(itemMap?.entries() ?? [])]
      .filter(([, item]) => !includeTag || item.tags.includes(includeTag))
      .filter(([, item]) => !excludeTag || !item.tags.includes(excludeTag))
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
    const q = query.trim().toLowerCase()
    return q ? all.filter(([, item]) => item.name.toLowerCase().includes(q)) : all
  }, [itemMap, query, includeTag, excludeTag])

  function pick(id: number) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function openDropdown() {
    setOpen(true)
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={openDropdown}
        title={selected?.name ?? label}
        className="flex h-10 w-10 items-center justify-center rounded-card border border-chip-border bg-inset hover:border-text-muted"
      >
        {selected ? (
          <img src={selected.iconUrl} alt={selected.name} className="h-9 w-9 rounded-sm" />
        ) : suggestion ? (
          <img
            src={suggestion.iconUrl}
            alt=""
            className="h-9 w-9 rounded-sm opacity-30 grayscale"
            title={`Suggested: ${suggestion.name}`}
          />
        ) : (
          <span className="text-base leading-none text-text-muted">+</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 flex max-h-64 w-56 flex-col overflow-hidden rounded-card border border-chip-border bg-card shadow-lg">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="border-b border-chip-border bg-inset px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <div className="flex flex-col overflow-y-auto p-1.5">
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onClear()
                  setOpen(false)
                }}
                className="rounded-card px-1.5 py-1 text-left text-[11px] text-text-secondary hover:bg-chip"
              >
                Clear
              </button>
            )}
            {query.trim() === '' && recommendedOptions.length > 0 && (
              <>
                <div className="px-1.5 pb-0.5 pt-1 text-[10px] font-bold text-text-muted">Recommended</div>
                {recommendedOptions.map(([id, item]) => (
                  <button
                    key={`rec-${id}`}
                    type="button"
                    onClick={() => pick(id)}
                    className="flex items-center gap-2 rounded-card px-1.5 py-1 text-left text-xs text-text-secondary hover:bg-chip"
                  >
                    <img src={item.iconUrl} alt="" className="h-5 w-5 rounded-sm" />
                    <span>{item.name}</span>
                  </button>
                ))}
                <div className="my-1 h-px bg-chip-border" />
              </>
            )}
            {options.length === 0 && <div className="px-1.5 py-2 text-[11px] text-text-muted">No items match.</div>}
            {options.map(([id, item]) => (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                className={`flex items-center gap-2 rounded-card px-1.5 py-1 text-left text-xs hover:bg-chip ${
                  id === value ? 'bg-chip text-text-primary' : 'text-text-secondary'
                }`}
              >
                <img src={item.iconUrl} alt="" className="h-5 w-5 rounded-sm" />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
