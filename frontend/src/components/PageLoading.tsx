interface Props {
  label?: string
}

export function PageLoading({ label = 'Loading…' }: Props) {
  return (
    <div className="flex justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-chip-border"
          style={{ borderTopColor: 'var(--color-accent)' }}
        />
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
    </div>
  )
}
