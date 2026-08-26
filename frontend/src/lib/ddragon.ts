import { useEffect, useState } from 'react'

const DDRAGON = 'https://ddragon.leagueoflegends.com'

export interface ChampionInfo {
  id: string
  name: string
  iconUrl: string
}

function cleanDdragonHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

let versionPromise: Promise<string> | null = null
function getLatestVersion(): Promise<string> {
  if (!versionPromise) {
    versionPromise = fetch(`${DDRAGON}/api/versions.json`)
      .then((r) => r.json())
      .then((versions: string[]) => versions[0])
  }
  return versionPromise
}

let championMapPromise: Promise<Map<number, ChampionInfo>> | null = null

interface DDragonChampionEntry {
  id: string
  key: string
  name: string
  image: { full: string }
}

function getChampionMap(): Promise<Map<number, ChampionInfo>> {
  if (!championMapPromise) {
    championMapPromise = getLatestVersion().then(async (version) => {
      const res = await fetch(`${DDRAGON}/cdn/${version}/data/en_US/champion.json`)
      const json: { data: Record<string, DDragonChampionEntry> } = await res.json()
      const map = new Map<number, ChampionInfo>()
      for (const champ of Object.values(json.data)) {
        map.set(Number(champ.key), {
          id: champ.id,
          name: champ.name,
          iconUrl: `${DDRAGON}/cdn/${version}/img/champion/${champ.image.full}`,
        })
      }
      return map
    })
  }
  return championMapPromise
}

export function useChampionMap(): Map<number, ChampionInfo> | null {
  const [map, setMap] = useState<Map<number, ChampionInfo> | null>(null)

  useEffect(() => {
    let cancelled = false
    getChampionMap().then((m) => {
      if (!cancelled) setMap(m)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return map
}

export function useProfileIconUrl(profileIconId: number | null): string | null {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    getLatestVersion().then((v) => {
      if (!cancelled) setVersion(v)
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (!version || profileIconId == null) return null
  return `${DDRAGON}/cdn/${version}/img/profileicon/${profileIconId}.png`
}

export function useItemIconUrl(itemId: number): string | null {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    getLatestVersion().then((v) => {
      if (!cancelled) setVersion(v)
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (!version || !itemId) return null
  return `${DDRAGON}/cdn/${version}/img/item/${itemId}.png`
}

export interface ItemStatLine {
  label: string
  value: string
  iconUrl?: string
}

export interface ItemSection {
  kind: 'passive' | 'active'
  name: string
  body: string
}

export interface ItemInfo {
  id: number
  name: string
  iconUrl: string
  tags: string[]
  plaintext: string
  statLines: ItemStatLine[]
  sections: ItemSection[]
  totalCost: number
  sellCost: number
}

const CDRAGON_STATMODS = 'https://raw.communitydragon.org/latest/game/assets/perks/statmods'
const STAT_ICON_BY_LABEL: Record<string, string> = {
  'ability power': `${CDRAGON_STATMODS}/statmodsabilitypowericon.png`,
  'attack damage': `${CDRAGON_STATMODS}/statmodsattackdamageicon.png`,
  armor: `${CDRAGON_STATMODS}/statmodsarmoricon.png`,
  'magic resist': `${CDRAGON_STATMODS}/statmodsmagicresicon.png`,
  'magic resistance': `${CDRAGON_STATMODS}/statmodsmagicresicon.png`,
  health: `${CDRAGON_STATMODS}/statmodshealthplusicon.png`,
  'move speed': `${CDRAGON_STATMODS}/statmodsmovementspeedicon.png`,
  'movement speed': `${CDRAGON_STATMODS}/statmodsmovementspeedicon.png`,
  'attack speed': `${CDRAGON_STATMODS}/statmodsattackspeedicon.png`,
  tenacity: `${CDRAGON_STATMODS}/statmodstenacityicon.png`,
  'ability haste': `${CDRAGON_STATMODS}/statmodscdrscalingicon.png`,
}

function parseItemDescription(html: string): { statLines: ItemStatLine[]; sections: ItemSection[] } {
  const mainText = html.match(/<mainText>([\s\S]*)<\/mainText>/i)?.[1] ?? html

  const statLines: ItemStatLine[] = []
  const statsBlock = mainText.match(/<stats>([\s\S]*?)<\/stats>/i)?.[1]
  if (statsBlock) {
    for (const fragment of statsBlock.split(/<br\s*\/?>/i)) {
      const m = fragment.match(/<attention>([\s\S]*?)<\/attention>\s*([\s\S]*)/i)
      if (!m) continue
      const value = m[1].replace(/<[^>]+>/g, '').trim()
      const label = m[2].replace(/<[^>]+>/g, '').trim()
      if (!value || !label) continue
      statLines.push({ value, label, iconUrl: STAT_ICON_BY_LABEL[label.toLowerCase()] })
    }
  }

  const sections: ItemSection[] = []
  const afterStats = mainText.replace(/<stats>[\s\S]*?<\/stats>/i, '')
  const sectionRegex = /<(passive|active)>([\s\S]*?)<\/\1>([\s\S]*?)(?=<(?:passive|active)>|$)/gi
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(afterStats))) {
    const [, kind, rawName, rawBody] = match
    const body = cleanDdragonHtml(rawBody)
    if (!body) continue
    sections.push({ kind: kind.toLowerCase() as 'passive' | 'active', name: cleanDdragonHtml(rawName), body })
  }

  return { statLines, sections }
}

interface DDragonItemEntry {
  name: string
  description: string
  plaintext?: string
  image: { full: string }
  tags?: string[]
  gold?: { purchasable: boolean; total: number; sell: number }
}

let rawItemDataPromise: Promise<{ version: string; data: Record<string, DDragonItemEntry> }> | null = null

function getRawItemData(): Promise<{ version: string; data: Record<string, DDragonItemEntry> }> {
  if (!rawItemDataPromise) {
    rawItemDataPromise = getLatestVersion().then(async (version) => {
      const res = await fetch(`${DDRAGON}/cdn/${version}/data/en_US/item.json`)
      const json: { data: Record<string, DDragonItemEntry> } = await res.json()
      return { version, data: json.data }
    })
  }
  return rawItemDataPromise
}

function toItemInfo(id: number, item: DDragonItemEntry, version: string): ItemInfo {
  const { statLines, sections } = parseItemDescription(item.description ?? '')
  return {
    id,
    name: item.name,
    iconUrl: `${DDRAGON}/cdn/${version}/img/item/${item.image.full}`,
    tags: item.tags ?? [],
    plaintext: item.plaintext ?? '',
    statLines,
    sections,
    totalCost: item.gold?.total ?? 0,
    sellCost: item.gold?.sell ?? 0,
  }
}

let itemMapPromise: Promise<Map<number, ItemInfo>> | null = null

function getItemMap(): Promise<Map<number, ItemInfo>> {
  if (!itemMapPromise) {
    itemMapPromise = getRawItemData().then(({ version, data }) => {
      const map = new Map<number, ItemInfo>()
      for (const [idStr, item] of Object.entries(data)) {
        if (item.gold?.purchasable === false) continue
        map.set(Number(idStr), toItemInfo(Number(idStr), item, version))
      }
      return map
    })
  }
  return itemMapPromise
}

let roleBoundItemMapPromise: Promise<Map<number, ItemInfo>> | null = null

function getRoleQuestItemMap(): Promise<Map<number, ItemInfo>> {
  if (!roleBoundItemMapPromise) {
    roleBoundItemMapPromise = getRawItemData().then(({ version, data }) => {
      const map = new Map<number, ItemInfo>()
      for (const [idStr, item] of Object.entries(data)) {
        map.set(Number(idStr), toItemInfo(Number(idStr), item, version))
      }
      return map
    })
  }
  return roleBoundItemMapPromise
}

export function useRoleQuestItemMap(): Map<number, ItemInfo> | null {
  const [map, setMap] = useState<Map<number, ItemInfo> | null>(null)
  useEffect(() => {
    let cancelled = false
    getRoleQuestItemMap().then((m) => {
      if (!cancelled) setMap(m)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return map
}

export function useItemMap(): Map<number, ItemInfo> | null {
  const [map, setMap] = useState<Map<number, ItemInfo> | null>(null)
  useEffect(() => {
    let cancelled = false
    getItemMap().then((m) => {
      if (!cancelled) setMap(m)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return map
}

export interface SummonerSpellInfo {
  name: string
  iconUrl: string
  description: string
}

interface DDragonSummonerSpellEntry {
  key: string
  name: string
  description: string
  image: { full: string }
}

let summonerSpellMapPromise: Promise<Map<number, SummonerSpellInfo>> | null = null

function getSummonerSpellMap(): Promise<Map<number, SummonerSpellInfo>> {
  if (!summonerSpellMapPromise) {
    summonerSpellMapPromise = getLatestVersion().then(async (version) => {
      const res = await fetch(`${DDRAGON}/cdn/${version}/data/en_US/summoner.json`)
      const json: { data: Record<string, DDragonSummonerSpellEntry> } = await res.json()
      const map = new Map<number, SummonerSpellInfo>()
      for (const spell of Object.values(json.data)) {
        map.set(Number(spell.key), {
          name: spell.name,
          iconUrl: `${DDRAGON}/cdn/${version}/img/spell/${spell.image.full}`,
          description: spell.description ?? '',
        })
      }
      return map
    })
  }
  return summonerSpellMapPromise
}

export function useSummonerSpellMap(): Map<number, SummonerSpellInfo> | null {
  const [map, setMap] = useState<Map<number, SummonerSpellInfo> | null>(null)
  useEffect(() => {
    let cancelled = false
    getSummonerSpellMap().then((m) => {
      if (!cancelled) setMap(m)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return map
}

interface DDragonRuneRef {
  id: number
  name: string
  shortDesc: string
  icon: string
}

interface DDragonRuneStyle {
  id: number
  name: string
  icon: string
  slots: { runes: DDragonRuneRef[] }[]
}

export interface RuneInfo {
  name: string
  iconUrl: string
  description: string
}

export interface RuneStyleInfo {
  name: string
  iconUrl: string
}

export interface RuneSlotInfo {
  runes: { id: number; info: RuneInfo }[]
}

export interface RuneTreeInfo {
  id: number
  name: string
  iconUrl: string
  slots: RuneSlotInfo[]
}

export interface StatShardInfo {
  id: number
  name: string
  description: string
  iconUrl: string
}

export interface RuneMaps {
  keystones: Map<number, RuneInfo>
  styles: Map<number, RuneStyleInfo>
  trees: RuneTreeInfo[]
}

export const STAT_SHARD_ROWS: StatShardInfo[][] = [
  [
    { id: 5008, name: 'Adaptive Force', description: '+9 Adaptive Force', iconUrl: `${CDRAGON_STATMODS}/statmodsadaptiveforceicon.png` },
    { id: 5005, name: 'Attack Speed', description: '+10% Attack Speed', iconUrl: `${CDRAGON_STATMODS}/statmodsattackspeedicon.png` },
    { id: 5007, name: 'Ability Haste', description: '+8 Ability Haste', iconUrl: `${CDRAGON_STATMODS}/statmodscdrscalingicon.png` },
  ],
  [
    { id: 5008, name: 'Adaptive Force', description: '+9 Adaptive Force', iconUrl: `${CDRAGON_STATMODS}/statmodsadaptiveforceicon.png` },
    { id: 5010, name: 'Move Speed', description: '+2.5% Move Speed', iconUrl: `${CDRAGON_STATMODS}/statmodsmovementspeedicon.png` },
    { id: 5001, name: 'Health Scaling', description: '+10-180 Health (based on level)', iconUrl: `${CDRAGON_STATMODS}/statmodshealthplusicon.png` },
  ],
  [
    { id: 5011, name: 'Health', description: '+65 Health', iconUrl: `${CDRAGON_STATMODS}/statmodshealthscalingicon.png` },
    { id: 5013, name: 'Tenacity and Slow Resist', description: '+15% Tenacity and Slow Resist', iconUrl: `${CDRAGON_STATMODS}/statmodstenacityicon.png` },
    { id: 5001, name: 'Health Scaling', description: '+10-180 Health (based on level)', iconUrl: `${CDRAGON_STATMODS}/statmodshealthplusicon.png` },
  ],
]

export const STAT_SHARD_ROW_LABELS = ['Offense', 'Flex', 'Defense']

export function getStatShard(rowIndex: number, id: number): StatShardInfo | undefined {
  return STAT_SHARD_ROWS[rowIndex]?.find((shard) => shard.id === id)
}

let runeMapPromise: Promise<RuneMaps> | null = null

function getRuneMaps(): Promise<RuneMaps> {
  if (!runeMapPromise) {
    runeMapPromise = getLatestVersion().then(async (version) => {
        const res = await fetch(`${DDRAGON}/cdn/${version}/data/en_US/runesReforged.json`)
        const styles: DDragonRuneStyle[] = await res.json()
        const keystones = new Map<number, RuneInfo>()
        const styleIcons = new Map<number, RuneStyleInfo>()
        const trees: RuneTreeInfo[] = []
        for (const style of styles) {
          styleIcons.set(style.id, { name: style.name, iconUrl: `${DDRAGON}/cdn/img/${style.icon}` })
          const treeSlots: RuneSlotInfo[] = []
          for (const slot of style.slots) {
            const slotRunes: { id: number; info: RuneInfo }[] = []
            for (const rune of slot.runes) {
              const info: RuneInfo = {
                name: rune.name,
                iconUrl: `${DDRAGON}/cdn/img/${rune.icon}`,
                description: cleanDdragonHtml(rune.shortDesc ?? ''),
              }
              keystones.set(rune.id, info)
              slotRunes.push({ id: rune.id, info })
            }
            treeSlots.push({ runes: slotRunes })
          }
          trees.push({
            id: style.id,
            name: style.name,
            iconUrl: `${DDRAGON}/cdn/img/${style.icon}`,
            slots: treeSlots,
          })
        }
        trees.sort((a, b) => a.id - b.id)
        return { keystones, styles: styleIcons, trees }
      })
  }
  return runeMapPromise
}

export function useRuneMaps(): RuneMaps | null {
  const [maps, setMaps] = useState<RuneMaps | null>(null)
  useEffect(() => {
    let cancelled = false
    getRuneMaps().then((m) => {
      if (!cancelled) setMaps(m)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return maps
}

export interface ChampionSpellInfo {
  key: 'Q' | 'W' | 'E' | 'R'
  name: string
  iconUrl: string
  description: string
}

interface DDragonChampionDetail {
  spells: { name: string; description: string; image: { full: string } }[]
}

const SPELL_KEYS: ChampionSpellInfo['key'][] = ['Q', 'W', 'E', 'R']
const championSpellPromises = new Map<number, Promise<ChampionSpellInfo[] | null>>()

function getChampionSpells(championId: number): Promise<ChampionSpellInfo[] | null> {
  const cached = championSpellPromises.get(championId)
  if (cached) return cached
  const promise = Promise.all([getLatestVersion(), getChampionMap()])
    .then(async ([version, champions]) => {
      const champion = champions.get(championId)
      if (!champion) return null
      const res = await fetch(`${DDRAGON}/cdn/${version}/data/en_US/champion/${champion.id}.json`)
      const json: { data: Record<string, DDragonChampionDetail> } = await res.json()
      const detail = json.data[champion.id]
      if (!detail) return null
      return detail.spells.slice(0, 4).map((spell, i) => ({
        key: SPELL_KEYS[i],
        name: spell.name,
        iconUrl: `${DDRAGON}/cdn/${version}/img/spell/${spell.image.full}`,
        description: spell.description ?? '',
      }))
    })
    .catch(() => null)
  championSpellPromises.set(championId, promise)
  return promise
}

export function useChampionSpells(championId: number | null): ChampionSpellInfo[] | null {
  const [spells, setSpells] = useState<ChampionSpellInfo[] | null>(null)
  useEffect(() => {
    if (championId == null) {
      setSpells(null)
      return
    }
    let cancelled = false
    getChampionSpells(championId).then((s) => {
      if (!cancelled) setSpells(s)
    })
    return () => {
      cancelled = true
    }
  }, [championId])
  return spells
}
