import { NavLink, Outlet } from "react-router-dom"
import {
  ClipboardCheck,
  LayoutGrid,
  ListChecks,
  Scissors,
  Users,
  ShieldCheck,
  PawPrint,
  FileWarning,
  LogOut,
  PaintBucket,
} from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { ROLE_LABEL, type Role } from "@/auth/auth"
import { cn } from "@/lib/utils"

type NavItem = { to: string; label: string; icon: typeof Users }

const NAV: Record<Role, NavItem[]> = {
  FrontDesk: [
    { to: "/staff/checkin", label: "報到核驗", icon: ClipboardCheck },
    { to: "/staff/kennels", label: "床位看板", icon: LayoutGrid },
    { to: "/staff/pending-review", label: "待審核佇列", icon: ListChecks },
  ],
  Groomer: [{ to: "/staff/work-orders", label: "工作單", icon: Scissors }],
  Admin: [
    { to: "/staff/accounts", label: "帳號管理", icon: Users },
    { to: "/staff/roles", label: "角色與權限", icon: ShieldCheck },
    { to: "/staff/danger-pets", label: "危險寵物", icon: PawPrint },
    { to: "/staff/reports", label: "異常取消報告", icon: FileWarning },
  ],
  Owner: [],
}

const PALETTES = ["latte", "forest", "coral"] as const

function cyclePalette() {
  const el = document.documentElement
  const cur = el.getAttribute("data-palette") ?? "latte"
  const next = PALETTES[(PALETTES.indexOf(cur as (typeof PALETTES)[number]) + 1) % PALETTES.length]
  if (next === "latte") el.removeAttribute("data-palette")
  else el.setAttribute("data-palette", next)
}

/** Staff backoffice shell: dark sidebar (role-based nav) + topbar + content. */
export function StaffLayout() {
  const { role, account, logout } = useAuth()
  const items = role ? NAV[role] : []

  return (
    <div className="flex min-h-svh bg-secondary/40">
      {/* sidebar */}
      <aside className="flex w-[248px] shrink-0 flex-col bg-foreground text-background">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">寵物旅館</div>
            <div className="text-xs text-background/60">後台管理</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-background/75 hover:bg-background/10",
                )
              }
            >
              <Icon className="size-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-background/15 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid size-9 place-items-center rounded-full bg-background/15 text-sm font-semibold">
              {account?.displayName?.[0] ?? "員"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{account?.displayName ?? "員工"}</div>
              <div className="text-xs text-background/60">{role ? ROLE_LABEL[role] : ""}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-md p-1.5 text-background/70 hover:bg-background/10"
              title="登出"
            >
              <LogOut className="size-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3.5">
          <div className="text-sm text-muted-foreground">
            {role ? ROLE_LABEL[role] : "員工"} 後台
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cyclePalette}
              className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted"
              title="切換配色"
            >
              <PaintBucket className="size-4" />
            </button>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-strong">
              {role ? ROLE_LABEL[role] : ""}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto scroll-area p-6">
          <div className="mx-auto max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
