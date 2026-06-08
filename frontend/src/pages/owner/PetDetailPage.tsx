import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ChevronLeft, FileUp, HeartPulse, Info, Syringe } from "lucide-react"
import { petApi } from "@/api/endpoints"
import type { MedicalRecordOut, PetOut, VaccinationRecordOut } from "@/api/types"
import { useAsync } from "@/lib/useAsync"
import { fmtDate } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty"
import { ImageSlot } from "@/components/ui/image-slot"
import { DangerBadge, VaccinationBadge } from "@/components/StatusBadge"

function ageYears(birthDate?: string | null): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years--
  return years < 0 ? null : years
}

export default function PetDetailPage() {
  const { id = "" } = useParams()
  const nav = useNavigate()

  const { data, loading, error } = useAsync(
    () =>
      Promise.all([
        petApi.get(id),
        petApi.vaccinations(id),
        petApi.medicalRecords(id),
      ]),
    [id],
  )

  // MOCK upload notice (no real endpoint — integration phase)
  const [uploadNotice, setUploadNotice] = React.useState<string | null>(null)
  function onMockUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setUploadNotice("（示範）已選擇檔案，實際上傳於整合階段串接")
    }
    e.target.value = ""
  }

  if (loading) return <PageLoader label="載入寵物檔案…" />

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <BackButton onBack={() => nav(-1)} />
        <Alert tone="danger" title="載入失敗">
          {error}
        </Alert>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4 p-4">
        <BackButton onBack={() => nav(-1)} />
        <EmptyState title="找不到此寵物" description="檔案可能已被移除" />
      </div>
    )
  }

  const [pet, vaccinations, medicalRecords] = data as [
    PetOut,
    VaccinationRecordOut[],
    MedicalRecordOut[],
  ]

  const age = ageYears(pet.birthDate)
  const subtitle =
    [pet.breed, pet.species].filter(Boolean).join(" · ") || "未填品種"

  return (
    <div className="space-y-4 p-4">
      <BackButton onBack={() => nav(-1)} />

      {/* Header */}
      <header className="flex items-center gap-4">
        <ImageSlot className="size-[72px] shrink-0" rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">{pet.name}</h1>
            <DangerBadge level={pet.dangerLevel} />
          </div>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          {age !== null ? (
            <p className="text-sm text-muted-foreground">約 {age} 歲</p>
          ) : null}
        </div>
      </header>

      {uploadNotice ? (
        <Alert tone="info" title="檔案上傳" icon={<Info className="size-4" />}>
          {uploadNotice}
        </Alert>
      ) : null}

      {/* Data card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <DataRow label="晶片號">
            {pet.chipId ? (
              <span className="num">{pet.chipId}</span>
            ) : (
              <span className="text-muted-foreground">未綁定</span>
            )}
          </DataRow>
          <DataRow label="行為備註">
            {pet.behaviorNote ? (
              <span>{pet.behaviorNote}</span>
            ) : (
              <span className="text-muted-foreground">無</span>
            )}
          </DataRow>
          {pet.dangerLevel !== "None" ? (
            <DataRow label="危險說明">
              <span className="font-medium text-destructive">
                {pet.dangerNote || "此寵物已標記為危險，請特別留意"}
              </span>
            </DataRow>
          ) : null}
        </CardContent>
      </Card>

      {/* Vaccinations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Syringe className="size-4 text-primary" />
            疫苗紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vaccinations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
                <Syringe className="size-7" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">尚無疫苗紀錄</p>
                <p className="text-sm text-muted-foreground">
                  上傳疫苗證明，加速報到核驗
                </p>
              </div>
              <UploadButton label="上傳疫苗證明" onChange={onMockUpload} />
            </div>
          ) : (
            <div className="space-y-2.5">
              {vaccinations.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{v.vaccineName}</span>
                    <VaccinationBadge status={v.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    有效至 {v.expiresAt ? fmtDate(v.expiresAt) : "—"}
                  </p>
                  {v.status === "Pending" ? (
                    <UploadButton
                      label="上傳證明文件"
                      onChange={onMockUpload}
                      className="mt-2.5"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical records — add-only (FR-02.2) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="size-4 text-primary" />
            醫療背景
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {medicalRecords.length === 0 ? (
            <EmptyState
              icon={<HeartPulse className="size-7" />}
              title="尚無醫療紀錄"
              description="醫療紀錄僅可新增不可修改"
            />
          ) : (
            <div className="space-y-2.5">
              {medicalRecords.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-border bg-muted/40 p-3"
                >
                  <p className="text-sm">{m.description}</p>
                  <p className="num mt-1 text-xs text-muted-foreground">
                    {fmtDate(m.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" />
            醫療紀錄僅可新增不可修改（FR-02.2）
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
      <ChevronLeft className="size-4" /> 返回
    </Button>
  )
}

function DataRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right">{children}</span>
    </div>
  )
}

function UploadButton({
  label,
  onChange,
  className,
}: {
  label: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}) {
  return (
    <label
      className={
        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-primary/60 bg-primary-soft/40 px-3 py-1.5 text-xs font-medium text-primary-strong transition-colors hover:border-primary hover:bg-primary-soft " +
        (className ?? "")
      }
    >
      <FileUp className="size-3.5" />
      {label}
      <input
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={onChange}
      />
    </label>
  )
}
