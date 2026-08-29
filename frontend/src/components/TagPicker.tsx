import type { MistakeTag, TagTaxonomyEntry } from '../api/types'
import { getTagColor } from '../lib/tagColors'

const MAX_TAGS = 3

interface Props {
  taxonomy: TagTaxonomyEntry[]
  selected: MistakeTag[]
  onChange: (tags: MistakeTag[]) => void
}

export function TagPicker({ taxonomy, selected, onChange }: Props) {
  function toggle(tag: MistakeTag) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag))
    } else if (selected.length < MAX_TAGS) {
      onChange([...selected, tag])
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-text-secondary">What went wrong</span>
        <span className="text-[11px] text-text-muted">
          {selected.length} / {MAX_TAGS}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {taxonomy.map((entry) => {
          const isSelected = selected.includes(entry.tag_key)
          const isDisabled = !isSelected && selected.length >= MAX_TAGS
          const color = getTagColor(entry.tag_key)
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
              className={`rounded-card border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
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
