import * as React from "react"
import { PawPrint } from "lucide-react"
import { cn } from "@/lib/utils"

/** Warm gradient placeholder (the design's <image-slot>). If `src` is given it
 * renders the image (object-cover); on a missing/broken file it auto-falls back
 * to the paw gradient — so dropping real photos into /public/img later just works. */
export function ImageSlot({
  className,
  label,
  src,
  alt,
  rounded = "rounded-xl",
}: {
  className?: string
  label?: string
  src?: string
  alt?: string
  rounded?: string
}) {
  const [broken, setBroken] = React.useState(false)
  const showImg = src && !broken

  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden bg-gradient-to-br from-primary-soft via-accent to-secondary",
        rounded,
        className,
      )}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt ?? label ?? ""}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <PawPrint className="size-1/4 max-h-12 max-w-12 text-primary/35" />
      )}
      {label ? (
        <span className="absolute bottom-1.5 right-2 z-10 rounded bg-card/70 px-1 text-[10px] font-medium text-primary-strong/80">
          {label}
        </span>
      ) : null}
    </div>
  )
}
