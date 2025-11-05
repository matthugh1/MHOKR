'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { track } from '@/lib/analytics'
import { GovernanceStatusSkeleton } from '@/components/ui/skeletons'

interface GovernanceStatusBarProps {
  cycleId: string
  scope: 'my' | 'team-workspace' | 'tenant'
}

interface CycleSummary {
  cycleId: string
  objectives: { total: number; published: number; draft: number }
  krs: { total: number; onTrack: number; atRisk: number; blocked: number; completed: number }
  checkins: { upcoming7d: number; overdue: number; recent24h: number }
}

export function GovernanceStatusBar({ cycleId, scope }: GovernanceStatusBarProps) {
  const [summary, setSummary] = useState<CycleSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [telemetryFired, setTelemetryFired] = useState(false)

  useEffect(() => {
    if (!cycleId) {
      setSummary(null)
      return
    }

    const fetchSummary = async () => {
      setLoading(true)
      setError(null)
      try {
        // Backend respects visibility automatically; scope param is optional for future use
        const response = await api.get(`/okr/insights/cycle-summary?cycleId=${cycleId}&scope=${scope}`)
        setSummary(response.data)
        
        // Fire telemetry once per mount
        if (!telemetryFired) {
          track('governance_status_viewed', {
            cycle_id: cycleId,
            scope,
            ts: new Date().toISOString(),
          })
          setTelemetryFired(true)
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load governance status')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [cycleId, scope, telemetryFired])

  if (!cycleId) {
    return null
  }

  if (loading) {
    return <GovernanceStatusSkeleton />
  }

  if (error || !summary) {
    return (
      <div className="mb-4 px-4 py-2 text-xs text-muted-foreground" data-testid="gov-status-bar">
        Unable to load governance status
      </div>
    )
  }

  return (
    <div 
      className="mb-4 px-4 py-2 bg-muted/30 rounded-md border border-border flex items-center gap-3 flex-wrap" 
      role="region" 
      aria-label="Governance status summary"
      data-testid="gov-status-bar"
    >
      <span className="text-xs font-medium text-muted-foreground">Governance:</span>
      
      {/* Published vs Draft */}
      <div className="flex items-center gap-1">
        {summary.objectives.published > 0 && (
          <Badge variant="outline" className="text-xs" aria-label={`${summary.objectives.published} published objectives`}>
            {summary.objectives.published} Published
          </Badge>
        )}
        {summary.objectives.draft > 0 && (
          <Badge variant="outline" className="text-xs" aria-label={`${summary.objectives.draft} draft objectives`}>
            {summary.objectives.draft} Draft
          </Badge>
        )}
      </div>

      {/* At Risk / Off Track */}
      {(summary.krs.atRisk > 0 || summary.krs.blocked > 0) && (
        <div className="flex items-center gap-1">
          {summary.krs.atRisk > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600" aria-label={`${summary.krs.atRisk} key results at risk`}>
              {summary.krs.atRisk} At Risk
            </Badge>
          )}
          {summary.krs.blocked > 0 && (
            <Badge variant="outline" className="text-xs text-rose-600" aria-label={`${summary.krs.blocked} key results blocked`}>
              {summary.krs.blocked} Off Track
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

