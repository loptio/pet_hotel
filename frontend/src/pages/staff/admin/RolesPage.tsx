import * as React from "react"
import { Check, ShieldCheck } from "lucide-react"
import { adminApi } from "@/api/endpoints"
import { ROLE_LABEL, type Role } from "@/auth/auth"
import { useAsync } from "@/lib/useAsync"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"

// NOTE: GET /auth/roles returns only {id,name} and the contract has no
// role→permission endpoint, so the ✓ matrix is rendered from this reference
// mapping (identical to the backend seed ROLE_GRANTS). Permission codes + role
// names themselves come from the API. Reported as a contract gap.
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  Owner: ["pet.read", "pet.write", "booking.create", "booking.read", "booking.cancel", "payment.pay"],
  FrontDesk: [
    "pet.read", "pet.danger.mark_low", "booking.read", "booking.review",
    "payment.pay", "checkin.perform", "kennel.manage", "emergency.trigger",
  ],
  Groomer: ["pet.read", "pet.danger.mark_low", "grooming.execute", "emergency.trigger"],
  Admin: [
    "account.read", "account.ban", "rbac.manage", "staff.create", "audit.read",
    "pet.danger.mark_high", "pet.read", "booking.read",
  ],
}

export default function RolesPage() {
  const { data, loading, error } = useAsync(
    () =>
      Promise.all([adminApi.roles(), adminApi.permissions()]).then(([roles, permissions]) => ({
        roles,
        permissions,
      })),
    [],
  )
  const [selected, setSelected] = React.useState<string | null>(null)

  if (loading) return <PageLoader label="載入角色與權限…" />
  if (error) return <Alert tone="danger" title="載入失敗">{error}</Alert>

  const roles = data!.roles
  const permissions = [...data!.permissions].sort((a, b) => a.code.localeCompare(b.code))
  const has = (roleName: string, code: string) =>
    (ROLE_PERMISSIONS[roleName as Role] ?? []).includes(code)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">角色與權限</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">RBAC 權限矩陣（權限 × 角色）</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* 角色清單 */}
        <Card className="h-fit p-2">
          {roles.map((r) => {
            const count = (ROLE_PERMISSIONS[r.name as Role] ?? []).length
            return (
              <button
                key={r.id}
                onClick={() => setSelected((s) => (s === r.name ? null : r.name))}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  selected === r.name ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  {ROLE_LABEL[r.name as Role] ?? r.name}
                </span>
                <span
                  className={cn(
                    "num rounded-full px-2 py-0.5 text-xs",
                    selected === r.name ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </Card>

        {/* 權限矩陣 */}
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">權限</th>
                {roles.map((r) => (
                  <th
                    key={r.id}
                    className={cn(
                      "px-3 py-3 text-center font-medium",
                      selected === r.name ? "bg-primary-soft text-primary-strong" : "",
                    )}
                  >
                    {ROLE_LABEL[r.name as Role] ?? r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{p.description ?? p.code}</div>
                    <div className="num text-xs text-muted-foreground">{p.code}</div>
                  </td>
                  {roles.map((r) => (
                    <td
                      key={r.id}
                      className={cn(
                        "px-3 py-2.5 text-center",
                        selected === r.name ? "bg-primary-soft/40" : "",
                      )}
                    >
                      {has(r.name, p.code) ? (
                        <Check className="mx-auto size-4 text-success" />
                      ) : (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
