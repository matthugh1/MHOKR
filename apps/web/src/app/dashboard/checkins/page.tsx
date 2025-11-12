'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
import { useAuth } from '@/contexts/auth.context'
import { useWorkspace } from '@/contexts/workspace.context'
import api from '@/lib/api'
import { buildMeetingSummaryBlob } from '@/lib/buildMeetingSummaryBlob'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

interface CheckInRollupResponse {
  userId: string
  userName: string
  userEmail: string
  responses: Array<{
    id: string
    requestId: string
    submittedAt: string
    summaryWhatMoved: string | null
    summaryBlocked: string | null
    summaryNeedHelp: string | null
    dueAt: string
  }>
  hasBlockers: boolean
  needsHelp: boolean
  requestsOverdue: number
  lastSubmittedAt: string | null
}

export default function CheckInsPage() {
  const { user } = useAuth()
  const { currentOrganization } = useWorkspace()
  const [rollup, setRollup] = useState<CheckInRollupResponse[]>([])
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_activeCycleId, setActiveCycleId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_teamId, setTeamId] = useState<string | null>(null)
  const [cycleName, setCycleName] = useState<string>('')
  const [teamName, setTeamName] = useState<string>('')

  // Meeting Mode state
  const [isMeetingMode, setIsMeetingMode] = useState(false)
  const [nextActionsByUser, setNextActionsByUser] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id || !currentOrganization?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Get active cycle
        // TODO [phase7-hardening]: Handle multiple active cycles or let user select
        const cyclesRes = await api.get('/reports/cycles/active').catch(() => ({ data: [] }))
        const activeCycles = Array.isArray(cyclesRes.data) ? cyclesRes.data : []
        const cycle = activeCycles.length > 0 ? activeCycles[0] : null
        setActiveCycleId(cycle?.id || null)
        setCycleName(cycle?.name || 'Unknown cycle')

        // Get user's teams (assume first team for now)
        // TODO [phase7-hardening]: Support multiple teams and let manager select
        const userContextRes = await api.get('/users/me/context').catch(() => ({ data: null }))
        const teams = userContextRes.data?.teams || []
        const firstTeam = teams.length > 0 ? teams[0] : null
        setTeamId(firstTeam?.id || null)
        setTeamName(firstTeam?.name || 'Unknown team')

        // Fetch rollup
        const params = new URLSearchParams()
        if (cycle?.id) params.append('cycleId', cycle.id)
        if (firstTeam?.id) params.append('teamId', firstTeam.id)
        params.append('daysBack', '14')

        const rollupRes = await api
          .get(`/okr/checkin-rollup?${params.toString()}`)
          .catch(() => ({ data: [] }))
        setRollup(Array.isArray(rollupRes.data) ? rollupRes.data : [])
      } catch (error) {
        console.error('Failed to fetch check-in rollup:', error)
        setRollup([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user?.id, currentOrganization?.id])

  const handleNextActionsChange = (userId: string, value: string) => {
    setNextActionsByUser((prev) => ({
      ...prev,
      [userId]: value,
    }))
  }

  const handleSuggestDraft = (userId: string, blockers: string, needHelp: string) => {
    // TODO [phase6-polish]: Replace with AI-assisted draft using latest KR/status signals
    const suggestions: string[] = []
    if (blockers && blockers.trim() && blockers !== '—') {
      suggestions.push(`Resolve blocker: ${blockers}`)
    }

    if (needHelp && needHelp.trim() && needHelp !== '—') {
      suggestions.push(`Support needed: ${needHelp}`)
    }

    if (suggestions.length === 0) {
      suggestions.push('Next review owner: TBD')
    }

    setNextActionsByUser((prev) => ({
      ...prev,
      [userId]: suggestions.join('\n\n'),
    }))
  }

  const handleExportSummary = () => {
    // Collect member data for export
    const members = rollup.map((member) => {
      // Collect all responses grouped by section
      const whatMoved: string[] = []
      const blockers: string[] = []
      const needHelp: string[] = []

      member.responses.forEach((response) => {
        if (response.summaryWhatMoved && response.summaryWhatMoved.trim()) {
          whatMoved.push(response.summaryWhatMoved.trim())
        }
        if (response.summaryBlocked && response.summaryBlocked.trim()) {
          blockers.push(response.summaryBlocked.trim())
        }
        if (response.summaryNeedHelp && response.summaryNeedHelp.trim()) {
          needHelp.push(response.summaryNeedHelp.trim())
        }
      })

      return {
        userId: member.userId,
        name: member.userName,
        requestsOverdue: member.requestsOverdue,
        lastSubmittedAt: member.lastSubmittedAt,
        whatMoved: whatMoved.join('\n\n') || '',
        blockers: blockers.join('\n\n') || '',
        needHelp: needHelp.join('\n\n') || '',
        nextActions: nextActionsByUser[member.userId] || '',
      }
    })

    // Build blob
    const blob = buildMeetingSummaryBlob({
      cycleName,
      teamName,
      generatedAt: new Date(),
      members,
    })

    // Trigger download
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `okr-checkin-summary-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    // TODO [phase6-polish]: add PDF export when server-side export is ready
    // TODO [phase7-hardening]: apply RBAC / restrict export to managers only
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <PageContainer variant="dashboard">
            <PageHeader
              title="Team check-in summary"
              subtitle="Summary of async updates from your team members"
            />
            <div className="text-center py-12">
              <p className="text-neutral-500">
                Loading team check-in summary...
              </p>
            </div>
          </PageContainer>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer variant="dashboard">
          <PageHeader
            title="Team check-in summary"
            subtitle="Review team check-ins and capture meeting notes"
            badges={isMeetingMode ? [{ label: 'Meeting Mode', tone: 'warning' }] : []}
          />
          
          {/* Meeting Mode toggle toolbar */}
          <div className="flex items-center justify-end mb-6">
            <div className="flex items-center gap-2">
              <label
                htmlFor="meeting-mode-toggle"
                className="text-sm font-medium text-neutral-700"
              >
                Meeting Mode
              </label>
              <button
                id="meeting-mode-toggle"
                type="button"
                onClick={() => {
                  setIsMeetingMode((prev) => !prev)
                  // TODO [phase7-hardening]: return focus to the toggle when we exit Meeting Mode (accessibility focus management)
                }}
                aria-pressed={isMeetingMode}
                aria-label={
                  isMeetingMode ? 'Exit Meeting Mode' : 'Enter Meeting Mode'
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
                  isMeetingMode ? 'bg-violet-600' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isMeetingMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

            {/* Conditional render: Normal Mode */}
            {!isMeetingMode && (
              <>
                {/* Top note */}
                <div className="mb-6 rounded-lg bg-neutral-50 border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    This view shows team check-ins ordered by risk. People with
                    overdue updates or active blockers are shown first.
                  </p>
                </div>

                {/* TODO [phase6-polish]: Generate an AI summary at the top, e.g.:
                    "Main risks this week: Hiring freeze blocking onboarding capacity; Billing automation rollout delayed."
                */}

                {/* TODO [phase7-hardening]: filter by teamId from query param instead of assuming the first team */}
                {/* TODO [phase7-hardening]: Add manager/team RBAC checks */}

                {rollup.length === 0 ? (
                  <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-8 text-center">
                    <p className="text-sm text-neutral-500">
                      No check-in responses found for the selected period.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {rollup.map((member) => {
                      const formattedLastSubmitted = member.lastSubmittedAt
                        ? new Date(member.lastSubmittedAt).toLocaleDateString(
                            'en-GB',
                            {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            }
                          )
                        : null

                      // Collect all responses grouped by section
                      const whatMoved: string[] = []
                      const blockers: string[] = []
                      const needHelp: string[] = []

                      member.responses.forEach((response) => {
                        if (
                          response.summaryWhatMoved &&
                          response.summaryWhatMoved.trim()
                        ) {
                          whatMoved.push(response.summaryWhatMoved.trim())
                        }
                        if (
                          response.summaryBlocked &&
                          response.summaryBlocked.trim()
                        ) {
                          blockers.push(response.summaryBlocked.trim())
                        }
                        if (
                          response.summaryNeedHelp &&
                          response.summaryNeedHelp.trim()
                        ) {
                          needHelp.push(response.summaryNeedHelp.trim())
                        }
                      })

                      return (
                        <div
                          key={member.userId}
                          className={`rounded-xl bg-white border shadow-sm p-4 ${
                            member.hasBlockers ||
                            member.needsHelp ||
                            member.requestsOverdue > 0
                              ? 'border-rose-200 bg-rose-50/30'
                              : 'border-neutral-200'
                          }`}
                        >
                          {/* Per-user header */}
                          <div className="mb-4 flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-sm font-semibold text-neutral-900">
                                  {member.userName}
                                </h2>
                                {member.requestsOverdue > 0 ? (
                                  <span className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                                    {member.requestsOverdue} overdue
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-full px-2 py-0.5">
                                    Up to date
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-500 mb-1">
                                {member.userEmail}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {formattedLastSubmitted
                                  ? `Last submitted: ${formattedLastSubmitted}`
                                  : 'No submissions yet'}
                              </p>
                            </div>
                          </div>
                          {/* Three sections */}
                          <div className="space-y-4">
                            {/* What moved */}
                            {whatMoved.length > 0 && (
                              <div>
                                <div className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide mb-2">
                                  What moved
                                </div>
                                <div className="space-y-2">
                                  {whatMoved.map((text, idx) => (
                                    <p
                                      key={idx}
                                      className="text-xs text-neutral-600 whitespace-pre-wrap"
                                    >
                                      {text}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Blockers */}
                            {blockers.length > 0 && (
                              <div>
                                <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide mb-2">
                                  Blockers
                                </div>
                                <div className="space-y-2">
                                  {blockers.map((text, idx) => (
                                    <p
                                      key={idx}
                                      className="text-xs text-rose-600 whitespace-pre-wrap"
                                    >
                                      {text}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Need help */}
                            {needHelp.length > 0 && (
                              <div>
                                <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-2">
                                  Need help
                                </div>
                                <div className="space-y-2">
                                  {needHelp.map((text, idx) => (
                                    <p
                                      key={idx}
                                      className="text-xs text-amber-600 whitespace-pre-wrap"
                                    >
                                      {text}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {whatMoved.length === 0 &&
                              blockers.length === 0 &&
                              needHelp.length === 0 && (
                                <p className="text-xs text-neutral-500 italic">
                                  No updates provided.
                                </p>
                              )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* Conditional render: Meeting Mode */}
            {isMeetingMode && (
              <>
                {/* Meeting Mode banner */}
                <div className="mb-6 rounded-lg bg-neutral-50 border border-neutral-200 p-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-neutral-900 mb-1">
                      Meeting Mode
                    </h2>
                    <p className="text-xs text-neutral-600 mb-1">
                      Live summary view
                    </p>
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      Use this during the live review. Capture decisions and
                      follow-ups. Export when done.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={handleExportSummary}
                      className="bg-neutral-900 text-white hover:bg-neutral-800"
                      aria-label="Export meeting summary as JSON"
                    >
                      Export summary
                    </Button>
                    <Button
                      onClick={() => setIsMeetingMode(false)}
                      variant="outline"
                      aria-label="Exit Meeting Mode"
                    >
                      Exit
                    </Button>
                  </div>
                </div>

                {/* TODO [phase6-polish]: Add fade/slide animation when entering/exiting Meeting Mode */}
                {/* TODO [phase7-hardening]: Lock Meeting Mode behind RBAC (not every user should see this) */}

                {rollup.length === 0 ? (
                  <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-8 text-center">
                    <p className="text-sm text-neutral-500">
                      No check-in responses found for the selected period.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {rollup.map((member) => {
                      const formattedLastSubmitted = member.lastSubmittedAt
                        ? new Date(member.lastSubmittedAt).toLocaleString(
                            'en-GB',
                            {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            }
                          )
                        : null

                      // Collect all responses grouped by section
                      const whatMoved: string[] = []
                      const blockers: string[] = []
                      const needHelp: string[] = []

                      member.responses.forEach((response) => {
                        if (
                          response.summaryWhatMoved &&
                          response.summaryWhatMoved.trim()
                        ) {
                          whatMoved.push(response.summaryWhatMoved.trim())
                        }
                        if (
                          response.summaryBlocked &&
                          response.summaryBlocked.trim()
                        ) {
                          blockers.push(response.summaryBlocked.trim())
                        }
                        if (
                          response.summaryNeedHelp &&
                          response.summaryNeedHelp.trim()
                        ) {
                          needHelp.push(response.summaryNeedHelp.trim())
                        }
                      })

                      const whatMovedText = whatMoved.join('\n\n') || '—'
                      const blockersText = blockers.join('\n\n') || '—'
                      const needHelpText = needHelp.join('\n\n') || '—'
                      const nextActionsValue =
                        nextActionsByUser[member.userId] || ''

                      return (
                        <div
                          key={member.userId}
                          className="rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow p-4"
                        >
                          {/* Card header */}
                          <div className="mb-4 flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-sm font-semibold text-neutral-900">
                                  {member.userName}
                                </h2>
                                {member.requestsOverdue > 0 ? (
                                  <span className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                                    {member.requestsOverdue} overdue
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                    Up to date
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-500 mb-1">
                                {member.userEmail}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {formattedLastSubmitted
                                  ? `Last submitted: ${formattedLastSubmitted}`
                                  : 'No submissions yet'}
                              </p>
                            </div>
                          </div>

                          {/* Card body: four blocks */}
                          <div className="space-y-4">
                            {/* What moved */}
                            <div>
                              <div className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide mb-2">
                                What moved
                              </div>
                              <p className="text-xs text-neutral-600 whitespace-pre-wrap">
                                {whatMovedText}
                              </p>
                            </div>

                            {/* Blockers */}
                            <div>
                              <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide mb-2">
                                Blockers
                              </div>
                              <p className="text-xs text-rose-600 whitespace-pre-wrap">
                                {blockersText}
                              </p>
                            </div>

                            {/* Need help */}
                            <div>
                              <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-2">
                                Need help
                              </div>
                              <p className="text-xs text-amber-600 whitespace-pre-wrap">
                                {needHelpText}
                              </p>
                            </div>

                            {/* Next actions / decisions */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">
                                  Next actions / decisions
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleSuggestDraft(
                                      member.userId,
                                      blockersText,
                                      needHelpText
                                    )
                                  }
                                  className="text-xs h-7"
                                  aria-label={`Suggest draft next actions for ${member.userName}`}
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Suggest draft
                                </Button>
                              </div>
                              <textarea
                                value={nextActionsValue}
                                onChange={(e) =>
                                  handleNextActionsChange(
                                    member.userId,
                                    e.target.value
                                  )
                                }
                                placeholder="Capture decisions and follow-ups here..."
                                rows={4}
                                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y"
                                aria-label={`Next actions and decisions for ${member.userName}`}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
