import type { RunePage } from '../api/types'
import { STAT_SHARD_ROW_LABELS, STAT_SHARD_ROWS, type RuneMaps, type RuneTreeInfo } from '../lib/ddragon'
import { applySecondaryPick } from '../lib/runes'
import { RuneIcon } from './RuneIcon'

interface Props {
  value: RunePage
  onChange: (page: RunePage) => void
  runeMaps: RuneMaps | null
  recommended?: RunePage | null
}

function TreeCrests({
  trees,
  selectedId,
  otherId,
  recommendedId,
  onPick,
}: {
  trees: RuneTreeInfo[]
  selectedId: number | null
  otherId: number | null
  recommendedId: number | null
  onPick: (treeId: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {trees.map((tree) => (
        <RuneIcon
          key={tree.id}
          iconUrl={tree.iconUrl}
          name={tree.name}
          size={24}
          muted={tree.id !== selectedId}
          recommended={tree.id === recommendedId}
          onClick={() => onPick(tree.id)}
          disabled={tree.id === otherId}
        />
      ))}
    </div>
  )
}

export function RunePageEditor({ value, onChange, runeMaps, recommended }: Props) {
  const trees = runeMaps?.trees ?? []
  const primary = trees.find((t) => t.id === value.primary_style_id)
  const secondary = trees.find((t) => t.id === value.secondary_style_id)

  function setPrimaryTree(treeId: number) {
    if (treeId === value.primary_style_id) return
    onChange({ ...value, primary_style_id: treeId, primary_rune_ids: [null, null, null, null] })
  }

  function setSecondaryTree(treeId: number) {
    if (treeId === value.secondary_style_id) return
    onChange({ ...value, secondary_style_id: treeId, secondary_rune_ids: [null, null] })
  }

  function pickPrimaryRune(slotIndex: number, runeId: number) {
    const next = [...value.primary_rune_ids]
    next[slotIndex] = next[slotIndex] === runeId ? null : runeId
    onChange({ ...value, primary_rune_ids: next })
  }

  function pickSecondaryRune(runeId: number) {
    onChange({ ...value, secondary_rune_ids: applySecondaryPick(value, secondary, runeId) })
  }

  function pickShard(rowIndex: number, shardId: number) {
    const next = [...value.stat_shard_ids]
    next[rowIndex] = next[rowIndex] === shardId ? null : shardId
    onChange({ ...value, stat_shard_ids: next })
  }

  const recommendedForPrimary = recommended?.primary_style_id === value.primary_style_id ? recommended : null
  const recommendedForSecondary = recommended?.secondary_style_id === value.secondary_style_id ? recommended : null

  return (
    <div className="flex flex-wrap gap-3 rounded-card border border-chip-border bg-inset p-2.5">
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-text-secondary">PRIMARY</span>
          <div className="flex-1" />
          <TreeCrests
            trees={trees}
            selectedId={value.primary_style_id}
            otherId={value.secondary_style_id}
            recommendedId={recommended?.primary_style_id ?? null}
            onPick={setPrimaryTree}
          />
        </div>

        {primary ? (
          primary.slots.map((slot, slotIndex) => (
            <div key={slotIndex} className="flex items-center gap-1.5">
              {slot.runes.map((rune) => (
                <RuneIcon
                  key={rune.id}
                  iconUrl={rune.info.iconUrl}
                  name={rune.info.name}
                  description={rune.info.description}
                  size={slotIndex === 0 ? 32 : 26}
                  muted={value.primary_rune_ids[slotIndex] !== rune.id}
                  recommended={recommendedForPrimary?.primary_rune_ids[slotIndex] === rune.id}
                  onClick={() => pickPrimaryRune(slotIndex, rune.id)}
                />
              ))}
            </div>
          ))
        ) : (
          <p className="py-3 text-[11px] text-text-muted">Pick a primary tree to choose a keystone.</p>
        )}
      </div>

      <div className="w-px self-stretch bg-chip-border" />

      <div className="flex min-w-[200px] flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-text-secondary">SECONDARY</span>
          <div className="flex-1" />
          <TreeCrests
            trees={trees}
            selectedId={value.secondary_style_id}
            otherId={value.primary_style_id}
            recommendedId={recommended?.secondary_style_id ?? null}
            onPick={setSecondaryTree}
          />
        </div>

        {secondary ? (
          secondary.slots.slice(1).map((slot, i) => {
            const slotIndex = i + 1
            return (
              <div key={slotIndex} className="flex items-center gap-1.5">
                {slot.runes.map((rune) => (
                  <RuneIcon
                    key={rune.id}
                    iconUrl={rune.info.iconUrl}
                    name={rune.info.name}
                    description={rune.info.description}
                    size={26}
                    muted={!value.secondary_rune_ids.includes(rune.id)}
                    recommended={recommendedForSecondary?.secondary_rune_ids.includes(rune.id)}
                    onClick={() => pickSecondaryRune(rune.id)}
                  />
                ))}
              </div>
            )
          })
        ) : (
          <p className="py-3 text-[11px] text-text-muted">Pick a secondary tree.</p>
        )}
      </div>

      <div className="w-px self-stretch bg-chip-border" />

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-text-secondary">SHARDS</span>
        {STAT_SHARD_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-1.5">
            <span className="w-[46px] shrink-0 text-[10px] text-text-muted">
              {STAT_SHARD_ROW_LABELS[rowIndex]}
            </span>
            {row.map((shard) => (
              <RuneIcon
                key={`${rowIndex}-${shard.id}`}
                iconUrl={shard.iconUrl}
                name={shard.name}
                description={shard.description}
                size={22}
                muted={value.stat_shard_ids[rowIndex] !== shard.id}
                recommended={recommended?.stat_shard_ids[rowIndex] === shard.id}
                onClick={() => pickShard(rowIndex, shard.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
