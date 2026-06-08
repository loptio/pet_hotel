import * as React from "react"
import { authApi } from "@/api/endpoints"
import { tokenStore } from "@/api/client"
import type { AccountOut } from "@/api/types"
import { isExpired, primaryRole, rolesFromToken, type Role } from "./auth"

interface AuthState {
  token: string | null
  account: AccountOut | null
  roles: Role[]
  role: Role | null
  loading: boolean
  login: (email: string, password: string) => Promise<Role | null>
  logout: () => void
  refreshAccount: () => Promise<void>
}

const AuthCtx = React.createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initial = tokenStore.get()
  const [token, setToken] = React.useState<string | null>(
    initial && !isExpired(initial) ? initial : null,
  )
  const [account, setAccount] = React.useState<AccountOut | null>(null)
  const [loading, setLoading] = React.useState<boolean>(!!token)

  const roles = React.useMemo(() => rolesFromToken(token), [token])
  const role = React.useMemo(() => primaryRole(roles), [roles])

  const logout = React.useCallback(() => {
    tokenStore.clear()
    setToken(null)
    setAccount(null)
  }, [])

  const refreshAccount = React.useCallback(async () => {
    try {
      setAccount(await authApi.me())
    } catch {
      /* account fetch is best-effort; token roles still drive routing */
    }
  }, [])

  // hydrate account on mount / token change; respond to global 401 logout
  React.useEffect(() => {
    let active = true
    if (token) {
      setLoading(true)
      authApi
        .me()
        .then((a) => active && setAccount(a))
        .catch(() => active && setAccount(null))
        .finally(() => active && setLoading(false))
    } else {
      setLoading(false)
    }
    return () => {
      active = false
    }
  }, [token])

  React.useEffect(() => {
    const onLogout = () => logout()
    window.addEventListener("auth:logout", onLogout)
    return () => window.removeEventListener("auth:logout", onLogout)
  }, [logout])

  const login = React.useCallback(async (email: string, password: string) => {
    const { accessToken } = await authApi.login(email, password)
    tokenStore.set(accessToken)
    setToken(accessToken)
    try {
      setAccount(await authApi.me())
    } catch {
      setAccount(null)
    }
    return primaryRole(rolesFromToken(accessToken))
  }, [])

  const value: AuthState = { token, account, roles, role, loading, login, logout, refreshAccount }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthCtx)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
