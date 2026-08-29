import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  content: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  interactive?: boolean
  onClick?: (e: MouseEvent) => void
}

export function DescriptionLines({ text }: { text: string }) {
  return (
    <>
      {text
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line, i) => (
          <div key={i}>{line}</div>
        ))}
    </>
  )
}

const NAV_CLEARANCE = 64
const HIDE_DELAY_MS = 30

export function HoverCard({ content, children, className, style, interactive = false, onClick }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelHide() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  function show() {
    cancelHide()
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const above = rect.top > 150
    setMaxHeight(undefined)
    setPos({
      top: above ? rect.top - 8 : rect.bottom + 8,
      left: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
      above,
    })
  }

  function scheduleHide() {
    cancelHide()
    if (!interactive) {
      setPos(null)
      return
    }
    hideTimer.current = setTimeout(() => setPos(null), HIDE_DELAY_MS)
  }

  useLayoutEffect(() => {
    if (!pos || !cardRef.current) return
    const height = cardRef.current.getBoundingClientRect().height
    if (pos.above) {
      const available = pos.top - NAV_CLEARANCE
      if (height > available) setMaxHeight(Math.max(available, 80))
    } else {
      const available = window.innerHeight - 8 - pos.top
      if (height > available) setMaxHeight(Math.max(available, 80))
    }
  }, [pos])

  return (
    <span
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={onClick}
      className={className}
      style={style}
    >
      {children}
      {pos &&
        createPortal(
          <div
            ref={cardRef}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
            className="fixed z-50 w-max max-w-72 overflow-y-auto overscroll-contain rounded-card border border-card-border bg-card p-3 text-[11px] leading-relaxed text-text-secondary-2 shadow-xl"
            style={{
              top: pos.top,
              left: pos.left,
              transform: `translate(-50%, ${pos.above ? '-100%' : '0'})`,
              maxHeight,
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  )
}
