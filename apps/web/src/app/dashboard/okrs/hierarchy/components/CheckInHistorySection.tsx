/**
 * Check-in History Section component
 * Displays timeline of recent check-ins with value, confidence, notes, blockers
 */

'use client'

import React, { useState } from 'react'
import { Clock, TrendingUp, MessageSquare, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { formatNumber, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { AvatarCircle } from '@/components/dashboard/AvatarCircle'

interface CheckInHistorySectionProps {
  hideTitle?: boolean
  detail: {
    checkIns?: Array<{
      id: string
      value: number
      confidence: number
      note?: string | null
      blockers?: string | null
      createdAt: string
      userId: string
      user?: {
        id: string
        name: string
        email?: string | null
      }
    }>
    checkInCadence?: string | null
    unit?: string | null
  } | null
}

const getCadenceLabel = (cadence: string | null | undefined): string => {
  switch (cadence) {
    case 'WEEKLY':
      return 'Weekly check-ins'
    case 'BIWEEKLY':
      return 'Fortnightly check-ins'
    case 'MONTHLY':
      return 'Monthly check-ins'
    default:
      return 'No cadence set'
  }
}

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 75) return 'text-emerald-400'
  if (confidence >= 50) return 'text-amber-400'
  return 'text-rose-400'
}

export function CheckInHistorySection({ detail, hideTitle = false }: CheckInHistorySectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  if (!detail || !detail.checkIns || detail.checkIns.length === 0) {
    return (
      <div className="space-y-4">
        {!hideTitle && (
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            Check-in History
          </h4>
        )}
        <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-4">
          <div className="text-sm text-slate-400 text-center py-4">
            No check-ins yet
            {detail?.checkInCadence && (
              <div className="text-xs text-slate-500 mt-2">{getCadenceLabel(detail.checkInCadence)}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const checkIns = detail.checkIns
  const displayedCheckIns = showAll ? checkIns : checkIns.slice(0, 5)
  const hasMore = checkIns.length > 5

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {!hideTitle && (
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            Check-in History ({checkIns.length})
          </h4>
        )}
        {detail.checkInCadence && (
          <span className="text-xs text-slate-500">{getCadenceLabel(detail.checkInCadence)}</span>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-4">
        <div className="space-y-4">
          {displayedCheckIns.map((checkIn, index) => (
            <div
              key={checkIn.id}
              className={index !== displayedCheckIns.length - 1 ? 'pb-4 border-b border-slate-700/50' : ''}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {checkIn.user && (
                      <>
                        <AvatarCircle name={checkIn.user.name} size="sm" />
                        <span className="text-sm text-slate-300 font-medium">{checkIn.user.name}</span>
                      </>
                    )}
                    <span className="text-xs text-slate-500">
                      {format(new Date(checkIn.createdAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-indigo-400" />
                      <span className="text-lg font-semibold text-white">
                        {formatNumber(checkIn.value)}
                        {detail.unit && <span className="text-sm text-slate-400 ml-1">{detail.unit}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Confidence:</span>
                      <span className={cn('text-sm font-medium', getConfidenceColor(checkIn.confidence))}>
                        {checkIn.confidence}%
                      </span>
                    </div>
                  </div>

                  {checkIn.note && (
                    <div className="flex items-start gap-2 mb-2">
                      <MessageSquare size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-300 break-words">{checkIn.note}</p>
                    </div>
                  )}

                  {checkIn.blockers && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-300 break-words">{checkIn.blockers}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full mt-4 pt-4 border-t border-slate-700/50 text-sm text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-2"
          >
            Show all {checkIns.length} check-ins
            <ChevronDown size={16} />
          </button>
        )}

        {hasMore && showAll && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full mt-4 pt-4 border-t border-slate-700/50 text-sm text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-2"
          >
            Show less
            <ChevronUp size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

