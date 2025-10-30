'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
            <p className="text-slate-600 mt-1">Track performance and identify trends</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Overall Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">68%</div>
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-green-600 font-medium">+12%</span>
                  <span className="text-slate-500 ml-1">from last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Completion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">42%</div>
                  <CheckCircle2 className="h-6 w-6 text-blue-500" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-slate-500">5 of 12 completed</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  At Risk OKRs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">3</div>
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-yellow-600 font-medium">25%</span>
                  <span className="text-slate-500 ml-1">of active OKRs</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Team Velocity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">8.5</div>
                  <TrendingDown className="h-6 w-6 text-red-500" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-red-600 font-medium">-0.5</span>
                  <span className="text-slate-500 ml-1">from last sprint</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>OKR Health by Team</CardTitle>
                <CardDescription>Current status across all teams</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { team: 'Product', onTrack: 8, atRisk: 1, total: 10 },
                    { team: 'Engineering', onTrack: 6, atRisk: 2, total: 8 },
                    { team: 'Sales', onTrack: 5, atRisk: 0, total: 5 },
                    { team: 'Customer Success', onTrack: 4, atRisk: 1, total: 6 },
                  ].map((team) => (
                    <div key={team.team} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{team.team}</span>
                        <span className="text-slate-500">
                          {team.onTrack + team.atRisk} / {team.total}
                        </span>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div
                          className="bg-green-500 rounded-full"
                          style={{ width: `${(team.onTrack / team.total) * 100}%` }}
                        />
                        <div
                          className="bg-yellow-500 rounded-full"
                          style={{ width: `${(team.atRisk / team.total) * 100}%` }}
                        />
                        <div
                          className="bg-slate-200 rounded-full"
                          style={{ 
                            width: `${((team.total - team.onTrack - team.atRisk) / team.total) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>Most active OKR owners this quarter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'Sarah Johnson', completed: 8, progress: 92 },
                    { name: 'Mike Chen', completed: 6, progress: 85 },
                    { name: 'Alex Kumar', completed: 7, progress: 88 },
                    { name: 'Emma Davis', completed: 5, progress: 78 },
                  ].map((person, index) => (
                    <div key={person.name} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-sm font-medium">
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{person.name}</div>
                        <div className="text-xs text-slate-500">
                          {person.completed} completed • {person.progress}% avg progress
                        </div>
                      </div>
                      <Badge variant="success">{person.progress}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates across all OKRs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      action: 'completed',
                      user: 'Sarah Johnson',
                      okr: 'Launch new feature',
                      time: '2 hours ago',
                    },
                    {
                      action: 'updated',
                      user: 'Mike Chen',
                      okr: 'Improve NPS score',
                      time: '5 hours ago',
                    },
                    {
                      action: 'at-risk',
                      user: 'Alex Kumar',
                      okr: 'Reduce infrastructure costs',
                      time: '1 day ago',
                    },
                    {
                      action: 'created',
                      user: 'Emma Davis',
                      okr: 'Expand market presence',
                      time: '2 days ago',
                    },
                  ].map((activity, index) => (
                    <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 ${
                          activity.action === 'completed'
                            ? 'bg-green-500'
                            : activity.action === 'at-risk'
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{activity.user}</span>{' '}
                          <span className="text-slate-600">{activity.action}</span>{' '}
                          <span className="font-medium">{activity.okr}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}



