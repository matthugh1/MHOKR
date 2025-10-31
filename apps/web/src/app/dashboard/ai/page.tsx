'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatCard } from '@/components/ui/StatCard'
import { ActivityItemCard } from '@/components/ui/ActivityItemCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AIAssistantPage() {
  // Placeholder data for insights feed
  // TODO [phase7-hardening]: Replace with live data from /reports/* endpoints once backend integration is ready
  const placeholderInsights = [
    {
      id: '1',
      actorName: 'AI Assistant',
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      action: 'INSIGHT_GENERATED',
      summary: 'Objective "Increase Customer Satisfaction" shows positive trend in recent check-ins',
    },
    {
      id: '2',
      actorName: 'AI Assistant',
      timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      action: 'RISK_DETECTED',
      summary: 'Key Result "Reduce Support Tickets" has not been updated in 14 days',
    },
    {
      id: '3',
      actorName: 'AI Assistant',
      timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      action: 'PATTERN_IDENTIFIED',
      summary: 'Multiple objectives mention blockers related to "API Rate Limits"',
    },
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8">
          <PageHeader
            title="AI Assistant"
            subtitle="AI-powered insights and recommendations for your OKRs"
            badges={[
              {
                label: ' β',
                tone: 'neutral',
              },
            ]}
          />

          {/* Insights Generated for You */}
          <div className="mb-8">
            <SectionHeader
              title="Insights generated for you"
              subtitle="AI-powered analysis of your OKR activity"
            />
            <div className="space-y-3">
              {placeholderInsights.map((insight) => (
                <ActivityItemCard
                  key={insight.id}
                  actorName={insight.actorName}
                  timestamp={insight.timestamp}
                  action={insight.action}
                  summary={insight.summary}
                />
              ))}
            </div>
          </div>

          {/* Risk Signals This Week */}
          <div className="mb-8">
            <SectionHeader
              title="Risk signals this week"
              subtitle="Key metrics requiring attention"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="At Risk OKRs"
                value="—"
                subtitle="No data available"
              />
              <StatCard
                title="Confidence Dropping"
                value="—"
                subtitle="No data available"
              />
              <StatCard
                title="Blockers Mentioned >3x"
                value="—"
                subtitle="No data available"
              />
            </div>
            {/* TODO [phase7-hardening]: Replace placeholder StatCards with live data from /reports/* endpoints */}
          </div>

          {/* Executive Summary Draft */}
          <div className="mb-8">
            <SectionHeader
              title="Executive summary draft"
              subtitle="AI-generated summary of current OKR status"
            />
            <Card className="border-neutral-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-neutral-900">
                  Weekly OKR Status Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-neutral-700">
                  <p>
                    This week, your organization has {placeholderInsights.length} active insights 
                    from AI analysis. The system has identified several patterns in your OKR data 
                    that may require attention.
                  </p>
                  <p>
                    {/* TODO [phase6-polish]: Enhance executive summary with actual metrics and recommendations 
                    once /reports/* endpoints are integrated */}
                    Key highlights include trend analysis, risk detection, and blocker identification 
                    across your objectives and key results.
                  </p>
                  <p className="text-xs text-neutral-500 italic">
                    Note: This is a placeholder summary. Full AI-powered executive summaries will be 
                    available once backend integration is complete.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
