import type { MistakeTag } from '../api/types'

export const TAG_COLORS: Record<MistakeTag, string> = {
  died_to_gank: '#ee5a52',
  overextended: '#2f9e8f',
  missed_wave: '#c9a227',
  bad_recall_timing: '#e2703a',
  bad_teamfight: '#d6549c',
  tilted: '#8c51c5',
  mechanical_misplay: '#6c7ee1',
  no_map_awareness: '#4fae5e',
}

export function getTagColor(tag: MistakeTag): string {
  return TAG_COLORS[tag]
}
