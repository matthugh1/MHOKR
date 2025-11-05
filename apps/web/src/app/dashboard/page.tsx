'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, BarChart3, Target } from 'lucide-react'
import Link from 'next/link'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
import { useWorkspace } from '@/contexts/workspace.context'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/auth.context'
import { CycleHealthStrip } from '@/components/okr/CycleHealthStrip'
import { AttentionDrawer } from '@/components/okr/AttentionDrawer'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertCircle, Clock, TrendingDown } from 'lucide-react'
import api from '@/lib/api'

interface Objective {
  id: string
  title: string
  status: string
  progress: number
  ownerId: string
  teamId?: string | null
  workspaceId?: string | null
  keyResults: Array<{
    id: string
    title: string
    status: string
    progress: number
  }>
}

interface OKROverviewResponse {
  objectives: Objective[]
  totalCount: number
  page: number
  pageSize: number
  canCreateObjective: boolean
  canPublishOKR: boolean
}

export default function DashboardPage() {
  const { currentOrganization, isSuperuser } = useWorkspace()
  const { user } = useAuth()
  const permissions = usePermissions()
  const [loading, setLoading] = useState(true)
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null)
  const [attentionDrawerOpen, setAttentionDrawerOpen] = useState(false)
  const [attentionItems, setAttentionItems] = useState<any[]>([])
  const [cycleHealthSummary, setCycleHealthSummary] = useState<any>(null)
  const [myOkrs, setMyOkrs] = useState<Objective[]>([])
  const [myOkrsLoading, setMyOkrsLoading] = useState(false)
  const [canCreateObjective, setCanCreateObjective] = useState(false)
  const [canPublishOKR, setCanPublishOKR] = useState(false)

  // Determine user roles and scopes
  const userRoles = useMemo(() => {
    if (!currentOrganization?.id) {
      return {
        isContributor: true,
        isManager: false,
        isAdmin: false,
        isSuperuser: isSuperuser || false,
        managedWorkspaces: [] as string[],
        managedTeams: [] as string[],
      }
    }

    const isAdmin = permissions.isTenantAdminOrOwner(currentOrganization.id)
    const isSuper = isSuperuser || false

    // Get managed workspaces
    const managedWorkspaces = permissions.rolesByScope?.workspace?.filter(
      (w: any) => w.roles.includes('WORKSPACE_LEAD') || w.roles.includes('WORKSPACE_ADMIN')
    ).map((w: any) => w.workspaceId) || []

    // Get managed teams
    const managedTeams = permissions.rolesByScope?.team?.filter(
      (t: any) => t.roles.includes('TEAM_LEAD')
    ).map((t: any) => t.teamId) || []

    const isManager = managedWorkspaces.length > 0 || managedTeams.length > 0

    return {
      isContributor: !isAdmin && !isManager,
      isManager,
      isAdmin,
      isSuperuser: isSuper,
      managedWorkspaces,
      managedTeams,
    }
  }, [permissions, currentOrganization?.id, isSuperuser])

  // Fetch My OKRs for any user who might have personal OKRs
  useEffect(() => {
    const fetchMyOKRs = async () => {
      if (!currentOrganization?.id || !user?.id) {
        setMyOkrs([])
        return
      }

      try {
        setMyOkrsLoading(true)
        // Use /me/summary for personal OKRs
        const response = await api.get('/me/summary')
        const summary = response.data || {}
        const ownedObjectives = summary.ownedObjectives || []
        
        // Transform to match Objective interface
        const objectives: Objective[] = ownedObjectives.map((obj: any) => ({
          id: obj.id,
          title: obj.title,
          status: obj.status,
          progress: obj.progress,
          keyResults: [], // Will be populated separately if needed
        }))
        
        setMyOkrs(objectives)
        
        // Check permissions for creating/publishing
        const overviewResponse = await api.get<OKROverviewResponse>(
          `/okr/overview?organizationId=${currentOrganization.id}&page=1&pageSize=1`
        ).catch(() => ({ data: { canCreateObjective: false, canPublishOKR: false } }))
        
        setCanCreateObjective(overviewResponse.data.canCreateObjective || false)
        setCanPublishOKR(overviewResponse.data.canPublishOKR || false)
      } catch (error) {
        setMyOkrs([])
      } finally {
        setMyOkrsLoading(false)
      }
    }

    fetchMyOKRs()
  }, [currentOrganization?.id, user?.id])

  // Team and workspace OKRs are shown as summary sections that link to filtered views
  // The actual OKR list is fetched on the OKRs page with appropriate filters

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Fetch active cycle
        const cyclesRes = await api.get('/reports/cycles/active').catch(() => ({ data: [] }))
        const activeCycles = Array.isArray(cyclesRes.data) ? cyclesRes.data : []
        const cycle = activeCycles.length > 0 ? activeCycles[0] : null
        setActiveCycleId(cycle?.id || null)

        const promises: Promise<any>[] = []

        // Fetch attention feed if we have a cycle
        if (cycle?.id) {
          promises.push(
            api.get(`/okr/insights/attention?cycleId=${cycle.id}&page=1&pageSize=5`).catch(() => ({ data: { items: [] } }))
          )
          promises.push(
            api.get(`/okr/insights/cycle-summary?cycleId=${cycle.id}`).catch(() => ({ data: null }))
          )
        }

        const results = await Promise.allSettled(promises)

        // Extract attention items if cycle exists
        if (cycle?.id && results.length > 0) {
          const attentionRes = results[0]
          if (attentionRes.status === 'fulfilled' && attentionRes.value?.data?.items) {
            setAttentionItems(attentionRes.value.data.items || [])
          }

          // Extract cycle health
          if (results.length > 1) {
            const cycleHealthRes = results[1]
            if (cycleHealthRes.status === 'fulfilled' && cycleHealthRes.value?.data) {
              setCycleHealthSummary(cycleHealthRes.value.data)
            }
          }
        }
      } catch (error) {
        // Error handling
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [currentOrganization?.id, activeCycleId])

  const getAttentionItemIcon = (type: string) => {
    switch (type) {
      case 'OVERDUE_CHECKIN':
        return <AlertCircle className="w-4 h-4 text-rose-600" />
      case 'NO_UPDATE_14D':
        return <Clock className="w-4 h-4 text-amber-600" />
      case 'STATUS_DOWNGRADE':
        return <TrendingDown className="w-4 h-4 text-rose-600" />
      default:
        return null
    }
  }

  const getAttentionItemLabel = (item: any) => {
    switch (item.type) {
      case 'OVERDUE_CHECKIN':
        return `Overdue check-in${item.ageDays ? ` (${item.ageDays} days)` : ''}`
      case 'NO_UPDATE_14D':
        return `No update in ${item.ageDays || 14}+ days`
      case 'STATUS_DOWNGRADE':
        return `Status changed from ${item.from || 'ON_TRACK'} to ${item.to || 'AT_RISK'}`
      default:
        return 'Needs attention'
    }
  }

  // Calculate summary metrics
  const myOkrsCount = myOkrs.length
  const myOkrsAtRisk = myOkrs.filter(obj => obj.status === 'AT_RISK').length

  // Generate AI summary message
  const aiSummary = useMemo(() => {
    if (myOkrsAtRisk > 0) {
      return 'You have objectives at risk. Focus is required this week.'
    } else if (attentionItems.length > 0) {
      return 'You have items requiring attention. Review the attention feed below.'
    } else {
      return 'Execution looks steady. Most objectives are tracking and check-ins are up to date.'
    }
  }, [myOkrsAtRisk, attentionItems.length])

  const renderReadOnlyTooltip = (children: React.ReactNode) => {
    if (!userRoles.isSuperuser) return children

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent>
            <p>Superuser access is read-only. You cannot modify OKR content.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer variant="dashboard" withGradient>
          <div className="mb-8">
            <PageHeader
              title="My Dashboard"
              subtitle={userRoles.isSuperuser
                ? 'System-wide overview with read-only access.'
                : userRoles.isAdmin
                ? 'Organisation-wide OKR performance and cross-workspace insights.'
                : userRoles.isManager
                ? 'Your OKRs, team performance, and cycle overview.'
                : 'Your OKRs and progress tracking.'}
              badges={[
                { label: 'AI-assisted', tone: 'neutral' },
                ...(userRoles.isSuperuser ? [{ label: 'Read-only', tone: 'warning' }] : [])
              ]}
            />
          </div>

          <div className="h-[2px] w-full bg-gradient-to-r from-violet-600 via-fuchsia-400 to-transparent rounded-full mb-6" />

          {/* Quick Actions Toolbar */}
          <div className="flex items-center justify-end gap-3 mb-6">
            <Link href="/dashboard/okrs">
              {renderReadOnlyTooltip(
                <Button variant="outline" size="sm" className="gap-2" disabled={userRoles.isSuperuser}>
                  <Target className="w-4 h-4" />
                  View All OKRs
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </Link>
            <Link href="/dashboard/analytics">
              <Button variant="outline" size="sm" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                See Analytics
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-neutral-500">Loading dashboard...</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: My OKRs - Always first if user has personal OKRs */}
              {myOkrsCount > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="mb-10"
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>My OKRs</CardTitle>
                          <CardDescription>
                            Your personal objectives and key results
                          </CardDescription>
                        </div>
                        {!userRoles.isSuperuser && canCreateObjective && (
                          <Link href="/dashboard/okrs?action=create">
                            <Button variant="outline" size="sm">
                              Create OKR
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {myOkrsLoading ? (
                        <div className="text-sm text-neutral-500 py-4">Loading your OKRs...</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="text-sm">
                              <div className="font-medium text-neutral-900 mb-1">Objectives</div>
                              <div className="text-2xl font-semibold">{myOkrsCount}</div>
                            </div>
                            <div className="text-sm">
                              <div className="font-medium text-neutral-900 mb-1">At Risk</div>
                              <div className={`text-2xl font-semibold ${myOkrsAtRisk > 0 ? 'text-rose-600' : 'text-neutral-700'}`}>
                                {myOkrsAtRisk}
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="font-medium text-neutral-900 mb-1">Key Results</div>
                              <div className="text-2xl font-semibold">
                                {myOkrs.reduce((sum, obj) => sum + (obj.keyResults?.length || 0), 0)}
                              </div>
                            </div>
                          </div>
                          {myOkrs.length > 0 && (
                            <Link href="/dashboard/okrs?ownerId=self">
                              <Button variant="ghost" size="sm" className="w-full">
                                View all my OKRs
                                <ArrowRight className="w-3 h-3 ml-2" />
                              </Button>
                            </Link>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </motion.section>
              )}

              {/* SECTION 2: My Team/Workspace OKRs - For managers */}
              {userRoles.isManager && (userRoles.managedTeams.length > 0 || userRoles.managedWorkspaces.length > 0) && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="mb-10"
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>
                            {userRoles.managedTeams.length > 0 && userRoles.managedWorkspaces.length > 0
                              ? "My Team & Workspace OKRs"
                              : userRoles.managedTeams.length > 0
                              ? "My Team's OKRs"
                              : "My Workspace OKRs"}
                          </CardTitle>
                          <CardDescription>
                            {userRoles.managedTeams.length > 0 && userRoles.managedWorkspaces.length > 0
                              ? 'Objectives and key results for your team and workspace'
                              : userRoles.managedTeams.length > 0
                              ? 'Objectives and key results for your team'
                              : 'Objectives and key results for your workspace'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-neutral-600 mb-4">
                        {userRoles.managedTeams.length > 0 && (
                          <p className="mb-2">
                            Managing {userRoles.managedTeams.length} team{userRoles.managedTeams.length !== 1 ? 's' : ''}
                          </p>
                        )}
                        {userRoles.managedWorkspaces.length > 0 && (
                          <p>
                            Managing {userRoles.managedWorkspaces.length} workspace{userRoles.managedWorkspaces.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <Link href="/dashboard/okrs">
                        <Button variant="ghost" size="sm" className="w-full">
                          View team and workspace OKRs
                          <ArrowRight className="w-3 h-3 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.section>
              )}

              {/* SECTION 4: Cycle Overview - For managers and admins */}
              {(userRoles.isManager || userRoles.isAdmin || userRoles.isSuperuser) && activeCycleId && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="mb-10"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {userRoles.isAdmin ? 'Cycle Overview' : 'Cycle Health'}
                      </CardTitle>
                      <CardDescription>
                        {userRoles.isAdmin
                          ? 'Organisation-wide cycle summary'
                          : 'Team and workspace cycle health'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {cycleHealthSummary ? (
                        <CycleHealthStrip
                          cycleId={activeCycleId}
                          onFilterClick={(filterType, value) => {
                            window.location.href = `/dashboard/okrs?filter=${filterType}${value ? `&value=${value}` : ''}`
                          }}
                        />
                      ) : (
                        <div className="text-sm text-neutral-500 py-4">
                          Loading cycle health data...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.section>
              )}

              {/* SECTION 5: Attention Feed - For all users */}
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.35 }}
                className="mt-10"
              >
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                    Attention Feed
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    Items requiring your attention
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Items Requiring Attention</CardTitle>
                      {attentionItems.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAttentionDrawerOpen(true)}
                          className="text-xs"
                        >
                          View all
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                    <CardDescription>
                      Overdue check-ins, status changes, and items needing follow-up
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {attentionItems.length > 0 ? (
                      <div className="space-y-3">
                        {attentionItems.slice(0, 5).map((item, index) => (
                          <div
                            key={`${item.type}-${item.objectiveId}-${item.keyResultId || ''}-${index}`}
                            className="flex items-start gap-3 p-3 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors"
                          >
                            <div className="mt-0.5">{getAttentionItemIcon(item.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {item.type.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              <p className="text-sm text-neutral-700">
                                {getAttentionItemLabel(item)}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-6 mt-2"
                                onClick={() => {
                                  if (item.keyResultId) {
                                    window.location.href = `/dashboard/okrs?krId=${item.keyResultId}`
                                  } else {
                                    window.location.href = `/dashboard/okrs?objectiveId=${item.objectiveId}`
                                  }
                                }}
                              >
                                View in OKRs
                                <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-500 text-center py-6">
                        No items need attention at this time.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.section>

              {/* AI Summary Bar */}
              {aiSummary && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  className="mt-6"
                >
                  <div className="text-sm bg-gradient-to-r from-violet-50 via-fuchsia-50 to-violet-50 border border-neutral-200 rounded-lg p-3 shadow-sm flex items-start gap-2">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">
                      <Sparkles size={14} />
                    </div>
                    <p className="text-sm leading-5">{aiSummary}</p>
                  </div>
                </motion.section>
              )}
            </>
          )}

          {/* Attention Drawer */}
          <AttentionDrawer
            isOpen={attentionDrawerOpen}
            onClose={() => setAttentionDrawerOpen(false)}
            cycleId={activeCycleId}
            onNavigateToObjective={(objectiveId) => {
              window.location.href = `/dashboard/okrs?objectiveId=${objectiveId}`
            }}
            onNavigateToKeyResult={(krId) => {
              window.location.href = `/dashboard/okrs?krId=${krId}`
            }}
            canRequestCheckIn={!userRoles.isSuperuser && permissions.canEditOKR({ ownerId: user?.id || '', organizationId: currentOrganization?.id || undefined })}
          />
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
