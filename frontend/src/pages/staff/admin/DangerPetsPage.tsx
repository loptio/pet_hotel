import { AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function DangerPetsPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="w-full max-w-md text-center shadow-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 pt-8">
          <div className="grid size-16 place-items-center rounded-2xl bg-destructive-soft text-destructive">
            <AlertTriangle className="size-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">危險寵物</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              標記寵物為高度危險（封鎖線上預約）或解除封鎖，僅限管理員操作。
            </p>
          </div>
          <Badge tone="warning">展示範圍外 (WIP)</Badge>
          <p className="num text-xs text-muted-foreground">POST /pets/{"{id}"}/danger-level · /unblock</p>
        </CardContent>
      </Card>
    </div>
  )
}
