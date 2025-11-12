import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">Dashboard Guide</h1>
        <p className="text-lg text-neutral-600">
          The dashboard provides a comprehensive overview of your organization's OKR health and performance.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Organization Health Dashboard</h2>
        <p className="text-neutral-600">
          The main dashboard shows key metrics about your organization's OKR performance:
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/dashboard-overview.png" 
            alt="Organization health dashboard showing KPIs and metrics"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Organization health dashboard with key performance indicators and AI-assisted insights
          </p>
        </div>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Performance Indicators (KPIs)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-neutral-900 mb-2">Total Objectives</h3>
                <p className="text-sm text-neutral-700">
                  Shows the total number of objectives in your organization, along with how many are on track.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 mb-2">% On Track</h3>
                <p className="text-sm text-neutral-700">
                  Percentage of objectives that are currently on track to be completed. Green indicates good progress, yellow indicates warning, and red indicates at risk.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 mb-2">% At Risk</h3>
                <p className="text-sm text-neutral-700">
                  Percentage of objectives that are at risk of not being completed. Lower is better.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 mb-2">Overdue Check-ins</h3>
                <p className="text-sm text-neutral-700">
                  Number of key results that have overdue check-ins. This indicates execution discipline.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 mb-2">Needs Attention</h3>
                <p className="text-sm text-neutral-700">
                  Combined count of at-risk objectives and overdue check-ins that require follow-up.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI-Assisted Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                The dashboard includes an AI-powered summary that provides insights based on your current OKR status:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Highlights objectives at risk</li>
                <li>Identifies execution discipline issues</li>
                <li>Provides actionable recommendations</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Execution Health Section</h2>
        <p className="text-neutral-600">
          This section shows how well your team is executing on OKRs:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Update Discipline</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-700 mb-2">
              Shows the top contributors who have been actively updating their key results:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
              <li>Number of check-ins in the past week</li>
              <li>Last update timestamp for each contributor</li>
              <li>Helps identify who is staying on top of their OKRs</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gaps That Need Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-700 mb-2">
              Highlights key results with overdue check-ins and other execution risks:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
              <li>Overdue check-in counts</li>
              <li>At-risk objectives</li>
              <li>Items that require escalation</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Operating Rhythm</h2>
        <p className="text-neutral-600">
          The operating rhythm section shows recent activity across your organization:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-700 mb-2">
              Displays the most recent check-ins and updates:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
              <li>Who updated what key result</li>
              <li>Value and confidence levels</li>
              <li>Timestamp of each update</li>
              <li>Color-coded confidence indicators (green/amber/red)</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">My Dashboard</h2>
        <p className="text-neutral-600">
          Access your personal dashboard from the navigation menu to see:
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/my-dashboard.png" 
            alt="Personal dashboard showing individual performance snapshot"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Personal dashboard showing your performance snapshot, priorities, and operating rhythm
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Performance Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li>• Your objectives and key results</li>
                <li>• Update discipline percentage</li>
                <li>• Items needing attention</li>
                <li>• Upcoming deadlines</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Priorities This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li>• At-risk objectives requiring focus</li>
                <li>• Overdue check-ins to complete</li>
                <li>• Upcoming deadlines in next 7 days</li>
                <li>• Your operating rhythm activity</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> Check your personal dashboard regularly to stay on top of your OKRs and ensure you're meeting your check-in cadences.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Understanding Status Indicators</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <strong className="text-green-900">On Track:</strong>
              <span className="text-sm text-green-800 ml-2">Objective is progressing as expected</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <div>
              <strong className="text-amber-900">At Risk:</strong>
              <span className="text-sm text-amber-800 ml-2">Objective may not be completed on time</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div>
              <strong className="text-red-900">Off Track:</strong>
              <span className="text-sm text-red-800 ml-2">Objective is significantly behind</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div>
              <strong className="text-blue-900">Completed:</strong>
              <span className="text-sm text-blue-800 ml-2">Objective has been achieved</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Related Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/docs/okr-management" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">OKR Management</h3>
            <p className="text-sm text-neutral-600">Learn how to create and manage objectives and key results</p>
          </Link>
          <Link href="/docs/analytics" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">Analytics</h3>
            <p className="text-sm text-neutral-600">Dive deeper into OKR performance and reporting</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
