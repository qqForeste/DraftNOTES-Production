import { useState } from 'react'

interface Props {
  label: string
  confirmLabel: string
  message: string
  onConfirm: () => void
  disabled?: boolean
  className?: string
}

export function ConfirmButton({ label, confirmLabel, message, onConfirm, disabled, className }: Props) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        disabled={disabled}
        className={
          className ??
          'text-[11px] text-text-secondary hover:text-loss-text disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-loss/40 bg-loss/10 px-2.5 py-1.5">
      <span className="text-[11px] text-loss-text">{message}</span>
      <button
        type="button"
        onClick={() => {
          setArmed(false)
          onConfirm()
        }}
        className="rounded-card bg-loss px-2 py-1 text-[11px] font-bold text-page hover:opacity-90"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-[11px] text-text-secondary hover:text-text-primary"
      >
        Cancel
      </button>
    </div>
  )
}
