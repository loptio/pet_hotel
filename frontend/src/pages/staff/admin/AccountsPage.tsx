import { Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function AccountsPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="w-full max-w-md text-center shadow-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 pt-8">
          <div className="grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary-strong">
            <Users className="size-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">帳號管理</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              封鎖／解封員工與飼主帳號、建立員工帳號、指派 RBAC 角色。
            </p>
          </div>
          <Badge tone="warning">展示範圍外 (WIP)</Badge>
          <p className="num text-xs text-muted-foreground">GET /auth/accounts</p>
        </CardContent>
      </Card>
    </div>
  )
}
