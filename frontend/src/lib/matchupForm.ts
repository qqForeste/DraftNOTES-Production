import type { MatchupPlaystyleTag, MatchupRole, MatchupWeaknessTag, RunePage, SkillOrder } from '../api/types'
import type { MatchupRecommendation } from './recommendation'
import {
  emptyRunePage,
  emptySkillOrder,
  fillEmptyItemSlots,
  fillEmptyRunePage,
  fillEmptySkillOrder,
} from './runes'

export interface MatchupFormState {
  role: MatchupRole
  yourChampionId: number | null
  enemyChampionId: number | null
  tags: MatchupPlaystyleTag[]
  weaknesses: MatchupWeaknessTag[]
  body: string
  coreItemIds: (number | null)[]
  optionalItemIds: (number | null)[]
  bootItemId: number | null
  optionalBootItemId: number | null
  runes: RunePage
  skillOrder: SkillOrder
}

export function emptyMatchupForm(role: MatchupRole): MatchupFormState {
  return {
    role,
    yourChampionId: null,
    enemyChampionId: null,
    tags: [],
    weaknesses: [],
    body: '',
    coreItemIds: [null, null, null],
    optionalItemIds: [null, null, null],
    bootItemId: null,
    optionalBootItemId: null,
    runes: emptyRunePage(),
    skillOrder: emptySkillOrder(),
  }
}

export function applyItemRecommendationFill(
  form: MatchupFormState,
  recommendation: MatchupRecommendation,
): MatchupFormState {
  return {
    ...form,
    coreItemIds: fillEmptyItemSlots(form.coreItemIds, recommendation.build.coreItemIds),
    optionalItemIds: fillEmptyItemSlots(form.optionalItemIds, recommendation.build.situationalItemIds),
    bootItemId: form.bootItemId ?? recommendation.build.bootItemId,
  }
}

export function clearItemFields(form: MatchupFormState): MatchupFormState {
  return {
    ...form,
    coreItemIds: [null, null, null],
    optionalItemIds: [null, null, null],
    bootItemId: null,
    optionalBootItemId: null,
  }
}

export function applyRuneRecommendationFill(
  form: MatchupFormState,
  recommendation: MatchupRecommendation,
): MatchupFormState {
  return {
    ...form,
    runes: recommendation.runes ? fillEmptyRunePage(form.runes, recommendation.runes) : form.runes,
  }
}

export function clearRuneFields(form: MatchupFormState): MatchupFormState {
  return { ...form, runes: emptyRunePage() }
}

export function applySkillRecommendationFill(
  form: MatchupFormState,
  recommendation: MatchupRecommendation,
): MatchupFormState {
  return { ...form, skillOrder: fillEmptySkillOrder(form.skillOrder, recommendation.skillOrder) }
}

export function clearSkillFields(form: MatchupFormState): MatchupFormState {
  return { ...form, skillOrder: emptySkillOrder() }
}
