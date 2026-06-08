import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface OverlayProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** "modal" = centered card; "sheet" = bottom sheet (owner mobile) */
  variant?: "modal" | "sheet"
  title?: React.ReactNode
  className?: string
}

/** Lightweight controlled overlay (no Radix). Backdrop click + Esc close. */
export function Overlay({ open, onClose, children, variant = "modal", title, className }: OverlayProps) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-foreground/40 backdrop-blur-[2px] animate-in fade-in",
        variant === "sheet" ? "items-end justify-center" : "items-center justify-center p-4",
      )}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "relative bg-card text-card-foreground shadow-lg",
          variant === "sheet"
            ? "w-full max-w-md rounded-t-[26px] max-h-[92vh] overflow-y-auto scroll-area animate-in slide-in-from-bottom"
            : "w-full max-w-[480px] rounded-xl max-h-[90vh] overflow-y-auto scroll-area animate-in zoom-in-95",
          className,
        )}
      >
        {variant === "sheet" && <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border" />}
        {title ? (
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="size-5" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
