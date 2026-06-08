import * as React from "react"
import { ApiError } from "@/api/client"

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
  setData: React.Dispatch<React.SetStateAction<T | null>>
}

/** Run an async loader on mount (and when deps change). Standard loading/error/data. */
export function useAsync<T>(loader: () => Promise<T>, deps: React.DependencyList = []): AsyncState<T> {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [nonce, setNonce] = React.useState(0)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    loader()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e instanceof ApiError ? e.detail : "載入失敗，請稍後再試"))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = React.useCallback(() => setNonce((n) => n + 1), [])
  return { data, loading, error, reload, setData }
}

/** Helper to surface an ApiError detail string from a catch. */
export function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.detail : "發生錯誤，請稍後再試"
}
