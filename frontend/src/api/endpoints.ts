/** Typed endpoint functions over the frozen contract. One function per operation used by the UI. */
import { api } from "./client"
import type {
  AccountOut,
  AvailabilityOut,
  BookingCreateIn,
  BookingDetailOut,
  BookingOut,
  BookingPaymentResultOut,
  BookingStatus,
  BookingVerifyOut,
  CancelBookingIn,
  CancellationResultOut,
  CheckInRequestIn,
  CheckInResultOut,
  DepositPaymentIn,
  EmergencyAtCounterIn,
  EmergencyEventOut,
  EmergencyTriggerIn,
  FinalPaymentIn,
  KennelOut,
  KennelUpdateIn,
  MedicalRecordOut,
  PetCreateIn,
  PetOut,
  ReviewIn,
  ServiceCategory,
  ServiceItemOut,
  StageUpdateIn,
  TokenOut,
  VaccinationRecordOut,
  VaccineRecordAtCounterIn,
  WorkOrderDetailOut,
  WorkOrderOut,
} from "./types"

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") p.append(k, v)
  const s = p.toString()
  return s ? `?${s}` : ""
}

// ---------- auth ----------
export const authApi = {
  login: (email: string, password: string) => api.post<TokenOut>("/auth/login", { email, password }),
  me: () => api.get<AccountOut>("/auth/me"),
}

// ---------- pets ----------
export const petApi = {
  list: () => api.get<PetOut[]>("/pets"),
  get: (id: string) => api.get<PetOut>(`/pets/${id}`),
  create: (body: PetCreateIn) => api.post<PetOut>("/pets", body),
  vaccinations: (id: string) => api.get<VaccinationRecordOut[]>(`/pets/${id}/vaccinations`),
  medicalRecords: (id: string) => api.get<MedicalRecordOut[]>(`/pets/${id}/medical-records`),
  markDanger: (id: string, body: { dangerLevel: import("./types").DangerLevel; dangerNote: string }) =>
    api.post<PetOut>(`/pets/${id}/danger-level`, body),
  unblock: (id: string) => api.post<PetOut>(`/pets/${id}/unblock`),
}

// ---------- bookings ----------
export const bookingApi = {
  services: (category?: ServiceCategory) =>
    api.get<ServiceItemOut[]>(`/bookings/services${qs({ category })}`),
  availability: (serviceItemId: string, startAt: string, endAt: string) =>
    api.get<AvailabilityOut>(
      `/bookings/availability${qs({ service_item_id: serviceItemId, start_at: startAt, end_at: endAt })}`,
    ),
  list: (status?: BookingStatus) => api.get<BookingOut[]>(`/bookings${qs({ status })}`),
  get: (id: string) => api.get<BookingDetailOut>(`/bookings/${id}`),
  create: (body: BookingCreateIn) => api.post<BookingOut>("/bookings", body),
  deposit: (id: string, body: DepositPaymentIn) =>
    api.post<BookingPaymentResultOut>(`/bookings/${id}/deposit`, body),
  finalPayment: (id: string, body: FinalPaymentIn) =>
    api.post<BookingPaymentResultOut>(`/bookings/${id}/final-payment`, body),
  pendingReview: () => api.get<BookingOut[]>("/bookings/pending-review"),
  review: (id: string, body: ReviewIn) => api.post<BookingOut>(`/bookings/${id}/review`, body),
}

// ---------- check-in / kennels ----------
export const checkinApi = {
  perform: (body: CheckInRequestIn) => api.post<CheckInResultOut>("/checkin", body),
  verify: (bookingId: string) => api.get<BookingVerifyOut>(`/checkin/${bookingId}/verify`),
  recordVaccine: (bookingId: string, body: VaccineRecordAtCounterIn) =>
    api.post<VaccinationRecordOut>(`/checkin/${bookingId}/vaccine`, body),
  checkout: (bookingId: string) => api.post<CheckInResultOut>(`/checkin/${bookingId}/checkout`),
  emergency: (bookingId: string, body: EmergencyAtCounterIn) =>
    api.post<EmergencyEventOut>(`/checkin/${bookingId}/emergency`, body),
  kennels: () => api.get<KennelOut[]>("/checkin/kennels"),
  updateKennel: (id: string, body: KennelUpdateIn) =>
    api.patch<KennelOut>(`/checkin/kennels/${id}`, body),
  markKennelAvailable: (id: string) => api.post<KennelOut>(`/checkin/kennels/${id}/available`),
}

// ---------- grooming ----------
export const groomingApi = {
  workOrders: () => api.get<WorkOrderOut[]>("/grooming/work-orders"),
  workOrder: (id: string) => api.get<WorkOrderDetailOut>(`/grooming/work-orders/${id}`),
  start: (id: string) => api.post<WorkOrderOut>(`/grooming/work-orders/${id}/start`),
  stage: (id: string, body: StageUpdateIn) =>
    api.post<WorkOrderOut>(`/grooming/work-orders/${id}/stage`, body),
  complete: (id: string) => api.post<WorkOrderOut>(`/grooming/work-orders/${id}/complete`),
  emergency: (id: string, body: EmergencyTriggerIn) =>
    api.post<EmergencyEventOut>(`/grooming/work-orders/${id}/emergency`, body),
  uploadPhoto: (id: string, file: File) =>
    api.upload<{ id: string }>(`/grooming/work-orders/${id}/photos`, file),
  photos: (id: string) => api.get<import("./types").WorkPhotoOut[]>(`/grooming/work-orders/${id}/photos`),
}

// ---------- cancellation ----------
export const cancellationApi = {
  cancel: (bookingId: string, body: CancelBookingIn) =>
    api.post<CancellationResultOut>(`/cancellation/bookings/${bookingId}`, body),
}
