import { useEffect, useState } from 'react'

export interface SiteTheme {
  id: string
  label: string
  mode: 'dark' | 'light'
  pair: string
  swatch: [string, string, string]
}

export const SITE_THEMES: SiteTheme[] = [
  { id: 'ink', label: 'Ink', mode: 'dark', pair: 'cyan', swatch: ['#08090b', '#0f1114', '#22c3d6'] },
  { id: 'crimson', label: 'Crimson', mode: 'dark', pair: 'crimson', swatch: ['#08090b', '#0f1114', '#e14b3f'] },
  { id: 'amethyst', label: 'Amethyst', mode: 'dark', pair: 'amethyst', swatch: ['#100c17', '#18121f', '#8b5cf6'] },
  { id: 'obsidian', label: 'Obsidian', mode: 'dark', pair: 'neutral', swatch: ['#060606', '#0d0d0d', '#cfd7de'] },
  { id: 'bracken', label: 'Bracken', mode: 'dark', pair: 'green', swatch: ['#08090b', '#0f1114', '#5a8a5f'] },
  { id: 'rouge', label: 'Rouge', mode: 'dark', pair: 'pink', swatch: ['#08090b', '#0f1114', '#c23d72'] },
  { id: 'blush', label: 'Blush', mode: 'light', pair: 'pink', swatch: ['#f6eef1', '#fffbfc', '#c23d72'] },
  { id: 'fern', label: 'Fern', mode: 'light', pair: 'green', swatch: ['#eaf0ea', '#f4f8f4', '#5a8a5f'] },
  { id: 'wisteria', label: 'Wisteria', mode: 'light', pair: 'amethyst', swatch: ['#f0edf4', '#f6f3fa', '#7452a8'] },
  { id: 'chalk', label: 'Chalk', mode: 'light', pair: 'neutral', swatch: ['#f0f0f0', '#f7f7f7', '#2b2b2b'] },
  { id: 'glacier', label: 'Glacier', mode: 'light', pair: 'cyan', swatch: ['#e8f1f5', '#f2f8fa', '#1f9dc4'] },
  { id: 'cardinal', label: 'Cardinal', mode: 'light', pair: 'crimson', swatch: ['#f0f0f0', '#f7f7f7', '#e14b3f'] },
]

export interface ThemePair {
  id: string
  dark: SiteTheme
  light: SiteTheme
}

export const THEME_PAIRS: ThemePair[] = (() => {
  const byId = new Map<string, { dark?: SiteTheme; light?: SiteTheme }>()
  const order: string[] = []
  for (const theme of SITE_THEMES) {
    if (!byId.has(theme.pair)) {
      byId.set(theme.pair, {})
      order.push(theme.pair)
    }
    byId.get(theme.pair)![theme.mode] = theme
  }
  return order.map((id) => {
    const entry = byId.get(id)!
    if (!entry.dark || !entry.light) {
      throw new Error(`Theme pair "${id}" is missing its ${entry.dark ? 'light' : 'dark'} counterpart`)
    }
    return { id, dark: entry.dark, light: entry.light }
  })
})()

export const DEFAULT_THEME_ID = 'ink'
const STORAGE_KEY = 'draftnotes-theme'

function readStoredTheme(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

export function useSiteTheme() {
  const [themeId, setThemeId] = useState(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
    try {
      localStorage.setItem(STORAGE_KEY, themeId)
    } catch {
      void 0
    }
  }, [themeId])

  return [themeId, setThemeId] as const
}
