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
        tone === 'good' && "bg-emerald-50 text-emerald-700 border-emerald-200",
        tone === 'warn' && "bg-amber-50 text-amber-700 border-amber-200",
        tone === 'bad' && "bg-rose-50 text-rose-700 border-rose-200",
        (!tone || tone === 'neutral') && "bg-neutral-100 text-neutral-700 border-neutral-300",
        className
      )}
    >
      {children}
    </span>
  )
}

