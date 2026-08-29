import { useEffect, useRef, useState } from 'react'
import { SITE_THEMES, THEME_PAIRS, useSiteTheme, type ThemePair } from '../lib/themes'

function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx={8} cy={8} r={3} />
      <path d="M8 0.8v1.7M8 13.5v1.7M15.2 8h-1.7M2.5 8H0.8M13.1 2.9l-1.2 1.2M4.1 11.9l-1.2 1.2M13.1 13.1l-1.2-1.2M4.1 4.1 2.9 2.9" />
    </svg>
  )
}

function MoonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.9 10.1A6.4 6.4 0 0 1 5.9 2.1a6.4 6.4 0 1 0 8 8Z" />
    </svg>
  )
}

function PairSwatch({ pair, size = 20 }: { pair: ThemePair; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full border border-black/20"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${pair.dark.swatch[2]} 50%, ${pair.light.swatch[2]} 50%)`,
      }}
    />
  )
}

export function ThemePicker() {
  const [themeId, setThemeId] = useSiteTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const active = SITE_THEMES.find((t) => t.id === themeId) ?? SITE_THEMES[0]
  const activePair = THEME_PAIRS.find((p) => p.id === active.pair) ?? THEME_PAIRS[0]

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function selectPair(pair: ThemePair) {
    setThemeId(active.mode === 'dark' ? pair.dark.id : pair.light.id)
    setOpen(false)
  }

  function toggleMode() {
    setThemeId(active.mode === 'dark' ? activePair.light.id : activePair.dark.id)
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Theme: ${active.label}`}
        aria-label={`Theme: ${active.label}. Click to change.`}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-card border border-accent bg-accent/15 transition-transform duration-100 hover:scale-[1.12]"
      >
        <span
          className="h-5 w-5 shrink-0 rounded-full border border-black/20"
          style={{ background: active.swatch[2] }}
        />
      </button>

      <button
        type="button"
        onClick={toggleMode}
        title={active.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={active.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="flex h-9 w-9 items-center justify-center rounded-card border border-chip-border text-text-secondary transition-transform duration-100 hover:scale-[1.12] hover:border-text-muted hover:bg-chip hover:text-text-primary"
      >
        {active.mode === 'dark' ? <MoonIcon /> : <SunIcon />}
      </button>

      {open && (
        <div className="absolute left-1/2 top-[calc(100%+4px)] z-30 flex -translate-x-1/2 gap-1 rounded-card border border-chip-border bg-card p-1.5 shadow-lg">
          {THEME_PAIRS.map((pair) => (
            <button
              key={pair.id}
              type="button"
              onClick={() => selectPair(pair)}
              title={`${pair.dark.label} / ${pair.light.label}`}
              aria-label={`${pair.dark.label} / ${pair.light.label}`}
              className={`flex h-9 w-9 items-center justify-center rounded-card border transition-transform duration-100 hover:scale-[1.12] ${
                pair.id === activePair.id
                  ? 'border-accent bg-accent/15'
                  : 'border-chip-border hover:border-text-muted hover:bg-chip'
              }`}
            >
              <PairSwatch pair={pair} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
