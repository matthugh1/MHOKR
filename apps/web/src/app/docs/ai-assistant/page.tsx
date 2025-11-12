import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AIAssistantPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">AI Assistant</h1>
        <p className="text-lg text-neutral-600">
          Get AI-powered insights, recommendations, and assistance for your OKRs.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Overview</h2>
        <p className="text-neutral-600">
          OKR Nexus includes AI assistants that help you create better OKRs, understand alignment, and analyze progress. The AI Assistant page provides insights generated specifically for your organization.
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/ai-assistant.png" 
            alt="AI Assistant page showing generated insights and risk signals"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            AI Assistant page with insights, risk signals, and executive summary
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Accessing AI Assistant</h2>
        <p className="text-neutral-600">
          To view AI-generated insights:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-neutral-700 ml-4">
          <li>Click "AI Assistant" in the sidebar navigation</li>
          <li>The page will display AI-generated insights and recommendations</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">AI Personas</h2>
        <p className="text-neutral-600">
          OKR Nexus includes three specialized AI personas (note: currently in development):
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>OKR Coach</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                Helps you create and improve OKRs:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>OKR validation and scoring</li>
                <li>Key result suggestions</li>
                <li>Best practices guidance</li>
                <li>Context-aware recommendations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cascade Assistant</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                Helps with alignment and hierarchy:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Alignment recommendations</li>
                <li>Hierarchy analysis</li>
                <li>Context-aware suggestions</li>
                <li>Gap identification</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progress Analyst</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                Analyzes progress and risks:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Progress analysis and insights</li>
                <li>Risk identification</li>
                <li>Report generation</li>
                <li>Pattern recognition</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Generated Insights</h2>
        <p className="text-neutral-600">
          The AI Assistant page displays insights automatically generated for you:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Types of Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Trend Analysis</h3>
              <p className="text-sm text-neutral-700">
                Identifies positive or negative trends in your OKR progress based on recent check-ins.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Risk Detection</h3>
              <p className="text-sm text-neutral-700">
                Flags key results or objectives that haven't been updated recently or show concerning patterns.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Pattern Identification</h3>
              <p className="text-sm text-neutral-700">
                Identifies common blockers, themes, or issues mentioned across multiple OKRs.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Recommendations</h3>
              <p className="text-sm text-neutral-700">
                Suggests actions to improve OKR quality, alignment, or execution.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Risk Signals</h2>
        <p className="text-neutral-600">
          The AI Assistant monitors and highlights risk signals:
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>At Risk OKRs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Objectives and key results that are at risk of not being completed on time.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confidence Dropping</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Key results where confidence levels have been decreasing over recent check-ins.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frequent Blockers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Issues or blockers mentioned repeatedly across multiple check-ins, indicating systemic problems.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Executive Summary</h2>
        <p className="text-neutral-600">
          AI generates executive summaries of your OKR status:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Summary Contents</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Overall OKR health and progress</li>
              <li>Key highlights and achievements</li>
              <li>Areas requiring attention</li>
              <li>Trends and patterns identified</li>
              <li>Actionable recommendations</li>
            </ul>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Full AI-powered executive summaries are being developed. The current interface shows placeholder summaries as the feature is enhanced.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Using AI in OKR Creation</h2>
        <p className="text-neutral-600">
          While the AI Assistant page shows insights, AI assistance is also available during OKR creation:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>AI-Powered Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Get suggestions for key results when creating objectives</li>
              <li>Receive feedback on OKR quality and clarity</li>
              <li>Validate that objectives are measurable and achievable</li>
              <li>Get recommendations for alignment with other OKRs</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Best Practices</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Regularly Check Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Review the AI Assistant page regularly to catch risks early and act on recommendations before issues escalate.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Use Insights for Planning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700">
                Incorporate AI-generated insights into your OKR planning and review meetings to make data-driven decisions.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Related Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/docs/okr-management" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">OKR Management</h3>
            <p className="text-sm text-neutral-600">Learn how to create OKRs that AI can help improve</p>
          </Link>
          <Link href="/docs/analytics" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">Analytics</h3>
            <p className="text-sm text-neutral-600">See detailed analytics that complement AI insights</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
