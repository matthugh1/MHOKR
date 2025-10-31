'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export interface ActivityItem {
  id: string
  timestamp: string // ISO
  actorName: string
  action: string // "UPDATED", "CHECK_IN", etc.
  summary: string // human readable like "Target 80 → 95" or "Check-in: 37 (confidence 4/5)"
}

interface ActivityDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: ActivityItem[]
  entityName: string // Objective/Key Result title for header
  hasMore?: boolean
  onLoadMore?: () => void
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else {
    return `${diffDays}d ago`
  }
}

// TODO [phase6-polish]: extract ActivityItemCard once content format is stable
interface ActivityItemCardProps {
  actorName: string
  timestamp: string
  action: string
  summary: string
}

function ActivityItemCard({ actorName, timestamp, action, summary }: ActivityItemCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm text-sm text-neutral-800">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-neutral-900">
          {actorName}
        </span>
        <span className="text-xs text-neutral-500">
          {formatTimeAgo(timestamp)}
        </span>
      </div>
      <p className="text-sm text-neutral-700 mb-1">
        {action}
      </p>
      <p className="text-xs text-neutral-600">
        {summary}
      </p>
    </div>
  )
}

export function ActivityDrawer({
  isOpen,
  onClose,
  items,
  entityName,
  hasMore,
  onLoadMore,
}: ActivityDrawerProps) {
  const headerTitle = entityName || 'Activity'
  const safeItems = Array.isArray(items) ? items : []

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              'fixed right-0 top-0 h-full w-[400px] max-w-[90%] z-50',
              'bg-white text-slate-900 border-l border-slate-200',
              'shadow-2xl rounded-l-2xl',
              'flex flex-col'
            )}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-900">
                    {headerTitle}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Recent updates
                  </div>
                  {/* TODO [phase6-polish]: include avatar / icon for objective vs key result */}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {(!safeItems || safeItems.length === 0) ? (
                <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
                  No recent activity.
                  {/* TODO [phase6-polish]: add subtle illustration */}
                </div>
              ) : (
                <div className="space-y-3">
                  {safeItems.map((item) => (
                    <ActivityItemCard
                      key={item.id}
                      actorName={item.actorName}
                      timestamp={item.timestamp}
                      action={item.action}
                      summary={item.summary}
                    />
                  ))}
                </div>
              )}
              
              {/* Load more button */}
              {hasMore && onLoadMore && (
                <div className="pt-4 border-t border-slate-200">
                  {/* TODO [phase7-performance]: Wire this to /activity/* with pagination params (limit, cursor) */}
                  <button
                    onClick={onLoadMore}
                    className="text-sm text-blue-600 hover:text-blue-700 underline w-full text-center"
                  >
                    Load more…
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

