const PREFIX = 'lookupCache:'

function cacheKey(platform: string, gameName: string, tagLine: string): string {
  return `${PREFIX}${platform}:${gameName.trim().toLowerCase()}#${tagLine.trim().toLowerCase()}`
}

export function getCachedPuuid(platform: string, gameName: string, tagLine: string): string | null {
  try {
    return sessionStorage.getItem(cacheKey(platform, gameName, tagLine))
  } catch {
    return null
  }
}

export function setCachedPuuid(platform: string, gameName: string, tagLine: string, puuid: string): void {
  try {
    sessionStorage.setItem(cacheKey(platform, gameName, tagLine), puuid)
  } catch {
    void 0
  }
}
