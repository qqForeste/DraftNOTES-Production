import type { RunePage } from '../api/types'
import { getStatShard, type RuneMaps } from '../lib/ddragon'
import { isRunePageEmpty } from '../lib/runes'
import { RuneIcon } from './RuneIcon'

interface Props {
  page: RunePage
  runeMaps: RuneMaps | null
  variant?: 'compact' | 'full'
  emptyText?: string
}

export function RunePageView({ page, runeMaps, variant = 'full', emptyText }: Props) {
  if (isRunePageEmpty(page)) {
    return emptyText ? <span className="text-[11px] text-text-muted">{emptyText}</span> : null
  }

  const rune = (id: number | null) => (id != null ? runeMaps?.keystones.get(id) : undefined)
  const style = (id: number | null) => (id != null ? runeMaps?.styles.get(id) : undefined)

  const keystoneId = page.primary_rune_ids[0]
  const keystone = rune(keystoneId)
  const secondaryStyle = style(page.secondary_style_id)

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1">
        {keystone ? (
          <RuneIcon iconUrl={keystone.iconUrl} name={keystone.name} description={keystone.description} size={22} />
        ) : null}
        {secondaryStyle ? (
          <RuneIcon iconUrl={secondaryStyle.iconUrl} name={secondaryStyle.name} size={16} />
        ) : null}
      </div>
    )
  }

  const minors = page.primary_rune_ids.slice(1)
  const primaryStyle = style(page.primary_style_id)

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {primaryStyle && (
        <RuneIcon iconUrl={primaryStyle.iconUrl} name={primaryStyle.name} size={16} muted />
      )}
      {keystone && (
        <RuneIcon iconUrl={keystone.iconUrl} name={keystone.name} description={keystone.description} size={30} />
      )}
      {minors.map((id, i) => {
        const info = rune(id)
        return info ? (
          <RuneIcon key={`minor-${i}`} iconUrl={info.iconUrl} name={info.name} description={info.description} size={24} />
        ) : null
      })}

      {(secondaryStyle || page.secondary_rune_ids.some((id) => id != null)) && (
        <span className="mx-0.5 h-5 w-px bg-chip-border" />
      )}
      {secondaryStyle && (
        <RuneIcon iconUrl={secondaryStyle.iconUrl} name={secondaryStyle.name} size={16} muted />
      )}
      {page.secondary_rune_ids.map((id, i) => {
        const info = rune(id)
        return info ? (
          <RuneIcon key={`sec-${i}`} iconUrl={info.iconUrl} name={info.name} description={info.description} size={24} />
        ) : null
      })}

      {page.stat_shard_ids.some((id) => id != null) && <span className="mx-0.5 h-5 w-px bg-chip-border" />}
      {page.stat_shard_ids.map((id, rowIndex) => {
        const shard = id != null ? getStatShard(rowIndex, id) : undefined
        return shard ? (
          <RuneIcon
            key={`shard-${rowIndex}`}
            iconUrl={shard.iconUrl}
            name={shard.name}
            description={shard.description}
            size={18}
          />
        ) : null
      })}
    </div>
  )
}
