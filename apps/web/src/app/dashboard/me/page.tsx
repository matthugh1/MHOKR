'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, TrendingDown, Minus, Clock, AlertCircle } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { AvatarCircle } from '@/components/dashboard/AvatarCircle'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'
import Link from 'next/link'
import { NewAsyncUpdateModal } from '@/components/okr/NewAsyncUpdateModal'
import { Button } from '@/components/ui/button'

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

interface Initiative {
  id: string
  title: string
  ownerId: string
  dueDate: string | null
}

interface MyDashboardSummary {
  ownedObjectives: OwnedObjective[]
  ownedKeyResults: OwnedKeyResult[]
  recentActivity: any[]
  overdueCheckIns: OverdueCheckIn[]
}

interface CheckInRequest {
  id: string
  requesterUserId: string
  requester: {
    id: string
    name: string
    email: string
  }
  targetUserId: string
  dueAt: string
  status: 'OPEN' | 'LATE' | 'SUBMITTED' | 'CANCELLED'
  createdAt: string
  response?: {
    id: string
    summaryWhatMoved: string | null
    summaryBlocked: string | null
    summaryNeedHelp: string | null
    submittedAt: string
  } | null
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else {
    return `${diffDays}d ago`
  }
}

export default function MyDashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<MyDashboardSummary | null>(null)
  const [checkInFeed, setCheckInFeed] = useState<CheckInFeedItem[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [checkInRequests, setCheckInRequests] = useState<CheckInRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)

  useEffect(() => {
    const fetchMyDashboard = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const [summaryRes, feedRes, initiativesRes, requestsRes] = await Promise.allSettled([
          api.get('/me/summary').catch(() => ({ data: { ownedObjectives: [], ownedKeyResults: [], recentActivity: [], overdueCheckIns: [] } })),
          api.get('/reports/analytics/feed').catch(() => ({ data: [] })),
          api.get('/initiatives').catch(() => ({ data: [] })),
          api.get('/okr/checkin-requests/mine').catch(() => ({ data: [] })),
        ])

        setSummary(
          summaryRes.status === 'fulfilled' && summaryRes.value?.data
            ? summaryRes.value.data
            : { ownedObjectives: [], ownedKeyResults: [], recentActivity: [], overdueCheckIns: [] }
        )
        setCheckInFeed(
          feedRes.status === 'fulfilled' && Array.isArray(feedRes.value?.data)
            ? feedRes.value.data
            : []
        )
        setInitiatives(
          initiativesRes.status === 'fulfilled' && Array.isArray(initiativesRes.value?.data)
            ? initiativesRes.value.data
            : []
        )
        setCheckInRequests(
          requestsRes.status === 'fulfilled' && Array.isArray(requestsRes.value?.data)
            ? requestsRes.value.data
            : []
        )
      } catch (error) {
        console.error('Failed to fetch my dashboard:', error)
        setSummary({
          ownedObjectives: [],
          ownedKeyResults: [],
          recentActivity: [],
          overdueCheckIns: [],
        })
        setCheckInFeed([])
        setInitiatives([])
        setCheckInRequests([])
      } finally {
        setLoading(false)
      }
    }

    fetchMyDashboard()
  }, [user?.id])

  const handleAsyncUpdateSubmitted = () => {
    // Optimistically remove the request from the list
    if (selectedRequestId) {
      setCheckInRequests(prev => prev.filter(req => req.id !== selectedRequestId))
      setSelectedRequestId(null)
    }
    // TODO [phase6-polish]: fade out row after submit
  }

  // Optimised memoised myItems object for client filtering
  const myItems = useMemo(() => {
    const objectives = summary?.ownedObjectives || []
    const keyResults = summary?.ownedKeyResults || []
    
    return {
      objectives,
      keyResults,
      keyResultIds: new Set(keyResults.map(kr => kr.id)),
      atRiskObjectives: objectives.filter(obj => obj.status === 'AT_RISK'),
      atRiskKeyResults: keyResults.filter(kr => kr.status === 'AT_RISK'),
      objectivesTop2: objectives.slice(0, 2),
      keyResultsTop2: keyResults.slice(0, 2),
      atRiskObjectivesTop2: objectives.filter(obj => obj.status === 'AT_RISK').slice(0, 2),
    }
  }, [summary?.ownedObjectives, summary?.ownedKeyResults])

  // Filter data for current user (using memoised myItems)
  const _myKeyResultIds = myItems.keyResultIds
  const _myObjectives = myItems.objectivesTop2
  const _myKeyResults = myItems.keyResultsTop2
  const atRiskObjectives = myItems.atRiskObjectivesTop2
  const atRiskObjectivesCount = myItems.atRiskObjectives.length
  const atRiskKeyResultsCount = myItems.atRiskKeyResults.length

  // Overdue check-ins (already filtered by backend for current user)
  const overdueCheckIns = summary?.overdueCheckIns || []

  // Update Discipline: percentage of KRs where latest check-in is within cadence
  // TODO [phase7-hardening]: Move cadence logic server-side
  const updateDiscipline = useMemo(() => {
    const keyResults = myItems.keyResults
    if (keyResults.length === 0) return { percentage: 0, onTime: 0, total: 0 }

    const now = new Date()
    let onTime = 0
    let total = 0

    keyResults.forEach(kr => {
      if (!kr.checkInCadence || kr.checkInCadence === 'NONE') {
        // KRs without cadence don't count
        return
      }

      total++

      // Determine cadence days
      let cadenceDays: number
      switch (kr.checkInCadence) {
        case 'WEEKLY':
          cadenceDays = 7
          break
        case 'MONTHLY':
          cadenceDays = 30
          break
        case 'BIWEEKLY':
          cadenceDays = 14
          break
        default:
          return // Unknown cadence, skip
      }

      // Check if latest check-in is within cadence
      if (kr.lastCheckInAt) {
        const lastCheckIn = new Date(kr.lastCheckInAt)
        const daysSinceCheckIn = Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceCheckIn <= cadenceDays) {
          onTime++
        }
      } else {
        // No check-in ever - check if KR is still within creation + cadence window
        // For simplicity, treat as not on time if no check-in exists
        // (This could be improved but follows the requirement)
      }
    })

    const percentage = total > 0 ? Math.round((onTime / total) * 100) : 0
    return { percentage, onTime, total }
  }, [myItems.keyResults])

  // Needs attention: combine at-risk objectives + overdue check-ins (limit 2)
  const needsAttentionItems = useMemo(() => {
    const items: Array<{
      type: 'objective' | 'check-in'
      id: string
      title: string
      status?: string
      progress?: number
      pillar?: { id: string; name: string } | null
      cycleStatus?: string | null
      objectiveTitle?: string
      daysLate?: number
      cadence?: string | null
      lastCheckInAt?: string | null
    }> = []

    // Add at-risk objectives
    atRiskObjectives.forEach(obj => {
      items.push({
        type: 'objective',
        id: obj.id,
        title: obj.title,
        status: obj.status,
        progress: obj.progress,
        pillar: obj.pillar,
        cycleStatus: obj.cycleStatus,
      })
    })

    // Add overdue check-ins
    overdueCheckIns.forEach(item => {
      items.push({
        type: 'check-in',
        id: item.krId,
        title: item.krTitle,
        objectiveTitle: item.objectiveTitle,
        daysLate: item.daysLate,
        cadence: item.cadence,
        lastCheckInAt: item.lastCheckInAt,
      })
    })

    return items.slice(0, 2)
  }, [atRiskObjectives, overdueCheckIns])

  // Upcoming deadlines: KRs with next check-in due ≤ 7 days + initiatives with dueDate ≤ 7 days
  // Exclude items already shown in needs attention
  // TODO [phase7-hardening]: Move cadence/overdue logic server-side
  const upcomingDeadlinesFiltered = useMemo(() => {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const needsAttentionIds = new Set(needsAttentionItems.map(item => item.id))
    const deadlines: Array<{
      type: 'kr' | 'initiative'
      id: string
      title: string
      dueDate: Date
      cadence?: string | null
      daysUntil: number
    }> = []

    // Add KRs with next check-in due ≤ 7 days (exclude if already in needs attention)
    myItems.keyResults.forEach(kr => {
      if (needsAttentionIds.has(kr.id)) return // Exclude already shown items
      if (!kr.checkInCadence || kr.checkInCadence === 'NONE') return

      // Calculate cadence days
      let cadenceDays: number
      switch (kr.checkInCadence) {
        case 'WEEKLY':
          cadenceDays = 7
          break
        case 'BIWEEKLY':
          cadenceDays = 14
          break
        case 'MONTHLY':
          cadenceDays = 30
          break
        default:
          return
      }

      // Calculate next due date
      const lastCheckIn = kr.lastCheckInAt ? new Date(kr.lastCheckInAt) : new Date() // Use now if no check-in
      const nextDueDate = new Date(lastCheckIn.getTime() + cadenceDays * 24 * 60 * 60 * 1000)
      const daysUntil = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (nextDueDate <= sevenDaysFromNow && nextDueDate >= now) {
        deadlines.push({
          type: 'kr',
          id: kr.id,
          title: kr.title,
          dueDate: nextDueDate,
          cadence: kr.checkInCadence,
          daysUntil,
        })
      }
    })

    // Add initiatives owned by user with dueDate in next 7 days (exclude if already in needs attention)
    initiatives
      .filter(init => init.ownerId === user?.id && init.dueDate && !needsAttentionIds.has(init.id))
      .forEach(init => {
        const dueDate = new Date(init.dueDate!)
        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (dueDate <= sevenDaysFromNow && dueDate >= now) {
          deadlines.push({
            type: 'initiative',
            id: init.id,
            title: init.title,
            dueDate,
            daysUntil,
          })
        }
      })

    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).slice(0, 2)
  }, [myItems.keyResults, initiatives, user?.id, needsAttentionItems])

  // Rhythm: Activity feed filtered to userId = me, limit 3, newest first, last 14 days only
  // Using check-in feed filtered for current user's check-ins
  const rhythmFeed = useMemo(() => {
    if (!user?.id) return []
    
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    
    return checkInFeed
      .filter(item => {
        // Filter by userId === currentUser.id
        if (item.userId !== user.id) return false
        
        // Filter to last 14 days
        const itemDate = new Date(item.createdAt)
        if (itemDate < fourteenDaysAgo) return false
        
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
  }, [checkInFeed, user?.id])

  // Calculate footer metric: updated KRs in last 7 days
  const updateMetrics = useMemo(() => {
    if (!user?.id) return { updatedCount: 0, totalMyKRs: 0, ratio: 0 }
    
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const totalMyKRs = myItems.keyResults.length
    
    // Get unique KR IDs that were updated in last 7 days by current user
    const updatedKrIds = new Set<string>()
    checkInFeed
      .filter(item => {
        if (item.userId !== user.id) return false
        const itemDate = new Date(item.createdAt)
        return itemDate >= sevenDaysAgo
      })
      .forEach(item => {
        updatedKrIds.add(item.krId)
      })
    
    const updatedCount = updatedKrIds.size
    const ratio = totalMyKRs > 0 ? updatedCount / totalMyKRs : 0
    
    return { updatedCount, totalMyKRs, ratio }
  }, [checkInFeed, user?.id, myItems.keyResults])

  // Calculate KPIs for performance snapshot
  const totalObjectives = myItems.objectives.length
  const totalKeyResults = myItems.keyResults.length
  const overdueCount = overdueCheckIns.length
  const needsAttentionCount = atRiskObjectivesCount + overdueCount

  // Generate AI summary message
  const aiSummary = useMemo(() => {
    if (atRiskObjectivesCount > 0) {
      return 'You have objectives at risk. Focus is required this week.'
    } else if (overdueCount > 0) {
      return 'You\'re missing check-ins. Execution discipline is slipping.'
    } else {
      return 'Execution looks steady. Most objectives are tracking and check-ins are up to date.'
    }
  }, [atRiskObjectivesCount, overdueCount])

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="bg-neutral-50 min-h-screen relative">
            <div className="max-w-[1400px] mx-auto px-6 py-6 relative">
              <div className="text-center py-12">
                <p className="text-neutral-500">Loading your dashboard...</p>
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="bg-neutral-50 min-h-screen relative">
          {/* Gradient mask at top */}
          <div className="absolute top-0 left-0 w-full h-[160px] bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
          <div className="max-w-[1400px] mx-auto px-6 py-6 relative">
            {/* Header */}
            <motion.header
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-4"
            >
              <h1 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                My performance snapshot
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600/10 to-fuchsia-400/10 text-violet-700 border border-violet-300/40">
                  AI-assisted
                </span>
              </h1>
              <p className="text-sm text-neutral-500">
                Personal delivery status, cadence discipline, and risk.
              </p>
            </motion.header>

            {/* Gradient accent line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-violet-600 via-fuchsia-400 to-violet-300/40 rounded-full mb-6" />

            {/* SECTION 0: YOUR UPDATES DUE */}
            {checkInRequests.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-8"
              >
                <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-neutral-900 mb-0.5">
                        Your updates due
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Updates requested by your manager
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {checkInRequests.map((request) => {
                      const isOverdue = request.status === 'LATE'
                      const dueDate = new Date(request.dueAt)
                      const formattedDueDate = dueDate.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })

                      return (
                        <li
                          key={request.id}
                          className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {isOverdue ? (
                                <span className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                                  Overdue
                                </span>
                              ) : (
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 border border-amber-500/30">
                                  Update due
                                </span>
                              )}
                              <span className="text-xs text-neutral-500">
                                Due: {formattedDueDate}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-600">
                              Requested by {request.requester.name}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setSelectedRequestId(request.id)}
                            className="flex-shrink-0"
                            aria-label={`Submit update for request due ${formattedDueDate}`}
                          >
                            Submit update
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </motion.section>
            )}

            {/* SECTION 1: MY PERFORMANCE SNAPSHOT · AI-ASSISTED */}
            <section className="mb-8">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.08,
                    },
                  },
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 12, scale: 0.95 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        type: 'spring',
                        stiffness: 300,
                        damping: 24,
                      },
                    },
                  }}
                >
                  <KpiCard
                    label="My Objectives"
                    value={totalObjectives > 0 ? totalObjectives : '--'}
                    meta={
                      <span className="flex items-center gap-1.5">
                        {totalObjectives > 0 ? (
                          <>
                            {atRiskObjectivesCount > 0 ? (
                              <TrendingDown className="h-3 w-3 text-rose-600" aria-hidden="true" />
                            ) : (
                              <Minus className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                            )}
                            <span>{atRiskObjectivesCount} need attention</span>
                          </>
                        ) : (
                          'No objectives yet'
                        )}
                      </span>
                    }
                    tone={atRiskObjectivesCount > 0 ? 'bad' : 'good'}
                    delay={0}
                  />
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 12, scale: 0.95 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        type: 'spring',
                        stiffness: 300,
                        damping: 24,
                      },
                    },
                  }}
                >
                  <KpiCard
                    label="My Key Results"
                    value={totalKeyResults > 0 ? totalKeyResults : '--'}
                    meta={
                      <span className="flex items-center gap-1.5">
                        {totalKeyResults > 0 ? (
                          <>
                            {atRiskKeyResultsCount > 0 ? (
                              <TrendingDown className="h-3 w-3 text-rose-600" aria-hidden="true" />
                            ) : (
                              <Minus className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                            )}
                            <span>{atRiskKeyResultsCount} at risk</span>
                          </>
                        ) : (
                          'No key results yet'
                        )}
                      </span>
                    }
                    tone={atRiskKeyResultsCount > 0 ? 'bad' : 'good'}
                    delay={0.05}
                  />
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 12, scale: 0.95 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        type: 'spring',
                        stiffness: 300,
                        damping: 24,
                      },
                    },
                  }}
                >
                  <KpiCard
                    label="Update Discipline"
                    value={updateDiscipline.total > 0 ? `${updateDiscipline.percentage}%` : '--'}
                    meta={
                      <span className="flex items-center gap-1.5">
                        {updateDiscipline.total > 0 ? (
                          <>
                            {updateDiscipline.percentage >= 70 ? (
                              <TrendingUp className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                            ) : updateDiscipline.percentage < 40 ? (
                              <TrendingDown className="h-3 w-3 text-rose-600" aria-hidden="true" />
                            ) : (
                              <Minus className="h-3 w-3 text-amber-600" aria-hidden="true" />
                            )}
                            <span>{updateDiscipline.onTime} of {updateDiscipline.total} on cadence</span>
                          </>
                        ) : (
                          'No cadence set'
                        )}
                      </span>
                    }
                    tone={updateDiscipline.percentage >= 70 ? 'good' : updateDiscipline.percentage >= 40 ? 'warning' : 'bad'}
                    trend={updateDiscipline.percentage >= 70 ? { direction: 'flat', text: 'On pace' } : updateDiscipline.percentage < 40 ? { direction: 'down', text: 'Falling behind' } : undefined}
                    delay={0.1}
                  />
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 12, scale: 0.95 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        type: 'spring',
                        stiffness: 300,
                        damping: 24,
                      },
                    },
                  }}
                >
                  <KpiCard
                    label="Needs Attention"
                    value={needsAttentionCount > 0 ? needsAttentionCount : '--'}
                    meta={
                      <span className="flex items-center gap-1.5">
                        {needsAttentionCount > 0 ? (
                          <>
                            <TrendingUp className="h-3 w-3 text-rose-600" aria-hidden="true" />
                            <span>
                              {needsAttentionCount === 1
                                ? '1 item requires follow-up'
                                : `${needsAttentionCount} items require follow-up`}
                            </span>
                          </>
                        ) : (
                          <>
                            <Minus className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                            <span>No active escalations</span>
                          </>
                        )}
                      </span>
                    }
                    tone={needsAttentionCount > 0 ? 'bad' : 'good'}
                    trend={needsAttentionCount > 0 ? { direction: 'up', text: 'Escalate to owners' } : { direction: 'flat', text: 'All stable' }}
                    delay={0.15}
                  />
                </motion.div>
              </motion.div>

              {/* AI Summary Bar */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="mt-3 text-sm bg-gradient-to-r from-violet-50 via-fuchsia-50 to-violet-50 border border-neutral-200 rounded-lg p-2.5 shadow-sm flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2 flex-1">
                  <div className="flex items-center justify-center h-5 w-5 rounded-full bg-violet-100 text-violet-700 flex-shrink-0 mt-0.5" aria-hidden="true">
                    <Sparkles size={12} />
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-800">{aiSummary}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/80 border border-neutral-200 flex items-center gap-1 flex-shrink-0" style={{ color: '#404040' }}>
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Last refreshed {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            </section>

            {/* SECTION 2: MY PRIORITIES THIS WEEK */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="mt-8"
            >
              <h2 className="text-sm font-semibold text-neutral-900 mb-4">
                My priorities this week
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* LEFT COLUMN — Needs attention */}
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 24,
                    delay: 0.3,
                  }}
                  className="relative rounded-xl bg-white border border-neutral-200 hover:shadow-md transition-all p-3 overflow-hidden"
                >
                  {/* Subtle coloured edge bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 via-amber-400 to-rose-500" />
                  
                  <div className="mb-2.5 pl-3">
                    <h3 className="text-xs font-semibold text-neutral-900 mb-0.5">
                      Needs attention
                    </h3>
                    <p className="text-[10px]" style={{ color: '#525252' }}>
                      These require follow-up this week
                    </p>
                  </div>

                  {needsAttentionItems.length > 0 ? (
                    <>
                      <ul className="space-y-2.5 pl-3">
                        {needsAttentionItems.map((item) => (
                          <li key={item.id} className="border-b border-neutral-100 last:border-0 pb-2 last:pb-0">
                            {/* Line 1: bold title + status chip */}
                            <div className="flex items-start gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-neutral-900 flex-1 leading-tight">
                                {item.title}
                              </span>
                              {item.type === 'objective' && item.status === 'AT_RISK' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-800 border border-red-500/30 flex-shrink-0" style={{ color: '#991b1b' }}>
                                  AT RISK
                                </span>
                              )}
                            </div>

                            {/* Line 2: Progress and metadata */}
                            {item.type === 'objective' && (
                              <div className="text-[10px] mb-0.5 leading-tight" style={{ color: '#525252' }}>
                                Progress: {Math.round(item.progress || 0)}%
                                {item.pillar && ` · Pillar: ${item.pillar.name}`}
                              </div>
                            )}

                            {/* Line 3: Cycle, check-in, cadence */}
                            <div className="text-[10px] leading-tight" style={{ color: '#525252' }}>
                              {item.type === 'objective' && item.cycleStatus && (
                                <>Cycle: {item.cycleStatus}</>
                              )}
                              {item.type === 'check-in' && item.lastCheckInAt && (
                                <>Last check-in: {formatTimeAgo(item.lastCheckInAt)}</>
                              )}
                              {item.cadence && (
                                <>
                                  {item.type === 'objective' ? ' · ' : ' · '}
                                  Cadence: {item.cadence}
                                </>
                              )}
                              {item.type === 'check-in' && item.daysLate !== undefined && (
                                <> · {item.daysLate}d late</>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {(atRiskObjectives.length + overdueCheckIns.length) > 2 && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-200 pl-3">
                          <Link
                            href="/dashboard/okrs"
                            className="text-[10px] font-medium text-violet-600 hover:text-violet-700 transition-colors"
                          >
                            View all →
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs italic py-3 pl-3" style={{ color: '#525252' }}>
                      No items need attention this week.
                    </div>
                  )}
                </motion.div>

                {/* RIGHT COLUMN — Upcoming deadlines */}
                <motion.div
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 24,
                    delay: 0.35,
                  }}
                  className="relative rounded-xl bg-white border border-neutral-200 hover:shadow-md transition-all p-3 overflow-hidden"
                >
                  {/* Subtle coloured edge bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 via-violet-400 to-blue-500" />
                  
                  <div className="mb-2.5 pl-3">
                    <h3 className="text-xs font-semibold text-neutral-900 mb-0.5">
                      Upcoming deadlines
                    </h3>
                    <p className="text-[10px]" style={{ color: '#525252' }}>
                      Due in the next 7 days
                    </p>
                  </div>

                  {upcomingDeadlinesFiltered.length > 0 ? (
                    <>
                      <ul className="space-y-2.5 pl-3">
                        {upcomingDeadlinesFiltered.map((deadline) => {
                          const formatDeadline = (type: 'kr' | 'initiative') => {
                            if (type === 'kr') {
                              // For KRs: "due in X days"
                              if (deadline.daysUntil === 0) {
                                return 'due today'
                              } else if (deadline.daysUntil === 1) {
                                return 'due in 1 day'
                              } else {
                                return `due in ${deadline.daysUntil} days`
                              }
                            } else {
                              // For initiatives: "due Friday" (day name)
                              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                              const dayName = dayNames[deadline.dueDate.getDay()]
                              return `due ${dayName}`
                            }
                          }

                          return (
                            <li key={deadline.id} className="border-b border-neutral-100 last:border-0 pb-2 last:pb-0">
                              {/* Line 1: bold title */}
                              <div className="text-xs font-semibold text-neutral-900 mb-0.5 leading-tight">
                                {deadline.title}
                              </div>

                              {/* Line 2: due date and type */}
                              <div className="text-[10px] leading-tight" style={{ color: '#525252' }}>
                                {deadline.type === 'kr' ? (
                                  <>
                                    Check-in {formatDeadline('kr')}
                                    {deadline.cadence && ` · Cadence: ${deadline.cadence}`}
                                  </>
                                ) : (
                                  <>
                                    Milestone {formatDeadline('initiative')} · Initiative
                                  </>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>

                      {upcomingDeadlinesFiltered.length > 2 && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-200 pl-3">
                          <Link
                            href="/dashboard/planner"
                            className="text-[10px] font-medium text-violet-600 hover:text-violet-700 transition-colors"
                          >
                            Open planner →
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs italic py-3 pl-3" style={{ color: '#525252' }}>
                      No upcoming deadlines this week.
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.section>

            {/* SECTION 3: OPERATING RHYTHM */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="mt-8 bg-white border border-neutral-200 rounded-xl shadow-sm p-4 transition-all duration-200 hover:shadow-md hover:border-neutral-300"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900 mb-0.5">
                    Operating rhythm
                  </h2>
                  <p className="text-xs" style={{ color: '#525252' }}>
                    Your recent updates
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200 flex-shrink-0" style={{ color: '#525252' }}>
                  Updated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {rhythmFeed.length > 0 ? (
                <>
                  <ul className="divide-y divide-neutral-200">
                    {rhythmFeed.map((item) => {
                      const confidence = item.confidence || 0
                      const confidenceDotColor =
                        confidence > 80 ? 'bg-emerald-500' : confidence >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      
                      return (
                        <li
                          key={item.id}
                          className="py-2.5 flex items-start gap-3 transition-colors hover:bg-neutral-50 rounded"
                        >
                          <AvatarCircle name={item.userName || 'Unknown User'} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-neutral-900">
                                You checked in
                              </span>
                              <div className={`h-2 w-2 rounded-full ${confidenceDotColor} flex-shrink-0`} />
                              <span className="text-[11px] ml-auto tabular-nums flex-shrink-0" style={{ color: '#737373' }}>
                                {formatTimeAgo(item.createdAt)}
                              </span>
                            </div>
                            <div className="text-xs truncate mb-0.5 leading-tight" style={{ color: '#404040' }}>
                              {item.krTitle}
                            </div>
                            <div className="text-[10px] leading-tight" style={{ color: '#525252' }}>
                              Value: {item.value} • Confidence: {item.confidence}%
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  {/* Footer Metric */}
                  <div className="mt-3 pt-3 border-t border-neutral-200">
                    {/* TODO [phase6-polish]: Add sparkline animation showing update frequency over time */}
                    <p
                      className={`text-xs font-medium ${
                        updateMetrics.ratio >= 0.6
                          ? 'text-emerald-600'
                          : updateMetrics.ratio >= 0.3
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      You've updated {updateMetrics.updatedCount} of {updateMetrics.totalMyKRs} key results in the last 7 days.
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-5">
                    <p className="text-xs font-medium mb-0.5" style={{ color: '#dc2626' }}>
                      No recent updates
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: '#525252' }}>
                      You haven't updated any of your key results in the last 2 weeks.
                    </p>
                </div>
              )}
            </motion.section>

            {/* Async Update Modal */}
            {selectedRequestId && (() => {
              const request = checkInRequests.find(r => r.id === selectedRequestId)
              if (!request) return null
              const isOverdue = request.status === 'LATE'
              return (
                <NewAsyncUpdateModal
                  isOpen={!!selectedRequestId}
                  requestId={request.id}
                  dueAt={request.dueAt}
                  isOverdue={isOverdue}
                  onClose={() => setSelectedRequestId(null)}
                  onSubmitted={handleAsyncUpdateSubmitted}
                />
              )
            })()}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
