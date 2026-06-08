import { useNavigate } from "react-router-dom"
import { Scissors } from "lucide-react"
import { groomingApi } from "@/api/endpoints"
import type { WorkOrderOut, WorkStatus } from "@/api/types"
import { useAsync } from "@/lib/useAsync"
import { fmtDateTime } from "@/lib/format"
import { GROOMING_STAGES } from "@/lib/status"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { WorkStatusBadge } from "@/components/StatusBadge"

// 排序權重：進行中（PreCheck..Grooming）最前，其次待處理，最後已完成/異常終止。
const SORT_RANK: Record<WorkStatus, number> = {
  PreCheck: 0,
  Bathing: 0,
  Drying: 0,
  Grooming: 0,
  Pending: 1,
  Completed: 2,
  Aborted: 2,
}

export default function WorkOrdersPage() {
  const nav = useNavigate()
  const { data: orders, loading, error } = useAsync(() => groomingApi.workOrders(), [])

  const sorted = orders
    ? [...orders].sort((a, b) => {
        const r = SORT_RANK[a.status] - SORT_RANK[b.status]
        if (r !== 0) return r
        // 同組內較新者在前
        return (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      })
    : []

  return (
    <div className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-xl font-bold">工作單清單</h1>
        <p className="text-sm text-muted-foreground">依進度排序，進行中的工作單優先顯示</p>
      </header>

      {loading ? (
        <PageLoader label="載入工作單…" />
      ) : error ? (
        <Alert tone="danger" title="載入失敗">
          {error}
        </Alert>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Scissors className="size-7" />}
          title="目前沒有工作單"
          description="美容預約報到後，系統會自動建立美容工作單"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3">
          {sorted.map((o) => (
            <WorkOrderCard key={o.id} order={o} onOpen={() => nav(`/staff/work-orders/${o.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkOrderCard({ order, onOpen }: { order: WorkOrderOut; onOpen: () => void }) {
  // 目前狀態在四階段中的索引（-1 = 尚未進入階段，即 Pending）。
  const curIdx = GROOMING_STAGES.indexOf(order.status as (typeof GROOMING_STAGES)[number])
  // 進度填滿到的索引：Completed 視為四段全滿；階段中則填到目前索引。
  const filledThrough = order.status === "Completed" ? GROOMING_STAGES.length - 1 : curIdx

  return (
    <Card
      onClick={onOpen}
      className="flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:border-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            工作單 <span className="num">{order.id.slice(0, 8)}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            建立 {fmtDateTime(order.createdAt)}
          </p>
        </div>
        <WorkStatusBadge status={order.status} />
      </div>

      {/* 四段 mini 進度條（預檢 / 洗澡 / 烘乾 / 剪毛） */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-4 gap-1.5">
          {GROOMING_STAGES.map((stage, i) => (
            <div
              key={stage}
              className={cn(
                "h-1.5 rounded-full",
                order.status === "Aborted"
                  ? i <= curIdx
                    ? "bg-destructive/50"
                    : "bg-muted"
                  : i <= filledThrough
                    ? "bg-primary"
                    : "bg-muted",
              )}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>預檢</span>
          <span>洗澡</span>
          <span>烘乾</span>
          <span>剪毛</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span className="text-muted-foreground">開始時間</span>
        <span className="num text-foreground">
          {order.startedAt ? fmtDateTime(order.startedAt) : "未開始"}
        </span>
      </div>
    </Card>
  )
}
