'use client'

import type { ReactNode } from 'react'

export interface StatCardProps {
  title: string
  value: string | number | ReactNode
  subtitle?: string
}

/**
 * StatCard - A consistent metric display card for dashboard KPIs
 * 
 * Uses Phase 9 design tokens: rounded-xl, border-neutral-200, bg-white, shadow-sm
 * 
 * @example
 * ```tsx
 * <StatCard
 *   title="Total Objectives"
 *   value={42}
 *   subtitle="12 on track"
 * />
 * ```
 */
export function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="text-2xl font-semibold text-neutral-900">{value}</div>
      {subtitle && (
        <div className="text-[11px] text-neutral-500 mt-1">{subtitle}</div>
      )}
    </div>
  )
}
