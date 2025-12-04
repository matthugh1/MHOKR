'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, BarChart3, Target, Search, Filter, Zap, CheckSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IntelligenceSummary } from '@/components/dashboard/IntelligenceSummary'
import { FocusSuggestion } from '@/components/dashboard/FocusSuggestion'
import { TodoItemCard } from '@/components/dashboard/TodoItemCard'
import { QuickActionsPanel } from '@/components/dashboard/QuickActionsPanel'
import { QuickCheckInForm } from '@/components/dashboard/QuickCheckInForm'
import { ActionFeed } from '@/components/dashboard/ActionFeed'
import { QuickActionButton } from '@/components/dashboard/QuickActionButton'
import { useToast } from '@/hooks/use-toast'
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

interface TodoItem {
  type: 'CHECK_IN' | 'TASK' | 'KEY_RESULT' | 'OBJECTIVE' | 'INITIATIVE'
  id: string
  title: string
  reason: string
  priority: number
  dueDate: string | Date | null
  status: string
  metadata: {
    objectiveId?: string
    objectiveTitle?: string
    keyResultId?: string
    keyResultTitle?: string
    initiativeId?: string
    daysOverdue?: number
    daysSinceUpdate?: number
    [key: string]: any
  }
}

interface IntelligenceData {
  overdueCount: number
  dueThisWeekCount: number
  atRiskCount: number
  staleCount: number
  blockedCount: number
  focusSuggestion: string | null
  patterns: Array<{
    type: string
    message: string
    severity: 'low' | 'medium' | 'high'
  }>
  workloadDistribution: {
    byType: Record<string, number>
    byStatus: Record<string, number>
  }
}

interface QuickActionsData {
  canCheckInBulk: boolean
  overdueCheckInCount: number
  canCompleteTasksToday: boolean
  tasksDueTodayCount: number
  canUpdateAtRiskItems: boolean
  atRiskItemsCount: number
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
  const { currentOrganization, isSuperuser, loading: workspaceLoading } = useWorkspace()
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
  const [myTodos, setMyTodos] = useState<TodoItem[]>([])
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null)
  const [quickActions, setQuickActions] = useState<QuickActionsData | null>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [checkInFormOpen, setCheckInFormOpen] = useState(false)
  const [selectedCheckInKr, setSelectedCheckInKr] = useState<{ id: string; title: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [recentlyViewed, setRecentlyViewed] = useState<Array<{ id: string; type: string; title: string; timestamp: Date }>>([])
  const [draggedTodoIndex, setDraggedTodoIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const { toast } = useToast()

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

  // Fetch My Todos and Intelligence data
  useEffect(() => {
    const fetchMyWork = async () => {
      if (!currentOrganization?.id || !user?.id) {
        setMyOkrs([])
        setMyTodos([])
        setIntelligence(null)
        setQuickActions(null)
        return
      }

      try {
        setMyOkrsLoading(true)
        // Use /me/summary for personal work items
        const response = await api.get('/me/summary')
        const summary = response.data || {}

        const ownedObjectives = summary.ownedObjectives || []
        const todos: TodoItem[] = summary.myTodos || []
        const intelligenceData = summary.intelligence || null
        const activity = summary.recentActivity || []

        setRecentActivity(activity)

        // Transform to match Objective interface
        const objectives: Objective[] = ownedObjectives.map((obj: any) => ({
          id: obj.id,
          title: obj.title,
          status: obj.status,
          progress: obj.progress,
          keyResults: [], // Will be populated separately if needed
        }))

        setMyOkrs(objectives)
        setMyTodos(todos)
        setIntelligence(intelligenceData)

        // Compute quick actions from todos data (no separate API call needed)
        const overdueCheckIns = todos.filter(t => t.type === 'CHECK_IN' && t.reason.includes('Overdue'))
        const tasksDueToday = todos.filter(t => t.type === 'TASK' && t.reason.includes('Due today'))
        const atRiskItems = todos.filter(t => t.reason.includes('At Risk') || t.reason.includes('Off Track'))

        setQuickActions({
          canCheckInBulk: overdueCheckIns.length > 0,
          overdueCheckInCount: overdueCheckIns.length,
          canCompleteTasksToday: tasksDueToday.length > 0,
          tasksDueTodayCount: tasksDueToday.length,
          canUpdateAtRiskItems: atRiskItems.length > 0,
          atRiskItemsCount: atRiskItems.length,
        })

        // Check permissions for creating/publishing
        const overviewResponse = await api.get<OKROverviewResponse>(
          `/okr/overview?tenantId=${currentOrganization.id}&page=1&pageSize=1`
        ).catch(() => ({ data: { canCreateObjective: false, canPublishOKR: false } }))

        setCanCreateObjective(overviewResponse.data.canCreateObjective || false)
        setCanPublishOKR(overviewResponse.data.canPublishOKR || false)
      } catch (error) {
        // Silently handle errors to prevent console spam
        setMyOkrs([])
        setMyTodos([])
        setIntelligence(null)
      } finally {
        setMyOkrsLoading(false)
      }
    }

    fetchMyWork()
  }, [currentOrganization?.id, user?.id])

  // Transform recent activity into feed items
  const feedItems = useMemo(() => {
    return recentActivity.slice(0, 20).map((activity: any, idx: number) => ({
      id: activity.id || `activity-${idx}`,
      type: activity.action === 'CHECK_IN' ? 'checkin' as const :
        activity.action === 'UPDATED' && activity.summary?.includes('status') ? 'status_update' as const :
          activity.action === 'CREATED' ? 'created' as const :
            'progress_update' as const,
      title: activity.summary || activity.action,
      description: activity.actorName ? `by ${activity.actorName}` : undefined,
      timestamp: activity.timestamp || new Date(),
      entityType: activity.entityType || 'OBJECTIVE' as const,
      entityId: activity.entityId || '',
      entityTitle: activity.entityTitle || '',
      status: activity.status,
      progress: activity.progress,
      user: activity.actorName ? { id: activity.actorId || '', name: activity.actorName } : undefined,
    }))
  }, [recentActivity])

  // Load recently viewed from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('okr-recently-viewed')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Filter to last 5 items and convert timestamps
        const recent = parsed
          .slice(0, 5)
          .map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }))
        setRecentlyViewed(recent)
      }
    } catch (error) {
      console.error('Failed to load recently viewed:', error)
    }
  }, [])

  // Helper function to track viewed items
  const trackView = (id: string, type: string, title: string) => {
    try {
      const stored = localStorage.getItem('okr-recently-viewed') || '[]'
      const parsed = JSON.parse(stored)

      // Remove if already exists
      const filtered = parsed.filter((item: any) => !(item.id === id && item.type === type))

      // Add to front
      const updated = [
        { id, type, title, timestamp: new Date().toISOString() },
        ...filtered,
      ].slice(0, 5) // Keep only last 5

      localStorage.setItem('okr-recently-viewed', JSON.stringify(updated))
      setRecentlyViewed(updated.map(item => ({ ...item, timestamp: new Date(item.timestamp) })))
    } catch (error) {
      console.error('Failed to track view:', error)
    }
  }

  // Helper function to refresh todos and intelligence
  const refreshTodos = async () => {
    try {
      const refreshResponse = await api.get('/me/summary')
      setMyTodos(refreshResponse.data.myTodos || [])
      setIntelligence(refreshResponse.data.intelligence || null)
    } catch (error) {
      console.error('Failed to refresh todos:', error)
    }
  }

  // Drag and drop handlers for todo prioritization - memoized to prevent re-renders
  const handleDragStart = useCallback((index: number) => {
    return (e: React.DragEvent) => {
      setDraggedTodoIndex(index)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/html', index.toString())
    }
  }, [])

  const handleDragOver = useCallback((index: number) => {
    return (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setDragOverIndex((prev) => prev !== index ? index : prev)
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedTodoIndex(null)
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback((dropIndex: number) => {
    return (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDraggedTodoIndex((dragIndex) => {
        if (dragIndex === null || dragIndex === dropIndex) {
          setDragOverIndex(null)
          return null
        }

        // Reorder todos
        setMyTodos((currentTodos) => {
          const newTodos = [...currentTodos]
          const [removed] = newTodos.splice(dragIndex, 1)
          newTodos.splice(dropIndex, 0, removed)

          // Update priority based on new position (lower index = higher priority)
          return newTodos.map((todo, idx) => ({
            ...todo,
            priority: idx + 1, // Update priority based on position
          }))
        })

        setDragOverIndex(null)
        return null
      })
    }
  }, [])

  // Helper function to handle todo actions
  const handleTodoAction = async (todo: TodoItem) => {
    const actionKey = `${todo.type}-${todo.id}`
    setActionLoading(prev => ({ ...prev, [actionKey]: true }))

    try {
      if (todo.type === 'CHECK_IN') {
        setSelectedCheckInKr({ id: todo.metadata.keyResultId || todo.id, title: todo.title })
        setCheckInFormOpen(true)
      } else if (todo.type === 'TASK' && todo.status !== 'COMPLETED') {
        // Complete task
        await api.patch(`/tasks/${todo.id}`, { status: 'COMPLETED' })
        toast({ title: 'Task completed', description: `"${todo.title}" has been marked as complete.` })
        // Refresh todos
        const refreshResponse = await api.get('/me/summary')
        setMyTodos(refreshResponse.data.myTodos || [])
      } else if (todo.type === 'OBJECTIVE' || todo.type === 'KEY_RESULT') {
        // Track view
        trackView(todo.id, todo.type, todo.title)
        // Navigate to edit
        const url = todo.type === 'OBJECTIVE'
          ? `/dashboard/okrs/hierarchy?objectiveId=${todo.id}`
          : `/dashboard/okrs/hierarchy?krId=${todo.id}`
        window.location.href = url
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: error.response?.data?.message || error.message || 'Failed to perform action'
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }))
    }
  }

  // Team and workspace OKRs are shown as summary sections that link to filtered views
  // The actual OKR list is fetched on the OKRs page with appropriate filters

  useEffect(() => {
    const fetchDashboard = async () => {
      // Wait for workspace context to finish loading
      if (workspaceLoading) {
        return
      }

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
  }, [currentOrganization?.id, workspaceLoading])

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
    // Superusers have full access - no tooltip needed
    return children
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer variant="dashboard" withGradient>
          <div className="mb-8">
            <PageHeader
              title="My Working Page"
              subtitle={userRoles.isSuperuser
                ? 'System-wide overview with read-only access.'
                : userRoles.isAdmin
                  ? 'Your outstanding work items, OKRs, and intelligence insights.'
                  : userRoles.isManager
                    ? 'Your todos, OKRs, team performance, and cycle overview.'
                    : 'Your todos, OKRs, and progress tracking.'}
              badges={[
                { label: 'AI-assisted', tone: 'neutral' },
                { label: `${myTodos.length} todos`, tone: myTodos.length > 0 ? 'warning' : 'neutral' },
              ]}
            />
          </div>

          <div className="h-[2px] w-full bg-gradient-to-r from-violet-600 via-fuchsia-400 to-transparent rounded-full mb-6" />

          {/* Quick Actions Toolbar */}
          <div className="flex items-center justify-end gap-3 mb-6">
            <Link href="/dashboard/okrs">
              {renderReadOnlyTooltip(
                <Button variant="outline" size="sm" className="gap-2">
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

          {loading || myOkrsLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          ) : (
            <>
              {/* Intelligence Summary Bar */}
              {intelligence && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-6"
                >
                  <IntelligenceSummary
                    overdueCount={intelligence.overdueCount}
                    dueThisWeekCount={intelligence.dueThisWeekCount}
                    atRiskCount={intelligence.atRiskCount}
                    staleCount={intelligence.staleCount}
                    blockedCount={intelligence.blockedCount}
                  />
                </motion.section>
              )}

              {/* Focus Suggestion */}
              {intelligence?.focusSuggestion && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="mb-6"
                >
                  <FocusSuggestion
                    suggestion={intelligence.focusSuggestion}
                    onFocus={() => {
                      // Filter to focus items
                      if (intelligence.overdueCount > 0) {
                        setFilterType('overdue')
                      } else if (intelligence.blockedCount >= 3) {
                        setFilterType('blocked')
                      } else if (intelligence.atRiskCount >= 3) {
                        setFilterType('at-risk')
                      }
                    }}
                  />
                </motion.section>
              )}

              {/* Main Content: My Todos with Right Feed Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                <div className="lg:col-span-2">
                  <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>My Todos</CardTitle>
                            <CardDescription>
                              All outstanding work items that need your attention
                            </CardDescription>
                          </div>
                        </div>

                        {/* Search and Filter */}
                        <div className="flex items-center gap-2 mt-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Search todos..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant={filterType === 'all' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFilterType('all')}
                            >
                              All
                            </Button>
                            <Button
                              variant={filterType === 'overdue' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFilterType('overdue')}
                            >
                              Overdue
                            </Button>
                            <Button
                              variant={filterType === 'due-today' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFilterType('due-today')}
                            >
                              Due Today
                            </Button>
                            <Button
                              variant={filterType === 'at-risk' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFilterType('at-risk')}
                            >
                              At Risk
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {myTodos.length === 0 ? (
                          <div className="text-center py-12">
                            <p className="text-muted-foreground mb-2">No todos at this time.</p>
                            {myOkrs.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                You don't have any Objectives, Key Results, Initiatives, or Tasks yet.
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                All your work items are up to date!
                              </p>
                            )}
                          </div>
                        ) : (
                          <Tabs defaultValue="focus-now" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="focus-now">Focus Now</TabsTrigger>
                              <TabsTrigger value="due-soon">Due Soon</TabsTrigger>
                              <TabsTrigger value="all">All My Work</TabsTrigger>
                            </TabsList>

                            <TabsContent value="focus-now" className="mt-4">
                              <div className="space-y-4">
                                {myTodos
                                  .filter(todo => {
                                    const matchesSearch = !searchQuery ||
                                      todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      todo.reason.toLowerCase().includes(searchQuery.toLowerCase())
                                    const matchesFilter = filterType === 'all' ||
                                      (filterType === 'overdue' && todo.reason.includes('Overdue')) ||
                                      (filterType === 'due-today' && todo.reason.includes('Due today')) ||
                                      (filterType === 'at-risk' && (todo.reason.includes('At Risk') || todo.reason.includes('Off Track')))
                                    return matchesSearch && matchesFilter && todo.priority <= 3
                                  })
                                  .map((todo, index) => (
                                    <TodoItemCard
                                      key={`${todo.type}-${todo.id}`}
                                      todo={todo}
                                      onAction={handleTodoAction}
                                      onStatusUpdate={refreshTodos}
                                      loading={actionLoading[`${todo.type}-${todo.id}`]}
                                      showProgress={todo.type === 'OBJECTIVE' || todo.type === 'KEY_RESULT'}
                                      currentProgress={todo.metadata.progress}
                                      draggable={false}
                                    />
                                  ))}
                                {myTodos.filter(todo => {
                                  const matchesSearch = !searchQuery ||
                                    todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    todo.reason.toLowerCase().includes(searchQuery.toLowerCase())
                                  const matchesFilter = filterType === 'all' ||
                                    (filterType === 'overdue' && todo.reason.includes('Overdue')) ||
                                    (filterType === 'due-today' && todo.reason.includes('Due today')) ||
                                    (filterType === 'at-risk' && (todo.reason.includes('At Risk') || todo.reason.includes('Off Track')))
                                  return matchesSearch && matchesFilter && todo.priority <= 3
                                }).length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                      No high-priority items to focus on
                                    </div>
                                  )}
                              </div>
                            </TabsContent>

                            <TabsContent value="due-soon" className="mt-4">
                              <div className="space-y-4">
                                {myTodos
                                  .filter(todo => {
                                    const matchesSearch = !searchQuery ||
                                      todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      todo.reason.toLowerCase().includes(searchQuery.toLowerCase())
                                    const matchesFilter = filterType === 'all' ||
                                      (filterType === 'overdue' && todo.reason.includes('Overdue')) ||
                                      (filterType === 'due-today' && todo.reason.includes('Due today')) ||
                                      (filterType === 'at-risk' && (todo.reason.includes('At Risk') || todo.reason.includes('Off Track')))
                                    return matchesSearch && matchesFilter && todo.dueDate &&
                                      new Date(todo.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                  })
                                  .map((todo, index) => (
                                    <TodoItemCard
                                      key={`${todo.type}-${todo.id}`}
                                      todo={todo}
                                      onAction={handleTodoAction}
                                      onStatusUpdate={refreshTodos}
                                      loading={actionLoading[`${todo.type}-${todo.id}`]}
                                      showProgress={todo.type === 'OBJECTIVE' || todo.type === 'KEY_RESULT'}
                                      currentProgress={todo.metadata.progress}
                                      draggable={false}
                                    />
                                  ))}
                                {myTodos.filter(todo => {
                                  const matchesSearch = !searchQuery ||
                                    todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    todo.reason.toLowerCase().includes(searchQuery.toLowerCase())
                                  const matchesFilter = filterType === 'all' ||
                                    (filterType === 'overdue' && todo.reason.includes('Overdue')) ||
                                    (filterType === 'due-today' && todo.reason.includes('Due today')) ||
                                    (filterType === 'at-risk' && (todo.reason.includes('At Risk') || todo.reason.includes('Off Track')))
                                  return matchesSearch && matchesFilter && todo.dueDate &&
                                    new Date(todo.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                }).length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                      No items due soon
                                    </div>
                                  )}
                              </div>
                            </TabsContent>

                            <TabsContent value="all" className="mt-4">
                              <div className="space-y-4">
                                {myTodos
                                  .filter(todo => {
                                    const matchesSearch = !searchQuery ||
                                      todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      todo.reason.toLowerCase().includes(searchQuery.toLowerCase())
                                    const matchesFilter = filterType === 'all' ||
                                      (filterType === 'overdue' && todo.reason.includes('Overdue')) ||
                                      (filterType === 'due-today' && todo.reason.includes('Due today')) ||
                                      (filterType === 'at-risk' && (todo.reason.includes('At Risk') || todo.reason.includes('Off Track')))
                                    return matchesSearch && matchesFilter
                                  })
                                  .map((todo, index) => (
                                    <TodoItemCard
                                      key={`${todo.type}-${todo.id}`}
                                      todo={todo}
                                      onAction={handleTodoAction}
                                      onStatusUpdate={refreshTodos}
                                      loading={actionLoading[`${todo.type}-${todo.id}`]}
                                      showProgress={todo.type === 'OBJECTIVE' || todo.type === 'KEY_RESULT'}
                                      currentProgress={todo.metadata.progress}
                                      draggable={false}
                                    />
                                  ))}
                                {myTodos.filter(todo => {
                                  const matchesSearch = !searchQuery ||
                                    todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    todo.reason.toLowerCase().includes(searchQuery.toLowerCase())
                                  const matchesFilter = filterType === 'all' ||
                                    (filterType === 'overdue' && todo.reason.includes('Overdue')) ||
                                    (filterType === 'due-today' && todo.reason.includes('Due today')) ||
                                    (filterType === 'at-risk' && (todo.reason.includes('At Risk') || todo.reason.includes('Off Track')))
                                  return matchesSearch && matchesFilter
                                }).length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                      No todos match your filters
                                    </div>
                                  )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        )}
                      </CardContent>
                    </Card>
                  </motion.section>
                </div>

                {/* Right Feed Panel */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Quick Actions */}
                  {quickActions && (
                    <motion.section
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                    >
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {quickActions.canCheckInBulk && (
                            <QuickActionButton
                              label={`Check in ${quickActions.overdueCheckInCount} overdue KR${quickActions.overdueCheckInCount !== 1 ? 's' : ''}`}
                              onClick={async () => {
                                const overdueCheckIn = myTodos.find(t => t.type === 'CHECK_IN' && t.reason.includes('Overdue'))
                                if (overdueCheckIn) {
                                  setSelectedCheckInKr({
                                    id: overdueCheckIn.metadata.keyResultId || overdueCheckIn.id,
                                    title: overdueCheckIn.title
                                  })
                                  setCheckInFormOpen(true)
                                }
                              }}
                              icon={<Zap className="w-4 h-4" />}
                              variant="default"
                            />
                          )}

                          {quickActions.canCompleteTasksToday && (
                            <QuickActionButton
                              label={`Complete ${quickActions.tasksDueTodayCount} task${quickActions.tasksDueTodayCount !== 1 ? 's' : ''} due today`}
                              onClick={async () => {
                                const tasksDueToday = myTodos.filter(t => t.type === 'TASK' && t.reason.includes('Due today'))
                                if (tasksDueToday.length === 0) return

                                try {
                                  // Complete all tasks in parallel
                                  await Promise.all(
                                    tasksDueToday.map(task =>
                                      api.patch(`/tasks/${task.id}`, { status: 'COMPLETED' })
                                    )
                                  )

                                  toast({
                                    title: 'Tasks completed',
                                    description: `Successfully completed ${tasksDueToday.length} task${tasksDueToday.length !== 1 ? 's' : ''}.`
                                  })

                                  // Refresh todos
                                  await refreshTodos()
                                } catch (error: any) {
                                  toast({
                                    variant: 'destructive',
                                    title: 'Failed to complete tasks',
                                    description: error.response?.data?.message || error.message || 'Some tasks could not be completed'
                                  })
                                }
                              }}
                              icon={<CheckSquare className="w-4 h-4" />}
                              variant="outline"
                            />
                          )}

                          {quickActions.canUpdateAtRiskItems && (
                            <QuickActionButton
                              label={`Update ${quickActions.atRiskItemsCount} at-risk item${quickActions.atRiskItemsCount !== 1 ? 's' : ''}`}
                              onClick={async () => {
                                const atRiskItems = myTodos.filter(t => t.reason.includes('At Risk') || t.reason.includes('Off Track'))
                                if (atRiskItems.length === 0) return

                                try {
                                  // Update all at-risk items to ON_TRACK in parallel
                                  await Promise.all(
                                    atRiskItems.map(item => {
                                      if (item.type === 'OBJECTIVE') {
                                        return api.patch(`/objectives/${item.id}`, { status: 'ON_TRACK' })
                                      } else if (item.type === 'KEY_RESULT') {
                                        return api.patch(`/key-results/${item.id}`, { status: 'ON_TRACK' })
                                      } else if (item.type === 'INITIATIVE') {
                                        return api.patch(`/initiatives/${item.id}`, { status: 'IN_PROGRESS' })
                                      }
                                      return Promise.resolve()
                                    })
                                  )

                                  toast({
                                    title: 'Status updated',
                                    description: `Successfully updated ${atRiskItems.length} item${atRiskItems.length !== 1 ? 's' : ''} to on track.`
                                  })

                                  // Refresh todos
                                  await refreshTodos()
                                } catch (error: any) {
                                  toast({
                                    variant: 'destructive',
                                    title: 'Failed to update status',
                                    description: error.response?.data?.message || error.message || 'Some items could not be updated'
                                  })
                                }
                              }}
                              icon={<AlertCircle className="w-4 h-4" />}
                              variant="outline"
                            />
                          )}

                          {!quickActions.canCheckInBulk && !quickActions.canCompleteTasksToday && !quickActions.canUpdateAtRiskItems && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No quick actions available
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </motion.section>
                  )}

                  {/* Activity Feed */}
                  <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                    className="h-full"
                  >
                    <ActionFeed
                      items={feedItems}
                      onItemClick={(item) => {
                        // Track view
                        trackView(item.entityId, item.entityType, item.entityTitle)
                        // Navigate to the item
                        if (item.entityType === 'OBJECTIVE') {
                          window.location.href = `/dashboard/okrs/hierarchy?objectiveId=${item.entityId}`
                        } else if (item.entityType === 'KEY_RESULT') {
                          window.location.href = `/dashboard/okrs/hierarchy?krId=${item.entityId}`
                        } else if (item.entityType === 'TASK') {
                          window.location.href = `/dashboard/okrs/hierarchy?taskId=${item.entityId}`
                        } else if (item.entityType === 'INITIATIVE') {
                          window.location.href = `/dashboard/okrs/hierarchy?initiativeId=${item.entityId}`
                        }
                      }}
                      className="h-full"
                    />

                    {/* Recently Viewed Section */}
                    {recentlyViewed.length > 0 && (
                      <motion.section
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.5 }}
                        className="mt-6"
                      >
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Recently Viewed</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {recentlyViewed.map((item) => (
                                <Button
                                  key={`${item.type}-${item.id}`}
                                  variant="ghost"
                                  className="w-full justify-start text-left h-auto py-2"
                                  onClick={() => {
                                    trackView(item.id, item.type, item.title)
                                    const url = item.type === 'OBJECTIVE'
                                      ? `/dashboard/okrs/hierarchy?objectiveId=${item.id}`
                                      : item.type === 'KEY_RESULT'
                                        ? `/dashboard/okrs/hierarchy?krId=${item.id}`
                                        : item.type === 'INITIATIVE'
                                          ? `/dashboard/okrs/hierarchy?initiativeId=${item.id}`
                                          : `/dashboard/okrs/hierarchy?taskId=${item.id}`
                                    window.location.href = url
                                  }}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Target className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                    <span className="text-sm truncate">{item.title}</span>
                                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                                      {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                    </span>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.section>
                    )}
                  </motion.section>
                </div>
              </div>

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
                          <Link href="/dashboard/okrs/hierarchy?action=create">
                            <Button variant="outline" size="sm">
                              Create OKR
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {myOkrsLoading ? (
                        <div className="text-sm text-muted-foreground py-4">Loading your OKRs...</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="text-sm">
                              <div className="font-medium text-card-foreground mb-1">Objectives</div>
                              <div className="text-2xl font-semibold">{myOkrsCount}</div>
                            </div>
                            <div className="text-sm">
                              <div className="font-medium text-card-foreground mb-1">At Risk</div>
                              <div className={`text-2xl font-semibold ${myOkrsAtRisk > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {myOkrsAtRisk}
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="font-medium text-card-foreground mb-1">Key Results</div>
                              <div className="text-2xl font-semibold">
                                {myOkrs.reduce((sum, obj) => sum + (obj.keyResults?.length || 0), 0)}
                              </div>
                            </div>
                          </div>
                          {myOkrs.length > 0 && (
                            <Link href="/dashboard/okrs/hierarchy?ownerId=self">
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
                      <div className="text-sm text-muted-foreground mb-4">
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
                      <Link href="/dashboard/okrs/hierarchy">
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
              {(userRoles.isManager || userRoles.isAdmin || userRoles.isSuperuser || user?.role === 'ORG_ADMIN') && activeCycleId && (
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
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground py-4">
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
                  <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                    Attention Feed
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
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
                            className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted transition-colors"
                          >
                            <div className="mt-0.5">{getAttentionItemIcon(item.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {item.type.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              <p className="text-sm text-card-foreground">
                                {getAttentionItemLabel(item)}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-6 mt-2"
                                onClick={() => {
                                  if (item.keyResultId) {
                                    window.location.href = `/dashboard/okrs/hierarchy?krId=${item.keyResultId}`
                                  } else {
                                    window.location.href = `/dashboard/okrs/hierarchy?objectiveId=${item.objectiveId}`
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
                      <div className="text-sm text-muted-foreground text-center py-6">
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
                  <div className="text-sm bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 border border-border rounded-lg p-3 shadow-sm flex items-start gap-2">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-violet-500/20 text-violet-300 flex-shrink-0">
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
              window.location.href = `/dashboard/okrs/hierarchy?objectiveId=${objectiveId}`
            }}
            onNavigateToKeyResult={(krId) => {
              window.location.href = `/dashboard/okrs/hierarchy?krId=${krId}`
            }}
            canRequestCheckIn={!userRoles.isSuperuser && permissions.canEditOKR({ ownerId: user?.id || '', tenantId: currentOrganization?.id || undefined })}
          />

          {/* Quick Check-In Form */}
          {selectedCheckInKr && (
            <QuickCheckInForm
              keyResultId={selectedCheckInKr.id}
              keyResultTitle={selectedCheckInKr.title}
              isOpen={checkInFormOpen}
              onClose={() => {
                setCheckInFormOpen(false)
                setSelectedCheckInKr(null)
              }}
              onSuccess={() => {
                // Refresh todos after successful check-in
                const fetchMyWork = async () => {
                  try {
                    const response = await api.get('/me/summary')
                    const summary = response.data || {}
                    setMyTodos(summary.myTodos || [])
                    setIntelligence(summary.intelligence || null)
                  } catch (error) {
                    console.error('Failed to refresh todos:', error)
                  }
                }
                fetchMyWork()
              }}
            />
          )}
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
