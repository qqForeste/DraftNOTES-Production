import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getMe } from '../api/client'
import type { MeOut } from '../api/types'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeOut | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setMe(await getMe())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return <AuthContext.Provider value={{ me, loading, refresh }}>{children}</AuthContext.Provider>
}
