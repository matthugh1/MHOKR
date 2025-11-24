/**
 * Metadata Section component
 * Displays cycle, dates, goal type, visibility, publish status, team/workspace/pillar
 */

'use client'

import React from 'react'
import { Calendar, Eye, Target, Building2, Users, Layers, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetadataSectionProps {
  hideTitle?: boolean
  detail: {
    cycle?: {
      id: string
      name: string
      status: string
      startDate: string
      endDate: string
    } | null
    cycleName?: string | null
    startDate?: string | null
    endDate?: string | null
    createdAt?: string | null
    updatedAt?: string | null
    lastReviewedAt?: string | null
    goalType?: 'ASPIRATIONAL' | 'COMMITTED' | null
    visibilityLevel?: string | null
    isPublished?: boolean | null
    state?: string | null
    workspace?: {
      id: string
      name: string
    } | null
    team?: {
      id: string
      name: string
    } | null
    pillar?: {
      id: string
      name: string
      color?: string | null
    } | null
  } | null
  type: 'objective' | 'keyResult'
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
    } else {
      return 'Just now'
    }
  } catch {
    return '—'
  }
}

const getVisibilityLabel = (level: string | null | undefined): string => {
  switch (level) {
    case 'PUBLIC_TENANT':
      return 'Public (Tenant)'
    case 'PRIVATE':
      return 'Private'
    default:
      return level || 'Public'
  }
}

const getGoalTypeBadge = (goalType: 'ASPIRATIONAL' | 'COMMITTED' | null | undefined) => {
  if (!goalType) return null
  return (
    <span
      className={cn(
        'text-xs px-2 py-0.5 rounded-full border',
        goalType === 'COMMITTED'
          ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
          : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
      )}
    >
      {goalType === 'COMMITTED' ? 'Committed' : 'Aspirational'}
    </span>
  )
}

const getPublishStatusBadge = (isPublished: boolean | null | undefined, state: string | null | undefined) => {
  const published = isPublished || state === 'PUBLISHED'
  return (
    <span
      className={cn(
        'text-xs px-2 py-0.5 rounded-full border',
        published
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      )}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

export function MetadataSection({ detail, type, hideTitle = false }: MetadataSectionProps) {
  if (!detail) return null

  // Check if there's any content to display
  const hasCycle = detail.cycle || detail.cycleName
  const hasDates = detail.startDate || detail.endDate || detail.createdAt || detail.updatedAt || detail.lastReviewedAt
  const hasStatusVisibility = detail.goalType || detail.visibilityLevel || detail.isPublished !== undefined || detail.state
  const hasContext = detail.workspace || detail.team || detail.pillar

  // Don't render if there's no content
  if (!hasCycle && !hasDates && !hasStatusVisibility && !hasContext) {
    return null
  }

    return (
      <div className="space-y-4">
        {!hideTitle && (
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar size={16} className="text-slate-500" />
            Overview
          </h4>
        )}

        <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-5 space-y-5">
        {/* Cycle Information */}
        {hasCycle && (
          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Cycle</div>
            <div className="text-sm text-slate-200 font-medium">
              {detail.cycle?.name || detail.cycleName || '—'}
            </div>
            {detail.cycle && (
              <>
                <div className="text-xs text-slate-400">
                  {formatDate(detail.cycle.startDate)} → {formatDate(detail.cycle.endDate)}
                </div>
                {detail.cycle.status && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 capitalize mt-1">
                    {detail.cycle.status.toLowerCase()}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Dates */}
        {hasDates && (
          <div className="space-y-3 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Dates</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {detail.startDate && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-medium">Start Date</div>
                  <div className="text-slate-200">{formatDate(detail.startDate)}</div>
                </div>
              )}
              {detail.endDate && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-medium">End Date</div>
                  <div className="text-slate-200">{formatDate(detail.endDate)}</div>
                </div>
              )}
              {detail.createdAt && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-medium">Created</div>
                  <div className="text-slate-200">{formatDate(detail.createdAt)}</div>
                </div>
              )}
              {detail.updatedAt && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-medium">Last Updated</div>
                  <div className="text-slate-200">
                    {formatDate(detail.updatedAt)}
                    <span className="text-slate-500 ml-1.5 text-[10px]">({formatRelativeTime(detail.updatedAt)})</span>
                  </div>
                </div>
              )}
              {detail.lastReviewedAt && (
                <div className="space-y-1">
                  <div className="text-slate-400 font-medium">Last Reviewed</div>
                  <div className="text-slate-200">{formatDate(detail.lastReviewedAt)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Goal Type & Visibility & Publish Status */}
        {hasStatusVisibility && (
          <div className="space-y-3 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Status & Visibility</div>
            <div className="flex flex-wrap gap-2 items-center">
              {getGoalTypeBadge(detail.goalType)}
              {getPublishStatusBadge(detail.isPublished, detail.state)}
              {detail.visibilityLevel && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-slate-700/50 text-slate-400 border border-slate-700">
                  <Eye size={12} />
                  {getVisibilityLabel(detail.visibilityLevel)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Context: Workspace, Team, Pillar */}
        {hasContext && (
          <div className="space-y-3 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Context</div>
            <div className="space-y-2.5">
              {detail.workspace && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Building2 size={16} className="text-slate-500 flex-shrink-0" />
                  <span className="text-slate-300">{detail.workspace.name}</span>
                </div>
              )}
              {detail.team && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Users size={16} className="text-slate-500 flex-shrink-0" />
                  <span className="text-slate-300">{detail.team.name}</span>
                </div>
              )}
              {detail.pillar && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Layers size={16} className="text-slate-500 flex-shrink-0" />
                  <span
                    className="text-xs px-2.5 py-1 rounded-full text-white font-medium"
                    style={{
                      backgroundColor: detail.pillar.color || '#6366f1',
                    }}
                  >
                    {detail.pillar.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

