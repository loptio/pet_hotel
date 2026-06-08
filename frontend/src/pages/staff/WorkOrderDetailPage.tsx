import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Check, Image as ImageIcon, Play, ShieldCheck, TriangleAlert, Upload } from "lucide-react"
import { groomingApi } from "@/api/endpoints"
import { ApiError } from "@/api/client"
import type { WorkPhotoOut } from "@/api/types"
import { useAsync, errMsg } from "@/lib/useAsync"
import { fmtDate, fmtDateTime } from "@/lib/format"
import { GROOMING_STAGES, stageLabel } from "@/lib/status"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { ImageSlot } from "@/components/ui/image-slot"
import { WorkStatusBadge } from "@/components/StatusBadge"

const CONFLICT_MSG = "狀態已變更，請重新整理"

export default function WorkOrderDetailPage() {
  const { id = "" } = useParams()
  const nav = useNavigate()
  const { data: wo, loading, error, reload } = useAsync(() => groomingApi.workOrder(id), [id])

  const [busy, setBusy] = React.useState(false)
  const [actionErr, setActionErr] = React.useState<string | null>(null)
  const [emergencyOpen, setEmergencyOpen] = React.useState(false)
  const [uploadMsg, setUploadMsg] = React.useState<string | null>(null)

  // 包裝每個 mutation：忙碌鎖定、409 顯示「請重新整理」，其餘以 errMsg 呈現，成功後 reload。
  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setActionErr(null)
    try {
      await fn()
      reload()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setActionErr(CONFLICT_MSG)
      else setActionErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoader label="載入工作單…" />

  if (error || !wo) {
    return (
      <div className="space-y-4 p-4">
        <BackButton onClick={() => nav("/staff/work-orders")} />
        <Alert tone="danger" title="載入失敗">
          {error ?? "找不到工作單"}
        </Alert>
      </div>
    )
  }

  const status = wo.status
  // 目前狀態在四階段中的索引：Pending=-1、PreCheck=0、…、Grooming=3、Completed/Aborted=-1。
  const curIdx = GROOMING_STAGES.indexOf(status as (typeof GROOMING_STAGES)[number])
  const isFinished = status === "Completed" || status === "Aborted"
  const photos: WorkPhotoOut[] = wo.photos ?? []

  return (
    <div className="space-y-4 p-4">
      <BackButton onClick={() => nav("/staff/work-orders")} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        {/* 左側：流程操作面板 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>
                  工作單 <span className="num text-base font-semibold">{wo.id.slice(0, 8)}</span>
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  開始時間 {wo.startedAt ? fmtDateTime(wo.startedAt) : "未開始"}
                </p>
              </div>
              <WorkStatusBadge status={status} />
            </CardHeader>

            <CardContent className="space-y-4">
              {actionErr ? (
                <Alert tone="danger" title="操作失敗" icon={<TriangleAlert />}>
                  {actionErr}
                </Alert>
              ) : null}

              {status === "Pending" ? (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={busy}
                  onClick={() => run(() => groomingApi.start(id))}
                >
                  {busy ? <Spinner /> : <Play className="size-4" />} 開始工作單
                </Button>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-sm font-medium text-foreground">服務階段</p>
                  {GROOMING_STAGES.map((stage, i) => {
                    // 已完成的階段：index <= curIdx（或工作單已結束時全部視為非可點）。
                    const done = curIdx >= 0 && i <= curIdx
                    // 下一個可推進的階段＝ curIdx + 1。
                    const active = !isFinished && i === curIdx + 1
                    return (
                      <StageButton
                        key={stage}
                        index={i}
                        label={stageLabel[stage] ?? stage}
                        done={done}
                        active={active}
                        busy={busy}
                        onClick={() => run(() => groomingApi.stage(id, { stage }))}
                      />
                    )
                  })}
                </div>
              )}

              {status !== "Pending" ? (
                <div className="space-y-2.5 border-t border-border pt-4">
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={busy || status !== "Grooming"}
                    onClick={() => run(() => groomingApi.complete(id))}
                  >
                    {busy ? <Spinner /> : <ShieldCheck className="size-4" />} 標記完成服務
                  </Button>
                  <Button
                    variant="destructive"
                    size="lg"
                    className="w-full"
                    disabled={busy || isFinished}
                    onClick={() => setEmergencyOpen(true)}
                  >
                    <TriangleAlert className="size-4" /> 緊急事件
                  </Button>
                </div>
              ) : null}

              {status === "Completed" ? (
                <Alert tone="success" title="服務已完成" icon={<Check />}>
                  完成於 {wo.completedAt ? fmtDateTime(wo.completedAt) : "—"}
                </Alert>
              ) : null}
              {status === "Aborted" ? (
                <Alert tone="danger" title="工作單已因緊急事件終止" icon={<TriangleAlert />}>
                  {wo.emergencyEvent?.description ?? "已觸發緊急事件，工作單終止。"}
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* 右側：作業照片 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">作業照片</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <ImageSlot key={p.id} className="aspect-square" label={p.uploadedAt ? fmtDate(p.uploadedAt) : undefined} />
                ))}
                {/* 補滿空位（最少顯示 3 格） */}
                {Array.from({ length: Math.max(0, 2 - photos.length) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="grid aspect-square place-items-center rounded-xl border border-dashed border-border text-muted-foreground"
                  >
                    <ImageIcon className="size-5 opacity-40" />
                  </div>
                ))}

                {/* MOCK 上傳格：僅示範，不呼叫真實上傳端點 */}
                <label className="grid aspect-square cursor-pointer place-items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 text-center text-primary-strong transition-colors hover:bg-primary-soft">
                  <Upload className="size-5" />
                  <span className="px-1 text-[10px] font-medium leading-tight">上傳照片</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setUploadMsg("（示範）已選擇照片")
                      }
                      e.target.value = ""
                    }}
                  />
                </label>
              </div>

              {uploadMsg ? (
                <Alert tone="success" icon={<Check />}>
                  {uploadMsg}
                </Alert>
              ) : null}

              <Alert tone="info">每階段完成自動推播通知飼主（FR-04.5）</Alert>
            </CardContent>
          </Card>
        </div>
      </div>

      <EmergencyDialog
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        onSubmitted={() => {
          setEmergencyOpen(false)
          reload()
        }}
        workOrderId={id}
      />
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={onClick}>
      <ArrowLeft className="size-4" /> 返回工作單清單
    </Button>
  )
}

function StageButton({
  index,
  label,
  done,
  active,
  busy,
  onClick,
}: {
  index: number
  label: string
  done: boolean
  active: boolean
  busy: boolean
  onClick: () => void
}) {
  const clickable = active && !busy
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors",
        done
          ? "border-success/30 bg-success-soft text-success"
          : active
            ? "border-primary bg-primary-soft text-primary-strong hover:bg-primary-soft/80"
            : "border-border bg-muted/40 text-muted-foreground",
        !clickable && "cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold num",
          done
            ? "bg-success text-success-foreground"
            : active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="size-4" /> : index + 1}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {done ? (
        <span className="text-xs">已完成</span>
      ) : active ? (
        <span className="flex items-center gap-1.5 text-xs">
          {busy ? <Spinner /> : null} 推進至此
        </span>
      ) : (
        <span className="text-xs">尚未開始</span>
      )}
    </button>
  )
}

function EmergencyDialog({
  open,
  onClose,
  onSubmitted,
  workOrderId,
}: {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
  workOrderId: string
}) {
  const [description, setDescription] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setDescription("")
      setErr(null)
    }
  }, [open])

  async function submit() {
    if (!description.trim()) {
      setErr("請填寫緊急事件描述")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await groomingApi.emergency(workOrderId, { description: description.trim() })
      onSubmitted()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErr(CONFLICT_MSG)
      else setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay open={open} onClose={onClose} variant="modal" title="觸發緊急事件">
      <div className="space-y-4 p-5">
        <Alert tone="warning" icon={<TriangleAlert />}>
          觸發後此工作單將終止（異常終止），並通知相關人員。
        </Alert>
        <div className="space-y-1.5">
          <Label htmlFor="emergency-desc">事件描述 *</Label>
          <Textarea
            id="emergency-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：寵物出現異常反應，已暫停服務並聯繫飼主…"
            rows={4}
          />
        </div>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button variant="destructive" className="flex-1" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : null} 確認觸發
          </Button>
        </div>
      </div>
    </Overlay>
  )
}
