import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CheckInsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">Check-ins Guide</h1>
        <p className="text-lg text-neutral-600">
          Learn how to update progress on key results through check-ins and track your team's execution discipline.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">What are Check-ins?</h2>
        <p className="text-neutral-600">
          Check-ins are regular updates to key result progress. They capture:
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/checkins-page.png" 
            alt="Team check-in summary page showing async updates"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Team check-in summary page with meeting mode toggle
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li><strong>Current Value:</strong> The updated numeric value for the key result</li>
              <li><strong>Confidence:</strong> How confident you are that you'll hit the target (0-100%)</li>
              <li><strong>Notes:</strong> Optional comments about what moved, blockers, or need for help</li>
              <li><strong>Timestamp:</strong> When the check-in was recorded</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Creating a Check-in</h2>
        <p className="text-neutral-600">
          To record a check-in for a key result:
        </p>

        <ol className="list-decimal list-inside space-y-3 text-neutral-700 ml-4">
          <li>
            <strong>Find the key result:</strong> Navigate to the OKRs page and locate the key result you want to update
          </li>
          <li>
            <strong>Open check-in modal:</strong> Click "Add Check-in" or use the quick action button on the key result row
          </li>
          <li>
            <strong>Update values:</strong>
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>Enter the current value (what you've achieved so far)</li>
              <li>Set your confidence level (how likely you are to reach the target)</li>
              <li>Add notes if needed (what moved, blockers, help needed)</li>
            </ul>
          </li>
          <li>
            <strong>Submit:</strong> Click "Save Check-in" to record the update
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Check-in Cadence</h2>
        <p className="text-neutral-600">
          Check-in cadence determines how often updates are expected:
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Weekly</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Check-ins expected every 7 days. Best for fast-moving, high-priority key results.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Biweekly</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Check-ins expected every 14 days. Good balance for most key results.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Check-ins expected every 30 days. Suitable for longer-term, strategic key results.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> Set cadence when creating a key result, or update it later. The system tracks overdue check-ins based on cadence.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Understanding Confidence Levels</h2>
        <p className="text-neutral-600">
          Confidence indicates how likely you are to achieve the target:
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <strong className="text-green-900">High Confidence (80-100%):</strong>
              <span className="text-sm text-green-800 ml-2">You're on track and likely to hit the target</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <div>
              <strong className="text-amber-900">Medium Confidence (50-79%):</strong>
              <span className="text-sm text-amber-800 ml-2">Some progress but may need attention</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div>
              <strong className="text-red-900">Low Confidence (0-49%):</strong>
              <span className="text-sm text-red-800 ml-2">At risk - intervention likely needed</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Overdue Check-ins</h2>
        <p className="text-neutral-600">
          The system tracks check-ins that are overdue based on cadence:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Where You'll See Overdue Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Dashboard</h3>
              <p className="text-sm text-neutral-700">
                The main dashboard shows a count of overdue check-ins and highlights key results that need updates.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">My Dashboard</h3>
              <p className="text-sm text-neutral-700">
                Your personal dashboard lists all your key results with overdue check-ins.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">OKRs Page</h3>
              <p className="text-sm text-neutral-700">
                Key results with overdue check-ins are marked with visual indicators and shown in the attention drawer.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Analytics</h3>
              <p className="text-sm text-neutral-700">
                The analytics page provides detailed reports on overdue check-ins across the organization.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Team Check-in Summary</h2>
        <p className="text-neutral-600">
          Managers can view a summary of team check-ins:
        </p>

        <ol className="list-decimal list-inside space-y-3 text-neutral-700 ml-4">
          <li>
            <strong>Navigate to Check-ins:</strong> Click "Check-ins" in the sidebar (visible to managers)
          </li>
          <li>
            <strong>View rollup:</strong> See all team members' check-in responses organized by person
          </li>
          <li>
            <strong>Review updates:</strong> Each member's responses show:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li>What moved (progress updates)</li>
              <li>Blockers (what's preventing progress)</li>
              <li>Need help (what support is needed)</li>
            </ul>
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Meeting Mode</h2>
        <p className="text-neutral-600">
          Meeting Mode provides a focused view for live check-in reviews:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Meeting Mode Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Live Summary View</h3>
              <p className="text-sm text-neutral-700">
                All team members' updates are shown in a single, easy-to-scan view perfect for live meetings.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Capture Decisions</h3>
              <p className="text-sm text-neutral-700">
                Add "Next actions / decisions" notes for each team member during the meeting.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">AI Suggestions</h3>
              <p className="text-sm text-neutral-700">
                Use the "Suggest draft" button to get AI-powered suggestions for next actions based on blockers and help requests.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Export Summary</h3>
              <p className="text-sm text-neutral-700">
                Export the meeting summary as JSON when done, including all updates and decisions.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Check-in Requests</h2>
        <p className="text-neutral-600">
          Managers can request check-ins from team members:
        </p>

        <ol className="list-decimal list-inside space-y-3 text-neutral-700 ml-4">
          <li>
            <strong>Create request:</strong> Request a check-in update with a due date
          </li>
          <li>
            <strong>Team member sees request:</strong> Appears in "My Dashboard" under "Your updates due"
          </li>
          <li>
            <strong>Submit async update:</strong> Team member fills out what moved, blockers, and help needed
          </li>
          <li>
            <strong>Request marked complete:</strong> Automatically updates when check-in is submitted
          </li>
        </ol>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Check-in requests can become overdue if not submitted by the due date. Overdue requests are highlighted in red.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Best Practices</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Regular Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Update check-ins according to your cadence schedule</li>
                <li>Be honest about confidence levels - early warning helps</li>
                <li>Provide context in notes, especially when confidence is low</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Effective Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Be specific about what moved (don't just update the number)</li>
                <li>Flag blockers early so they can be addressed</li>
                <li>Clearly state what help is needed and from whom</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Related Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/docs/okr-management" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">OKR Management</h3>
            <p className="text-sm text-neutral-600">Learn about creating key results that you'll track with check-ins</p>
          </Link>
          <Link href="/docs/analytics" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">Analytics</h3>
            <p className="text-sm text-neutral-600">See how check-in data contributes to analytics and reporting</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
