import * as React from "react"
import { Ban, Search, ShieldCheck, UserPlus, Unlock } from "lucide-react"
import { adminApi } from "@/api/endpoints"
import type { AccountOut, AccountStatus, RoleOut } from "@/api/types"
import { ROLE_LABEL, type Role } from "@/auth/auth"
import { useAsync, errMsg } from "@/lib/useAsync"
import type { Tone } from "@/lib/status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"

const STATUS: Record<AccountStatus, { label: string; tone: Tone }> = {
  Active: { label: "啟用", tone: "success" },
  Banned: { label: "已封鎖", tone: "danger" },
  Disabled: { label: "已停用", tone: "neutral" },
}

export default function AccountsPage() {
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([adminApi.accounts(), adminApi.roles()]).then(([accounts, roles]) => ({ accounts, roles })),
    [],
  )
  const [q, setQ] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [banTarget, setBanTarget] = React.useState<AccountOut | null>(null)
  const [roleTarget, setRoleTarget] = React.useState<AccountOut | null>(null)

  if (loading) return <PageLoader label="載入帳號…" />
  if (error) return <Alert tone="danger" title="載入失敗">{error}</Alert>

  const roles = data!.roles
  const query = q.trim().toLowerCase()
  const accounts = data!.accounts.filter(
    (a) => !query || a.displayName.toLowerCase().includes(query) || a.email.toLowerCase().includes(query),
  )

  async function toggleBan(a: AccountOut) {
    if (a.status === "Banned") {
      await adminApi.unban(a.id)
      reload()
    } else {
      setBanTarget(a)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">帳號管理</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">封鎖/解封、建立員工帳號、指派 RBAC 角色</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋姓名 / Email"
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button onClick={() => setCreating(true)}>
            <UserPlus className="size-4" /> 建立員工
          </Button>
        </div>
      </header>

      {accounts.length === 0 ? (
        <EmptyState title="沒有符合的帳號" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{a.displayName}</td>
                  <td className="px-4 py-3"><span className="num text-muted-foreground">{a.email}</span></td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setRoleTarget(a)}>
                        <ShieldCheck className="size-4" /> 角色
                      </Button>
                      <Button
                        size="sm"
                        variant={a.status === "Banned" ? "outline" : "destructive"}
                        onClick={() => toggleBan(a)}
                      >
                        {a.status === "Banned" ? <Unlock className="size-4" /> : <Ban className="size-4" />}
                        {a.status === "Banned" ? "解封" : "封鎖"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateStaffDialog open={creating} roles={roles} onClose={() => setCreating(false)} onDone={reload} />
      <BanDialog account={banTarget} onClose={() => setBanTarget(null)} onDone={reload} />
      <RolesDialog account={roleTarget} roles={roles} onClose={() => setRoleTarget(null)} />
    </div>
  )
}

/* ----- create staff ----- */
function CreateStaffDialog({
  open,
  roles,
  onClose,
  onDone,
}: {
  open: boolean
  roles: RoleOut[]
  onClose: () => void
  onDone: () => void
}) {
  const staffRoles = roles.filter((r) => r.name !== "Owner")
  const [form, setForm] = React.useState({ email: "", password: "", displayName: "", phone: "", roleName: "FrontDesk" })
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setForm({ email: "", password: "", displayName: "", phone: "", roleName: "FrontDesk" })
      setErr(null)
    }
  }, [open])

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit() {
    if (!form.email || !form.password || !form.displayName) {
      setErr("Email、密碼、姓名為必填")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await adminApi.createStaff({
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        phone: form.phone || null,
        roleName: form.roleName,
      })
      onDone()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay open={open} onClose={onClose} variant="modal" title="建立員工帳號">
      <div className="space-y-3 p-5">
        <Field label="姓名 *">
          <Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="王小明" />
        </Field>
        <Field label="Email *">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="staff@demo.example.com" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="密碼 *">
            <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Passw0rd!" />
          </Field>
          <Field label="電話">
            <Input className="num" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0912000000" />
          </Field>
        </div>
        <Field label="角色">
          <select
            value={form.roleName}
            onChange={(e) => set("roleName", e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            {staffRoles.map((r) => (
              <option key={r.id} value={r.name}>
                {ROLE_LABEL[r.name as Role] ?? r.name}
              </option>
            ))}
          </select>
        </Field>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
          {busy ? <Spinner /> : <UserPlus className="size-4" />} 建立帳號
        </Button>
      </div>
    </Overlay>
  )
}

/* ----- ban ----- */
function BanDialog({
  account,
  onClose,
  onDone,
}: {
  account: AccountOut | null
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (account) {
      setReason("")
      setErr(null)
    }
  }, [account])

  if (!account) return null

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      await adminApi.ban(account!.id, { reason: reason.trim() || null })
      onDone()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay open={!!account} onClose={onClose} variant="modal" title={`封鎖帳號 · ${account.displayName}`}>
      <div className="space-y-4 p-5">
        <Alert tone="danger" title="封鎖後">該帳號將無法登入與操作，可隨時解封。</Alert>
        <div className="space-y-1.5">
          <Label>封鎖原因（選填）</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例：違反使用條款" />
        </div>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        <Button className="w-full" size="lg" variant="destructive" disabled={busy} onClick={submit}>
          {busy ? <Spinner /> : <Ban className="size-4" />} 確認封鎖
        </Button>
      </div>
    </Overlay>
  )
}

/* ----- role management (assign / remove; contract has no per-account role read) ----- */
function RolesDialog({
  account,
  roles,
  onClose,
}: {
  account: AccountOut | null
  roles: RoleOut[]
  onClose: () => void
}) {
  const [busyRole, setBusyRole] = React.useState<string | null>(null)
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null)

  React.useEffect(() => {
    if (account) setMsg(null)
  }, [account])

  if (!account) return null

  async function act(roleId: string, action: "assign" | "remove", roleName: string) {
    setBusyRole(roleId + action)
    setMsg(null)
    try {
      if (action === "assign") await adminApi.assignRole(account!.id, { roleId })
      else await adminApi.removeRole(account!.id, roleId)
      setMsg({ tone: "success", text: `已${action === "assign" ? "指派" : "移除"} ${ROLE_LABEL[roleName as Role] ?? roleName}` })
    } catch (e) {
      setMsg({ tone: "danger", text: errMsg(e) })
    } finally {
      setBusyRole(null)
    }
  }

  return (
    <Overlay open={!!account} onClose={onClose} variant="modal" title={`管理角色 · ${account.displayName}`}>
      <div className="space-y-3 p-5">
        <Alert tone="info">指派或移除此帳號的 RBAC 角色（後端即時生效）。</Alert>
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-muted-foreground" />
                {ROLE_LABEL[r.name as Role] ?? r.name}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!!busyRole} onClick={() => act(r.id, "assign", r.name)}>
                  {busyRole === r.id + "assign" ? <Spinner /> : null} 指派
                </Button>
                <Button size="sm" variant="ghost" disabled={!!busyRole} onClick={() => act(r.id, "remove", r.name)}>
                  {busyRole === r.id + "remove" ? <Spinner /> : null} 移除
                </Button>
              </div>
            </div>
          ))}
        </div>
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      </div>
    </Overlay>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
