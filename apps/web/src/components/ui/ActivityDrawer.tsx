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

export function ActivityDrawer({
  isOpen,
  onClose,
  items,
  entityName,
}: ActivityDrawerProps) {
  // TODO: pagination/filter later

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
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900 truncate">
                    Activity Timeline
                  </h2>
                  <p className="text-sm text-slate-600 mt-1 truncate">
                    {entityName}
                  </p>
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
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No activity recorded yet
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

                  {/* Activity items */}
                  <div className="space-y-6">
                    {items.map((item, index) => (
                      <div key={item.id} className="relative flex gap-4">
                        {/* Timeline bullet */}
                        <div className="flex-shrink-0 relative z-10">
                          <div className="w-8 h-8 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-sm">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900">
                              {item.actorName}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatTimeAgo(item.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mb-1">
                            {item.action}
                          </p>
                          <p className="text-xs text-slate-600">
                            {item.summary}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

