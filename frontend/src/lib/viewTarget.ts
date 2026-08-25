export function buildViewPath(gameName: string, tagLine: string, platform: string): string {
  const params = new URLSearchParams({ name: gameName, tag: tagLine, platform })
  return `/?${params}`
}

export function hasViewTarget(searchParams: URLSearchParams): boolean {
  return searchParams.has('name')
}
