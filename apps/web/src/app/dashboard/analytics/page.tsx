'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Download } from 'lucide-react'
import api from '@/lib/api'
import { useWorkspace } from '@/contexts/workspace.context'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import type { ReactNode } from 'react'

// TODO [phase6-polish]: unify StatCard styling across dashboard pages
interface StatCardProps {
  title: string
  value: string | number | ReactNode
  subtitle?: string
}

function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="text-2xl font-semibold text-neutral-900">{value}</div>
      {subtitle && (
        <div className="text-[11px] text-neutral-500 mt-1">{subtitle}</div>
      )}
    </div>
  )
}

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
            </div>
          </div>

          {/* CSV Export Button */}
          {/* TODO [phase7-hardening]: canExportData() must stay aligned with backend RBACService.canExportData() */}
          {canExportData() && (
            <div className="flex justify-end mb-4">
              <div className="flex flex-col items-end">
                <button
                  onClick={handleExportCSV}
                  disabled={exporting || loading}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-3 w-3 inline mr-1.5" />
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </button>
                {exportError && (
                  <div className="text-[11px] text-red-500 mt-1">
                    {exportError}
                    {/* TODO [phase6-polish]: turn into toast */}
                  </div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Loading analytics...</p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <StatCard
                  title="Total Objectives"
                  value={totalObjectives > 0 ? totalObjectives : '—'}
                  subtitle={totalObjectives > 0 ? `${onTrackCount} on track` : undefined}
                />
                <StatCard
                  title="% On Track"
                  value={`${safePercent(onTrackCount, totalObjectives)}%`}
                  subtitle={totalObjectives > 0 ? `${onTrackCount} of ${totalObjectives}` : undefined}
                />
                <StatCard
                  title="% At Risk"
                  value={`${safePercent(atRiskCount, totalObjectives)}%`}
                  subtitle={totalObjectives > 0 ? `${atRiskCount} objective${atRiskCount !== 1 ? 's' : ''}` : undefined}
                />
                <StatCard
                  title="Overdue Check-ins"
                  value={overdue.length > 0 ? overdue.length : '—'}
                  subtitle={overdue.length > 0 ? `${overdue.length} key result${overdue.length !== 1 ? 's' : ''} overdue` : undefined}
                />
              </div>

              {/* Strategic Coverage */}
              {/* TODO [phase6-polish]: extract SectionHeader into shared component if reused 3+ times */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-neutral-900">
                    Strategic Coverage
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Pillar coverage in active cycle
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  {pillarCoverage.length === 0 ? (
                    <div className="text-sm text-neutral-500 text-center py-6">
                      No strategic pillars defined or no active cycle
                      {/* TODO [phase6-polish]: add subtle icon/illustration */}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pillarCoverage.map((pillar) => (
                        <div
                          key={pillar.pillarId}
                          className="flex items-center justify-between pb-3 border-b border-neutral-100 last:border-0"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-neutral-900">
                              {pillar.pillarName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {pillar.objectiveCountInActiveCycle === 0 ? (
                              <span className="text-xs font-medium text-red-600">
                                No active OKRs this cycle
                              </span>
                            ) : (
                              <span className="text-sm text-neutral-600">
                                {pillar.objectiveCountInActiveCycle} OKR{pillar.objectiveCountInActiveCycle !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Risk */}
              {/* TODO [phase6-polish]: extract SectionHeader into shared component if reused 3+ times */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-neutral-900">
                    Execution Risk
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Key Results overdue for check-in
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  {overdue.length === 0 ? (
                    <div className="text-sm text-neutral-500 text-center py-6">
                      No overdue check-ins
                      {/* TODO [phase6-polish]: add subtle icon/illustration */}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {overdue.slice(0, 5).map((item) => (
                        <div key={item.krId} className="flex items-start gap-4 pb-4 border-b border-neutral-100 last:border-0">
                          <div className="w-2 h-2 rounded-full mt-2 bg-red-500" />
                          <div className="flex-1">
                            <p className="text-sm text-neutral-900">
                              <span className="font-medium">{item.krTitle}</span>
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
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
                        <div className="text-xs text-neutral-500 text-center pt-2">
                          And {overdue.length - 5} more...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity Feed */}
              {/* TODO [phase6-polish]: extract SectionHeader into shared component if reused 3+ times */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-neutral-900">
                    Recent Activity
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Last 10 check-ins
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  {feed.length === 0 ? (
                    <div className="text-sm text-neutral-500 text-center py-6">
                      No recent activity.
                      {/* TODO [phase6-polish]: add subtle icon/illustration */}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {feed.map((item) => (
                        <div key={item.id} className="flex items-start gap-4 pb-4 border-b border-neutral-100 last:border-0">
                          <div className="w-2 h-2 rounded-full mt-2 bg-blue-500" />
                          <div className="flex-1">
                            <p className="text-sm text-neutral-900">
                              <span className="font-medium">{item.userName || 'Unknown User'}</span>{' '}
                              <span className="text-neutral-600">checked in</span>{' '}
                              <span className="font-medium">{item.krTitle}</span>
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
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
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}



