'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/contexts/workspace.context'
import api from '@/lib/api'

interface Objective {
  id: string
  title: string
  status: string
  progress: number
  keyResults?: Array<{
    keyResult: {
      id: string
      title: string
      status: string
      progress: number
    }
  }>
}

interface OverdueCheckIn {
  krId: string
  krTitle: string
  objectiveId: string
  objectiveTitle: string
  ownerId: string
  ownerName: string | null
  daysLate: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { currentOrganization } = useWorkspace()
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [overdueCheckIns, setOverdueCheckIns] = useState<OverdueCheckIn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // Fetch all objectives in the organization
        const [objectivesRes, overdueRes] = await Promise.all([
          api.get('/objectives'),
          api.get('/key-results/overdue'),
        ])

        setObjectives(objectivesRes.data || [])
        setOverdueCheckIns(overdueRes.data || [])
      } catch (error) {
        console.error('Failed to fetch dashboard:', error)
        setObjectives([])
        setOverdueCheckIns([])
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [currentOrganization?.id])

  // Extract all key results from objectives
  const allKeyResults = objectives.flatMap((obj) =>
    (obj.keyResults || []).map((kr) => ({
      id: kr.keyResult.id,
      title: kr.keyResult.title,
      status: kr.keyResult.status,
      progress: kr.keyResult.progress,
      objectiveTitle: obj.title,
    }))
  )

  const objectivesCount = objectives.length
  const keyResultsCount = allKeyResults.length
  const overdueCheckInsCount = overdueCheckIns.length
  const atRiskObjectivesCount = objectives.filter((o) => o.status === 'AT_RISK').length
  const atRiskKeyResults = allKeyResults.filter(
    (kr) => kr.status === 'AT_RISK' || kr.status === 'OFF_TRACK'
  )

  const avgProgress =
    objectives.length > 0
      ? Math.round(
          objectives.reduce((acc, o) => acc + (o.progress || 0), 0) / objectives.length
        )
      : 0

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8">
          <PageHeader
            title="Dashboard"
            subtitle="Organization OKR overview at a glance"
            badges={[
              {
                label: `${objectivesCount} Objectives`,
                tone: 'neutral',
              },
              ...(atRiskObjectivesCount > 0
                ? [{ label: `${atRiskObjectivesCount} At Risk`, tone: 'warning' as const }]
                : []),
              ...(atRiskKeyResults.length > 0
                ? [{ label: `${atRiskKeyResults.length} At-Risk KRs`, tone: 'warning' as const }]
                : []),
              ...(overdueCheckInsCount > 0
                ? [
                    {
                      label: `${overdueCheckInsCount} Overdue`,
                      tone: 'danger' as const,
                    },
                  ]
                : []),
            ]}
          />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="Objectives"
              value={objectivesCount.toString()}
              hint="All objectives in organization"
            />
            <StatCard
              label="Key Results"
              value={keyResultsCount.toString()}
              hint="All key results in organization"
            />
            <StatCard
              label="Avg Progress"
              value={`${avgProgress}%`}
              hint="Average across all objectives"
              tone={avgProgress >= 70 ? 'success' : avgProgress >= 50 ? 'default' : 'warning'}
            />
            <StatCard
              label="Overdue Check-ins"
              value={overdueCheckInsCount.toString()}
              hint="Requires attention"
              tone={overdueCheckInsCount > 0 ? 'danger' : 'default'}
            />
          </div>

          {/* At-risk Key Results */}
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              Loading dashboard...
            </div>
          ) : atRiskKeyResults.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      At-Risk Key Results
                    </CardTitle>
                    <CardDescription>
                      {atRiskKeyResults.length} key result{atRiskKeyResults.length !== 1 ? 's' : ''} requiring attention
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard/okrs')}
                  >
                    View All
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {atRiskKeyResults.slice(0, 5).map((kr) => (
                    <div
                      key={kr.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => router.push('/dashboard/okrs')}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900 truncate">
                            {kr.title}
                          </h4>
                          <Badge
                            variant={kr.status === 'OFF_TRACK' ? 'destructive' : 'warning'}
                            className="text-xs shrink-0"
                          >
                            {kr.status === 'OFF_TRACK' ? 'Off Track' : 'At Risk'}
                          </Badge>
                        </div>
                        {kr.objectiveTitle && (
                          <p className="text-sm text-slate-600 truncate">
                            Objective: {kr.objectiveTitle}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                kr.status === 'OFF_TRACK'
                                  ? 'bg-red-500'
                                  : 'bg-yellow-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, kr.progress || 0))}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600">
                            {Math.round(kr.progress || 0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {atRiskKeyResults.length > 5 && (
                    <div className="text-center pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/dashboard/okrs')}
                      >
                        View {atRiskKeyResults.length - 5} more at-risk key result{atRiskKeyResults.length - 5 !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-slate-500">
                  <p className="mb-2">All key results are on track! 🎉</p>
                  <p className="text-sm text-slate-400">
                    Use the navigation to explore OKRs and Analytics.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}



