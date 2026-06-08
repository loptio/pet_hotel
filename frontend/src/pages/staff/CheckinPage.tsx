import * as React from "react"
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Cpu,
  ShieldAlert,
  Syringe,
  TriangleAlert,
  X,
} from "lucide-react"
import { bookingApi, checkinApi, petApi } from "@/api/endpoints"
import type {
  BookingDetailOut,
  BookingVerifyOut,
  CheckInResultOut,
  DangerLevel,
  PetOut,
  VaccinationRecordOut,
} from "@/api/types"
import { useAsync, errMsg } from "@/lib/useAsync"
import { fmtDateTime } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Segmented } from "@/components/ui/segmented"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { DangerBadge, VaccinationBadge } from "@/components/StatusBadge"

type RowState = "ok" | "fail" | "warn"

function VRow({
  state,
  title,
  children,
}: {
  state: RowState
  title: string
  children?: React.ReactNode
}) {
  const icon =
    state === "ok" ? (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success-soft text-success-foreground">
        <Check className="size-4" />
      </span>
    ) : state === "fail" ? (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-destructive-soft text-destructive-foreground">
        <X className="size-4" />
      </span>
    ) : (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-warning-soft text-warning-foreground">
        <TriangleAlert className="size-4" />
      </span>
    )
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {children ? <div className="mt-1.5">{children}</div> : null}
      </div>
    </div>
  )
}

export default function CheckinPage() {
  const { data: list, loading, error, reload } = useAsync(() => bookingApi.list("Confirmed"), [])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  return (
    <div className="p-6">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">報到核驗</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          核對預約、晶片與疫苗，通過後完成報到並分配床位（FR-06.1）
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* LEFT — 今日報到清單 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">今日報到清單</h2>
            {list ? (
              <span className="num rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {list.length}
              </span>
            ) : null}
          </div>

          {loading ? (
            <PageLoader label="載入待報到預約…" />
          ) : error ? (
            <Alert tone="danger" title="載入失敗">
              {error}
            </Alert>
          ) : !list || list.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="size-7" />}
              title="目前無待報到預約"
              description="已確認（Confirmed）的預約會出現在此處等待報到"
            />
          ) : (
            <div className="space-y-2.5">
              {list.map((b) => {
                const active = b.id === selectedId
                return (
                  <Card
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={
                      "cursor-pointer p-3 transition-colors " +
                      (active
                        ? "border-primary bg-primary-soft/40 ring-1 ring-primary"
                        : "hover:border-primary")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="num text-sm font-semibold text-primary-strong">
                        預約 {b.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="num mt-1 text-xs text-muted-foreground">
                      期間 {fmtDateTime(b.startAt)}
                    </p>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* RIGHT — 核驗面板 */}
        <section>
          {selectedId ? (
            <VerifyPanel
              key={selectedId}
              bookingId={selectedId}
              onCheckedIn={() => {
                setSelectedId(null)
                reload()
              }}
            />
          ) : (
            <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
              <div className="space-y-2">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-strong">
                  <ClipboardCheck className="size-7" />
                </div>
                <p className="font-medium">請從左側選擇預約進行核驗</p>
                <p className="text-sm text-muted-foreground">
                  選取後將載入預約狀態、晶片與疫苗核對結果
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function VerifyPanel({
  bookingId,
  onCheckedIn,
}: {
  bookingId: string
  onCheckedIn: () => void
}) {
  const {
    data: detail,
    loading: dLoading,
    error: dError,
  } = useAsync<BookingDetailOut>(() => bookingApi.get(bookingId), [bookingId])

  const firstPetId = detail?.bookedPets?.[0]?.petId ?? null

  const {
    data: pet,
    loading: pLoading,
    error: pError,
    reload: reloadPet,
  } = useAsync<PetOut | null>(
    () => (firstPetId ? petApi.get(firstPetId) : Promise.resolve(null)),
    [firstPetId],
  )

  const {
    data: verify,
    loading: vLoading,
    error: vError,
    reload: reloadVerify,
  } = useAsync<BookingVerifyOut>(() => checkinApi.verify(bookingId), [bookingId])

  const [chipInput, setChipInput] = React.useState("")
  // prefill the chip from the pet for a smooth demo, but keep it editable
  React.useEffect(() => {
    if (pet?.chipId) setChipInput(pet.chipId)
  }, [pet?.chipId])

  // mutation state
  const [busy, setBusy] = React.useState(false)
  const [mutError, setMutError] = React.useState<string | null>(null)

  // dialogs / results
  const [vaxOpen, setVaxOpen] = React.useState(false)
  const [vaxResult, setVaxResult] = React.useState<VaccinationRecordOut | null>(null)
  const [dangerOpen, setDangerOpen] = React.useState(false)
  const [emergencyOpen, setEmergencyOpen] = React.useState(false)
  const [emergencyDone, setEmergencyDone] = React.useState(false)
  const [checkinResult, setCheckinResult] = React.useState<CheckInResultOut | null>(null)

  if (dLoading) return <PageLoader label="載入預約明細…" />
  if (dError)
    return (
      <Alert tone="danger" title="載入預約失敗">
        {dError}
      </Alert>
    )
  if (!detail)
    return (
      <Alert tone="danger" title="找不到預約">
        無法取得此預約資料。
      </Alert>
    )

  const chipMatches = !!pet?.chipId && chipInput.trim() === pet.chipId

  async function doCheckin() {
    setBusy(true)
    setMutError(null)
    try {
      const r = await checkinApi.perform({ bookingId, chipId: chipInput.trim() })
      setCheckinResult(r)
    } catch (e) {
      setMutError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-4">
          <div>
            <h2 className="num text-lg font-semibold text-primary-strong">
              預約 {bookingId.slice(0, 8)}
            </h2>
            <p className="num mt-0.5 text-xs text-muted-foreground">
              期間 {fmtDateTime(detail.startAt)} — {fmtDateTime(detail.endAt)}
            </p>
          </div>
          {pet ? (
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="font-semibold">{pet.name}</span>
                <DangerBadge level={pet.dangerLevel} />
              </div>
              <p className="num mt-0.5 text-xs text-muted-foreground">
                晶片 {pet.chipId || "未登記"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="p-5">
          {pLoading || vLoading ? (
            <PageLoader label="核驗中…" />
          ) : pError ? (
            <Alert tone="danger" title="載入寵物失敗">
              {pError}
            </Alert>
          ) : vError ? (
            <Alert tone="danger" title="核驗失敗">
              {vError}
            </Alert>
          ) : (
            <>
              {/* 4 verification rows */}
              <div className="rounded-xl border border-border px-4">
                {/* 1) 預約狀態 */}
                <VRow state={verify?.valid ? "ok" : "fail"} title="預約狀態">
                  <p className="text-xs text-muted-foreground">
                    {verify?.message || (verify?.valid ? "預約有效，可進行報到" : "預約無效")}
                  </p>
                </VRow>

                {/* 2) 晶片核對 */}
                <VRow state={chipMatches ? "ok" : "warn"} title="晶片核對">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      className="num"
                      value={chipInput}
                      onChange={(e) => setChipInput(e.target.value)}
                      placeholder="掃描或輸入晶片號"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {pet?.chipId
                      ? chipMatches
                        ? "與檔案晶片號相符"
                        : "與檔案晶片號不符，請確認"
                      : "此寵物未登記晶片號"}
                  </p>
                </VRow>

                {/* 3) 疫苗有效期 */}
                <VRow state="warn" title="疫苗有效期">
                  <p className="text-xs text-muted-foreground">
                    報到時自動校驗；如需補登可使用下方「錄入疫苗」。
                  </p>
                  {vaxResult ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <VaccinationBadge status={vaxResult.status} />
                      <span className="num text-muted-foreground">
                        {vaxResult.vaccineName} · 到期 {vaxResult.expiresAt || "—"}
                      </span>
                    </div>
                  ) : null}
                </VRow>

                {/* 4) 危險等級 */}
                <VRow
                  state={
                    !pet || pet.dangerLevel === "None" || pet.dangerLevel === "Low"
                      ? "ok"
                      : pet.dangerLevel === "Medium"
                        ? "warn"
                        : "fail"
                  }
                  title="危險等級"
                >
                  {pet && pet.dangerLevel !== "None" ? (
                    <DangerBadge level={pet.dangerLevel} />
                  ) : (
                    <p className="text-xs text-muted-foreground">無危險標記</p>
                  )}
                  {pet?.isBlocked ? (
                    <p className="mt-1 text-xs text-destructive-foreground">此寵物已被封鎖</p>
                  ) : null}
                </VRow>
              </div>

              {/* secondary: record vaccine */}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setVaxOpen(true)}>
                  <Syringe className="size-4" /> 錄入疫苗
                </Button>
              </div>

              {mutError ? (
                <Alert tone="danger" title="操作失敗" className="mt-4">
                  {mutError}
                </Alert>
              ) : null}

              {/* primary action */}
              <Button size="lg" className="mt-5 w-full" disabled={busy} onClick={doCheckin}>
                {busy ? <Spinner /> : <Check className="size-5" />}
                完成報到並分配床位
              </Button>

              {/* danger-level + emergency actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!firstPetId}
                  onClick={() => setDangerOpen(true)}
                >
                  <ShieldAlert className="size-4" /> 標記危險等級
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!firstPetId}
                  onClick={() => setEmergencyOpen(true)}
                >
                  <AlertTriangle className="size-4" /> 觸發緊急事件
                </Button>
              </div>

              {emergencyDone ? (
                <Alert tone="warning" title="已建立緊急事件" className="mt-4">
                  緊急事件已記錄並通知相關人員。
                </Alert>
              ) : null}
            </>
          )}
        </div>
      </Card>

      {/* ---- 錄入疫苗 dialog ---- */}
      {firstPetId ? (
        <RecordVaccineDialog
          open={vaxOpen}
          onClose={() => setVaxOpen(false)}
          bookingId={bookingId}
          petId={firstPetId}
          onRecorded={(rec) => {
            setVaxResult(rec)
            reloadVerify()
          }}
        />
      ) : null}

      {/* ---- 標記危險等級 dialog ---- */}
      {firstPetId ? (
        <MarkDangerDialog
          open={dangerOpen}
          onClose={() => setDangerOpen(false)}
          petId={firstPetId}
          onMarked={() => reloadPet()}
        />
      ) : null}

      {/* ---- 觸發緊急事件 dialog ---- */}
      {firstPetId ? (
        <EmergencyDialog
          open={emergencyOpen}
          onClose={() => setEmergencyOpen(false)}
          bookingId={bookingId}
          petId={firstPetId}
          onDone={() => setEmergencyDone(true)}
        />
      ) : null}

      {/* ---- check-in result dialog ---- */}
      <Overlay
        open={!!checkinResult}
        onClose={() => {
          const ok = checkinResult?.result === "Success"
          setCheckinResult(null)
          if (ok) onCheckedIn()
        }}
        variant="modal"
        title={checkinResult?.result === "Success" ? "報到成功" : "報到阻斷"}
      >
        <div className="space-y-4 p-5">
          {checkinResult?.result === "Success" ? (
            <>
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <div className="grid size-14 place-items-center rounded-full bg-success-soft text-success-foreground">
                  <Check className="size-7" />
                </div>
                <p className="text-lg font-semibold">
                  報到成功，
                  {checkinResult.kennelNumber ? (
                    <>
                      床位{" "}
                      <span className="num text-primary-strong">{checkinResult.kennelNumber}</span>
                    </>
                  ) : (
                    "美容無需床位"
                  )}
                </p>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  setCheckinResult(null)
                  onCheckedIn()
                }}
              >
                完成
              </Button>
            </>
          ) : checkinResult ? (
            <>
              <Alert tone="danger" title="報到阻斷（FR-06.1）" icon={<X className="size-4" />}>
                {checkinResult.reason || "報到條件未通過，無法完成報到。"}
              </Alert>
              <Button
                className="w-full"
                variant="outline"
                size="lg"
                onClick={() => setCheckinResult(null)}
              >
                返回核驗
              </Button>
            </>
          ) : null}
        </div>
      </Overlay>
    </div>
  )
}

function RecordVaccineDialog({
  open,
  onClose,
  bookingId,
  petId,
  onRecorded,
}: {
  open: boolean
  onClose: () => void
  bookingId: string
  petId: string
  onRecorded: (rec: VaccinationRecordOut) => void
}) {
  const [vaccineName, setVaccineName] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<VaccinationRecordOut | null>(null)

  async function submit() {
    if (!vaccineName.trim()) {
      setErr("請輸入疫苗名稱")
      return
    }
    if (!expiresAt) {
      setErr("請選擇有效期")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const rec = await checkinApi.recordVaccine(bookingId, {
        petId,
        vaccineName: vaccineName.trim(),
        expiresAt,
      })
      setResult(rec)
      onRecorded(rec)
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setVaccineName("")
    setExpiresAt("")
    setErr(null)
    setResult(null)
    onClose()
  }

  return (
    <Overlay open={open} onClose={close} variant="modal" title="錄入疫苗">
      <div className="space-y-3 p-5">
        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <VaccinationBadge status={result.status} />
              <span className="num text-sm">{result.vaccineName}</span>
            </div>
            <p className="num text-xs text-muted-foreground">有效期至 {result.expiresAt || "—"}</p>
            <Button className="w-full" size="lg" onClick={close}>
              完成
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>疫苗名稱 *</Label>
              <Input
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                placeholder="狂犬病疫苗"
              />
            </div>
            <div className="space-y-1.5">
              <Label>有效期 *</Label>
              <Input
                type="date"
                className="num"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            {err ? <Alert tone="danger">{err}</Alert> : null}
            <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
              {busy ? <Spinner /> : null} 錄入疫苗
            </Button>
          </>
        )}
      </div>
    </Overlay>
  )
}

function MarkDangerDialog({
  open,
  onClose,
  petId,
  onMarked,
}: {
  open: boolean
  onClose: () => void
  petId: string
  onMarked: () => void
}) {
  const [level, setLevel] = React.useState<DangerLevel>("Low")
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      await petApi.markDanger(petId, { dangerLevel: level, dangerNote: note.trim() })
      onMarked()
      close()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setLevel("Low")
    setNote("")
    setErr(null)
    onClose()
  }

  return (
    <Overlay open={open} onClose={close} variant="modal" title="標記危險等級">
      <div className="space-y-4 p-5">
        <div className="space-y-1.5">
          <Label>危險等級</Label>
          <div>
            <Segmented<DangerLevel>
              value={level}
              onChange={setLevel}
              options={[
                { value: "Low", label: "低度 Low" },
                { value: "Medium", label: "中度 Medium" },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            高度危險（High）與解除封鎖僅管理員可操作。
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>說明</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="描述行為觀察與處置建議"
            rows={3}
          />
        </div>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
          {busy ? <Spinner /> : null} 儲存標記
        </Button>
      </div>
    </Overlay>
  )
}

function EmergencyDialog({
  open,
  onClose,
  bookingId,
  petId,
  onDone,
}: {
  open: boolean
  onClose: () => void
  bookingId: string
  petId: string
  onDone: () => void
}) {
  const [description, setDescription] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  async function submit() {
    if (!description.trim()) {
      setErr("請輸入緊急事件描述")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await checkinApi.emergency(bookingId, { petId, description: description.trim() })
      onDone()
      close()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setDescription("")
    setErr(null)
    onClose()
  }

  return (
    <Overlay open={open} onClose={close} variant="modal" title="觸發緊急事件">
      <div className="space-y-4 p-5">
        <Alert tone="warning">建立後將記錄並通知相關人員，請據實填寫。</Alert>
        <div className="space-y-1.5">
          <Label>事件描述 *</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述發生的緊急狀況與處置"
            rows={4}
          />
        </div>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        <Button className="w-full" size="lg" variant="destructive" onClick={submit} disabled={busy}>
          {busy ? <Spinner /> : null} 送出緊急事件
        </Button>
      </div>
    </Overlay>
  )
}
