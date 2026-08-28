interface Props {
  size?: number
  color?: string
}

export function NoteIcon({ size = 16, color = 'currentColor' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="1.5" width="9" height="13" rx="1.4" fill="none" stroke={color} strokeWidth="1.3" />
      <path d="M4.3 5h4.4M4.3 7.3h4.4M4.3 9.6h2.8" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <path
        d="M10.8 9.7 14.3 6.2a1 1 0 0 1 1.4 1.4l-3.5 3.5-1.9.5z"
        fill={color}
        stroke={color}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
