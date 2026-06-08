/**
 * Typed mirror of the frozen contract (contracts/openapi.json). camelCase to
 * match the API. Enums are string-literal unions (not TS enums — erasableSyntaxOnly).
 * Only the fields/endpoints that exist in the contract are modelled here.
 */

// ---------- enums (string-literal unions, values = api-overview red lines) ----------
export type AccountStatus = "Active" | "Banned" | "Disabled"
export type DangerLevel = "None" | "Low" | "Medium" | "High"
export type VaccinationStatus = "Pending" | "Valid" | "Expired" | "Rejected"
export type ServiceCategory = "Lodging" | "Grooming"
export type RoomType = "Standard" | "Deluxe"
export type GroomingType = "Basic" | "Full"
export type BookingStatus =
  | "PendingDeposit"
  | "PendingReview"
  | "Confirmed"
  | "Cancelled"
  | "CheckedIn"
  | "InProgress"
  | "Completed"
  | "Aborted"
  | "NoShow"
export type KennelStatus = "Available" | "Reserved" | "Occupied" | "Cleaning"
export type WorkStatus =
  | "Pending"
  | "PreCheck"
  | "Bathing"
  | "Drying"
  | "Grooming"
  | "Completed"
  | "Aborted"
export type CheckInResult = "Success" | "Blocked"
export type PaymentType = "Deposit" | "FinalPay" | "Refund"
export type PaymentMethod = "Online" | "CardOnSite"
export type PaymentStatus = "Pending" | "Authorized" | "Failed" | "Refunded"
export type GroomingStage = "PreCheck" | "Bathing" | "Drying" | "Grooming"
export type ReviewDecision = "Approved" | "Rejected"

// ---------- value objects ----------
export interface Money {
  amount: string
  currency?: string
}

// ---------- auth / account ----------
export interface TokenOut {
  accessToken: string
  tokenType?: string
  expiresIn: number
}
export interface AccountOut {
  id: string
  email: string
  displayName: string
  phone?: string | null
  status: AccountStatus
  createdAt: string
}

// ---------- pet & health ----------
export interface PetOut {
  id: string
  ownerId: string
  name: string
  species?: string | null
  breed?: string | null
  birthDate?: string | null
  chipId?: string | null
  behaviorNote?: string | null
  dangerLevel: DangerLevel
  dangerNote?: string | null
  isBlocked: boolean
  createdAt: string
}
export interface PetCreateIn {
  name: string
  species?: string | null
  breed?: string | null
  birthDate?: string | null
  chipId?: string | null
  behaviorNote?: string | null
}
export interface VaccinationRecordOut {
  id: string
  petId: string
  vaccineName: string
  administeredAt?: string | null
  expiresAt?: string | null
  status: VaccinationStatus
  verifiedAt?: string | null
  verifiedById?: string | null
}
export interface MedicalRecordOut {
  id: string
  petId: string
  description: string
  createdAt: string
}

// ---------- booking ----------
export interface ServiceItemOut {
  id: string
  name: string
  category: ServiceCategory
  basePrice: Money
  durationMinutes: number
  roomType?: RoomType | null
  groomingType?: GroomingType | null
  isActive: boolean
}
export interface AvailabilitySlotOut {
  id: string
  serviceItemId: string
  startAt: string
  endAt: string
  capacity: number
}
export interface AvailabilityOut {
  available: boolean
  slots?: AvailabilitySlotOut[]
}
export interface BookingItemIn {
  serviceItemId: string
  petId: string
  quantity?: number
}
export interface BookingCreateIn {
  startAt: string
  endAt: string
  items: BookingItemIn[]
}
export interface BookingItemOut {
  id: string
  serviceItemId: string
  bookedPetId: string
  unitPrice: Money
  quantity: number
}
export interface BookedPetOut {
  id: string
  petId: string
  kennelId?: string | null
}
export interface BookingOut {
  id: string
  ownerId: string
  status: BookingStatus
  startAt: string
  endAt: string
  totalAmount: Money
  depositAmount: Money
  cancelledAt?: string | null
  cancelReason?: string | null
  createdAt: string
}
export interface BookingDetailOut extends BookingOut {
  items?: BookingItemOut[]
  bookedPets?: BookedPetOut[]
}
export interface DepositPaymentIn {
  paymentMethod: PaymentMethod
}
export interface FinalPaymentIn {
  paymentMethod: PaymentMethod
}
export interface PaymentResultOut {
  transactionId: string
  type: PaymentType
  method: PaymentMethod
  amount: Money
  status: PaymentStatus
}
export interface BookingPaymentResultOut {
  booking: BookingOut
  payment: PaymentResultOut
}
export interface ReviewIn {
  decision: ReviewDecision
  staffNote?: string | null
}

// ---------- check-in / kennel ----------
export interface CheckInRequestIn {
  bookingId: string
  chipId: string
}
export interface CheckInResultOut {
  bookingId: string
  result: CheckInResult
  reason?: string | null
  kennelNumber?: string | null
}
export interface BookingVerifyOut {
  bookingId: string
  status: BookingStatus
  valid: boolean
  message?: string | null
}
export interface VaccineRecordAtCounterIn {
  petId: string
  vaccineName: string
  administeredAt?: string | null
  expiresAt: string
}
export interface KennelOut {
  id: string
  kennelNumber: string
  type: RoomType
  status: KennelStatus
  occupiedByPetId?: string | null
  occupiedByPetName?: string | null
  occupiedByBookingId?: string | null
}
export interface KennelUpdateIn {
  status: KennelStatus
}
export interface EmergencyAtCounterIn {
  petId: string
  description: string
}

// ---------- grooming ----------
export interface WorkOrderOut {
  id: string
  bookingItemId: string
  assignedToId: string
  status: WorkStatus
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
}
export interface WorkPhotoOut {
  id: string
  workOrderId: string
  url: string
  uploadedAt?: string | null
}
export interface EmergencyEventOut {
  id: string
  bookingId: string
  petId: string
  workOrderId?: string | null
  reportedById: string
  description: string
  occurredAt?: string | null
}
export interface WorkOrderDetailOut extends WorkOrderOut {
  photos?: WorkPhotoOut[]
  emergencyEvent?: EmergencyEventOut | null
}
export interface StageUpdateIn {
  stage: GroomingStage
}
export interface EmergencyTriggerIn {
  description: string
}

// ---------- cancellation ----------
export interface CancelBookingIn {
  reason: string
}
export interface RefundOut {
  eligible: boolean
  status?: PaymentStatus | null
  amount?: Money | null
  reason: string
}
export interface CancellationResultOut {
  booking: BookingOut
  refund: RefundOut
}
