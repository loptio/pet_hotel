/** Status → 中文 label + badge tone, per design handoff (照狀態機，務必一致). */
import type {
  BookingStatus,
  DangerLevel,
  KennelStatus,
  PaymentStatus,
  VaccinationStatus,
  WorkStatus,
} from "@/api/types"

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info"

export const bookingStatus: Record<BookingStatus, { label: string; tone: Tone }> = {
  PendingDeposit: { label: "待付訂金", tone: "warning" },
  PendingReview: { label: "待審核", tone: "warning" },
  Confirmed: { label: "已確認", tone: "success" },
  CheckedIn: { label: "已報到", tone: "success" },
  InProgress: { label: "服務中", tone: "brand" },
  Completed: { label: "已完成", tone: "neutral" },
  Cancelled: { label: "已取消", tone: "neutral" },
  NoShow: { label: "未到場", tone: "neutral" },
  Aborted: { label: "異常終止", tone: "danger" },
}

export const workStatus: Record<WorkStatus, { label: string; tone: Tone }> = {
  Pending: { label: "待處理", tone: "neutral" },
  PreCheck: { label: "預檢", tone: "brand" },
  Bathing: { label: "洗澡", tone: "brand" },
  Drying: { label: "烘乾", tone: "brand" },
  Grooming: { label: "剪毛", tone: "brand" },
  Completed: { label: "已完成", tone: "success" },
  Aborted: { label: "異常終止", tone: "danger" },
}

export const kennelStatus: Record<KennelStatus, { label: string; tone: Tone }> = {
  Available: { label: "空床", tone: "success" },
  Reserved: { label: "已預約", tone: "warning" },
  Occupied: { label: "已入住", tone: "brand" },
  Cleaning: { label: "清潔中", tone: "neutral" },
}

export const dangerLevel: Record<DangerLevel, { label: string; tone: Tone }> = {
  None: { label: "無危險", tone: "neutral" },
  Low: { label: "低度", tone: "success" },
  Medium: { label: "中度", tone: "warning" },
  High: { label: "高度", tone: "danger" },
}

export const vaccinationStatus: Record<VaccinationStatus, { label: string; tone: Tone }> = {
  Pending: { label: "待驗證", tone: "warning" },
  Valid: { label: "有效", tone: "success" },
  Expired: { label: "逾期", tone: "danger" },
  Rejected: { label: "駁回", tone: "danger" },
}

export const paymentStatus: Record<PaymentStatus, { label: string; tone: Tone }> = {
  Pending: { label: "處理中", tone: "warning" },
  Authorized: { label: "已授權", tone: "success" },
  Failed: { label: "失敗", tone: "danger" },
  Refunded: { label: "已退款", tone: "success" },
}

// the 4 advanceable grooming stages, in order
export const GROOMING_STAGES = ["PreCheck", "Bathing", "Drying", "Grooming"] as const
export const stageLabel: Record<string, string> = {
  PreCheck: "預檢",
  Bathing: "洗澡",
  Drying: "烘乾",
  Grooming: "剪毛",
  Completed: "完成",
  Pending: "待處理",
}
