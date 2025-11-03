'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { ArrowUp, ArrowDown, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import { useRowVisibilityObserver } from '@/hooks/useRowVisibilityObserver'
import { InlineInsightSkeleton } from '@/components/ui/skeletons'
import { useUxTiming } from '@/hooks/useUxTiming'

interface ObjectiveInsights {
  objectiveId: string
  statusTrend: 'IMPROVING' | 'DECLINING' | 'FLAT' | 'UNKNOWN'
  lastUpdateAgeHours: number
  krs: { onTrack: number; atRisk: number; blocked: number; completed: number }
  upcomingCheckins: number
  overdueCheckins: number
}

interface InlineInsightBarProps {
  objectiveId: string
  isVisible: boolean
  onCheckInClick?: (krId: string) => void
}

export function InlineInsightBar({ objectiveId, isVisible, onCheckInClick }: InlineInsightBarProps) {
  const { user } = useAuth()
  const [insights, setInsights] = useState<ObjectiveInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { observe } = useRowVisibilityObserver({ rootMargin: '200px', threshold: 0.1 })
  const timing = useUxTiming('okr.insights.objective.loaded')

  useEffect(() => {
    if (!isVisible || !objectiveId) {
      return
    }

    // Use shared IntersectionObserver to lazy load when visible
    if (containerRef.current) {
      const cleanup = observe(containerRef.current, (isIntersecting) => {
        if (isIntersecting && !insights && !loading) {
          fetchInsights()
        }
      })

      return cleanup
    }
  }, [isVisible, objectiveId, observe, insights, loading])

  const fetchInsights = async () => {
    if (loading || insights) return

    setLoading(true)
    setError(null)
    timing.start()
    
    try {
      const response = await api.get(`/okr/insights/objective/${objectiveId}`)
      setInsights(response.data)
      
      const loadTimeMs = timing.end()
      
      // Track telemetry with timing
      console.log('[Telemetry] okr.insights.objective.loaded', {
        userId: user?.id,
        objectiveId,
        loadTimeMs,
        timestamp: new Date().toISOString(),
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load insights')
      console.error('[Inline Insight Bar] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isVisible) {
    return null
  }

  if (loading) {
    return <InlineInsightSkeleton />
  }

  if (error || !insights) {
    return null
  }

  const getStatusTrendIcon = () => {
    switch (insights?.statusTrend) {
      case 'IMPROVING':
        return <ArrowUp className="w-3 h-3 text-emerald-600" />
      case 'DECLINING':
        return <ArrowDown className="w-3 h-3 text-rose-600" />
      case 'FLAT':
        return <ArrowRight className="w-3 h-3 text-muted-foreground" />
      default:
        return null
    }
  }

  const formatLastUpdate = (hours: number) => {
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div ref={containerRef} className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-xs" role="status" aria-label="Objective insights">
      {/* Status Trend */}
      {insights.statusTrend !== 'UNKNOWN' && (
        <div className="flex items-center gap-1" aria-label={`Status trend: ${insights.statusTrend.toLowerCase()}`}>
          {getStatusTrendIcon()}
        </div>
      )}

      {/* Last Update */}
      <span className="text-muted-foreground">
        Updated {formatLastUpdate(insights.lastUpdateAgeHours)}
      </span>

      {/* KR Roll-ups */}
      {(insights.krs.onTrack > 0 || insights.krs.atRisk > 0 || insights.krs.blocked > 0 || insights.krs.completed > 0) && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">KRs:</span>
          {insights.krs.onTrack > 0 && (
            <Badge variant="outline" className="text-xs px-1 py-0 text-emerald-600" role="status" aria-label={`${insights.krs.onTrack} key results on track`}>
              {insights.krs.onTrack} on track
            </Badge>
          )}
          {insights.krs.atRisk > 0 && (
            <Badge variant="outline" className="text-xs px-1 py-0 text-amber-600" role="status" aria-label={`${insights.krs.atRisk} key results at risk`}>
              {insights.krs.atRisk} at risk
            </Badge>
          )}
          {insights.krs.blocked > 0 && (
            <Badge variant="outline" className="text-xs px-1 py-0 text-rose-600" role="status" aria-label={`${insights.krs.blocked} key results blocked`}>
              {insights.krs.blocked} blocked
            </Badge>
          )}
          {insights.krs.completed > 0 && (
            <Badge variant="outline" className="text-xs px-1 py-0 text-neutral-600" role="status" aria-label={`${insights.krs.completed} key results completed`}>
              {insights.krs.completed} completed
            </Badge>
          )}
        </div>
      )}

      {/* Check-in Badges */}
      {insights.overdueCheckins > 0 && (
        <Badge
          variant="outline"
          className="text-xs px-1 py-0 text-rose-600 cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none"
          onClick={() => {
            if (onCheckInClick) {
              console.log('[Inline Insight] Overdue check-ins clicked')
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${insights.overdueCheckins} overdue check-ins`}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onCheckInClick) {
              e.preventDefault()
              onCheckInClick(objectiveId)
            }
          }}
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          {insights.overdueCheckins} overdue
        </Badge>
      )}
      {insights.upcomingCheckins > 0 && (
        <Badge variant="outline" className="text-xs px-1 py-0 text-amber-600" role="status" aria-label={`${insights.upcomingCheckins} upcoming check-ins`}>
          <Clock className="w-3 h-3 mr-1" />
          {insights.upcomingCheckins} upcoming
        </Badge>
      )}
    </div>
  )
}

