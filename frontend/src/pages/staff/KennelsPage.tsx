import * as React from "react"
import { BedDouble, LayoutGrid, Sparkles, CheckCircle2 } from "lucide-react"
import { checkinApi } from "@/api/endpoints"
import type { KennelOut, KennelStatus } from "@/api/types"
import { useAsync, errMsg } from "@/lib/useAsync"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { KennelStatusBadge } from "@/components/StatusBadge"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<KennelOut["type"], string> = {
  Standard: "標準",
  Deluxe: "豪華",
}

// border/tint styling per kennel status
const CARD_STYLE: Record<KennelStatus, string> = {
  Available: "border-dashed border-success/60 bg-success-soft/30",
  Occupied: "border-primary bg-primary-soft/40",
  Reserved: "border-warning/60 bg-warning-soft/40",
  Cleaning: "border-border bg-muted/60",
}

export default function KennelsPage() {
  const { data: kennels, loading, error, reload } = useAsync(() => checkinApi.kennels(), [])
  const [selected, setSelected] = React.useState<KennelOut | null>(null)

  const counts = React.useMemo(() => {
    const c: Record<KennelStatus, number> = { Available: 0, Reserved: 0, Occupied: 0, Cleaning: 0 }
    for (const k of kennels ?? []) c[k.status] += 1
    return c
  }, [kennels])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">床位看板</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">即時掌握每個床位的狀態與住客</p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="空床" value={counts.Available} icon={<BedDouble className="size-5" />} tint="success" />
        <KpiCard label="已預約" value={counts.Reserved} icon={<LayoutGrid className="size-5" />} tint="warning" />
        <KpiCard label="已入住" value={counts.Occupied} icon={<LayoutGrid className="size-5" />} tint="primary" />
        <KpiCard label="清潔中" value={counts.Cleaning} icon={<Sparkles className="size-5" />} tint="muted" />
      </div>

      {loading ? (
        <PageLoader label="載入床位中…" />
      ) : error ? (
        <Alert tone="danger" title="載入失敗">{error}</Alert>
      ) : !kennels || kennels.length === 0 ? (
        <EmptyState
          icon={<BedDouble className="size-7" />}
          title="尚無床位資料"
          description="系統目前沒有可顯示的床位"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {kennels.map((k) => {
            const clickable = k.status === "Cleaning" || k.status === "Occupied"
            return (
              <button
                key={k.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setSelected(k)}
                className={cn(
                  "relative flex flex-col gap-1 rounded-xl border p-3 text-left shadow-sm transition-shadow",
                  CARD_STYLE[k.status],
                  clickable ? "cursor-pointer hover:shadow-md" : "cursor-default",
                )}
              >
                <div className="absolute right-2 top-2">
                  <KennelStatusBadge status={k.status} />
                </div>
                <span className="num text-lg font-bold tracking-tight">{k.kennelNumber}</span>
                <span className="text-xs text-muted-foreground">{TYPE_LABEL[k.type]}房</span>
                <span className="mt-2 truncate text-sm font-medium text-foreground">
                  {k.occupiedByPetName || "—"}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <KennelDialog kennel={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tint: "success" | "warning" | "primary" | "muted"
}) {
  const tintCls = {
    success: "bg-success-soft text-success-foreground",
    warning: "bg-warning-soft text-warning-foreground",
    primary: "bg-primary-soft text-primary-strong",
    muted: "bg-muted text-muted-foreground",
  }[tint]
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-lg", tintCls)}>{icon}</div>
      <div className="leading-tight">
        <div className="num text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

function KennelDialog({
  kennel,
  onClose,
  onChanged,
}: {
  kennel: KennelOut | null
  onClose: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (kennel) setErr(null)
  }, [kennel])

  async function markAvailable() {
    if (!kennel) return
    setBusy(true)
    setErr(null)
    try {
      await checkinApi.markKennelAvailable(kennel.id)
      onChanged()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!kennel) return null

  return (
    <Overlay open={!!kennel} onClose={onClose} variant="modal" title={`床位 ${kennel.kennelNumber}`}>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
          <div className="leading-tight">
            <div className="num text-lg font-bold">{kennel.kennelNumber}</div>
            <div className="text-xs text-muted-foreground">{TYPE_LABEL[kennel.type]}房</div>
          </div>
          <KennelStatusBadge status={kennel.status} />
        </div>

        {kennel.status === "Occupied" ? (
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">住客</dt>
              <dd className="font-medium">{kennel.occupiedByPetName || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">預約編號</dt>
              <dd className="num font-medium">
                {kennel.occupiedByBookingId ? kennel.occupiedByBookingId.slice(0, 8) : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <>
            <Alert tone="info" title="清潔完成手動標記">
              清潔完成後，請手動將此床位標記為空床，使其重新開放預約。
            </Alert>
            {err ? <Alert tone="danger">{err}</Alert> : null}
            <Button className="w-full" size="lg" onClick={markAvailable} disabled={busy}>
              {busy ? <Spinner /> : <CheckCircle2 className="size-4" />}
              標記為空床（清潔完成）
            </Button>
          </>
        )}
      </div>
    </Overlay>
  )
}
