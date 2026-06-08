import { Badge } from "@/components/ui/badge"
import {
  bookingStatus,
  dangerLevel,
  kennelStatus,
  vaccinationStatus,
  workStatus,
} from "@/lib/status"
import type {
  BookingStatus,
  DangerLevel,
  KennelStatus,
  VaccinationStatus,
  WorkStatus,
} from "@/api/types"

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const s = bookingStatus[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}
export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  const s = workStatus[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}
export function KennelStatusBadge({ status }: { status: KennelStatus }) {
  const s = kennelStatus[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}
export function VaccinationBadge({ status }: { status: VaccinationStatus }) {
  const s = vaccinationStatus[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}
export function DangerBadge({ level }: { level: DangerLevel }) {
  if (level === "None") return null
  const s = dangerLevel[level]
  return <Badge tone={s.tone}>⚠ {s.label}危險</Badge>
}
