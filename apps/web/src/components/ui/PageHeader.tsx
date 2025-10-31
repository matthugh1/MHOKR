'use client'

import { motion } from 'framer-motion'
import { Badge } from './badge'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  badges?: Array<{
    label: string
    tone?: 'neutral' | 'success' | 'warning' | 'danger'
  }>
}

export function PageHeader({ title, subtitle, badges = [] }: PageHeaderProps) {

  const getBadgeVariant = (tone?: string) => {
    switch (tone) {
      case 'success':
        return 'success'
      case 'warning':
        return 'warning'
      case 'danger':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border border-slate-200/50',
        'bg-gradient-to-br from-slate-50 to-white',
        'shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)]',
        'p-6 mb-8'
      )}
    >
      <div className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="text-slate-600 mt-1 text-sm">{subtitle}</p>
          )}
        </div>
        {badges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {badges.map((badge, index) => (
              <Badge
                key={index}
                variant={getBadgeVariant(badge.tone)}
                className="rounded-full px-3 py-1"
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

