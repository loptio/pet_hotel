import * as React from "react"
import { PawPrint, ShieldAlert, Unlock } from "lucide-react"
import { petApi, adminApi } from "@/api/endpoints"
import type { AccountOut, PetOut } from "@/api/types"
import { useAsync, errMsg } from "@/lib/useAsync"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { Segmented } from "@/components/ui/segmented"
import { DangerBadge } from "@/components/StatusBadge"

type Filter = "all" | "danger" | "blocked"

export default function DangerPetsPage() {
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([petApi.list(), adminApi.accounts()]).then(([pets, accounts]) => ({ pets, accounts })),
    [],
  )
  const [filter, setFilter] = React.useState<Filter>("all")
  const [markTarget, setMarkTarget] = React.useState<PetOut | null>(null)

  if (loading) return <PageLoader label="載入寵物清單…" />
  if (error) return <Alert tone="danger" title="載入失敗">{error}</Alert>

  const nameById = new Map(data!.accounts.map((a: AccountOut) => [a.id, a.displayName]))
  const pets = data!.pets.filter((p) =>
    filter === "all" ? true : filter === "blocked" ? p.isBlocked : p.dangerLevel !== "None",
  )

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">危險寵物</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">標記高度危險（封鎖線上預約）或解除封鎖</p>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "全部" },
            { value: "danger", label: "有危險" },
            { value: "blocked", label: "已封鎖" },
          ]}
        />
      </header>

      {pets.length === 0 ? (
        <EmptyState icon={<PawPrint className="size-7" />} title="沒有符合條件的寵物" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">寵物</th>
                <th className="px-4 py-3 font-medium">品種</th>
                <th className="px-4 py-3 font-medium">飼主</th>
                <th className="px-4 py-3 font-medium">危險等級</th>
                <th className="px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {pets.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.breed ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {nameById.get(p.ownerId) ?? <span className="num">{p.ownerId.slice(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {p.dangerLevel === "None" ? (
                      <span className="text-muted-foreground">無</span>
                    ) : (
                      <DangerBadge level={p.dangerLevel} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isBlocked ? (
                      <Badge tone="danger">已封鎖</Badge>
                    ) : (
                      <Badge tone="success">正常</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {p.dangerLevel !== "High" ? (
                        <Button size="sm" variant="destructive" onClick={() => setMarkTarget(p)}>
                          <ShieldAlert className="size-4" /> 標記高度危險
                        </Button>
                      ) : null}
                      {p.isBlocked ? (
                        <UnblockButton pet={p} onDone={reload} />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MarkHighDialog pet={markTarget} onClose={() => setMarkTarget(null)} onDone={reload} />
    </div>
  )
}

function UnblockButton({ pet, onDone }: { pet: PetOut; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await petApi.unblock(pet.id)
          onDone()
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? <Spinner /> : <Unlock className="size-4" />} 解除封鎖
    </Button>
  )
}

function MarkHighDialog({
  pet,
  onClose,
  onDone,
}: {
  pet: PetOut | null
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (pet) {
      setNote("")
      setErr(null)
    }
  }, [pet])

  if (!pet) return null

  async function submit() {
    if (!note.trim()) {
      setErr("請填寫危險說明")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await petApi.markDanger(pet!.id, { dangerLevel: "High", dangerNote: note.trim() })
      onDone()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay open={!!pet} onClose={onClose} variant="modal" title={`標記高度危險 · ${pet.name}`}>
      <div className="space-y-4 p-5">
        <Alert tone="danger" title="高度危險將自動封鎖">
          標記後此寵物會被封鎖、無法線上預約，須由管理員解除封鎖才能再次預約（FR-02.8）。
        </Alert>
        <div className="space-y-1.5">
          <Label>危險說明 *</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：曾咬傷工作人員" />
        </div>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        <Button className="w-full" size="lg" variant="destructive" disabled={busy} onClick={submit}>
          {busy ? <Spinner /> : <ShieldAlert className="size-4" />} 確認標記為高度危險
        </Button>
      </div>
    </Overlay>
  )
}
