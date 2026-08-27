import type { MatchListItem, ScoreboardEntry } from '../api/types'
import type { ChampionInfo, RuneMaps, SummonerSpellInfo } from '../lib/ddragon'
import { comparePositions } from '../lib/positions'
import { formatRankLabel, getRankEmblemUrl, getTierColor } from '../lib/rankIcons'
import { ClickableChampionIcon } from './ClickableChampionIcon'
import { DescriptionLines, HoverCard } from './HoverCard'
import { ItemSlot } from './ItemSlot'
import { PlayerHoverName } from './PlayerHoverName'
import { platformFromMatchId } from '../lib/platforms'
import { RoleQuestBadge } from './RoleQuestBadge'

interface Props {
  match: MatchListItem
  championMap: Map<number, ChampionInfo> | null
  spellMap: Map<number, SummonerSpellInfo> | null
  runeMaps: RuneMaps | null
}

const COL = {
  champ: 38,
  spellRune: 30,
  player: 92,
  kda: 58,
  dmg: 68,
  cs: 22,
}

function ChampionFrame({
  championId,
  level,
  championMap,
}: {
  championId: number
  level: number
  championMap: Map<number, ChampionInfo> | null
}) {
  return (
    <div className="relative shrink-0" style={{ width: COL.champ }}>
      <ClickableChampionIcon championId={championId} championMap={championMap} size={34} />
      <div className="pointer-events-none absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-black/40 bg-inset text-[10px] font-bold leading-none text-text-primary">
        {level}
      </div>
    </div>
  )
}

function SpellRuneColumn({
  p,
  spellMap,
  runeMaps,
}: {
  p: ScoreboardEntry
  spellMap: Map<number, SummonerSpellInfo> | null
  runeMaps: RuneMaps | null
}) {
  const keystone = p.primary_rune_id ? runeMaps?.keystones.get(p.primary_rune_id) : undefined
  const style = p.secondary_style_id ? runeMaps?.styles.get(p.secondary_style_id) : undefined
  return (
    <div className="flex shrink-0 gap-0.5" style={{ width: COL.spellRune }}>
      <div className="flex flex-col gap-0.5">
        {[p.summoner_1_id, p.summoner_2_id].map((spellId, i) => {
          const spell = spellId ? spellMap?.get(spellId) : undefined
          return spell ? (
            <HoverCard
              key={i}
              content={
                <>
                  <div className="mb-1 font-bold text-text-primary">{spell.name}</div>
                  {spell.description && <DescriptionLines text={spell.description} />}
                </>
              }
            >
              <img src={spell.iconUrl} alt="" className="h-3.5 w-3.5 rounded-sm" />
            </HoverCard>
          ) : (
            <div key={i} className="h-3.5 w-3.5 rounded-sm bg-black/25" />
          )
        })}
      </div>
      <div className="flex flex-col gap-0.5">
        {keystone ? (
          <HoverCard
            content={
              <>
                <div className="mb-1 font-bold text-text-primary">{keystone.name}</div>
                <DescriptionLines text={keystone.description} />
              </>
            }
          >
            <img src={keystone.iconUrl} alt="" className="h-3.5 w-3.5" />
          </HoverCard>
        ) : (
          <div className="h-3.5 w-3.5 rounded-full bg-black/25" />
        )}
        {style ? (
          <HoverCard content={<div className="font-bold text-text-primary">{style.name}</div>}>
            <img src={style.iconUrl} alt="" className="h-3.5 w-3.5 rounded-full bg-black/20 p-0.5" />
          </HoverCard>
        ) : (
          <div className="h-3.5 w-3.5 rounded-full bg-black/25" />
        )}
      </div>
    </div>
  )
}

function PlayerLabel({ p, platform }: { p: ScoreboardEntry; platform: string | null }) {
  return (
    <PlayerHoverName
      gameName={p.game_name}
      tagLine={p.tag_line}
      platform={platform}
      isSelf={p.is_self}
      className="flex shrink-0 flex-col gap-0.5"
      style={{ width: COL.player }}
    >
      <span
        className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] hover:text-text-primary"
        style={{ color: p.is_self ? 'var(--color-text-primary)' : 'var(--color-text-secondary-2)' }}
      >
        {p.game_name}
        <span className="text-text-secondary-5">#{p.tag_line}</span>
      </span>
      <span className="flex items-center gap-1">
        <img src={getRankEmblemUrl(p.tier)} alt="" className="h-3 w-3 shrink-0 object-scale-down" />
        <span className="truncate text-[10px] font-bold" style={{ color: getTierColor(p.tier) }}>
          {formatRankLabel(p.tier, p.division)}
        </span>
      </span>
    </PlayerHoverName>
  )
}

function TeamTable({
  players,
  win,
  championMap,
  spellMap,
  runeMaps,
  maxDamage,
  platform,
}: {
  players: ScoreboardEntry[]
  win: boolean
  championMap: Map<number, ChampionInfo> | null
  spellMap: Map<number, SummonerSpellInfo> | null
  runeMaps: RuneMaps | null
  maxDamage: number
  platform: string | null
}) {
  const accent = win ? 'var(--color-win-text)' : 'var(--color-loss-text)'
  const ordered = [...players].sort((a, b) => comparePositions(a.team_position, b.team_position))
  return (
    <div
      className="flex flex-col overflow-hidden rounded-card border"
      style={{
        background: win ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
        borderColor: win ? 'var(--color-win-border)' : 'var(--color-loss-border)',
      }}
    >
      <div className="relative flex items-center gap-2 bg-black/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-text-secondary-5">
        <span
          className="absolute left-2 text-[12px] normal-case tracking-normal"
          style={{ color: accent }}
        >
          {win ? 'Victory' : 'Defeat'}
        </span>
        <span className="shrink-0" style={{ width: COL.champ }} />
        <span className="shrink-0" style={{ width: COL.spellRune }} />
        <span className="shrink-0" style={{ width: COL.player }}>
          Player
        </span>
        <span className="shrink-0" style={{ width: COL.kda }}>
          KDA
        </span>
        <span className="shrink-0" style={{ width: COL.dmg }}>
          DMG
        </span>
        <span className="shrink-0" style={{ width: COL.cs }}>
          CS
        </span>
        <span>Items</span>
      </div>
      {ordered.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2 py-1.5"
          style={{ background: p.is_self ? 'rgba(30, 161, 247, 0.08)' : undefined }}
        >
          <ChampionFrame championId={p.champion_id} level={p.champion_level} championMap={championMap} />
          <SpellRuneColumn p={p} spellMap={spellMap} runeMaps={runeMaps} />
          <PlayerLabel p={p} platform={platform} />
          <span className="shrink-0 text-[12px] text-text-secondary-3" style={{ width: COL.kda }}>
            {p.kills}/<span className="text-loss">{p.deaths}</span>/{p.assists}
          </span>
          <div className="flex shrink-0 flex-col gap-0.5" style={{ width: COL.dmg }}>
            <span className="text-[11px] text-text-secondary-4">{p.damage_dealt.toLocaleString()}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${maxDamage > 0 ? Math.round((p.damage_dealt / maxDamage) * 100) : 0}%`,
                  background: p.is_self ? 'var(--color-accent)' : '#9a9aa4',
                }}
              />
            </div>
          </div>
          <span className="shrink-0 text-[12px] text-text-secondary-4" style={{ width: COL.cs }}>
            {p.cs}
          </span>
          <div className="flex flex-1 items-center gap-1">
            {p.items.map((itemId, j) => (
              <ItemSlot key={j} itemId={itemId} size={26} />
            ))}
            <RoleQuestBadge itemId={p.role_quest_item_id} size={24} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MatchAnalysisTab({ match, championMap, spellMap, runeMaps }: Props) {
  const selfTeamId = match.scoreboard.find((p) => p.is_self)?.team_id
  const allies = match.scoreboard.filter((p) => p.team_id === selfTeamId)
  const enemies = match.scoreboard.filter((p) => p.team_id !== selfTeamId)
  const maxDamage = Math.max(1, ...match.scoreboard.map((p) => p.damage_dealt))
  const platform = platformFromMatchId(match.match_id)

  const isLegacyMatch = match.scoreboard.every((p) => p.summoner_1_id == null)
  if (isLegacyMatch) {
    return (
      <div className="px-3 py-4 text-center text-[11px] text-text-secondary">
        This game was synced before full match analysis existed. Hit sync again to backfill it.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <TeamTable
        players={allies}
        win={match.win}
        championMap={championMap}
        spellMap={spellMap}
        runeMaps={runeMaps}
        maxDamage={maxDamage}
        platform={platform}
      />
      <TeamTable
        players={enemies}
        win={!match.win}
        championMap={championMap}
        spellMap={spellMap}
        runeMaps={runeMaps}
        maxDamage={maxDamage}
        platform={platform}
      />
    </div>
  )
}
