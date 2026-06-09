import { useNavigate } from "react-router-dom"
import {
  Bell,
  ChevronRight,
  CreditCard,
  Headphones,
  LogOut,
  PawPrint,
  CalendarClock,
  UserRound,
} from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ImageSlot } from "@/components/ui/image-slot"
import { OWNER_AVATAR_IMG } from "@/lib/images"

export default function MePage() {
  const { account, logout } = useAuth()
  const nav = useNavigate()

  const rows = [
    { icon: <UserRound className="size-5" />, label: "個人資料" },
    { icon: <PawPrint className="size-5" />, label: "我的寵物", onClick: () => nav("/app/pets") },
    { icon: <CalendarClock className="size-5" />, label: "預約紀錄", onClick: () => nav("/app/bookings") },
    { icon: <Bell className="size-5" />, label: "通知" },
    { icon: <CreditCard className="size-5" />, label: "付款方式" },
    { icon: <Headphones className="size-5" />, label: "聯絡客服" },
  ]

  return (
    <div className="space-y-5 p-4">
      <header className="pt-2">
        <h1 className="text-xl font-bold">我的</h1>
      </header>

      {/* profile header */}
      <Card className="flex items-center gap-4 p-4">
        <ImageSlot src={OWNER_AVATAR_IMG} className="size-16 shrink-0" rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{account?.displayName ?? "—"}</p>
          <p className="num truncate text-sm text-muted-foreground">{account?.email ?? "—"}</p>
          {account?.phone ? (
            <p className="num truncate text-sm text-muted-foreground">{account.phone}</p>
          ) : null}
        </div>
      </Card>

      {/* settings list */}
      <Card className="divide-y divide-border overflow-hidden p-0">
        {rows.map((row) => {
          const interactive = !!row.onClick
          return (
            <button
              key={row.label}
              type="button"
              onClick={row.onClick}
              disabled={!interactive}
              className={
                "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors " +
                (interactive ? "hover:bg-muted/60" : "cursor-default")
              }
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-strong">
                {row.icon}
              </span>
              <span className="flex-1 text-sm font-medium">{row.label}</span>
              {interactive ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" /> : null}
            </button>
          )
        })}
      </Card>

      {/* logout */}
      <Button
        variant="outline"
        size="lg"
        className="w-full border-destructive/40 text-destructive hover:bg-destructive-soft hover:text-destructive-foreground"
        onClick={() => {
          logout()
          nav("/login", { replace: true })
        }}
      >
        <LogOut className="size-4" /> 登出
      </Button>
    </div>
  )
}
