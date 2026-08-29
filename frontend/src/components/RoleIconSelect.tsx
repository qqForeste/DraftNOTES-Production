import { useEffect, useRef, useState } from 'react'
import type { MatchupRole } from '../api/types'
import { getPositionLabel } from '../lib/positions'
import { PositionIcon } from './PositionIcon'

export type RoleSelection = MatchupRole | 'DUO'

const OPTIONS: RoleSelection[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY', 'DUO']

function optionLabel(option: RoleSelection): string {
  return option === 'DUO' ? 'Bot + Support synergy' : getPositionLabel(option)
}

function OptionIcon({ option, size }: { option: RoleSelection; size: number }) {
  if (option === 'DUO') {
    const partSize = Math.round(size * 0.72)
    return (
      <span className="relative inline-block" style={{ width: size, height: size }}>
        <span className="absolute left-0 top-0">
          <PositionIcon position="BOTTOM" size={partSize} />
        </span>
        <span className="absolute bottom-0 right-0">
          <PositionIcon position="UTILITY" size={partSize} />
        </span>
      </span>
    )
  }
  return <PositionIcon position={option} size={size} />
}

interface Props {
  value: RoleSelection
  onChange: (value: RoleSelection) => void
  options?: RoleSelection[]
}

export function RoleIconSelect({ value, onChange, options = OPTIONS }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={optionLabel(value)}
        aria-label={`Role: ${optionLabel(value)}. Click to change.`}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-card border border-accent bg-accent/15 text-accent transition-transform duration-100 hover:scale-[1.12]"
      >
        <OptionIcon option={value} size={20} />
      </button>

      {open && (
        <div className="absolute left-1/2 top-[calc(100%+4px)] z-30 flex -translate-x-1/2 gap-1 rounded-card border border-chip-border bg-card p-1.5 shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option)
                setOpen(false)
              }}
              title={optionLabel(option)}
              aria-label={optionLabel(option)}
              className={`flex h-9 w-9 items-center justify-center rounded-card border transition-transform duration-100 hover:scale-[1.12] ${
                option === value
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-chip-border text-text-secondary hover:border-text-muted hover:bg-chip'
              }`}
            >
              <OptionIcon option={option} size={20} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
