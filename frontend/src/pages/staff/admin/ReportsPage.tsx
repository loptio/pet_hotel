import { FileBarChart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function ReportsPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="w-full max-w-md text-center shadow-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 pt-8">
          <div className="grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary-strong">
            <FileBarChart className="size-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">異常取消報告</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              檢視近 30 天取消與不退款異常、辨識高風險帳號，供稽核與風控使用。
            </p>
          </div>
          <Badge tone="warning">展示範圍外 (WIP)</Badge>
          <p className="num text-xs text-muted-foreground">GET /auth/reports/abnormal-cancellations</p>
        </CardContent>
      </Card>
    </div>
  )
}
