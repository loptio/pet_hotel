import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, BedDouble, CalendarClock, Check, TriangleAlert } from "lucide-react"
import { bookingApi, groomingApi, cancellationApi } from "@/api/endpoints"
import type { BookingDetailOut, WorkOrderOut, CancellationResultOut, BookingStatus } from "@/api/types"
import { useAsync, errMsg } from "@/lib/useAsync"
import { money, amountOf, moneyNum, fmtDateTime, fmtTime } from "@/lib/format"
import { GROOMING_STAGES, stageLabel, workStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { BookingStatusBadge } from "@/components/StatusBadge"

// generic booking lifecycle, in order — index drives the stepper
const BOOKING_STEPS: { status: BookingStatus; label: string }[] = [
  { status: "PendingDeposit", label: "待付訂金" },
  { status: "Confirmed", label: "已確認" },
  { status: "CheckedIn", label: "已報到" },
  { status: "InProgress", label: "服務中" },
  { status: "Completed", label: "已完成" },
]

// map every booking status onto a step index (PendingReview folds into the deposit stage)
const STATUS_INDEX: Record<BookingStatus, number> = {
  PendingDeposit: 0,
  PendingReview: 0,
  Confirmed: 1,
  CheckedIn: 2,
  InProgress: 3,
  Completed: 4,
  Cancelled: -1,
  Aborted: -1,
  NoShow: -1,
}

const CANCELLABLE: BookingStatus[] = ["PendingDeposit", "PendingReview", "Confirmed"]
const FINAL_PAYABLE: BookingStatus[] = ["Confirmed", "CheckedIn", "InProgress"]

export default function BookingDetailPage() {
  const { id = "" } = useParams()
  const nav = useNavigate()
  const { data: booking, loading, error, reload, setData } = useAsync(() => bookingApi.get(id), [id])

  // grooming work order — only relevant once we know the booking's item ids
  const { data: workOrder } = useAsync(async () => {
    if (!booking?.items?.length) return null
    const itemIds = new Set(booking.items.map((it) => it.id))
    const orders = await groomingApi.workOrders()
    return orders.find((w) => itemIds.has(w.bookingItemId)) ?? null
  }, [booking?.id])

  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [actionErr, setActionErr] = React.useState<string | null>(null)
  const [actionOk, setActionOk] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<"deposit" | "final" | null>(null)

  async function payDeposit() {
    setBusy("deposit")
    setActionErr(null)
    setActionOk(null)
    try {
      const r = await bookingApi.deposit(id, { paymentMethod: "Online" })
      setData(await bookingApi.get(id))
      setActionOk(`訂金 ${money(r.payment.amount)} 已付款，預約已確認`)
    } catch (e) {
      setActionErr(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  async function payFinal() {
    setBusy("final")
    setActionErr(null)
    setActionOk(null)
    try {
      const r = await bookingApi.finalPayment(id, { paymentMethod: "CardOnSite" })
      setData(await bookingApi.get(id))
      setActionOk(`尾款 ${money(r.payment.amount)} 已結清，謝謝您`)
    } catch (e) {
      setActionErr(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 p-4 pb-8">
      <button
        onClick={() => nav("/app/bookings")}
        className="flex items-center gap-1 pt-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 返回預約列表
      </button>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <Alert tone="danger" title="載入失敗">{error}</Alert>
      ) : !booking ? (
        <Alert tone="danger" title="找不到預約">此預約不存在或已被移除。</Alert>
      ) : (
        <BookingDetail
          booking={booking}
          workOrder={workOrder ?? null}
          busy={busy}
          actionErr={actionErr}
          actionOk={actionOk}
          onPayDeposit={payDeposit}
          onPayFinal={payFinal}
          onOpenCancel={() => {
            setActionErr(null)
            setActionOk(null)
            setCancelOpen(true)
          }}
        />
      )}

      {booking ? (
        <CancelSheet
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          bookingId={booking.id}
          onCancelled={reload}
        />
      ) : null}
    </div>
  )
}

function BookingDetail({
  booking,
  workOrder,
  busy,
  actionErr,
  actionOk,
  onPayDeposit,
  onPayFinal,
  onOpenCancel,
}: {
  booking: BookingDetailOut
  workOrder: WorkOrderOut | null
  busy: "deposit" | "final" | null
  actionErr: string | null
  actionOk: string | null
  onPayDeposit: () => void
  onPayFinal: () => void
  onOpenCancel: () => void
}) {
  const hasKennel = (booking.bookedPets ?? []).some((p) => !!p.kennelId)
  const total = amountOf(booking.totalAmount)
  const deposit = amountOf(booking.depositAmount)
  const balance = total - deposit

  const showCancel = CANCELLABLE.includes(booking.status)
  const showDeposit = booking.status === "PendingDeposit"
  const showFinal = FINAL_PAYABLE.includes(booking.status)

  return (
    <>
      {/* header */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <BookingStatusBadge status={booking.status} />
          {hasKennel ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-strong">
              <BedDouble className="size-3.5" /> 已配床
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4 shrink-0" />
          <span className="num">
            {fmtDateTime(booking.startAt)} ~ {fmtTime(booking.endAt)}
          </span>
        </div>
      </Card>

      {/* generic booking progress */}
      <Card className="p-4">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base">預約進度</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <BookingStepper status={booking.status} />
        </CardContent>
      </Card>

      {/* grooming work-order progress (only if a grooming item exists) */}
      {workOrder ? (
        <Card className="p-4">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-base">美容服務進度</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <GroomingStepper workOrder={workOrder} />
          </CardContent>
        </Card>
      ) : null}

      {/* amount */}
      <Card className="p-4">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base">金額明細</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 p-0 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">預估總額</span>
            <span className="num font-medium">{money(booking.totalAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">已付訂金</span>
            <span className="num font-medium text-success-foreground">- {money(booking.depositAmount)}</span>
          </div>
          <div className="my-1 border-t border-border" />
          <div className="flex items-center justify-between">
            <span className="font-medium">尾款</span>
            <span className="num text-lg font-bold text-primary">{moneyNum(balance)}</span>
          </div>
        </CardContent>
      </Card>

      {actionOk ? <Alert tone="success" title="完成">{actionOk}</Alert> : null}
      {actionErr ? <Alert tone="danger" title="操作失敗">{actionErr}</Alert> : null}

      {/* bottom actions */}
      {showDeposit || showFinal || showCancel ? (
        <div className="space-y-2.5">
          {showDeposit ? (
            <Button className="w-full" size="lg" onClick={onPayDeposit} disabled={busy !== null}>
              {busy === "deposit" ? <Spinner /> : null} 前往付訂金
            </Button>
          ) : null}
          {showFinal ? (
            <Button className="w-full" size="lg" onClick={onPayFinal} disabled={busy !== null}>
              {busy === "final" ? <Spinner /> : null} 結清尾款
            </Button>
          ) : null}
          {showCancel ? (
            <Button
              variant="destructive"
              className="w-full"
              size="lg"
              onClick={onOpenCancel}
              disabled={busy !== null}
            >
              取消預約
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function BookingStepper({ status }: { status: BookingStatus }) {
  const current = STATUS_INDEX[status]
  const terminated = current < 0 // Cancelled / Aborted / NoShow

  return (
    <div className="flex items-start">
      {BOOKING_STEPS.map((step, i) => {
        const done = !terminated && i < current
        const now = !terminated && i === current
        return (
          <React.Fragment key={step.status}>
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "grid size-8 place-items-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done && "border-success bg-success text-success-foreground",
                  now && "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px] shadow-primary-soft",
                  !done && !now && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-center text-[11px] leading-tight",
                  now ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < BOOKING_STEPS.length - 1 ? (
              <div className="mt-4 h-0.5 flex-1 self-start bg-border" aria-hidden />
            ) : null}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function GroomingStepper({ workOrder }: { workOrder: WorkOrderOut }) {
  // current stage index among the 4 advanceable stages; Completed => all done
  const isCompleted = workOrder.status === "Completed"
  const currentIdx = GROOMING_STAGES.indexOf(workOrder.status as (typeof GROOMING_STAGES)[number])
  const meta = workStatus[workOrder.status]

  return (
    <div className="space-y-3">
      <div className="flex items-start">
        {GROOMING_STAGES.map((stage, i) => {
          const done = isCompleted || (currentIdx >= 0 && i < currentIdx)
          const now = !isCompleted && i === currentIdx
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "grid size-8 place-items-center rounded-full border-2 text-xs font-semibold transition-colors",
                    done && "border-success bg-success text-success-foreground",
                    now && "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px] shadow-primary-soft",
                    !done && !now && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-center text-[11px] leading-tight",
                    now ? "font-medium text-primary" : "text-muted-foreground",
                  )}
                >
                  {stageLabel[stage]}
                </span>
              </div>
              {i < GROOMING_STAGES.length - 1 ? (
                <div className="mt-4 h-0.5 flex-1 self-start bg-border" aria-hidden />
              ) : null}
            </React.Fragment>
          )
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        目前狀態：<span className="font-medium text-foreground">{meta.label}</span>
      </p>
    </div>
  )
}

function CancelSheet({
  open,
  onClose,
  bookingId,
  onCancelled,
}: {
  open: boolean
  onClose: () => void
  bookingId: string
  onCancelled: () => void
}) {
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<CancellationResultOut["refund"] | null>(null)

  async function submit() {
    if (!reason.trim()) {
      setErr("請填寫取消原因")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await cancellationApi.cancel(bookingId, { reason: reason.trim() })
      setResult(r.refund)
      onCancelled()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay open={open} onClose={onClose} variant="sheet" title="取消預約與退款">
      <div className="space-y-4 p-5">
        <Alert tone="warning" title="退款規則" icon={<TriangleAlert className="size-4" />}>
          距預約開始 24 小時（含）以上取消可全額退還訂金；不足 24 小時則訂金恕不退還。
        </Alert>

        {result ? (
          <>
            <Alert
              tone={result.eligible ? "success" : "danger"}
              title={result.eligible ? "已取消並退款" : "已取消（不符退款）"}
            >
              <div className="space-y-1">
                {result.amount ? (
                  <div>
                    退款金額：<span className="num font-semibold">{money(result.amount)}</span>
                  </div>
                ) : null}
                <div>{result.reason}</div>
              </div>
            </Alert>
            <Button className="w-full" size="lg" variant="outline" onClick={onClose}>
              關閉
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Textarea
                placeholder="請說明取消原因（必填）"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
            {err ? <Alert tone="danger">{err}</Alert> : null}
            <Button
              variant="destructive"
              className="w-full"
              size="lg"
              onClick={submit}
              disabled={busy || !reason.trim()}
            >
              {busy ? <Spinner /> : null} 確認取消並退款
            </Button>
          </>
        )}
      </div>
    </Overlay>
  )
}
