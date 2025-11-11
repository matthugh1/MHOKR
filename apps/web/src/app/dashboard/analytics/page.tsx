'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
import { StatCard } from '@/components/ui/StatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
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
  owner: {
    id: string
    name: string | null
  }
  cadence: string | null
  lastCheckInAt: string | null
  daysOverdue: number
  status: 'DUE' | 'OVERDUE'
}

interface PillarCoverageItem {
  pillarId: string
  pillarName: string
  objectiveCountInActiveCycle: number
}

interface HealthHeatmapData {
  buckets: Array<{
    dimensionId: string
    dimensionName: string
    status: string
    count: number
  }>
  totals: Array<{
    dimensionId: string
    dimensionName: string
    total: number
  }>
}

interface AtRiskItem {
  entityType: 'OBJECTIVE' | 'KEY_RESULT'
  id: string
  title: string
  owner: {
    id: string
    name: string | null
  }
  status: string
  confidence: number | null
  lastUpdatedAt: string
  dimensionRefs: {
    objectiveId?: string
    objectiveTitle?: string
    teamId?: string
    teamName?: string | null
    pillarId?: string
    pillarName?: string | null
    cycleId?: string
    cycleName?: string | null
  }
}

interface CycleHealthData {
  totalsByStatus: {
    ON_TRACK: number
    AT_RISK: number
    OFF_TRACK: number
    BLOCKED: number
    COMPLETED: number
    CANCELLED: number
  }
  avgConfidence: number | null
  coverage: {
    objectivesWith2PlusKRsPct: number
    krsWithRecentCheckInPct: number
  }
}

export default function AnalyticsPage() {
  const { currentOrganization } = useWorkspace()
  const { canExportData } = useTenantPermissions()
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [feed, setFeed] = useState<CheckInFeedItem[]>([])
  const [overdue, setOverdue] = useState<OverdueCheckInItem[]>([])
  const [overduePeriod, setOverduePeriod] = useState<'7' | '14' | '30' | 'all'>('all')
  const [pillarCoverage, setPillarCoverage] = useState<PillarCoverageItem[]>([])
  const [activeCycles, setActiveCycles] = useState<Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    tenantId: string
  }>>([])
  const [healthHeatmap, setHealthHeatmap] = useState<HealthHeatmapData | null>(null)
  const [heatmapBy, setHeatmapBy] = useState<'team' | 'pillar'>('team')
  const [atRiskItems, setAtRiskItems] = useState<AtRiskItem[]>([])
  const [cycleHealth, setCycleHealth] = useState<CycleHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setFetchError(null)
        // TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
        const overdueParams = new URLSearchParams()
        if (overduePeriod !== 'all') {
          // Calculate cutoff date based on period
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - parseInt(overduePeriod))
          // Note: Backend doesn't support date filtering yet, so we'll filter client-side
        }
        
        const [summaryRes, feedRes, overdueRes, coverageRes, cyclesRes] = await Promise.allSettled([
          api.get('/reports/analytics/summary'),
          api.get('/reports/analytics/feed'),
          api.get(`/reports/check-ins/overdue?${overdueParams.toString()}`),
          api.get('/reports/pillars/coverage'),
          api.get('/reports/cycles/active'),
        ])

        // Fetch health heatmap
        const activeCycleId = cyclesRes.status === 'fulfilled' && Array.isArray(cyclesRes.value?.data) && cyclesRes.value.data.length > 0
          ? cyclesRes.value.data[0].id
          : undefined
        const heatmapParams = new URLSearchParams()
        heatmapParams.append('by', heatmapBy)
        if (activeCycleId) {
          heatmapParams.append('cycleId', activeCycleId)
        }
        
        const heatmapRes = await Promise.allSettled([
          api.get(`/reports/health-heatmap?${heatmapParams.toString()}`),
        ])

        // Fetch at-risk items
        const atRiskParams = new URLSearchParams()
        if (activeCycleId) {
          atRiskParams.append('cycleId', activeCycleId)
        }
        
        const atRiskRes = await Promise.allSettled([
          api.get(`/reports/at-risk?${atRiskParams.toString()}`),
        ])

        // Fetch cycle health if we have an active cycle
        const cycleHealthRes = activeCycleId
          ? await Promise.allSettled([
              api.get(`/reports/cycle-health?cycleId=${activeCycleId}`),
            ])
          : []

        // Extract data safely, handle errors per endpoint
        if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
          setSummary(summaryRes.value.data)
        } else {
          const error = summaryRes.status === 'rejected' ? summaryRes.reason : null
          if (error?.response?.status === 403) {
            setFetchError('You do not have permission to view analytics')
          } else if (error?.response?.status !== 401) {
            // 401 is handled by interceptor, don't show error
            setFetchError('Failed to load analytics summary')
          }
          setSummary({ totalObjectives: 0, byStatus: {}, atRiskRatio: 0 })
        }

        if (feedRes.status === 'fulfilled' && Array.isArray(feedRes.value?.data)) {
          setFeed(feedRes.value.data)
        } else {
          setFeed([])
        }
        
        // Filter overdue by period if needed
        let overdueData: OverdueCheckInItem[] = []
        if (overdueRes.status === 'fulfilled' && Array.isArray(overdueRes.value?.data)) {
          overdueData = overdueRes.value.data
        }
        
        if (overduePeriod !== 'all' && overdueData.length > 0) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - parseInt(overduePeriod))
          overdueData = overdueData.filter((item: OverdueCheckInItem) => {
            if (!item.lastCheckInAt) return true // Include items with no check-in
            const lastCheckIn = new Date(item.lastCheckInAt)
            return lastCheckIn <= cutoffDate
          })
        }
        
        setOverdue(overdueData)
        
        if (coverageRes.status === 'fulfilled' && Array.isArray(coverageRes.value?.data)) {
          setPillarCoverage(coverageRes.value.data)
        } else {
          setPillarCoverage([])
        }
        
        if (cyclesRes.status === 'fulfilled' && Array.isArray(cyclesRes.value?.data)) {
          setActiveCycles(cyclesRes.value.data)
        } else {
          setActiveCycles([])
        }

        // Set health heatmap data
        if (heatmapRes[0].status === 'fulfilled' && heatmapRes[0].value?.data) {
          setHealthHeatmap(heatmapRes[0].value.data)
        } else {
          setHealthHeatmap(null)
        }

        // Set at-risk items
        if (atRiskRes[0].status === 'fulfilled' && Array.isArray(atRiskRes[0].value?.data)) {
          setAtRiskItems(atRiskRes[0].value.data)
        } else {
          setAtRiskItems([])
        }

        // Set cycle health
        if (cycleHealthRes.length > 0 && cycleHealthRes[0].status === 'fulfilled' && cycleHealthRes[0].value?.data) {
          setCycleHealth(cycleHealthRes[0].value.data)
        } else {
          setCycleHealth(null)
        }
      } catch (error: unknown) {
        console.error('Failed to fetch analytics:', error)
        const apiError = error as { response?: { status?: number; data?: { message?: string } } }
        if (apiError.response?.status === 403) {
          setFetchError('You do not have permission to view analytics')
        } else if (apiError.response?.status !== 401) {
          // 401 is handled by interceptor, don't show error
          setFetchError('Failed to load analytics data. Please try again later.')
        }
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
        setHealthHeatmap(null)
        setAtRiskItems([])
        setCycleHealth(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [currentOrganization?.id, overduePeriod, heatmapBy])

  // TODO [phase7-performance]: lift this into a shared util if we reuse it
  function safePercent(numerator: number, denominator: number): number {
    if (!denominator || denominator <= 0) return 0
    if (!numerator || numerator < 0) return 0
    return Math.round((numerator / denominator) * 100)
  }

  const onTrackCount = summary?.byStatus?.['ON_TRACK'] || 0
  const atRiskCount = summary?.byStatus?.['AT_RISK'] || 0
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // NOTE: This surface is admin-only and is not exposed to external design partners.
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
      // TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
    } finally {
      setExporting(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer variant="content">
          <div className="mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
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
          {/* NOTE: This surface is admin-only and is not exposed to external design partners. */}
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
                    {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
                  </div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Loading analytics...</p>
            </div>
          ) : fetchError ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-medium mb-2">{fetchError}</p>
              <p className="text-sm text-neutral-500">Please check your permissions or try refreshing the page.</p>
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
                {overdue.length > 0 ? (
                  <Link href="/dashboard/okrs?filter=overdue">
                    <div className="cursor-pointer hover:shadow-md transition-shadow">
                      <StatCard
                        title="Overdue Check-ins"
                        value={overdue.length}
                        subtitle={
                          overduePeriod === 'all'
                            ? `${overdue.length} key result${overdue.length !== 1 ? 's' : ''} overdue`
                            : `${overdue.length} overdue (last ${overduePeriod}d)`
                        }
                      />
                    </div>
                  </Link>
                ) : (
                  <StatCard
                    title="Overdue Check-ins"
                    value="—"
                    subtitle={undefined}
                  />
                )}
                {/* Time period filter for overdue */}
                {overdue.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-neutral-500">Filter:</span>
                    <select
                      value={overduePeriod}
                      onChange={(e) => setOverduePeriod(e.target.value as '7' | '14' | '30' | 'all')}
                      className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="all">All time</option>
                      <option value="7">Last 7 days</option>
                      <option value="14">Last 14 days</option>
                      <option value="30">Last 30 days</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Strategic Coverage */}
              <div className="mb-8">
                <SectionHeader
                  title="Strategic Coverage"
                  subtitle="Pillar coverage in active cycle"
                />
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  {pillarCoverage.length === 0 ? (
                    <div className="text-sm text-neutral-500 text-center py-6">
                      No strategic pillars defined or no active cycle
                      {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
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

              {/* Health Heatmap */}
              <div className="mb-8">
                <SectionHeader
                  title="Health Heatmap"
                  subtitle={`Objective status by ${heatmapBy === 'team' ? 'team' : 'strategic pillar'}`}
                />
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">Group by:</span>
                      <select
                        value={heatmapBy}
                        onChange={(e) => setHeatmapBy(e.target.value as 'team' | 'pillar')}
                        className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white"
                      >
                        <option value="team">Team</option>
                        <option value="pillar">Pillar</option>
                      </select>
                    </div>
                  </div>
                  {!healthHeatmap || healthHeatmap.buckets.length === 0 ? (
                    <div className="text-sm text-neutral-500 text-center py-6">
                      No data available
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200">
                            <th className="text-left py-2 px-3 font-semibold text-neutral-700">
                              {heatmapBy === 'team' ? 'Team' : 'Pillar'}
                            </th>
                            <th className="text-center py-2 px-2 font-semibold text-neutral-700">On Track</th>
                            <th className="text-center py-2 px-2 font-semibold text-neutral-700">At Risk</th>
                            <th className="text-center py-2 px-2 font-semibold text-neutral-700">Off Track</th>
                            <th className="text-center py-2 px-2 font-semibold text-neutral-700">Completed</th>
                            <th className="text-center py-2 px-2 font-semibold text-neutral-700">Cancelled</th>
                            <th className="text-center py-2 px-2 font-semibold text-neutral-700">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {healthHeatmap.totals
                            .sort((a, b) => b.total - a.total)
                            .map((total) => {
                              const dimensionBuckets = healthHeatmap.buckets.filter(
                                (b) => b.dimensionId === total.dimensionId
                              )
                              const statusCounts = {
                                ON_TRACK: dimensionBuckets.find((b) => b.status === 'ON_TRACK')?.count || 0,
                                AT_RISK: dimensionBuckets.find((b) => b.status === 'AT_RISK')?.count || 0,
                                OFF_TRACK: dimensionBuckets.find((b) => b.status === 'OFF_TRACK')?.count || 0,
                                COMPLETED: dimensionBuckets.find((b) => b.status === 'COMPLETED')?.count || 0,
                                CANCELLED: dimensionBuckets.find((b) => b.status === 'CANCELLED')?.count || 0,
                              }

                              const buildFilterUrl = (status?: string) => {
                                const params = new URLSearchParams()
                                if (heatmapBy === 'team' && total.dimensionId) {
                                  params.append('filterTeamId', total.dimensionId)
                                } else if (heatmapBy === 'pillar' && total.dimensionId) {
                                  params.append('filterPillarId', total.dimensionId)
                                }
                                if (status) {
                                  params.append('filterStatus', status)
                                }
                                if (activeCycles.length > 0) {
                                  params.append('filterCycleId', activeCycles[0].id)
                                }
                                return `/dashboard/okrs?${params.toString()}`
                              }

                              return (
                                <tr key={total.dimensionId || 'unassigned'} className="border-b border-neutral-100 hover:bg-neutral-50">
                                  <td className="py-2 px-3 font-medium text-neutral-900">
                                    {total.dimensionName}
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    {statusCounts.ON_TRACK > 0 ? (
                                      <Link
                                        href={buildFilterUrl('ON_TRACK')}
                                        className="text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                                      >
                                        {statusCounts.ON_TRACK}
                                      </Link>
                                    ) : (
                                      <span className="text-neutral-400">0</span>
                                    )}
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    {statusCounts.AT_RISK > 0 ? (
                                      <Link
                                        href={buildFilterUrl('AT_RISK')}
                                        className="text-amber-600 hover:text-amber-700 hover:underline font-medium"
                                      >
                                        {statusCounts.AT_RISK}
                                      </Link>
                                    ) : (
                                      <span className="text-neutral-400">0</span>
                                    )}
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    {statusCounts.OFF_TRACK > 0 ? (
                                      <Link
                                        href={buildFilterUrl('OFF_TRACK')}
                                        className="text-rose-600 hover:text-rose-700 hover:underline font-medium"
                                      >
                                        {statusCounts.OFF_TRACK}
                                      </Link>
                                    ) : (
                                      <span className="text-neutral-400">0</span>
                                    )}
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    {statusCounts.COMPLETED > 0 ? (
                                      <Link
                                        href={buildFilterUrl('COMPLETED')}
                                        className="text-neutral-600 hover:text-neutral-700 hover:underline font-medium"
                                      >
                                        {statusCounts.COMPLETED}
                                      </Link>
                                    ) : (
                                      <span className="text-neutral-400">0</span>
                                    )}
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    {statusCounts.CANCELLED > 0 ? (
                                      <Link
                                        href={buildFilterUrl('CANCELLED')}
                                        className="text-neutral-600 hover:text-neutral-700 hover:underline font-medium"
                                      >
                                        {statusCounts.CANCELLED}
                                      </Link>
                                    ) : (
                                      <span className="text-neutral-400">0</span>
                                    )}
                                  </td>
                                  <td className="text-center py-2 px-2 font-semibold text-neutral-900">
                                    {total.total > 0 ? (
                                      <Link
                                        href={buildFilterUrl()}
                                        className="hover:text-neutral-700 hover:underline"
                                      >
                                        {total.total}
                                      </Link>
                                    ) : (
                                      total.total
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* At-Risk View */}
              <div className="mb-8">
                <SectionHeader
                  title="At-Risk Items"
                  subtitle="Objectives and Key Results requiring attention"
                />
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  {atRiskItems.length === 0 ? (
                    <div className="text-sm text-neutral-500 text-center py-6">
                      No at-risk items found
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-semibold text-neutral-900">
                          {atRiskItems.length} item{atRiskItems.length !== 1 ? 's' : ''} at risk
                        </div>
                        <Link
                          href={`/dashboard/okrs?filterStatus=AT_RISK,OFF_TRACK,BLOCKED${activeCycles.length > 0 ? `&filterCycleId=${activeCycles[0].id}` : ''}`}
                          className="text-xs text-violet-600 hover:text-violet-700 hover:underline"
                        >
                          View all →
                        </Link>
                      </div>
                      {atRiskItems.slice(0, 5).map((item) => {
                        const buildFilterUrl = () => {
                          const params = new URLSearchParams()
                          if (item.entityType === 'KEY_RESULT' && item.dimensionRefs.objectiveId) {
                            // Link to objective detail page
                            return `/dashboard/okrs?objectiveId=${item.dimensionRefs.objectiveId}`
                          }
                          params.append('filterStatus', item.status)
                          if (item.dimensionRefs.teamId) {
                            params.append('filterTeamId', item.dimensionRefs.teamId)
                          }
                          if (item.dimensionRefs.pillarId) {
                            params.append('filterPillarId', item.dimensionRefs.pillarId)
                          }
                          if (item.dimensionRefs.cycleId) {
                            params.append('filterCycleId', item.dimensionRefs.cycleId)
                          }
                          return `/dashboard/okrs?${params.toString()}`
                        }

                        return (
                          <div key={`${item.entityType}-${item.id}`} className="flex items-start gap-4 pb-4 border-b border-neutral-100 last:border-0">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              item.status === 'OFF_TRACK' || item.status === 'BLOCKED' ? 'bg-rose-500' :
                              item.status === 'AT_RISK' ? 'bg-amber-500' :
                              'bg-neutral-400'
                            }`} />
                            <div className="flex-1">
                              <Link
                                href={buildFilterUrl()}
                                className="text-sm font-medium text-neutral-900 hover:text-violet-600 hover:underline"
                              >
                                {item.title}
                              </Link>
                              <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                                <span className="capitalize">{item.entityType.toLowerCase().replace('_', ' ')}</span>
                                <span>•</span>
                                <span>Owner: {item.owner.name || item.owner.id}</span>
                                {item.confidence !== null && (
                                  <>
                                    <span>•</span>
                                    <span className={item.confidence < 50 ? 'text-amber-600 font-medium' : ''}>
                                      Confidence: {item.confidence}%
                                    </span>
                                  </>
                                )}
                                {item.dimensionRefs.teamName && (
                                  <>
                                    <span>•</span>
                                    <span>Team: {item.dimensionRefs.teamName}</span>
                                  </>
                                )}
                                {item.entityType === 'KEY_RESULT' && item.dimensionRefs.objectiveTitle && (
                                  <>
                                    <span>•</span>
                                    <span>Objective: {item.dimensionRefs.objectiveTitle}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {atRiskItems.length > 5 && (
                        <div className="text-xs text-neutral-500 text-center pt-2">
                          And {atRiskItems.length - 5} more...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cycle Health */}
              {activeCycles.length > 0 && (
                <div className="mb-8">
                  <SectionHeader
                    title="Cycle Health"
                    subtitle={`Health metrics for ${activeCycles[0].name}`}
                  />
                  <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                    {cycleHealth ? (
                      <div className="space-y-6">
                        {/* Totals by Status */}
                        <div>
                          <h5 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 mb-3">
                            Objectives by Status
                          </h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {Object.entries(cycleHealth.totalsByStatus).map(([status, count]) => (
                              <div key={status} className="text-center">
                                <div className={`text-2xl font-bold ${
                                  status === 'ON_TRACK' ? 'text-emerald-600' :
                                  status === 'AT_RISK' ? 'text-amber-600' :
                                  status === 'OFF_TRACK' || status === 'BLOCKED' ? 'text-rose-600' :
                                  status === 'COMPLETED' ? 'text-violet-600' :
                                  'text-neutral-600'
                                }`}>
                                  {count}
                                </div>
                                <div className="text-xs text-neutral-500 mt-1 capitalize">
                                  {status.replace('_', ' ').toLowerCase()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Average Confidence */}
                        <div>
                          <h5 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 mb-3">
                            Average Confidence
                          </h5>
                          <div className="text-3xl font-bold text-neutral-900">
                            {cycleHealth.avgConfidence !== null
                              ? `${cycleHealth.avgConfidence.toFixed(1)}%`
                              : '—'}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
                            Based on latest check-ins across all Key Results
                          </div>
                        </div>

                        {/* Coverage Metrics */}
                        <div>
                          <h5 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 mb-3">
                            Coverage Metrics
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <div className="text-2xl font-bold text-neutral-900">
                                {cycleHealth.coverage.objectivesWith2PlusKRsPct.toFixed(1)}%
                              </div>
                              <div className="text-xs text-neutral-500 mt-1">
                                Objectives with ≥2 Key Results
                              </div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-neutral-900">
                                {cycleHealth.coverage.krsWithRecentCheckInPct.toFixed(1)}%
                              </div>
                              <div className="text-xs text-neutral-500 mt-1">
                                Key Results with check-in in last 14 days
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-500 text-center py-6">
                        No cycle health data available
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Execution Risk */}
              <div className="mb-8">
                <SectionHeader
                  title="Execution Risk"
                  subtitle="Key Results overdue for check-in"
                />
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  {overdue.length === 0 ? (
                    <div className="text-sm text-neutral-500 text-center py-6">
                      No overdue check-ins
                      {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
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
                              <span>Owner: {item.owner.name || item.owner.id}</span>
                              <span>•</span>
                              <span className="text-red-600 font-medium">{item.daysOverdue}d overdue</span>
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
              <div className="mb-8">
                <SectionHeader
                  title="Recent Activity"
                  subtitle="Last 10 check-ins"
                />
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  {feed.length === 0 ? (
                    <div className="text-sm text-neutral-500 text-center py-6">
                      No recent activity.
                      {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
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
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  )
}



