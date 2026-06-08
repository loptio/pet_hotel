/** Presentation helpers (Tier-2 compute — never stored in state / contract). */
import type { Money } from "@/api/types"

export function amountOf(m?: Money | null): number {
  return m ? Number(m.amount) : 0
}

const twd = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
})

export function money(m?: Money | null): string {
  return twd.format(amountOf(m))
}
export function moneyNum(n: number): string {
  return twd.format(n)
}

/** deposit = round(total × 0.30) to 2dp, half-up — mirrors backend ROUND_HALF_UP. */
export function depositOf(total: number): number {
  return Math.round(total * 0.3 * 100) / 100
}

// ----- dates (assume local timezone Asia/Taipei, UTC+8) -----
const TZ = "Asia/Taipei"
const dateFmt = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, dateStyle: "medium" })
const dateTimeFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: TZ,
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const timeFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "—" : dateFmt.format(d)
}
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d)
}
export function fmtTime(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "—" : timeFmt.format(d)
}

// ----- date string helpers (YYYY-MM-DD, Taipei) -----
export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())
}
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00+08:00")
  d.setDate(d.getDate() + n)
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d)
}
export function diffNights(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + "T00:00:00+08:00").getTime()
  const b = new Date(checkOut + "T00:00:00+08:00").getTime()
  return Math.max(1, Math.round((b - a) / 86_400_000))
}
/** Build a contract datetime (date + HH:mm at Taipei offset) — avoids UTC±8 cross-day. */
export function apiDateTime(dateStr: string, hhmm: string): string {
  return `${dateStr}T${hhmm}:00+08:00`
}
export function prettyDate(dateStr: string): string {
  return fmtDate(dateStr + "T00:00:00+08:00")
}
