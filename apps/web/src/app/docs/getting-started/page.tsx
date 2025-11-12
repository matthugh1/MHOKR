import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function GettingStartedPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">Getting Started</h1>
        <p className="text-lg text-neutral-600">
          Welcome to OKR Nexus! This guide will help you get started with your account and learn the basics of the platform.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Creating an Account</h2>
        <p className="text-neutral-600">
          To get started with OKR Nexus, you'll need to create an account. Follow these steps:
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/register-page.png" 
            alt="Registration page showing account creation form"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Registration page where you create your account
          </p>
        </div>
        <ol className="list-decimal list-inside space-y-2 text-neutral-700 ml-4">
          <li>Navigate to the registration page by clicking "Sign up" on the login page or visiting <code className="bg-neutral-100 px-1 py-0.5 rounded">/register</code></li>
          <li>Fill in your details:
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
              <li>First name and last name</li>
              <li>Email address</li>
              <li>Password (choose a strong password)</li>
            </ul>
          </li>
          <li>Click "Create account" to complete registration</li>
        </ol>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Your account will automatically create an organization for you. You can invite team members and create workspaces after logging in.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Logging In</h2>
        <p className="text-neutral-600">
          Once you have an account, log in using your email and password:
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/login-page.png" 
            alt="Login page with email and password fields"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Login page to access your OKR workspace
          </p>
        </div>
        <ol className="list-decimal list-inside space-y-2 text-neutral-700 ml-4">
          <li>Go to the login page at <code className="bg-neutral-100 px-1 py-0.5 rounded">/login</code></li>
          <li>Enter your email address and password</li>
          <li>Click "Sign in" to access your dashboard</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Understanding the Dashboard</h2>
        <p className="text-neutral-600">
          After logging in, you'll see the main dashboard which provides an overview of your organization's OKR health:
        </p>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Health</CardTitle>
              <CardDescription>Overview metrics and insights</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li>• Total objectives across your organization</li>
                <li>• Percentage on track vs. at risk</li>
                <li>• Overdue check-ins count</li>
                <li>• AI-assisted summary and recommendations</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Navigation Menu</CardTitle>
              <CardDescription>Access all features from the sidebar</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li>• Dashboard - Overview and health metrics</li>
                <li>• My Dashboard - Personal performance snapshot</li>
                <li>• OKRs - Manage objectives and key results</li>
                <li>• Visual Builder - Create OKR hierarchies</li>
                <li>• Analytics - Detailed reports and insights</li>
                <li>• AI Assistant - Get AI-powered help</li>
                <li>• Settings - Configure your organization</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Core Concepts</h2>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 mb-2">
                Objectives are high-level, qualitative goals that define what you want to achieve. They should be:
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-700 ml-4">
                <li>Inspiring and meaningful</li>
                <li>Time-bound (typically tied to a cycle)</li>
                <li>Clear and easy to understand</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Results</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 mb-2">
                Key Results are measurable outcomes that indicate progress toward an objective. They should be:
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-700 ml-4">
                <li>Quantifiable and specific</li>
                <li>Aligned with the parent objective</li>
                <li>Trackable with regular check-ins</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Initiatives</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 mb-2">
                Initiatives are the specific projects or activities that drive progress on key results:
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-700 ml-4">
                <li>Actionable tasks or projects</li>
                <li>Linked to key results</li>
                <li>Have owners and due dates</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cycles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 mb-2">
                Cycles are time periods (quarters, months, etc.) that organize OKRs:
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-700 ml-4">
                <li>Define when OKRs are active</li>
                <li>Can be locked to prevent editing</li>
                <li>Help track progress over time</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Next Steps</h2>
        <p className="text-neutral-600">
          Now that you understand the basics, here's what to do next:
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create Your First OKR</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-4">
                Learn how to create objectives and key results for your organization.
              </p>
              <Link href="/docs/okr-management">
                <Button>Read OKR Management Guide</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Explore the Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-4">
                Understand all the metrics and insights available on your dashboard.
              </p>
              <Link href="/docs/dashboard">
                <Button>Read Dashboard Guide</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
