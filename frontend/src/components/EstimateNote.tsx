export function EstimateNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
      <span
        aria-hidden
        className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-current text-[8px] font-bold leading-none"
      >
        i
      </span>
      {children}
    </span>
  )
}

export function EstimatedBadge() {
  return (
    <span
      className="rounded-card border border-chip-border px-1 py-px text-[9px] font-bold uppercase tracking-wide text-text-muted"
      title="Generated from the champion pairing, not measured from real games"
    >
      Estimate
    </span>
  )
}
