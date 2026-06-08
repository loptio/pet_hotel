import { NavLink, Outlet } from "react-router-dom"
import { Compass, CalendarDays, PawPrint, User } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { to: "/app/home", label: "探索", icon: Compass },
  { to: "/app/bookings", label: "預約", icon: CalendarDays },
  { to: "/app/pets", label: "寵物", icon: PawPrint },
  { to: "/app/me", label: "我的", icon: User },
]

/** Owner mobile shell: centered 390px phone frame + bottom tab bar. */
export function OwnerLayout() {
  return (
    <div className="flex min-h-svh justify-center bg-gradient-to-b from-secondary/60 to-background">
      <div className="relative flex min-h-svh w-full max-w-[420px] flex-col bg-background shadow-lg">
        <main className="flex-1 overflow-y-auto scroll-area pb-20">
          <Outlet />
        </main>
        <nav className="absolute inset-x-0 bottom-0 z-20 flex border-t border-border bg-card/95 backdrop-blur">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
