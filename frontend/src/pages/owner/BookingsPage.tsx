import * as React from "react"
import { useNavigate } from "react-router-dom"
import { CalendarClock, ChevronRight } from "lucide-react"
import { bookingApi } from "@/api/endpoints"
import type { BookingOut, BookingStatus } from "@/api/types"
import { useAsync } from "@/lib/useAsync"
import { money, fmtDateTime, fmtTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { Segmented } from "@/components/ui/segmented"
import { BookingStatusBadge } from "@/components/StatusBadge"

type Tab = "active" | "history"

const ACTIVE: BookingStatus[] = ["PendingDeposit", "PendingReview", "Confirmed", "CheckedIn", "InProgress"]
const HISTORY: BookingStatus[] = ["Completed", "Cancelled", "NoShow", "Aborted"]
const DIMMED: BookingStatus[] = ["Cancelled", "Aborted", "NoShow"]

export default function BookingsPage() {
  const nav = useNavigate()
  const { data: bookings, loading, error } = useAsync(() => bookingApi.list(), [])
  const [tab, setTab] = React.useState<Tab>("active")

  const list = React.useMemo(() => {
    if (!bookings) return []
    const allow = tab === "active" ? ACTIVE : HISTORY
    return bookings.filter((b) => allow.includes(b.status))
  }, [bookings, tab])

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">我的預約</h1>
      </header>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: "進行中" },
          { value: "history", label: "歷史" },
        ]}
        className="w-full [&>button]:flex-1"
      />

      {loading ? (
        <PageLoader />
      ) : error ? (
        <Alert tone="danger" title="載入失敗">{error}</Alert>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-7" />}
          title={tab === "active" ? "目前沒有進行中的預約" : "尚無歷史預約"}
          description={
            tab === "active"
              ? "在探索頁挑選住宿或美容服務，立即預約"
              : "完成或取消的預約會顯示在這裡"
          }
        />
      ) : (
        <div className="space-y-2.5">
          {list.map((b) => (
            <BookingCard key={b.id} booking={b} onClick={() => nav(`/app/bookings/${b.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function BookingCard({ booking, onClick }: { booking: BookingOut; onClick: () => void }) {
  const dimmed = DIMMED.includes(booking.status)
  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer space-y-2.5 p-3.5 transition-colors hover:border-primary",
        dimmed && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between">
        <BookingStatusBadge status={booking.status} />
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarClock className="size-4 shrink-0" />
        <span className="num">
          {fmtDateTime(booking.startAt)} ~ {fmtTime(booking.endAt)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="num text-base font-semibold text-foreground">{money(booking.totalAmount)}</span>
        {booking.status === "PendingDeposit" ? (
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-strong">
            付訂金
          </span>
        ) : null}
      </div>
    </Card>
  )
}
