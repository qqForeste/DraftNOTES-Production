import { useNavigate } from 'react-router-dom'
import { buildViewPath } from './viewTarget'

export function useLookupNavigate() {
  const navigate = useNavigate()
  return {
    go: (gameName: string, tagLine: string, platform: string) => {
      navigate(buildViewPath(gameName, tagLine, platform))
    },
  }
}
