import type { ItemInfo } from '../lib/ddragon'

function GoldIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 16 16" className="shrink-0" aria-hidden="true">
      <circle cx={8} cy={8} r={6.5} fill="#c8aa6e" stroke="#785a28" strokeWidth={1} />
      <circle cx={8} cy={8} r={4} fill="none" stroke="#785a28" strokeWidth={0.75} />
    </svg>
  )
}

export function ItemTooltip({ item }: { item: ItemInfo }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-bold text-text-primary">{item.name}</div>
        {item.totalCost > 0 && (
          <div className="flex shrink-0 items-center gap-1 text-[11px] font-bold" style={{ color: '#c8aa6e' }}>
            <GoldIcon />
            {item.totalCost}
          </div>
        )}
      </div>

      {item.statLines.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-white/10 pt-1.5">
          {item.statLines.map((stat, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {stat.iconUrl ? (
                <img src={stat.iconUrl} alt="" className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <div className="h-1 w-1 shrink-0 rounded-full bg-text-secondary-5" />
              )}
              <span className="text-text-secondary-2">
                <span className="font-bold text-text-primary">+{stat.value}</span> {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {item.sections.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-1.5">
          {item.sections.map((section, i) => (
            <div key={i}>
              {section.name && (
                <span
                  className="mr-1 font-bold"
                  style={{ color: section.kind === 'active' ? '#4ab3f7' : '#c8aa6e' }}
                >
                  {section.name}:
                </span>
              )}
              <span className="text-text-secondary-2">{section.body}</span>
            </div>
          ))}
        </div>
      )}

      {item.plaintext && (
        <div className="border-t border-white/10 pt-1.5 italic text-text-secondary">{item.plaintext}</div>
      )}
    </div>
  )
}
