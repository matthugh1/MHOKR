'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Target, Activity } from 'lucide-react'
import api from '@/lib/api'
import { useWorkspace } from '@/contexts/workspace.context'

interface OwnedObjective {
  id: string
  title: string
  status: string
  progress: number
  isPublished: boolean
  cycleStatus: string | null
  pillar: { id: string; name: string } | null
  teamName: string | null
  workspaceName: string | null
}

interface OwnedKeyResult {
  id: string
  title: string
  status: string
  progress: number
  checkInCadence: string | null
  lastCheckInAt: string | null
  objectiveId: string | null
  objectiveTitle: string | null
}

interface OverdueCheckIn {
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

interface RecentActivity {
  id: string
  timestamp: string
  action: string
  targetType: string
  targetId: string
  metadata: any
}

interface MyDashboardSummary {
  ownedObjectives: OwnedObjective[]
  ownedKeyResults: OwnedKeyResult[]
  recentActivity: RecentActivity[]
  overdueCheckIns: OverdueCheckIn[]
}

export default function MyDashboardPage() {
  const { currentOrganization } = useWorkspace()
  const [summary, setSummary] = useState<MyDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMyDashboard = async () => {
      try {
        setLoading(true)
        const response = await api.get('/me/summary')
        setSummary(response.data)
      } catch (error) {
        console.error('Failed to fetch my dashboard:', error)
        // Set empty state on error
        setSummary({
          ownedObjectives: [],
          ownedKeyResults: [],
          recentActivity: [],
          overdueCheckIns: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchMyDashboard()
  }, [])

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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ON_TRACK':
        return 'default'
      case 'AT_RISK':
        return 'secondary'
      case 'OFF_TRACK':
        return 'destructive'
      case 'COMPLETED':
        return 'outline'
      default:
        return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ON_TRACK':
        return 'text-green-600'
      case 'AT_RISK':
        return 'text-yellow-600'
      case 'OFF_TRACK':
        return 'text-red-600'
      case 'COMPLETED':
        return 'text-blue-600'
      default:
        return 'text-slate-600'
    }
  }

  const atRiskObjectives = summary?.ownedObjectives.filter(
    (obj) => obj.status === 'AT_RISK' || obj.status === 'OFF_TRACK'
  ) || []

  const atRiskKeyResults = summary?.ownedKeyResults.filter(
    (kr) => kr.status === 'AT_RISK' || kr.status === 'OFF_TRACK'
  ) || []

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-8">
            <div className="text-center py-12">
              <p className="text-slate-500">Loading your dashboard...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">My Dashboard</h1>
            <p className="text-slate-600 mt-1">Your OKRs, Key Results, and activity overview</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">My OKRs</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.ownedObjectives.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {atRiskObjectives.length > 0 ? `${atRiskObjectives.length} need attention` : 'All on track'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">My Key Results</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.ownedKeyResults.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {atRiskKeyResults.length > 0 ? `${atRiskKeyResults.length} at risk` : 'All on track'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Check-ins</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.overdueCheckIns.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.overdueCheckIns.length === 0 ? 'All up to date' : 'Need check-in'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.recentActivity.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Updates in last 20 items
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Overdue Check-ins Alert */}
          {summary && summary.overdueCheckIns.length > 0 && (
            <Card className="mb-8 border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-900">
                  <AlertTriangle className="h-5 w-5" />
                  Overdue Check-ins
                </CardTitle>
                <CardDescription>These Key Results need attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.overdueCheckIns.map((item) => (
                    <div key={item.krId} className="flex items-start justify-between p-3 bg-white rounded-lg border border-red-200">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{item.krTitle}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {item.objectiveTitle}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                          <span className="text-red-600 font-medium">{item.daysLate}d late</span>
                          {item.lastCheckInAt && (
                            <>
                              <span>•</span>
                              <span>Last check-in: {formatTimeAgo(item.lastCheckInAt)}</span>
                            </>
                          )}
                          {item.cadence && (
                            <>
                              <span>•</span>
                              <span>Cadence: {item.cadence}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* At Risk Items */}
          {(atRiskObjectives.length > 0 || atRiskKeyResults.length > 0) && (
            <Card className="mb-8 border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-900">
                  <AlertTriangle className="h-5 w-5" />
                  At Risk Items
                </CardTitle>
                <CardDescription>These items need attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {atRiskObjectives.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-900 mb-2">Objectives</h3>
                      <div className="space-y-2">
                        {atRiskObjectives.map((obj) => (
                          <div key={obj.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-900">{obj.title}</p>
                                <Badge variant={getStatusBadgeVariant(obj.status)} className="text-xs">
                                  {obj.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                                <span>Progress: {Math.round(obj.progress)}%</span>
                                {obj.pillar && (
                                  <>
                                    <span>•</span>
                                    <span>Pillar: {obj.pillar.name}</span>
                                  </>
                                )}
                                {obj.teamName && (
                                  <>
                                    <span>•</span>
                                    <span>Team: {obj.teamName}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {atRiskKeyResults.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-900 mb-2">Key Results</h3>
                      <div className="space-y-2">
                        {atRiskKeyResults.map((kr) => (
                          <div key={kr.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-900">{kr.title}</p>
                                <Badge variant={getStatusBadgeVariant(kr.status)} className="text-xs">
                                  {kr.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                                <span>Progress: {Math.round(kr.progress)}%</span>
                                {kr.objectiveTitle && (
                                  <>
                                    <span>•</span>
                                    <span>Objective: {kr.objectiveTitle}</span>
                                  </>
                                )}
                                {kr.lastCheckInAt && (
                                  <>
                                    <span>•</span>
                                    <span>Last check-in: {formatTimeAgo(kr.lastCheckInAt)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* My Objectives */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>My Objectives</CardTitle>
              <CardDescription>OKRs you own</CardDescription>
            </CardHeader>
            <CardContent>
              {summary && summary.ownedObjectives.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No objectives assigned to you
                </div>
              ) : (
                <div className="space-y-4">
                  {summary?.ownedObjectives.map((obj) => (
                    <div key={obj.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-slate-900">{obj.title}</h3>
                          <Badge variant={getStatusBadgeVariant(obj.status)} className="text-xs">
                            {obj.status.replace('_', ' ')}
                          </Badge>
                          {obj.isPublished && (
                            <Badge variant="outline" className="text-xs">Published</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                          {obj.pillar && (
                            <span>Pillar: {obj.pillar.name}</span>
                          )}
                          {obj.teamName && (
                            <span>• Team: {obj.teamName}</span>
                          )}
                          {obj.workspaceName && (
                            <span>• Workspace: {obj.workspaceName}</span>
                          )}
                          {obj.cycleStatus && (
                            <span>• Cycle: {obj.cycleStatus}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                obj.status === 'ON_TRACK' ? 'bg-green-500' :
                                obj.status === 'AT_RISK' ? 'bg-yellow-500' :
                                obj.status === 'OFF_TRACK' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, obj.progress))}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-600">{Math.round(obj.progress)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Key Results */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>My Key Results</CardTitle>
              <CardDescription>Key Results you own</CardDescription>
            </CardHeader>
            <CardContent>
              {summary && summary.ownedKeyResults.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No key results assigned to you
                </div>
              ) : (
                <div className="space-y-4">
                  {summary?.ownedKeyResults.map((kr) => (
                    <div key={kr.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-slate-900">{kr.title}</h3>
                          <Badge variant={getStatusBadgeVariant(kr.status)} className="text-xs">
                            {kr.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                          {kr.objectiveTitle && (
                            <span>Objective: {kr.objectiveTitle}</span>
                          )}
                          {kr.checkInCadence && (
                            <span>• Cadence: {kr.checkInCadence}</span>
                          )}
                          {kr.lastCheckInAt && (
                            <span>• Last check-in: {formatTimeAgo(kr.lastCheckInAt)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                kr.status === 'ON_TRACK' ? 'bg-green-500' :
                                kr.status === 'AT_RISK' ? 'bg-yellow-500' :
                                kr.status === 'OFF_TRACK' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, kr.progress))}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-600">{Math.round(kr.progress)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates on your OKRs and Key Results</CardDescription>
            </CardHeader>
            <CardContent>
              {summary && summary.recentActivity.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No recent activity
                </div>
              ) : (
                <div className="space-y-4">
                  {summary?.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className="w-2 h-2 rounded-full mt-2 bg-blue-500" />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{activity.action}</span>{' '}
                          <span className="text-slate-600">{activity.targetType.toLowerCase().replace('_', ' ')}</span>
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                          <span>{formatTimeAgo(activity.timestamp)}</span>
                          {activity.metadata && typeof activity.metadata === 'object' && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400">
                                {JSON.stringify(activity.metadata).substring(0, 50)}...
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}


