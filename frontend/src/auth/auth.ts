/** JWT decoding + role helpers. The access token carries a `roles` claim
 * ({sub,type,roles,exp}); /auth/me (AccountOut) does NOT return roles, so role
 * is read from the token client-side (display-only; backend enforces RBAC). */
export type Role = "Owner" | "FrontDesk" | "Groomer" | "Admin"

interface JwtPayload {
  sub?: string
  roles?: string[]
  exp?: number
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1]
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

export function rolesFromToken(token: string | null): Role[] {
  if (!token) return []
  const p = decodeJwt(token)
  return (p?.roles ?? []).filter((r): r is Role =>
    ["Owner", "FrontDesk", "Groomer", "Admin"].includes(r),
  )
}

export function isExpired(token: string | null): boolean {
  if (!token) return true
  const p = decodeJwt(token)
  return !p?.exp || p.exp * 1000 < Date.now()
}

const PRECEDENCE: Role[] = ["Admin", "FrontDesk", "Groomer", "Owner"]
export function primaryRole(roles: Role[]): Role | null {
  for (const r of PRECEDENCE) if (roles.includes(r)) return r
  return null
}

export const ROLE_LABEL: Record<Role, string> = {
  Owner: "飼主",
  FrontDesk: "櫃台人員",
  Groomer: "美容師",
  Admin: "系統管理員",
}

/** Where each role lands after login. */
export function homeForRole(role: Role | null): string {
  switch (role) {
    case "FrontDesk":
      return "/staff/checkin"
    case "Groomer":
      return "/staff/work-orders"
    case "Admin":
      return "/staff/accounts"
    case "Owner":
    default:
      return "/app/home"
  }
}
