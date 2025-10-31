'use client'

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

export interface ActivityItemCardProps {
  actorName: string
  timestamp: string
  action: string
  summary: string
}

/**
 * ActivityItemCard - Card component for displaying individual activity feed items
 * 
 * Uses Phase 9 design tokens: rounded-lg, border-neutral-200, bg-white, shadow-sm
 * Suitable for activity timelines, audit logs, and change history displays.
 * 
 * @example
 * ```tsx
 * <ActivityItemCard
 *   actorName="John Doe"
 *   timestamp="2024-01-15T10:30:00Z"
 *   action="UPDATED"
 *   summary="Progress 45% → 60%"
 * />
 * ```
 */
export function ActivityItemCard({ actorName, timestamp, action, summary }: ActivityItemCardProps) {
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

