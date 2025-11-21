"use client"

import { useState, useEffect } from "react"
import { History, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatNumber, clampProgress } from "@/lib/utils"
import api from "@/lib/api"

interface Activity {
  id: string
  createdAt: string
  userId: string
  action: string
  metadata?: {
    checkIn?: {
      value: number
      confidence: number
    }
    before?: {
      progress?: number
      status?: string
      currentValue?: number
      targetValue?: number
    }
    after?: {
      progress?: number
      status?: string
      currentValue?: number
      targetValue?: number
    }
    wasPublish?: boolean
  }
}

interface InlineHistoryPreviewProps {
  entityType: 'OBJECTIVE' | 'KEY_RESULT'
  entityId: string
  availableUsers: Array<{ id: string; name: string; email?: string }>
  onViewFullHistory?: () => void
  limit?: number
}

export function InlineHistoryPreview({
  entityType,
  entityId,
  availableUsers,
  onViewFullHistory,
  limit = 3,
}: InlineHistoryPreviewProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadActivities = async () => {
      if (!entityId) return

      setLoading(true)
      setError(null)

      try {
        const endpoint =
          entityType === 'OBJECTIVE'
            ? `/activity/objectives/${entityId}`
            : `/activity/key-results/${entityId}`

        const response = await api.get(endpoint, {
          params: {
            limit: limit.toString(),
            offset: '0',
          },
        })

        const data = response.data || []
        setActivities(data.slice(0, limit))
      } catch (err: any) {
        console.error('Failed to load activity preview:', err)
        setError('Failed to load')
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    loadActivities()
  }, [entityId, entityType, limit])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const formatActionSummary = (activity: Activity): string => {
    const { action, metadata } = activity

    switch (action) {
      case 'CREATED':
        return 'Created'
      case 'UPDATED':
        if (metadata?.wasPublish) {
          return 'Published'
        }
        if (metadata?.before && metadata?.after) {
          const changes: string[] = []
          if (metadata.before.progress !== metadata.after.progress) {
            changes.push(
              `Progress ${clampProgress(metadata.before.progress || 0).toFixed(0)}% → ${clampProgress(metadata.after.progress || 0).toFixed(0)}%`
            )
          }
          if (metadata.before.status !== metadata.after.status) {
            changes.push(
              `Status ${metadata.before.status} → ${metadata.after.status}`
            )
          }
          if (metadata.before.currentValue !== undefined && metadata.after.currentValue !== undefined) {
            if (metadata.before.currentValue !== metadata.after.currentValue) {
              changes.push(
                `Value ${formatNumber(metadata.before.currentValue)} → ${formatNumber(metadata.after.currentValue)}`
              )
            }
          }
          if (metadata.before.targetValue !== undefined && metadata.after.targetValue !== undefined) {
            if (metadata.before.targetValue !== metadata.after.targetValue) {
              changes.push(
                `Target ${formatNumber(metadata.before.targetValue)} → ${formatNumber(metadata.after.targetValue)}`
              )
            }
          }
          if (changes.length > 0) {
            return changes.join(', ')
          }
        }
        return 'Updated'
      case 'DELETED':
        return 'Deleted'
      case 'CHECK_IN':
        if (metadata?.checkIn) {
          return `Check-in: ${formatNumber(metadata.checkIn.value)} (confidence ${metadata.checkIn.confidence}/5)`
        }
        return 'Check-in recorded'
      default:
        return action
    }
  }

  const getActorName = (userId: string) => {
    const user = availableUsers.find((u) => u.id === userId)
    return user?.name || user?.email || 'Unknown User'
  }

  if (loading) {
    return (
      <div className="text-[11px] text-neutral-500">
        <Clock className="h-3 w-3 inline mr-1" />
        Loading history...
      </div>
    )
  }

  if (error || activities.length === 0) {
    return null // Don't show anything if no activities
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600 flex items-center gap-2">
          <span className="w-1 h-4 bg-violet-400 rounded-full"></span>
          Recent Activity
        </h5>
        {onViewFullHistory && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[11px] font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50"
            onClick={onViewFullHistory}
            aria-label="View full history"
          >
            <History className="h-3 w-3 mr-1.5" />
            View all
          </Button>
        )}
      </div>
      
      <div className="space-y-1.5 pl-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="text-[11px] text-neutral-600 border-l-2 border-neutral-200 pl-2 py-0.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-neutral-700">
                  {getActorName(activity.userId)}
                </span>
                {' '}
                <span className="text-neutral-500">
                  {formatActionSummary(activity)}
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 whitespace-nowrap flex-shrink-0">
                {formatTimeAgo(activity.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

