import { createContext, useContext } from 'react'
import type { Household, Profile } from './api'
import type { Scope } from './util'

export interface AppCtx {
  userId: string
  profile: Profile
  household: Household
  members: Profile[]
  /** Nosso (shared) ou Meu (personal): filtra todas as telas */
  scope: Scope
  setScope: (s: Scope) => void
  /** 'YYYY-MM' */
  month: string
  setMonth: (m: string) => void
}

export const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp fora do provider')
  return ctx
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'Sem nome'
