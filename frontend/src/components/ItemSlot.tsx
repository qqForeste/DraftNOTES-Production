import { useItemMap } from '../lib/ddragon'
import { HoverCard } from './HoverCard'
import { ItemTooltip } from './ItemTooltip'

export function ItemSlot({ itemId, size = 20 }: { itemId: number; size?: number }) {
  const itemMap = useItemMap()
  const dim = { width: size, height: size }
  if (!itemId) {
    return <div className="rounded bg-black/25" style={dim} />
  }
  const item = itemMap?.get(itemId)
  if (!item) {
    return <div className="rounded bg-black/25" style={dim} />
  }
  return (
    <HoverCard content={<ItemTooltip item={item} />} interactive>
      <img src={item.iconUrl} alt="" className="rounded" style={dim} />
    </HoverCard>
  )
}
