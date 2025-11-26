"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type OkrBadgeProps = {
  tone?: 'good' | 'warn' | 'bad' | 'neutral'
  children: React.ReactNode
  className?: string
}

export function OkrBadge({ tone = 'neutral', children, className }: OkrBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-[2px] text-[11px] font-medium leading-none border",
        tone === 'good' && "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        tone === 'warn' && "bg-amber-500/20 text-amber-300 border-amber-500/30",
        tone === 'bad' && "bg-destructive/20 text-destructive border-destructive/30",
        (!tone || tone === 'neutral') && "bg-muted text-muted-foreground border-border",
        className
      )}
    >
      {children}
    </span>
  )
}

