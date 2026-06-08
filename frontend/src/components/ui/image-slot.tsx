import { PawPrint } from "lucide-react"
import { cn } from "@/lib/utils"

/** Warm gradient placeholder (the design's <image-slot>). Falls back to a paw motif. */
export function ImageSlot({
  className,
  label,
  rounded = "rounded-xl",
}: {
  className?: string
  label?: string
  rounded?: string
}) {
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden bg-gradient-to-br from-primary-soft via-accent to-secondary",
        rounded,
        className,
      )}
    >
      <PawPrint className="size-1/4 max-h-12 max-w-12 text-primary/35" />
      {label ? (
        <span className="absolute bottom-1.5 right-2 text-[10px] font-medium text-primary-strong/60">
          {label}
        </span>
      ) : null}
    </div>
  )
}
