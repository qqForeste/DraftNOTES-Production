interface Props {
  size?: number
  color?: string
}

export function SearchIcon({ size = 14, color = 'currentColor' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M11 11 15 15" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
