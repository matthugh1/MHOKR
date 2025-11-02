'use client'

import { motion } from 'framer-motion'

export interface KpiCardProps {
  label: string
  value: number | string
  meta?: string | React.ReactNode
  tone?: 'good' | 'warning' | 'bad' | 'neutral'
  trend?: { direction: 'up' | 'down' | 'flat'; text: string }
  sparklineData?: number[]
  delay?: number
}

/**
 * KpiCard - Executive KPI display card with tone indicators and trends
 * Used in the executive dashboard for Status Overview section
 */
export function KpiCard({ label, value, meta, tone = 'neutral', trend, delay = 0 }: KpiCardProps) {
  const toneClasses = {
    good: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    bad: 'bg-rose-50 text-rose-700 border border-rose-200',
    neutral: 'bg-neutral-50 text-neutral-700 border border-neutral-200',
  }

  const trendIcon = trend?.direction === 'up' ? '▲' : trend?.direction === 'down' ? '▼' : '–'

  // TODO [phase6-polish]: Implement spring-based number animation using useMotionValue + useTransform
  // For now, display value directly. When animated, extract numeric value and animate from 0 to target.

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4 flex flex-col transition-all duration-200 hover:shadow-md hover:border-neutral-300"
    >
      <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">
        {label}
      </div>
      <motion.div
        className="text-3xl font-semibold text-neutral-900 mb-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: delay + 0.1 }}
      >
        {value}
      </motion.div>
      {(meta || trend) && (
        <div className="flex items-center gap-2 text-xs">
          {meta && (
            typeof meta === 'string' ? (
              <span className="text-neutral-500">{meta}</span>
            ) : (
              meta
            )
          )}
          {trend && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${toneClasses[tone]}`}>
              {trendIcon} {trend.text}
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}

