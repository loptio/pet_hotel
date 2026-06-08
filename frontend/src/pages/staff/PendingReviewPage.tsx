import * as React from "react"
import { Check, X, ListChecks } from "lucide-react"
import { bookingApi } from "@/api/endpoints"
import type { BookingOut } from "@/api/types"
import { useAsync, errMsg } from "@/lib/useAsync"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { money, fmtDateTime } from "@/lib/format"

type Decision = "Approved" | "Rejected"

export default function PendingReviewPage() {
  const { data: bookings, loading, error, reload } = useAsync(() => bookingApi.pendingReview(), [])
  const [target, setTarget] = React.useState<{ booking: BookingOut; decision: Decision } | null>(null)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">待審核佇列</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">審核中度危險寵物的預約，核可或拒絕</p>
      </header>

      {loading ? (
        <PageLoader label="載入待審核預約…" />
      ) : error ? (
        <Alert tone="danger" title="載入失敗">{error}</Alert>
      ) : !bookings || bookings.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-7" />}
          title="目前沒有待審核的預約"
          description="所有送出的預約都已處理完畢"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">預約</th>
                <th className="px-4 py-3 font-medium">期間</th>
                <th className="px-4 py-3 font-medium">金額</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="num font-semibold">{b.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="num">{fmtDateTime(b.startAt)}</div>
                    <div className="num text-xs">至 {fmtDateTime(b.endAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="num font-semibold text-primary-strong">{money(b.totalAmount)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setTarget({ booking: b, decision: "Rejected" })}
                      >
                        <X className="size-4" /> 拒絕
                      </Button>
                      <Button size="sm" onClick={() => setTarget({ booking: b, decision: "Approved" })}>
                        <Check className="size-4" /> 核可
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReviewDialog target={target} onClose={() => setTarget(null)} onReviewed={reload} />
    </div>
  )
}

function ReviewDialog({
  target,
  onClose,
  onReviewed,
}: {
  target: { booking: BookingOut; decision: Decision } | null
  onClose: () => void
  onReviewed: () => void
}) {
  const [decision, setDecision] = React.useState<Decision>("Approved")
  const [staffNote, setStaffNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (target) {
      setDecision(target.decision)
      setStaffNote("")
      setErr(null)
    }
  }, [target])

  async function submit(d: Decision) {
    if (!target) return
    setBusy(true)
    setErr(null)
    try {
      await bookingApi.review(target.booking.id, { decision: d, staffNote: staffNote.trim() || undefined })
      onReviewed()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!target) return null
  const b = target.booking

  return (
    <Overlay open={!!target} onClose={onClose} variant="modal" title="審核預約">
      <div className="space-y-4 p-5">
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">預約編號</span>
            <span className="num font-semibold">{b.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">期間</span>
            <span className="num text-right">
              {fmtDateTime(b.startAt)} ～ {fmtDateTime(b.endAt)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">金額</span>
            <span className="num font-semibold text-primary-strong">{money(b.totalAmount)}</span>
          </div>
        </div>

        {decision === "Approved" ? (
          <Alert tone="success" title="核可後">該預約將轉為「待付訂金」，飼主可繼續完成付款。</Alert>
        ) : (
          <Alert tone="danger" title="拒絕後">該預約將被取消，飼主會收到通知。</Alert>
        )}

        <div className="space-y-1.5">
          <Label>審核備註</Label>
          <Textarea
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            placeholder="核可備註或拒絕原因（選填）"
          />
        </div>

        {err ? <Alert tone="danger">{err}</Alert> : null}

        <div className="flex gap-2.5">
          <Button
            className="flex-1"
            size="lg"
            variant="destructive"
            onClick={() => submit("Rejected")}
            disabled={busy}
          >
            {busy && decision === "Rejected" ? <Spinner /> : <X className="size-4" />}
            拒絕
          </Button>
          <Button className="flex-1" size="lg" onClick={() => submit("Approved")} disabled={busy}>
            {busy && decision === "Approved" ? <Spinner /> : <Check className="size-4" />}
            核可
          </Button>
        </div>
      </div>
    </Overlay>
  )
}
