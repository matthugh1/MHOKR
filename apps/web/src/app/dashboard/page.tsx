'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { AvatarCircle } from '@/components/dashboard/AvatarCircle'
import { useWorkspace } from '@/contexts/workspace.context'
import api from '@/lib/api'

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

interface TopContributor {
  userName: string
  recentCheckInsCount: number
  lastCheckInAgeDays: number
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

function formatDaysAgo(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function DashboardPage() {
  const { currentOrganization } = useWorkspace()
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [feed, setFeed] = useState<CheckInFeedItem[]>([])
  const [overdue, setOverdue] = useState<OverdueCheckInItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // TODO [phase7-hardening]: tighten dashboard access & visibility rules based on tenant/workspace membership
        const [summaryRes, feedRes, overdueRes] = await Promise.allSettled([
          api.get('/reports/analytics/summary').catch(() => ({ data: { totalObjectives: 0, byStatus: {}, atRiskRatio: 0 } })),
          api.get('/reports/analytics/feed').catch(() => ({ data: [] })),
          api.get('/reports/check-ins/overdue').catch(() => ({ data: [] })),
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
      } catch (error) {
        // Set empty state on error - page should still render
        setSummary({
          totalObjectives: 0,
          byStatus: {},
          atRiskRatio: 0,
        })
        setFeed([])
        setOverdue([])
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [currentOrganization?.id])

  function safePercent(numerator: number, denominator: number): number {
    if (!denominator || denominator <= 0) return 0
    if (!numerator || numerator < 0) return 0
    return Math.round((numerator / denominator) * 100)
  }

  // Derive top contributors from feed (group by user, count check-ins in last 7 days)
  const topContributors = useMemo((): TopContributor[] => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const userMap = new Map<string, { count: number; lastCheckIn: Date }>()

    feed.forEach((item) => {
      const checkInDate = new Date(item.createdAt)
      if (checkInDate >= sevenDaysAgo && item.userName) {
        const existing = userMap.get(item.userName)
        if (existing) {
          existing.count++
          if (checkInDate > existing.lastCheckIn) {
            existing.lastCheckIn = checkInDate
          }
        } else {
          userMap.set(item.userName, { count: 1, lastCheckIn: checkInDate })
        }
      }
    })

    return Array.from(userMap.entries())
      .map(([userName, data]) => {
        const daysSinceLastCheckIn = Math.floor(
          (new Date().getTime() - data.lastCheckIn.getTime()) / (1000 * 60 * 60 * 24)
        )
        return {
          userName,
          recentCheckInsCount: data.count,
          lastCheckInAgeDays: daysSinceLastCheckIn,
        }
      })
      .sort((a, b) => b.recentCheckInsCount - a.recentCheckInsCount)
      .slice(0, 5) // Top 5 contributors
  }, [feed])

  // Get top 3 most recent activity items
  const recentActivityTop3 = useMemo(() => {
    return feed.slice(0, 3)
  }, [feed])

  const onTrackCount = summary?.byStatus?.['ON_TRACK'] || 0
  const atRiskCount = summary?.byStatus?.['AT_RISK'] || 0
  const totalObjectives = summary?.totalObjectives || 0
  const overdueCount = overdue.length
  
  // Calculate "Needs Attention" metric
  const atRiskObjectivesCount = summary?.byStatus?.AT_RISK ?? 0
  const overdueCheckInsCount = overdue?.length ?? 0
  const needsAttentionCount = atRiskObjectivesCount + overdueCheckInsCount
  
  const onTrackPercent = safePercent(onTrackCount, totalObjectives)
  const atRiskPercent = safePercent(atRiskCount, totalObjectives)

  // Generate AI summary message (deterministic for now)
  const aiSummary = useMemo(() => {
    if (atRiskCount > 0) {
      return 'There are objectives at risk. Focus is required this week.'
    } else if (overdueCount > 0) {
      return 'You\'re missing check-ins. Execution discipline is slipping.'
    } else {
      return 'Execution looks steady. Most objectives are tracking and check-ins are up to date.'
    }
  }, [atRiskCount, overdueCount])

  const lastUpdatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

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
                Organisation health
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600/10 to-fuchsia-400/10 text-violet-700 border border-violet-300/40">
                  AI-assisted
                </span>
              </h1>
              <p className="text-sm text-neutral-500">
                Snapshot of OKR performance, delivery risk, and update discipline across the organisation.
              </p>
            </motion.header>

            {/* Gradient accent line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-violet-600 via-fuchsia-400 to-transparent rounded-full mb-6" />

            {loading ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">Loading dashboard...</p>
              </div>
            ) : (
              <>
                {/* SECTION 1: STATUS OVERVIEW */}
                <section className="mb-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiCard
                      label="Total Objectives"
                      value={totalObjectives > 0 ? totalObjectives : '--'}
                      meta={totalObjectives > 0 ? `${onTrackCount} on track` : 'No data yet'}
                      tone="neutral"
                      delay={0}
                    />
                    <KpiCard
                      label="% On Track"
                      value={totalObjectives > 0 ? `${onTrackPercent}%` : '--'}
                      meta={totalObjectives > 0 ? `${onTrackCount} of ${totalObjectives}` : 'No data yet'}
                      tone={onTrackPercent >= 70 ? 'good' : onTrackPercent >= 50 ? 'warning' : 'bad'}
                      delay={0.05}
                    />
                    <KpiCard
                      label="% At Risk"
                      value={totalObjectives > 0 ? `${atRiskPercent}%` : '--'}
                      meta={totalObjectives > 0 ? `${atRiskCount} objective${atRiskCount !== 1 ? 's' : ''}` : 'No data yet'}
                      tone={atRiskPercent === 0 ? 'good' : atRiskPercent <= 20 ? 'warning' : 'bad'}
                      delay={0.1}
                    />
                    <KpiCard
                      label="Overdue Check-ins"
                      value={overdueCount > 0 ? overdueCount : '--'}
                      meta={overdueCount > 0 ? `${overdueCount} key result${overdueCount !== 1 ? 's' : ''}` : 'No data yet'}
                      tone={overdueCount === 0 ? 'good' : overdueCount <= 3 ? 'warning' : 'bad'}
                      delay={0.15}
                    />
                    <KpiCard
                      label="Needs Attention"
                      value={needsAttentionCount > 0 ? needsAttentionCount : '--'}
                      meta={needsAttentionCount > 0 ? `${needsAttentionCount} item${needsAttentionCount !== 1 ? 's' : ''} require${needsAttentionCount === 1 ? 's' : ''} follow-up` : 'No active escalations'}
                      tone={needsAttentionCount > 0 ? 'bad' : 'good'}
                      trend={{
                        direction: needsAttentionCount > 0 ? 'up' : 'flat',
                        text: needsAttentionCount > 0 ? 'Escalate to owners' : 'All stable',
                      }}
                      delay={0.2}
                    />
                  </div>

                  {/* AI Summary Bar */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="mt-4 text-sm text-neutral-700 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-neutral-200 rounded-lg p-3 shadow-sm flex items-start gap-2"
                  >
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">
                      <Sparkles size={14} />
                    </div>
                    <p className="text-sm leading-5">{aiSummary}</p>
                  </motion.div>
                </section>

                {/* SECTION 2: EXECUTION HEALTH */}
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                  className="mt-10 bg-white border border-neutral-200 rounded-xl shadow-sm p-4 transition-all duration-200 hover:shadow-md hover:border-neutral-300"
                >
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      Execution health
                      <span className="text-[10px] font-medium text-neutral-500">Updated {lastUpdatedDate}</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Are people actively updating progress, or are we flying blind?
                    </p>
                    <div className="h-[1px] bg-gradient-to-r from-neutral-200 to-transparent mb-3 mt-3" />
                  </div>

                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: {
                          staggerChildren: 0.05,
                        },
                      },
                    }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                  >
                    {/* Left: Update discipline */}
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 4 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      className="border border-neutral-200 rounded-lg p-3 bg-neutral-50/50"
                    >
                      <div className="text-xs font-medium text-neutral-700 mb-2">
                        Update discipline
                      </div>
                      {topContributors.length > 0 ? (
                        <ul className="space-y-2">
                          {topContributors.map((contributor) => (
                            <motion.li
                              key={contributor.userName}
                              variants={{
                                hidden: { opacity: 0, x: -4 },
                                visible: { opacity: 1, x: 0 },
                              }}
                              className="flex items-center gap-2 even:bg-neutral-50/40"
                            >
                              <AvatarCircle name={contributor.userName} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-neutral-700 font-medium truncate">
                                  {contributor.userName}
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                  {contributor.recentCheckInsCount} check-in{contributor.recentCheckInsCount !== 1 ? 's' : ''} this week
                                  {' • '}
                                  last update {formatDaysAgo(contributor.lastCheckInAgeDays)}
                                </div>
                              </div>
                            </motion.li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-neutral-500 italic">
                          No recent updates logged.
                        </div>
                      )}
                    </motion.div>

                    {/* Right: Gaps / Risks */}
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 4 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      className="border border-neutral-200 rounded-lg p-3 bg-neutral-50/50"
                    >
                      <div className="text-xs font-medium text-neutral-700 mb-2">
                        Gaps that need attention
                      </div>
                      <div className="space-y-0">
                        <motion.div
                          variants={{
                            hidden: { opacity: 0, x: -4 },
                            visible: { opacity: 1, x: 0 },
                          }}
                          className="flex items-center justify-between py-2 border-t border-neutral-200 first:border-t-0"
                        >
                          <span className="font-medium text-sm text-neutral-800">
                            Key results with overdue check-ins
                          </span>
                          <span className="text-base font-semibold text-rose-600">
                            {overdueCount}
                          </span>
                        </motion.div>
                        {/* TODO [phase6-polish]: Add more rows e.g. "Objectives flagged At Risk", etc. */}
                      </div>
                    </motion.div>
                  </motion.div>
                </motion.section>

                {/* SECTION 3: OPERATING RHYTHM */}
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="mt-10 bg-white border border-neutral-200 rounded-xl shadow-sm p-4 transition-all duration-200 hover:shadow-md hover:border-neutral-300"
                >
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      Operating rhythm
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Latest changes to targets, confidence, and progress.
                    </p>
                    <div className="h-[1px] bg-gradient-to-r from-neutral-200 to-transparent mb-3 mt-3" />
                  </div>

                  {recentActivityTop3.length > 0 ? (
                    <ul className="divide-y divide-neutral-200">
                      {recentActivityTop3.map((item) => {
                        const confidence = item.confidence || 0
                        const confidenceDotColor =
                          confidence > 80 ? 'bg-emerald-500' : confidence > 50 ? 'bg-amber-500' : 'bg-rose-500'
                        
                        return (
                          <li
                            key={item.id}
                            className="py-3 flex items-start gap-3 transition-colors hover:bg-neutral-50"
                          >
                            <AvatarCircle name={item.userName || 'Unknown User'} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-neutral-900">
                                  {item.userName || 'Unknown User'} checked in
                                </span>
                                <div className={`h-2 w-2 rounded-full ${confidenceDotColor}`} />
                                <span className="text-[11px] text-neutral-400 ml-auto tabular-nums">
                                  {formatTimeAgo(item.createdAt)}
                                </span>
                              </div>
                              <div className="text-xs text-neutral-600 truncate mb-1">
                                {item.krTitle}
                              </div>
                              <div className="text-[10px] text-neutral-500">
                                Value: {item.value} • Confidence: {item.confidence}%
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <div className="text-xs text-neutral-500 italic">
                      No recent updates in this workspace.
                    </div>
                  )}
                </motion.section>
              </>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
