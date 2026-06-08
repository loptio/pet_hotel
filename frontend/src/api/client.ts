/**
 * Fetch wrapper for the Pet Hotel API. Same-origin via the Vite proxy (/api →
 * uvicorn:8000). Bearer JWT in localStorage (auth strategy confirmed = HTTPBearer).
 * Non-ok responses become ApiError carrying { status, detail, code } so callers
 * can branch (e.g. 409 danger / resource conflict). A 401 broadcasts auth:logout.
 */
const TOKEN_KEY = "pethotel_token"

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  detail: string
  code?: string | null
  constructor(status: number, detail: string, code?: string | null) {
    super(detail)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
    this.code = code
  }
}

const BASE = "/api/v1"

async function parse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (await parse(res)) as T
  const body = (await parse(res)) as { detail?: unknown; code?: string | null } | string | null
  let detail = `HTTP ${res.status}`
  let code: string | null | undefined
  if (body && typeof body === "object") {
    if (typeof body.detail === "string") detail = body.detail
    else if (Array.isArray(body.detail)) detail = "輸入資料有誤" // pydantic 422 list
    code = body.code
  } else if (typeof body === "string" && body) {
    detail = body
  }
  if (res.status === 401) {
    tokenStore.clear()
    window.dispatchEvent(new CustomEvent("auth:logout"))
  }
  throw new ApiError(res.status, detail, code)
}

function authHeaders(): Record<string, string> {
  const t = tokenStore.get()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export const api = {
  get: <T>(path: string) =>
    fetch(BASE + path, { headers: { ...authHeaders() } }).then((r) => handle<T>(r)),

  post: <T>(path: string, body?: unknown) =>
    fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => handle<T>(r)),

  patch: <T>(path: string, body?: unknown) =>
    fetch(BASE + path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => handle<T>(r)),

  // multipart upload (work photos / vaccine proof) — no JSON content-type
  upload: <T>(path: string, file: File, field = "file") => {
    const fd = new FormData()
    fd.append(field, file)
    return fetch(BASE + path, {
      method: "POST",
      headers: { ...authHeaders() },
      body: fd,
    }).then((r) => handle<T>(r))
  },
}
