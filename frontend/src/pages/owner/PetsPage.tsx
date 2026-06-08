import * as React from "react"
import { useNavigate } from "react-router-dom"
import { ChevronRight, PawPrint, Plus } from "lucide-react"
import { petApi } from "@/api/endpoints"
import type { PetCreateIn } from "@/api/types"
import { useAsync, errMsg } from "@/lib/useAsync"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { DangerBadge } from "@/components/StatusBadge"

export default function PetsPage() {
  const nav = useNavigate()
  const { data: pets, loading, error, reload } = useAsync(() => petApi.list(), [])
  const [adding, setAdding] = React.useState(false)

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">我的寵物</h1>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> 新增
        </Button>
      </header>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <Alert tone="danger" title="載入失敗">{error}</Alert>
      ) : !pets || pets.length === 0 ? (
        <EmptyState
          icon={<PawPrint className="size-7" />}
          title="尚無寵物檔案"
          description="新增第一隻毛孩，開始預約住宿或美容服務"
          actionLabel="新增寵物"
          onAction={() => setAdding(true)}
        />
      ) : (
        <div className="space-y-2.5">
          {pets.map((p) => (
            <Card
              key={p.id}
              className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:border-primary"
              onClick={() => nav(`/app/pets/${p.id}`)}
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-strong">
                <PawPrint className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <DangerBadge level={p.dangerLevel} />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {[p.breed, p.species].filter(Boolean).join(" · ") || "未填品種"}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      <AddPetSheet open={adding} onClose={() => setAdding(false)} onCreated={reload} />
    </div>
  )
}

function AddPetSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = React.useState<PetCreateIn>({ name: "", species: "", breed: "", chipId: "" })
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  function set<K extends keyof PetCreateIn>(k: K, v: PetCreateIn[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit() {
    if (!form.name.trim()) {
      setErr("請輸入寵物名稱")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await petApi.create({
        name: form.name.trim(),
        species: form.species || null,
        breed: form.breed || null,
        chipId: form.chipId || null,
      })
      setForm({ name: "", species: "", breed: "", chipId: "" })
      onCreated()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay open={open} onClose={onClose} variant="sheet" title="新增寵物">
      <div className="space-y-3 p-5">
        <div className="space-y-1.5">
          <Label>名稱 *</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="旺財" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>物種</Label>
            <Input value={form.species ?? ""} onChange={(e) => set("species", e.target.value)} placeholder="Dog" />
          </div>
          <div className="space-y-1.5">
            <Label>品種</Label>
            <Input value={form.breed ?? ""} onChange={(e) => set("breed", e.target.value)} placeholder="柴犬" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>晶片號</Label>
          <Input
            className="num"
            value={form.chipId ?? ""}
            onChange={(e) => set("chipId", e.target.value)}
            placeholder="900000000000001"
          />
        </div>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
          {busy ? <Spinner /> : null} 建立檔案
        </Button>
      </div>
    </Overlay>
  )
}
