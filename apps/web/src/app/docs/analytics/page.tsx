import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">Analytics & Reporting</h1>
        <p className="text-lg text-neutral-600">
          Deep insights into your organization's OKR performance and execution health.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Overview</h2>
        <p className="text-neutral-600">
          The Analytics page provides comprehensive reporting and analysis of your OKR data. Access detailed metrics, identify trends, and export data for external analysis.
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/analytics-page.png" 
            alt="Analytics page showing metrics, pillar coverage, and execution risk"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Analytics page with key metrics, strategic coverage, and execution risk analysis
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Accessing Analytics</h2>
        <p className="text-neutral-600">
          To view analytics:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-neutral-700 ml-4">
          <li>Click "Analytics" in the sidebar navigation</li>
          <li>The page displays key metrics and reports for the active cycle</li>
          <li>Use the cycle selector to analyze different time periods</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Key Metrics</h2>
        <p className="text-neutral-600">
          The analytics page displays high-level metrics at the top:
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Total number of objectives in the active cycle, with breakdown of how many are on track.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>% On Track</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Percentage of objectives currently on track. Higher is better. Shows count and percentage.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>% At Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Percentage of objectives at risk. Lower is better. Indicates potential delivery issues.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overdue Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Number of key results with overdue check-ins. Indicates execution discipline.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Strategic Coverage</h2>
        <p className="text-neutral-600">
          The Strategic Coverage section shows how well your strategic pillars are covered by OKRs:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Pillar Coverage Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">What It Shows</h3>
              <p className="text-sm text-neutral-700">
                For each strategic pillar defined in your organization, this section shows:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4 mt-2">
                <li>Number of objectives linked to the pillar in the active cycle</li>
                <li>Whether pillars have adequate OKR coverage</li>
                <li>Gaps where strategic pillars lack active OKRs</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Using This Information</h3>
              <p className="text-sm text-neutral-700">
                Identify strategic gaps and ensure your OKRs align with your organization's strategic pillars. Pillars with zero OKRs in the active cycle are highlighted.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Execution Risk</h2>
        <p className="text-neutral-600">
          The Execution Risk section identifies key results that need attention:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Overdue Check-ins Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Information Displayed</h3>
              <p className="text-sm text-neutral-700 mb-2">
                For each overdue key result, you'll see:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Key result title</li>
                <li>Parent objective title</li>
                <li>Owner name and email</li>
                <li>Number of days late</li>
                <li>Last check-in timestamp</li>
                <li>Check-in cadence</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Taking Action</h3>
              <p className="text-sm text-neutral-700">
                Use this list to prioritize follow-ups with key result owners. Key results are sorted by urgency (days late).
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Recent Activity</h2>
        <p className="text-neutral-600">
          The Recent Activity feed shows the latest check-ins across your organization:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Activity Feed Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Shows the last 10 check-ins (configurable)</li>
              <li>Displays who updated what key result</li>
              <li>Shows the value and confidence level for each update</li>
              <li>Includes timestamps showing when updates occurred</li>
              <li>Color-coded confidence indicators</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Exporting Data</h2>
        <p className="text-neutral-600">
          Administrators can export OKR data for external analysis:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>CSV Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Export Button</h3>
              <p className="text-sm text-neutral-700">
                Administrators will see an "Export CSV" button at the top of the analytics page. This exports all OKR data for the active cycle.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">What's Exported</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>All objectives, key results, and initiatives</li>
                <li>Progress values and confidence levels</li>
                <li>Owner and team assignments</li>
                <li>Status information</li>
                <li>Timestamps and metadata</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Using Exported Data</h3>
              <p className="text-sm text-neutral-700">
                Import the CSV into Excel, Google Sheets, or other analysis tools to create custom reports, charts, and dashboards.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Export functionality is only available to administrators. The export is tenant-scoped and includes only data from your organization.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Cycle Selection</h2>
        <p className="text-neutral-600">
          Analyze different time periods using the cycle selector:
        </p>

        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Select any active cycle to see analytics for that period</li>
              <li>View historical performance by analyzing past cycles</li>
              <li>Compare metrics across different time periods</li>
              <li>Cycle status (active, locked, archived) is displayed</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Interpreting Metrics</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>On Track Percentage</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li><strong>70%+:</strong> Excellent - most objectives are progressing well</li>
                <li><strong>50-69%:</strong> Good - room for improvement but generally healthy</li>
                <li><strong>Below 50%:</strong> Needs attention - significant portion at risk</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>At Risk Percentage</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li><strong>0%:</strong> Perfect - no objectives at risk</li>
                <li><strong>1-20%:</strong> Normal range - some risk is expected</li>
                <li><strong>Above 20%:</strong> High risk - requires immediate attention</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Best Practices</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Regular Review</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Review analytics weekly or biweekly to catch trends early. Don't wait for end-of-cycle reviews.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Use Pillar Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Regularly check pillar coverage to ensure your OKRs align with strategic priorities. Address gaps proactively.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Share with Leadership</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Export analytics and share executive summaries with leadership to communicate OKR health and progress.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Related Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/docs/dashboard" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">Dashboard</h3>
            <p className="text-sm text-neutral-600">See the high-level dashboard view that complements detailed analytics</p>
          </Link>
          <Link href="/docs/check-ins" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">Check-ins</h3>
            <p className="text-sm text-neutral-600">Understand how check-ins contribute to analytics data</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
