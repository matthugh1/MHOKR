'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import api from '@/lib/api'

interface Activity {
  id: string
  entityType: string
  entityId: string
  userId: string
  action: string
  metadata?: any
  createdAt: string
}

interface ActivityDrawerProps {
  isOpen: boolean
  onClose: () => void
  entityType: 'OBJECTIVE' | 'KEY_RESULT'
  entityId: string | null
  entityTitle?: string
  availableUsers: Array<{ id: string; name: string | null; email: string }>
}

const PAGE_SIZE = 20
const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'CREATED', label: 'Created' },
  { value: 'UPDATED', label: 'Updated' },
  { value: 'DELETED', label: 'Deleted' },
  { value: 'CHECK_IN', label: 'Check-ins' },
]

export function ActivityDrawer({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
  availableUsers,
}: ActivityDrawerProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [userIdFilter, setUserIdFilter] = useState<string>('all')
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (isOpen && entityId) {
      // Reset filters and pagination when drawer opens
      setCurrentPage(0)
      setActionFilter('all')
      setUserIdFilter('all')
      loadActivities(0, 'all', 'all')
    } else {
      setActivities([])
      setError(null)
      setCurrentPage(0)
      setHasMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entityId, entityType])

  useEffect(() => {
    // Reload when filters change (reset to page 0)
    if (isOpen && entityId) {
      setCurrentPage(0)
      loadActivities(0, actionFilter, userIdFilter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, userIdFilter])

  const loadActivities = async (page: number, action: string, userId: string) => {
    if (!entityId) return

    setLoading(true)
    setError(null)

    try {
      const endpoint =
        entityType === 'OBJECTIVE'
          ? `/objectives/${entityId}/activity`
          : `/key-results/${entityId}/activity`

      const params: Record<string, string> = {
        limit: PAGE_SIZE.toString(),
        offset: (page * PAGE_SIZE).toString(),
      }

      if (action !== 'all') {
        params.action = action
      }

      if (userId !== 'all') {
        params.userId = userId
      }

      const response = await api.get(endpoint, { params })
      const data = response.data || []
      
      setActivities(data)
      // If we got a full page, there might be more
      setHasMore(data.length === PAGE_SIZE)
    } catch (err: any) {
      console.error('Failed to load activity:', err)
      if (err.response?.status === 403) {
        setError("You don't have access to this audit trail")
      } else {
        setError('Failed to load activity history')
      }
      setActivities([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 0) return
    setCurrentPage(newPage)
    loadActivities(newPage, actionFilter, userIdFilter)
  }

  const handleFilterChange = (newActionFilter: string, newUserIdFilter: string) => {
    setActionFilter(newActionFilter)
    setUserIdFilter(newUserIdFilter)
  }

  const clearFilters = () => {
    setActionFilter('all')
    setUserIdFilter('all')
  }

  const hasActiveFilters = actionFilter !== 'all' || userIdFilter !== 'all'

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      })
    }
  }

  const formatActionSummary = (activity: Activity) => {
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
              `Progress ${metadata.before.progress?.toFixed(0) || 0}% → ${metadata.after.progress?.toFixed(0) || 0}%`
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
                `Value ${metadata.before.currentValue} → ${metadata.after.currentValue}`
              )
            }
          }
          if (metadata.before.targetValue !== undefined && metadata.after.targetValue !== undefined) {
            if (metadata.before.targetValue !== metadata.after.targetValue) {
              changes.push(
                `Target ${metadata.before.targetValue} → ${metadata.after.targetValue}`
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
          return `Check-in: value ${metadata.checkIn.value}, confidence ${metadata.checkIn.confidence}/5`
        }
        return 'Check-in recorded'
      default:
        return action
    }
  }

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'CREATED':
        return 'default'
      case 'UPDATED':
        return 'secondary'
      case 'DELETED':
        return 'destructive'
      case 'CHECK_IN':
        return 'outline'
      default:
        return 'outline'
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Activity Timeline</SheetTitle>
          <SheetDescription>
            {entityTitle || `${entityType} history`}
          </SheetDescription>
        </SheetHeader>

        {/* Filters */}
        <div className="mt-6 space-y-3 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filters</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Action</label>
              <Select value={actionFilter} onValueChange={(value) => handleFilterChange(value, userIdFilter)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Actor</label>
              <Select value={userIdFilter} onValueChange={(value) => handleFilterChange(actionFilter, value)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto mt-4">
          {loading && currentPage === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Loading activity...
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-2">{error}</p>
              <p className="text-sm text-slate-500">
                Please check your permissions or try again later.
              </p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {hasActiveFilters
                ? 'No activity matches your filters'
                : 'No activity recorded yet'}
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, idx) => {
                const actor = availableUsers.find((u) => u.id === activity.userId)
                const actorName = actor?.name || actor?.email || 'Unknown User'

                return (
                  <div
                    key={activity.id || idx}
                    className="flex gap-4 pb-4 border-b last:border-0"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={getActionBadgeVariant(activity.action)}
                          className="text-xs"
                        >
                          {activity.action}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {formatTimeAgo(activity.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-1">
                        {formatActionSummary(activity)}
                      </p>
                      <p className="text-xs text-slate-600">
                        by {actorName}
                      </p>
                      {activity.metadata?.note && (
                        <p className="text-xs text-slate-500 mt-1 italic">
                          {activity.metadata.note}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {!error && activities.length > 0 && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div className="text-xs text-slate-600">
              Page {currentPage + 1}
              {hasMore && ' (more available)'}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0 || loading}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasMore || loading}
                className="h-8"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

