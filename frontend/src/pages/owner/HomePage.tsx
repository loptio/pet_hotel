import * as React from "react"
import { useNavigate } from "react-router-dom"
import { BedDouble, Clock, Scissors, Sparkles } from "lucide-react"
import { bookingApi } from "@/api/endpoints"
import type { ServiceItemOut } from "@/api/types"
import { useAuth } from "@/auth/AuthContext"
import { useAsync } from "@/lib/useAsync"
import { money } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { ImageSlot } from "@/components/ui/image-slot"
import { HERO_IMG, serviceImg } from "@/lib/images"

const ROOM_LABEL: Record<string, string> = { Standard: "標準房", Deluxe: "豪華房" }
const GROOM_LABEL: Record<string, string> = { Basic: "基礎", Full: "完整" }

type Filter = "All" | "Lodging" | "Grooming"

function serviceSubtitle(s: ServiceItemOut): string {
  if (s.category === "Lodging") return s.roomType ? ROOM_LABEL[s.roomType] ?? s.roomType : "住宿"
  return s.groomingType ? GROOM_LABEL[s.groomingType] ?? s.groomingType : "美容"
}

export default function HomePage() {
  const nav = useNavigate()
  const { account } = useAuth()
  const { data: services, loading, error } = useAsync(() => bookingApi.services(), [])
  const [filter, setFilter] = React.useState<Filter>("All")
  const listRef = React.useRef<HTMLDivElement>(null)

  function pickCategory(cat: "Lodging" | "Grooming") {
    setFilter((cur) => (cur === cat ? "All" : cat))
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const shown = (services ?? []).filter((s) => filter === "All" || s.category === filter)

  return (
    <div className="space-y-5 pb-6">
      {/* Hero */}
      <div className="relative h-[210px] w-full overflow-hidden">
        <ImageSlot src={HERO_IMG} className="absolute inset-0 size-full" rounded="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/75 via-foreground/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-primary-foreground">
          <p className="text-sm font-medium opacity-90">午安，{account?.displayName ?? "貴賓"}</p>
          <p className="mt-1 text-2xl font-bold leading-tight">想為毛孩安排什麼？</p>
        </div>
      </div>

      <div className="space-y-5 px-4">
        {/* Category cards */}
        <div className="grid grid-cols-2 gap-3">
          <CategoryCard
            active={filter === "Lodging"}
            icon={<BedDouble className="size-6" />}
            title="住宿"
            subtitle="標準 / 豪華"
            onClick={() => pickCategory("Lodging")}
          />
          <CategoryCard
            active={filter === "Grooming"}
            icon={<Scissors className="size-6" />}
            title="美容"
            subtitle="基礎 / 完整"
            onClick={() => pickCategory("Grooming")}
          />
        </div>

        {/* Services */}
        <div ref={listRef} className="scroll-mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {filter === "Lodging" ? "住宿方案" : filter === "Grooming" ? "美容方案" : "熱門方案"}
            </h2>
            {filter !== "All" ? (
              <button
                type="button"
                onClick={() => setFilter("All")}
                className="text-sm text-primary hover:text-primary-strong"
              >
                顯示全部
              </button>
            ) : null}
          </div>

          {loading ? (
            <PageLoader label="載入服務中…" />
          ) : error ? (
            <Alert tone="danger" title="載入失敗">{error}</Alert>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-7" />}
              title="目前沒有可預約的方案"
              description={filter === "All" ? "請稍後再回來看看" : "試試其他分類"}
            />
          ) : (
            <div className="space-y-3">
              {shown.map((s) => (
                <ServiceCard key={s.id} service={s} onClick={() => nav(`/app/service/${s.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryCard({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative h-[104px] overflow-hidden rounded-2xl border p-4 text-left transition-all " +
        (active
          ? "border-primary bg-primary-soft shadow-md"
          : "border-border bg-card shadow-sm hover:border-primary")
      }
    >
      <div
        className={
          "mb-2 grid size-10 place-items-center rounded-xl " +
          (active ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-strong")
        }
      >
        {icon}
      </div>
      <div className="font-bold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </button>
  )
}

function ServiceCard({ service, onClick }: { service: ServiceItemOut; onClick: () => void }) {
  const isLodging = service.category === "Lodging"
  const unit = isLodging ? "/晚" : "/次"
  return (
    <Card
      className="flex cursor-pointer items-stretch gap-3 overflow-hidden p-3 transition-colors hover:border-primary"
      onClick={onClick}
    >
      <ImageSlot src={serviceImg(service)} className="size-[88px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate font-semibold">{service.name}</span>
          <Badge tone={isLodging ? "brand" : "info"}>{isLodging ? "住宿" : "美容"}</Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{serviceSubtitle(service)}</p>
        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="num inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {service.durationMinutes} 分鐘
          </span>
          <span className="num font-bold text-primary">
            {money(service.basePrice)}
            <span className="text-xs font-normal text-muted-foreground">{unit}</span>
          </span>
        </div>
      </div>
    </Card>
  )
}
