'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  const toneClasses = {
    default: 'bg-white border-slate-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    danger: 'bg-red-50 border-red-200',
  }

  return (
    <div
      className={cn(
        'rounded-2xl border p-6',
        'shadow-sm transition-all duration-200',
        'hover:translate-y-[-2px] hover:shadow-lg',
        toneClasses[tone]
      )}
    >
      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-600">{label}</div>
        <div className="text-3xl font-semibold leading-tight text-slate-900">
          {value}
        </div>
        {hint && (
          <div className="text-xs text-slate-500 mt-2">{hint}</div>
        )}
      </div>
    </div>
  )
}

