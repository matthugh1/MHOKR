'use client'

import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { CycleHealthSkeleton } from '@/components/ui/skeletons'

interface CycleHealthSummary {
  cycleId: string
  objectives: { total: number; published: number; draft: number }
  krs: { total: number; onTrack: number; atRisk: number; blocked: number; completed: number }
  checkins: { upcoming7d: number; overdue: number; recent24h: number }
}

interface CycleHealthStripProps {
  cycleId: string | null
  onFilterClick?: (filterType: 'objectives' | 'krs' | 'checkins', value?: string) => void
}

export function CycleHealthStrip({ cycleId, onFilterClick }: CycleHealthStripProps) {
  const { user } = useAuth()
  const [summary, setSummary] = useState<CycleHealthSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cycleId) {
      setSummary(null)
      return
    }

    const fetchSummary = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get(`/okr/insights/cycle-summary?cycleId=${cycleId}`)
        setSummary(response.data)
        
        // Track telemetry
        console.log('[Telemetry] okr.insights.cycle.open', {
          userId: user?.id,
          cycleId,
          timestamp: new Date().toISOString(),
        })
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load cycle health')
        console.error('[Cycle Health Strip] Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [cycleId, user?.id])

  if (!cycleId || loading) {
    return <CycleHealthSkeleton />
  }

  if (error || !summary) {
    return null
  }

  const handleChipClick = (filterType: 'objectives' | 'krs' | 'checkins', value?: string) => {
    if (onFilterClick) {
      onFilterClick(filterType, value)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-md border border-border" role="region" aria-label="Cycle health summary">
      <span className="text-xs font-medium text-muted-foreground">Cycle health:</span>
      
      {/* Objectives */}
      <div className="flex items-center gap-1">
        <Badge
          variant="outline"
          className={cn(
            'cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none',
            summary.objectives.total > 0 && 'hover:ring-1 hover:ring-ring'
          )}
          onClick={() => handleChipClick('objectives')}
          role="button"
          tabIndex={0}
          aria-label={`${summary.objectives.total} objectives`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleChipClick('objectives')
            }
          }}
        >
          <span className="text-xs font-medium">{summary.objectives.total}</span>
          <span className="text-xs text-muted-foreground ml-1">Objectives</span>
        </Badge>
        {summary.objectives.published > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none text-xs"
            onClick={() => handleChipClick('objectives', 'published')}
            role="button"
            tabIndex={0}
            aria-label={`${summary.objectives.published} published objectives`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleChipClick('objectives', 'published')
              }
            }}
          >
            {summary.objectives.published} published
          </Badge>
        )}
        {summary.objectives.draft > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none text-xs"
            onClick={() => handleChipClick('objectives', 'draft')}
            role="button"
            tabIndex={0}
            aria-label={`${summary.objectives.draft} draft objectives`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleChipClick('objectives', 'draft')
              }
            }}
          >
            {summary.objectives.draft} draft
          </Badge>
        )}
      </div>

      {/* KRs */}
      <div className="flex items-center gap-1">
        <Badge
          variant="outline"
          className={cn(
            'cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none',
            summary.krs.total > 0 && 'hover:ring-1 hover:ring-ring'
          )}
          onClick={() => handleChipClick('krs')}
          role="button"
          tabIndex={0}
          aria-label={`${summary.krs.total} key results`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleChipClick('krs')
            }
          }}
        >
          <span className="text-xs font-medium">{summary.krs.total}</span>
          <span className="text-xs text-muted-foreground ml-1">KRs</span>
        </Badge>
        {summary.krs.onTrack > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none text-xs text-emerald-600"
            onClick={() => handleChipClick('krs', 'onTrack')}
            role="button"
            tabIndex={0}
            aria-label={`${summary.krs.onTrack} key results on track`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleChipClick('krs', 'onTrack')
              }
            }}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {summary.krs.onTrack} on track
          </Badge>
        )}
        {summary.krs.atRisk > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none text-xs text-amber-600"
            onClick={() => handleChipClick('krs', 'atRisk')}
            role="button"
            tabIndex={0}
            aria-label={`${summary.krs.atRisk} key results at risk`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleChipClick('krs', 'atRisk')
              }
            }}
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            {summary.krs.atRisk} at risk
          </Badge>
        )}
        {summary.krs.blocked > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none text-xs text-rose-600"
            onClick={() => handleChipClick('krs', 'blocked')}
            role="button"
            tabIndex={0}
            aria-label={`${summary.krs.blocked} key results blocked`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleChipClick('krs', 'blocked')
              }
            }}
          >
            <XCircle className="w-3 h-3 mr-1" />
            {summary.krs.blocked} blocked
          </Badge>
        )}
      </div>

      {/* Check-ins */}
      <div className="flex items-center gap-1">
        <Badge
          variant="outline"
          className={cn(
            'cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none',
            (summary.checkins.upcoming7d > 0 || summary.checkins.overdue > 0) && 'hover:ring-1 hover:ring-ring'
          )}
          onClick={() => handleChipClick('checkins')}
          role="button"
          tabIndex={0}
          aria-label={`${summary.checkins.upcoming7d + summary.checkins.overdue} check-ins`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleChipClick('checkins')
            }
          }}
        >
          <span className="text-xs font-medium">
            {summary.checkins.upcoming7d + summary.checkins.overdue}
          </span>
          <span className="text-xs text-muted-foreground ml-1">check-ins</span>
        </Badge>
        {summary.checkins.overdue > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none text-xs text-rose-600"
            onClick={() => handleChipClick('checkins', 'overdue')}
            role="button"
            tabIndex={0}
            aria-label={`${summary.checkins.overdue} overdue check-ins`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleChipClick('checkins', 'overdue')
              }
            }}
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            {summary.checkins.overdue} overdue
          </Badge>
        )}
        {summary.checkins.upcoming7d > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none text-xs text-amber-600"
            onClick={() => handleChipClick('checkins', 'upcoming')}
            role="button"
            tabIndex={0}
            aria-label={`${summary.checkins.upcoming7d} upcoming check-ins`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleChipClick('checkins', 'upcoming')
              }
            }}
          >
            <Clock className="w-3 h-3 mr-1" />
            {summary.checkins.upcoming7d} upcoming
          </Badge>
        )}
      </div>
    </div>
  )
}

