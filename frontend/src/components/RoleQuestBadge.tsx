import { useRoleQuestItemMap } from '../lib/ddragon'
import { HoverCard } from './HoverCard'
import { ItemTooltip } from './ItemTooltip'

export function RoleQuestBadge({ itemId, size = 20 }: { itemId: number | null; size?: number }) {
  const roleQuestItemMap = useRoleQuestItemMap()
  if (!itemId) return null
  const item = roleQuestItemMap?.get(itemId)
  if (!item) return null
  return (
    <HoverCard content={<ItemTooltip item={item} />} interactive>
      <img
        src={item.iconUrl}
        alt=""
        className="rounded-full"
        style={{ width: size, height: size, boxShadow: '0 0 0 1px #c8aa6e' }}
      />
    </HoverCard>
  )
}
