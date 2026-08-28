const MAX_TAGS = 4

interface Entry<T extends string> {
  tag_key: T
  label: string
}

interface Props<T extends string> {
  label: string
  taxonomy: Entry<T>[]
  selected: T[]
  onChange: (tags: T[]) => void
  getColor?: (tag: T) => string
}

export function MatchupTagPicker<T extends string>({ label, taxonomy, selected, onChange, getColor }: Props<T>) {
  function toggle(tag: T) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag))
    } else if (selected.length < MAX_TAGS) {
      onChange([...selected, tag])
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-[18px] items-center justify-between">
        <span className="text-xs font-bold text-text-primary">{label}</span>
        <span className="text-[10px] text-text-muted">
          {selected.length} / {MAX_TAGS}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {taxonomy.map((entry) => {
          const isSelected = selected.includes(entry.tag_key)
          const isDisabled = !isSelected && selected.length >= MAX_TAGS
          const color = getColor ? getColor(entry.tag_key) : 'var(--color-loss)'
          return (
            <button
              key={entry.tag_key}
              type="button"
              disabled={isDisabled}
              onClick={() => toggle(entry.tag_key)}
              style={{
                color: isSelected ? '#fff' : undefined,
                background: isSelected ? color : 'transparent',
                borderColor: isSelected ? color : undefined,
              }}
              className={`rounded-card border px-1 py-0.5 text-[9px] font-bold transition-colors ${
                isSelected
                  ? ''
                  : isDisabled
                    ? 'cursor-not-allowed border-header-border text-text-muted'
                    : 'border-chip-border text-text-secondary hover:border-text-muted'
              }`}
            >
              {entry.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
