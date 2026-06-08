import * as React from "react"
import { useNavigate } from "react-router-dom"
import { PawPrint } from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { homeForRole, ROLE_LABEL, type Role } from "@/auth/auth"
import { errMsg } from "@/lib/useAsync"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"

const DEMO: { role: Role; email: string }[] = [
  { role: "Owner", email: "owner@demo.example.com" },
  { role: "FrontDesk", email: "frontdesk@demo.example.com" },
  { role: "Groomer", email: "groomer@demo.example.com" },
  { role: "Admin", email: "admin@demo.example.com" },
]

export default function LoginPage() {
  const { login, token, role } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  // already logged in → bounce to role home
  React.useEffect(() => {
    if (token) nav(homeForRole(role), { replace: true })
  }, [token, role, nav])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError("請輸入 Email 與密碼")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await login(email, password)
      nav(homeForRole(r), { replace: true })
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-secondary/60 to-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid size-[72px] place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-strong text-primary-foreground shadow-lg">
            <PawPrint className="size-9" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">寵物旅館</h1>
            <p className="mt-1 text-sm text-muted-foreground">把毛孩，交給信賴的人</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-md">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">密碼</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? <Alert tone="danger" title="登入失敗">{error}</Alert> : null}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            登入
          </Button>

          <div className="flex justify-between text-xs text-muted-foreground">
            <button type="button" className="hover:text-foreground" title="（示範版未實作）">
              忘記密碼？
            </button>
            <button type="button" className="hover:text-foreground" title="（示範版未實作）">
              註冊新帳號
            </button>
          </div>
        </form>

        <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/40 p-3">
          <p className="mb-2 text-center text-xs text-muted-foreground">示範帳號（密碼 Passw0rd!）</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.role}
                type="button"
                onClick={() => {
                  setEmail(d.email)
                  setPassword("Passw0rd!")
                }}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
              >
                {ROLE_LABEL[d.role]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
