import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Info,
  PartyPopper,
  ShieldAlert,
  Store,
  Syringe,
} from "lucide-react"
import { bookingApi, petApi } from "@/api/endpoints"
import { ApiError } from "@/api/client"
import type {
  AvailabilityOut,
  BookingOut,
  PaymentMethod,
  PetOut,
  ServiceItemOut,
} from "@/api/types"
import { useAsync, errMsg } from "@/lib/useAsync"
import {
  addDays,
  amountOf,
  apiDateTime,
  depositOf,
  diffNights,
  fmtDate,
  money,
  moneyNum,
  prettyDate,
  todayStr,
} from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { Overlay } from "@/components/ui/overlay"
import { Spinner, PageLoader } from "@/components/ui/spinner"
import { ImageSlot } from "@/components/ui/image-slot"
import { DangerBadge, BookingStatusBadge } from "@/components/StatusBadge"

const ROOM_LABEL: Record<string, string> = { Standard: "標準房", Deluxe: "豪華房" }
const GROOM_LABEL: Record<string, string> = { Basic: "基礎", Full: "完整" }
const TIME_SLOTS = ["10:00", "14:00", "16:00"] as const

const INCLUDED_LODGING = ["專屬獨立房間", "每日 2 次放風散步", "24 小時監控與照護", "新鮮飲水與餵食"]
const INCLUDED_GROOMING = ["專業洗護沐浴", "造型修剪與吹整", "耳道清潔與剪指甲", "完成後傳送照片"]

function serviceSubtitle(s: ServiceItemOut): string {
  if (s.category === "Lodging") return s.roomType ? ROOM_LABEL[s.roomType] ?? s.roomType : "住宿"
  return s.groomingType ? GROOM_LABEL[s.groomingType] ?? s.groomingType : "美容"
}

/** Computed booking window + quantity for the current selection. */
interface BookingWindow {
  startISO: string
  endISO: string
  quantity: number
}

export default function ServiceDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data: services, loading, error } = useAsync(() => bookingApi.services(), [])

  // ----- step overlays (Tier-3 UI state) -----
  const [sheetOpen, setSheetOpen] = React.useState(false) // A4
  const [confirmOpen, setConfirmOpen] = React.useState(false) // A5
  const [depositOpen, setDepositOpen] = React.useState(false) // A6
  const [successBooking, setSuccessBooking] = React.useState<BookingOut | null>(null) // A7
  const [reviewBooking, setReviewBooking] = React.useState<BookingOut | null>(null) // Medium → PendingReview

  // ----- booking selection -----
  const [pet, setPet] = React.useState<PetOut | null>(null)
  const [win, setWin] = React.useState<BookingWindow | null>(null)
  const [createdBooking, setCreatedBooking] = React.useState<BookingOut | null>(null)

  if (loading) return <PageLoader label="載入服務中…" />
  if (error)
    return (
      <div className="p-4">
        <BackButton onClick={() => nav(-1)} />
        <Alert tone="danger" title="載入失敗">{error}</Alert>
      </div>
    )

  const service = (services ?? []).find((s) => s.id === id) ?? null

  if (!service) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <Info className="size-7" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">找不到這項服務</p>
          <p className="text-sm text-muted-foreground">服務可能已下架，請返回探索其他方案。</p>
        </div>
        <Button onClick={() => nav("/app/home")}>回探索首頁</Button>
      </div>
    )
  }

  const isLodging = service.category === "Lodging"
  const unit = isLodging ? "/晚" : "/次"
  const included = isLodging ? INCLUDED_LODGING : INCLUDED_GROOMING
  const basePrice = amountOf(service.basePrice)
  const depositPreview = depositOf(basePrice)

  function openSheet() {
    setPet(null)
    setWin(null)
    setSheetOpen(true)
  }

  function goConfirm(p: PetOut, w: BookingWindow) {
    setPet(p)
    setWin(w)
    setSheetOpen(false)
    setConfirmOpen(true)
  }

  function onCreated(b: BookingOut) {
    // success path: PendingDeposit → open deposit sheet (A6)
    setCreatedBooking(b)
    setConfirmOpen(false)
    setDepositOpen(true)
  }

  function onReviewSubmitted(b: BookingOut) {
    // Medium path: PendingReview → review modal, no deposit
    setConfirmOpen(false)
    setReviewBooking(b)
  }

  function onPaid(b: BookingOut) {
    setDepositOpen(false)
    setSuccessBooking(b)
  }

  return (
    <div className="pb-28">
      {/* A3 hero */}
      <div className="relative">
        <ImageSlot className="h-[240px] w-full" rounded="rounded-none" />
        <button
          type="button"
          onClick={() => nav(-1)}
          className="absolute left-4 top-4 grid size-10 place-items-center rounded-full bg-card/90 text-foreground shadow-md backdrop-blur hover:bg-card"
          aria-label="返回"
        >
          <ArrowLeft className="size-5" />
        </button>
      </div>

      <div className="space-y-5 p-4">
        <div className="space-y-2">
          <Badge tone={isLodging ? "brand" : "info"}>{isLodging ? "住宿" : "美容"}</Badge>
          <h1 className="text-2xl font-bold leading-tight">{service.name}</h1>
          <p className="text-sm text-muted-foreground">
            {serviceSubtitle(service)} · 約 {service.durationMinutes} 分鐘
          </p>
          <p className="num text-xl font-bold text-primary">
            {money(service.basePrice)}
            <span className="text-sm font-normal text-muted-foreground">{unit}</span>
          </p>
        </div>

        {/* 方案內含 */}
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">方案內含</h2>
          <ul className="space-y-2.5">
            {included.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                  <Check className="size-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Card>

        {/* 疫苗提示 */}
        <Alert tone="info" icon={<Syringe />} title="疫苗提醒">
          報到時請出示有效期內的疫苗證明，逾期將無法完成報到。
        </Alert>
      </div>

      {/* A3 bottom fixed bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="leading-tight">
          <p className="text-xs text-muted-foreground">訂金 30%</p>
          <p className="num text-lg font-bold text-primary">{moneyNum(depositPreview)}</p>
        </div>
        <Button size="lg" onClick={openSheet}>
          立即預約
        </Button>
      </div>

      {/* A4 */}
      <BookingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        service={service}
        onNext={goConfirm}
      />

      {/* A5 */}
      {pet && win ? (
        <ConfirmModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          service={service}
          pet={pet}
          win={win}
          onCreated={onCreated}
          onReviewSubmitted={onReviewSubmitted}
        />
      ) : null}

      {/* A6 */}
      {createdBooking ? (
        <DepositSheet
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
          booking={createdBooking}
          onPaid={onPaid}
        />
      ) : null}

      {/* A7 */}
      {successBooking ? (
        <SuccessModal
          open={!!successBooking}
          booking={successBooking}
          service={service}
          pet={pet}
          onClose={() => setSuccessBooking(null)}
        />
      ) : null}

      {/* Medium → 待審核 */}
      {reviewBooking ? (
        <ReviewModal
          open={!!reviewBooking}
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
        />
      ) : null}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="mb-3" onClick={onClick}>
      <ArrowLeft className="size-4" /> 返回
    </Button>
  )
}

/* ----------------------------- A4 booking sheet ----------------------------- */

function BookingSheet({
  open,
  onClose,
  service,
  onNext,
}: {
  open: boolean
  onClose: () => void
  service: ServiceItemOut
  onNext: (pet: PetOut, win: BookingWindow) => void
}) {
  const isLodging = service.category === "Lodging"
  const today = todayStr()

  const { data: pets, loading, error } = useAsync(() => petApi.list(), [open ? "open" : "closed"])
  const [petId, setPetId] = React.useState<string | null>(null)

  // grooming selection
  const [groomDate, setGroomDate] = React.useState<string | null>(null)
  const [slot, setSlot] = React.useState<string | null>(null)
  // lodging selection
  const [checkIn, setCheckIn] = React.useState(today)
  const [checkOut, setCheckOut] = React.useState(addDays(today, 1))

  const [avail, setAvail] = React.useState<AvailabilityOut | null>(null)
  const [availLoading, setAvailLoading] = React.useState(false)

  const dateChips = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today])

  // keep check-out strictly after check-in
  React.useEffect(() => {
    if (diffNights(checkIn, checkOut) < 1 || checkOut <= checkIn) setCheckOut(addDays(checkIn, 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn])

  const win: BookingWindow | null = React.useMemo(() => {
    if (isLodging) {
      if (!checkIn || !checkOut || checkOut <= checkIn) return null
      return {
        startISO: apiDateTime(checkIn, "14:00"),
        endISO: apiDateTime(checkOut, "12:00"),
        quantity: diffNights(checkIn, checkOut),
      }
    }
    if (!groomDate) return null
    const start = slot ?? "10:00"
    return {
      startISO: apiDateTime(groomDate, start),
      endISO: apiDateTime(groomDate, "12:00"),
      quantity: 1,
    }
  }, [isLodging, checkIn, checkOut, groomDate, slot])

  // optional availability probe
  React.useEffect(() => {
    if (!open || !win) {
      setAvail(null)
      return
    }
    let active = true
    setAvailLoading(true)
    bookingApi
      .availability(service.id, win.startISO, win.endISO)
      .then((a) => active && setAvail(a))
      .catch(() => active && setAvail(null))
      .finally(() => active && setAvailLoading(false))
    return () => {
      active = false
    }
  }, [open, win, service.id])

  const pet = (pets ?? []).find((p) => p.id === petId) ?? null
  const qty = win?.quantity ?? 1
  const depositPreview = depositOf(amountOf(service.basePrice) * qty)
  const canNext = !!pet && !!win

  return (
    <Overlay open={open} onClose={onClose} variant="sheet" title={`預約 · ${service.name}`}>
      <div className="space-y-5 p-5">
        {/* pet selector */}
        <section className="space-y-2">
          <p className="text-sm font-semibold">為哪位毛孩預約？</p>
          {loading ? (
            <div className="flex justify-center py-3"><Spinner /></div>
          ) : error ? (
            <Alert tone="danger" title="載入寵物失敗">{error}</Alert>
          ) : !pets || pets.length === 0 ? (
            <Alert tone="warning">尚未建立寵物檔案，請先到「寵物」頁新增。</Alert>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pets.map((p) => {
                const selected = p.id === petId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPetId(p.id)}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
                      (selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary")
                    }
                  >
                    {p.name}
                    {p.dangerLevel !== "None" ? <DangerBadge level={p.dangerLevel} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* date / slot */}
        {isLodging ? (
          <section className="space-y-2">
            <p className="text-sm font-semibold">選擇住宿期間</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                入住
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="num block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                退房
                <input
                  type="date"
                  min={addDays(checkIn, 1)}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="num block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
            {win ? (
              <p className="text-xs text-muted-foreground">
                共 <span className="num font-medium text-foreground">{win.quantity}</span> 晚
              </p>
            ) : null}
          </section>
        ) : (
          <section className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-semibold">選擇日期</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dateChips.map((d) => {
                  const selected = d === groomDate
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setGroomDate(d)}
                      className={
                        "num shrink-0 rounded-lg border px-3 py-2 text-xs transition-colors " +
                        (selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary")
                      }
                    >
                      {prettyDate(d)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">選擇時段</p>
              <div className="flex gap-2">
                {TIME_SLOTS.map((t) => {
                  const selected = t === slot
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSlot(t)}
                      className={
                        "num flex-1 rounded-lg border px-3 py-2 text-sm transition-colors " +
                        (selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary")
                      }
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        <Alert tone="info" icon={<Info />}>僅顯示可預約時段</Alert>

        {win ? (
          availLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner /> 查詢可預約狀態…</p>
          ) : avail ? (
            avail.available ? (
              <Alert tone="success" icon={<Check />}>此時段可預約</Alert>
            ) : (
              <Alert tone="warning">此時段已額滿，仍可送出但可能需改期。</Alert>
            )
          ) : null
        ) : null}

        {/* deposit + CTA */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="leading-tight">
            <p className="text-xs text-muted-foreground">訂金 30%</p>
            <p className="num text-lg font-bold text-primary">{moneyNum(depositPreview)}</p>
          </div>
          <Button size="lg" disabled={!canNext} onClick={() => pet && win && onNext(pet, win)}>
            前往確認
          </Button>
        </div>
      </div>
    </Overlay>
  )
}

/* ----------------------------- A5 confirm modal ----------------------------- */

function ConfirmModal({
  open,
  onClose,
  service,
  pet,
  win,
  onCreated,
  onReviewSubmitted,
}: {
  open: boolean
  onClose: () => void
  service: ServiceItemOut
  pet: PetOut
  win: BookingWindow
  onCreated: (b: BookingOut) => void
  onReviewSubmitted: (b: BookingOut) => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [conflict, setConflict] = React.useState(false)

  const total = amountOf(service.basePrice) * win.quantity
  const deposit = depositOf(total)
  const balance = total - deposit

  // danger branch
  const blocked = pet.isBlocked || pet.dangerLevel === "High"
  const medium = !blocked && pet.dangerLevel === "Medium"
  const low = !blocked && pet.dangerLevel === "Low"

  async function submit() {
    if (blocked) return
    setBusy(true)
    setErr(null)
    setConflict(false)
    try {
      const booking = await bookingApi.create({
        startAt: win.startISO,
        endAt: win.endISO,
        items: [{ serviceItemId: service.id, petId: pet.id, quantity: win.quantity }],
      })
      if (medium) onReviewSubmitted(booking)
      else onCreated(booking)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true)
      } else {
        setErr(errMsg(e))
      }
    } finally {
      setBusy(false)
    }
  }

  const ctaLabel = blocked ? "無法送出" : medium ? "送出待審核" : "確認並付訂金"

  return (
    <Overlay open={open} onClose={onClose} variant="modal" title="確認預約">
      <div className="space-y-4 p-5">
        <div className="flex justify-end">
          {blocked ? (
            <Badge tone="danger">⚠ 高度危險</Badge>
          ) : medium ? (
            <Badge tone="warning">需審核</Badge>
          ) : (
            <DangerBadge level={pet.dangerLevel} />
          )}
        </div>

        {/* summary */}
        <Card className="space-y-2.5 p-4 text-sm">
          <Row label="寵物" value={pet.name} />
          <Row label="服務" value={service.name} />
          <Row label="期間" value={`${fmtDate(win.startISO)} － ${fmtDate(win.endISO)}`} />
          <div className="my-1 border-t border-border" />
          <Row label="預估總額" value={<span className="num">{moneyNum(total)}</span>} />
          <Row
            label="訂金 30%（本次支付）"
            value={<span className="num font-bold text-primary">{moneyNum(deposit)}</span>}
          />
          <Row
            label="尾款"
            value={<span className="num text-muted-foreground">{moneyNum(balance)}</span>}
          />
        </Card>

        {/* danger-driven alert */}
        {blocked ? (
          <Alert tone="danger" icon={<ShieldAlert />} title="無法線上預約">
            此寵物為高度危險，無法線上預約，請聯繫門市或由管理員解除封鎖。
          </Alert>
        ) : medium ? (
          <Alert tone="warning" title="須櫃台審核">
            送出後須由櫃台審核，核可後才需付款。
          </Alert>
        ) : low ? (
          <Alert tone="success" title="低度危險提醒">
            報到時將提醒工作人員此寵物為低度危險。
          </Alert>
        ) : null}

        {conflict ? (
          <Alert tone="danger" title="時段衝突">
            此時段已額滿或資源衝突，請選擇其他時段。
          </Alert>
        ) : null}
        {err ? <Alert tone="danger">{err}</Alert> : null}

        {/* CTA */}
        <div className="space-y-2">
          <Button className="w-full" size="lg" disabled={blocked || busy} onClick={submit}>
            {busy ? <Spinner /> : null} {ctaLabel}
          </Button>
          {blocked ? (
            <Button className="w-full" size="lg" variant="secondary" onClick={() => {}}>
              <Store className="size-4" /> 聯繫門市
            </Button>
          ) : null}
        </div>
      </div>
    </Overlay>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

/* ----------------------------- A6 deposit sheet ----------------------------- */

function DepositSheet({
  open,
  onClose,
  booking,
  onPaid,
}: {
  open: boolean
  onClose: () => void
  booking: BookingOut
  onPaid: (b: BookingOut) => void
}) {
  const [method, setMethod] = React.useState<PaymentMethod>("Online")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  async function pay() {
    setBusy(true)
    setErr(null)
    try {
      const res = await bookingApi.deposit(booking.id, { paymentMethod: method })
      onPaid(res.booking)
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay open={open} onClose={onClose} variant="sheet" title="付訂金">
      <div className="space-y-5 p-5">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">預估總額 30%</p>
          <p className="num mt-1 text-3xl font-bold text-primary">{money(booking.depositAmount)}</p>
        </div>

        <div className="space-y-2.5">
          <PayOption
            label="線上付款"
            desc="信用卡 / 行動支付"
            icon={<CreditCard className="size-5" />}
            selected={method === "Online"}
            onClick={() => setMethod("Online")}
          />
          <PayOption
            label="現場刷卡"
            desc="報到時於櫃台付款"
            icon={<Store className="size-5" />}
            selected={method === "CardOnSite"}
            onClick={() => setMethod("CardOnSite")}
          />
        </div>

        <Alert tone="info" icon={<Info />}>由 ECPay 處理，不留存卡號</Alert>

        {err ? <Alert tone="danger">{err}</Alert> : null}

        <Button className="w-full" size="lg" disabled={busy} onClick={pay}>
          {busy ? <Spinner /> : null} 確認付款
        </Button>
      </div>
    </Overlay>
  )
}

function PayOption({
  label,
  desc,
  icon,
  selected,
  onClick,
}: {
  label: string
  desc: string
  icon: React.ReactNode
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors " +
        (selected ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary")
      }
    >
      <span
        className={
          "grid size-10 shrink-0 place-items-center rounded-lg " +
          (selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
        }
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <span
        className={
          "grid size-5 place-items-center rounded-full border " +
          (selected ? "border-primary bg-primary text-primary-foreground" : "border-border")
        }
      >
        {selected ? <Check className="size-3.5" /> : null}
      </span>
    </button>
  )
}

/* ----------------------------- A7 success modal ----------------------------- */

function SuccessModal({
  open,
  booking,
  service,
  pet,
  onClose,
}: {
  open: boolean
  booking: BookingOut
  service: ServiceItemOut
  pet: PetOut | null
  onClose: () => void
}) {
  const nav = useNavigate()
  return (
    <Overlay open={open} onClose={onClose} variant="modal">
      <div className="space-y-4 p-6 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <PartyPopper className="size-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">預約成功！</h2>
          <p className="text-sm text-muted-foreground">訂金已付款，期待與毛孩相見。</p>
        </div>
        <div className="flex justify-center">
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {pet ? `${pet.name} · ` : ""}
          {service.name} · {fmtDate(booking.startAt)}
        </p>
        <div className="space-y-2 pt-1">
          <Button className="w-full" size="lg" onClick={() => nav(`/app/bookings/${booking.id}`)}>
            查看預約明細
          </Button>
          <Button className="w-full" size="lg" variant="secondary" onClick={() => nav("/app/home")}>
            回首頁
          </Button>
        </div>
      </div>
    </Overlay>
  )
}

/* ------------------------ Medium → 待審核 review modal ------------------------ */

function ReviewModal({
  open,
  booking,
  onClose,
}: {
  open: boolean
  booking: BookingOut
  onClose: () => void
}) {
  const nav = useNavigate()
  return (
    <Overlay open={open} onClose={onClose} variant="modal">
      <div className="space-y-4 p-6 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-warning-soft text-warning">
          <ClipboardCheck className="size-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">已送出待審核</h2>
          <p className="text-sm text-muted-foreground">
            此寵物為中度危險，須由櫃台審核。核可後我們會通知你前往付款。
          </p>
        </div>
        <div className="flex justify-center">
          <BookingStatusBadge status={booking.status} />
        </div>
        <div className="space-y-2 pt-1">
          <Button className="w-full" size="lg" onClick={() => nav(`/app/bookings/${booking.id}`)}>
            <CheckCircle2 className="size-4" /> 查看預約
          </Button>
          <Button className="w-full" size="lg" variant="secondary" onClick={() => nav("/app/home")}>
            回首頁
          </Button>
        </div>
      </div>
    </Overlay>
  )
}
