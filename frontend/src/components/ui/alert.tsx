import * as React from "react"
import { cn } from "@/lib/utils"
import type { Tone } from "@/lib/status"

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted/60 text-foreground border-border",
  brand: "bg-primary-soft text-primary-strong border-primary/25",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-destructive-soft text-destructive border-destructive/25",
  info: "bg-info-soft text-info border-info/25",
}

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: Tone
  icon?: React.ReactNode
  title?: React.ReactNode
}

export function Alert({ className, tone = "info", icon, title, children, ...props }: AlertProps) {
  return (
    <div
      className={cn("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm", toneClasses[tone], className)}
      role="alert"
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <div className="min-w-0 space-y-0.5">
        {title ? <div className="font-semibold leading-tight">{title}</div> : null}
        {children ? <div className="leading-snug opacity-90">{children}</div> : null}
      </div>
    </div>
  )
}
