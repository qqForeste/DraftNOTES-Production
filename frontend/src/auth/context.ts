import { createContext } from 'react'
import type { MeOut } from '../api/types'

export interface AuthState {
  me: MeOut | null
  loading: boolean
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
