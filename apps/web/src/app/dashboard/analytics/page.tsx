'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import api from '@/lib/api'
import { useWorkspace } from '@/contexts/workspace.context'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'

interface AnalyticsSummary {
  totalObjectives: number
  byStatus: { [status: string]: number }
  atRiskRatio: number
}

interface CheckInFeedItem {
  id: string
  krId: string
  krTitle: string
  userId: string
  userName: string | null
  value: number
  confidence: number
  createdAt: string
}

interface OverdueCheckInItem {
  krId: string
  krTitle: string
  objectiveId: string
  objectiveTitle: string
  ownerId: string
  ownerName: string | null
  ownerEmail: string
  lastCheckInAt: string | null
  daysLate: number
  cadence: string | null
}

interface PillarCoverageItem {
  pillarId: string
  pillarName: string
  objectiveCountInActiveCycle: number
}

export default function AnalyticsPage() {
  const { currentOrganization } = useWorkspace()
  const { canExportData } = useTenantPermissions()
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [feed, setFeed] = useState<CheckInFeedItem[]>([])
  const [overdue, setOverdue] = useState<OverdueCheckInItem[]>([])
  const [pillarCoverage, setPillarCoverage] = useState<PillarCoverageItem[]>([])
  const [activeCycles, setActiveCycles] = useState<Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    organizationId: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // TODO [phase6-polish]: replace with proper skeleton loaders
        const [summaryRes, feedRes, overdueRes, coverageRes, cyclesRes] = await Promise.allSettled([
          api.get('/reports/analytics/summary').catch(() => ({ data: { totalObjectives: 0, byStatus: {}, atRiskRatio: 0 } })),
          api.get('/reports/analytics/feed').catch(() => ({ data: [] })),
          api.get('/reports/check-ins/overdue').catch(() => ({ data: [] })),
          api.get('/reports/pillars/coverage').catch(() => ({ data: [] })),
          api.get('/reports/cycles/active').catch(() => ({ data: [] })),
        ])

        // Extract data safely, fallback to empty defaults
        setSummary(
          summaryRes.status === 'fulfilled' && summaryRes.value?.data
            ? summaryRes.value.data
            : { totalObjectives: 0, byStatus: {}, atRiskRatio: 0 }
        )
        setFeed(
          feedRes.status === 'fulfilled' && Array.isArray(feedRes.value?.data)
            ? feedRes.value.data
            : []
        )
        setOverdue(
          overdueRes.status === 'fulfilled' && Array.isArray(overdueRes.value?.data)
            ? overdueRes.value.data
            : []
        )
        setPillarCoverage(
          coverageRes.status === 'fulfilled' && Array.isArray(coverageRes.value?.data)
            ? coverageRes.value.data
            : []
        )
        setActiveCycles(
          cyclesRes.status === 'fulfilled' && Array.isArray(cyclesRes.value?.data)
            ? cyclesRes.value.data
            : []
        )
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
        // Set empty state on error - page should still render
        setSummary({
          totalObjectives: 0,
          byStatus: {},
          atRiskRatio: 0,
        })
        setFeed([])
        setOverdue([])
        setPillarCoverage([])
        setActiveCycles([])
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [currentOrganization?.id])

  // TODO [phase7-performance]: lift this into a shared util if we reuse it
  function safePercent(numerator: number, denominator: number): number {
    if (!denominator || denominator <= 0) return 0
    if (!numerator || numerator < 0) return 0
    return Math.round((numerator / denominator) * 100)
  }

  const onTrackCount = summary?.byStatus?.['ON_TRACK'] || 0
  const atRiskCount = summary?.byStatus?.['AT_RISK'] || 0
  const offTrackCount = summary?.byStatus?.['OFF_TRACK'] || 0
  const completedCount = summary?.byStatus?.['COMPLETED'] || 0
  const totalObjectives = summary?.totalObjectives || 0

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
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    }
  }

  const handleExportCSV = async () => {
    // This endpoint is tenant-scoped and already RBAC-protected server-side
    // TODO [phase7-hardening]: align this with backend export permissions dynamically per-tenant, not just role check.
    try {
      setExporting(true)
      setExportError(null)
      const response = await api.get('/reports/export/csv', {
        responseType: 'blob',
      })
      
      // Create blob and trigger download
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `okr-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error: unknown) {
      console.error('Failed to export CSV:', error)
      let errorMessage = 'Failed to export CSV'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string } } }).response
        if (response?.data?.message) {
          errorMessage = response.data.message
        }
      }
      setExportError(errorMessage)
      // TODO [phase6-polish]: turn this into toast
    } finally {
      setExporting(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <PageHeader
                  title={
                    activeCycles.length > 0
                      ? `${activeCycles[0].name} Execution Health`
                      : 'Execution Health'
                  }
                  subtitle="Live performance for your organisation"
                  badges={[
                    ...(activeCycles.length > 0
                      ? [
                          {
                            label: `Active Cycle: ${activeCycles[0].name}`,
                            tone: 'neutral' as const,
                          },
                        ]
                      : []),
                    ...(activeCycles.some((c) => c.status === 'LOCKED')
                      ? [{ label: 'Locked', tone: 'warning' as const }]
                      : []),
                    ...(atRiskCount > 0
                      ? [{ label: `${atRiskCount} At Risk`, tone: 'warning' as const }]
                      : []),
                    { label: `${totalObjectives} Objectives`, tone: 'neutral' as const },
                    ...(completedCount > 0
                      ? [{ label: `${completedCount} Completed`, tone: 'success' as const }]
                      : []),
                  ]}
                />
              </div>
              {/* TODO [phase7-hardening]: canExportData() must stay aligned with backend RBACService.canExportData() */}
              {canExportData() && (
                <div className="flex flex-col items-end gap-2">
                  <Button
                    onClick={handleExportCSV}
                    disabled={exporting || loading}
                    variant="outline"
                    className="shrink-0"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? 'Exporting...' : 'Export CSV'}
                  </Button>
                  {exportError && (
                    <div className="text-xs text-red-500">
                      {exportError}
                      {/* TODO [phase6-polish]: turn this into toast */}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Loading analytics...</p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  label="Total Objectives"
                  value={totalObjectives.toString()}
                  hint={`${onTrackCount} on track`}
                />
                <StatCard
                  label="Completion Rate"
                  value={`${safePercent(completedCount, totalObjectives)}%`}
                  hint={`${completedCount} of ${totalObjectives} completed`}
                  tone={completedCount > 0 ? 'success' : 'default'}
                />
                <StatCard
                  label="At Risk OKRs"
                  value={atRiskCount.toString()}
                  hint={`${safePercent(atRiskCount, totalObjectives)}% of active OKRs`}
                  tone={atRiskCount > 0 ? 'warning' : 'default'}
                />
                <StatCard
                  label="Status Breakdown"
                  value={`${onTrackCount} / ${atRiskCount} / ${offTrackCount}`}
                  hint="On Track / At Risk / Off Track"
                />
              </div>

              {/* Strategic Coverage */}
              <div className="grid grid-cols-1 gap-6 mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Strategic Coverage</CardTitle>
                    <CardDescription>Pillar coverage in active cycle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pillarCoverage.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No strategic pillars defined or no active cycle
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pillarCoverage.map((pillar) => (
                          <div
                            key={pillar.pillarId}
                            className="flex items-center justify-between pb-3 border-b last:border-0"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">
                                {pillar.pillarName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {pillar.objectiveCountInActiveCycle === 0 ? (
                                <span className="text-xs font-medium text-red-600">
                                  No active OKRs this cycle
                                </span>
                              ) : (
                                <span className="text-sm text-slate-600">
                                  {pillar.objectiveCountInActiveCycle} OKR{pillar.objectiveCountInActiveCycle !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Overdue Check-ins */}
              <div className="grid grid-cols-1 gap-6 mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Overdue Check-ins</CardTitle>
                    <CardDescription>Key Results overdue for check-in</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {overdue.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        All KRs are up to date ✅
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-sm font-medium text-slate-700 mb-2">
                          {overdue.length} Key Result{overdue.length !== 1 ? 's' : ''} overdue
                        </div>
                        {overdue.slice(0, 5).map((item) => (
                          <div key={item.krId} className="flex items-start gap-4 pb-4 border-b last:border-0">
                            <div className="w-2 h-2 rounded-full mt-2 bg-red-500" />
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-medium">{item.krTitle}</span>
                              </p>
                              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                                <span>Owner: {item.ownerName || item.ownerEmail}</span>
                                <span>•</span>
                                <span className="text-red-600 font-medium">{item.daysLate}d late</span>
                                {item.lastCheckInAt && (
                                  <>
                                    <span>•</span>
                                    <span>Last check-in: {formatTimeAgo(item.lastCheckInAt)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {overdue.length > 5 && (
                          <div className="text-xs text-slate-500 text-center pt-2">
                            And {overdue.length - 5} more...
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity Feed */}
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest check-ins across all Key Results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {feed.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No recent check-ins
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {feed.map((item) => (
                          <div key={item.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                            <div className="w-2 h-2 rounded-full mt-2 bg-blue-500" />
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-medium">{item.userName || 'Unknown User'}</span>{' '}
                                <span className="text-slate-600">checked in</span>{' '}
                                <span className="font-medium">{item.krTitle}</span>
                              </p>
                              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                                <span>Value: {item.value}</span>
                                <span>•</span>
                                <span>Confidence: {item.confidence}%</span>
                                <span>•</span>
                                <span>{formatTimeAgo(item.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}



