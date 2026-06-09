import * as React from "react"
import { FileWarning, Ban, ShieldAlert } from "lucide-react"
import { adminApi } from "@/api/endpoints"
import type { AccountOut, CancellationReportOut } from "@/api/types"
import { useAsync } from "@/lib/useAsync"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"

export default function ReportsPage() {
  const { data, loading, error } = useAsync(
    () =>
      Promise.all([adminApi.abnormalCancellations(), adminApi.accounts()]).then(
        ([report, accounts]) => ({ report, accounts }),
      ),
    [],
  )

  if (loading) return <PageLoader label="載入異常取消報告…" />
  if (error) return <Alert tone="danger" title="載入失敗">{error}</Alert>

  const report: CancellationReportOut = data!.report
  const nameById = new Map(data!.accounts.map((a: AccountOut) => [a.id, a.displayName]))

  // 高風險帳號 = 同一飼主出現 ≥2 次異常取消
  const byOwner = new Map<string, number>()
  for (const r of report.rows) byOwner.set(r.ownerId, (byOwner.get(r.ownerId) ?? 0) + 1)
  const highRiskOwners = new Set([...byOwner.entries()].filter(([, n]) => n >= 2).map(([id]) => id))
  const notRefunded = report.rows.filter((r) => !r.refunded).length

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">異常取消報告</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          監控取消行為，紀錄保存 ≥180 天（NFR-05）
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi icon={<FileWarning className="size-5" />} tone="warning" label="異常取消總數" value={report.total} />
        <Kpi icon={<Ban className="size-5" />} tone="danger" label="不退款異常" value={notRefunded} />
        <Kpi icon={<ShieldAlert className="size-5" />} tone="danger" label="高風險帳號" value={highRiskOwners.size} />
      </div>

      {report.rows.length === 0 ? (
        <EmptyState icon={<FileWarning className="size-7" />} title="近期沒有異常取消" description="一切正常" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">預約</th>
                <th className="px-4 py-3 font-medium">飼主</th>
                <th className="px-4 py-3 font-medium">取消原因</th>
                <th className="px-4 py-3 font-medium">退款</th>
                <th className="px-4 py-3 font-medium">取消日</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => {
                const risky = highRiskOwners.has(r.ownerId)
                return (
                  <tr
                    key={r.bookingId}
                    className={cn(
                      "border-b border-border last:border-0",
                      risky ? "bg-destructive-soft/50" : "hover:bg-muted/30",
                    )}
                  >
                    <td className="px-4 py-3"><span className="num">{r.bookingId.slice(0, 8)}</span></td>
                    <td className="px-4 py-3">
                      {nameById.get(r.ownerId) ?? (
                        <span className="num text-muted-foreground">{r.ownerId.slice(0, 8)}</span>
                      )}
                      {risky ? <Badge tone="danger" className="ml-2">高風險</Badge> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.cancelReason ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.refunded ? "success" : "neutral"}>{r.refunded ? "已退款" : "未退款"}</Badge>
                    </td>
                    <td className="px-4 py-3"><span className="num text-muted-foreground">{fmtDate(r.cancelledAt)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode
  tone: "warning" | "danger"
  label: string
  value: number
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl",
          tone === "danger" ? "bg-destructive-soft text-destructive" : "bg-warning-soft text-warning",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="num text-2xl font-bold">{value}</div>
        <div className="whitespace-nowrap text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  )
}
