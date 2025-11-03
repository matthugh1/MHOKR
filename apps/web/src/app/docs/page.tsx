import Link from 'next/link'
import { Book, Target, Network, BarChart3, Settings, MessageSquare, CheckCircle, LayoutDashboard, User, ArrowRight, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'OKR Nexus Documentation',
  description: 'Complete user guide for OKR Nexus',
}

export default function DocsHomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 pb-8 border-b">
        <h1 className="text-4xl font-bold text-neutral-900">
          OKR Nexus Documentation
        </h1>
        <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
          Everything you need to know about using OKR Nexus to manage your objectives, key results, and initiatives.
        </p>
        <div className="my-8">
          <img 
            src="/screenshots/docs-homepage.png" 
            alt="Documentation homepage"
            className="rounded-lg border border-neutral-200 shadow-sm w-full max-w-4xl mx-auto"
          />
        </div>
      </div>

      {/* Quick Start */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Quick Start</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-violet-600" />
                New to OKR Nexus?
              </CardTitle>
              <CardDescription>
                Get started with your first account and learn the basics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/getting-started">
                <Button className="w-full">
                  Getting Started Guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-violet-600" />
                Looking for Something?
              </CardTitle>
              <CardDescription>
                Use the search bar above to find specific topics and features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600">
                Search by feature name, action (e.g., "create OKR"), or keyword to quickly find what you need.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Feature Guides */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Feature Guides</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-violet-600" />
                Dashboard
              </CardTitle>
              <CardDescription>
                Overview of your organization's OKR health and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/dashboard" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-violet-600" />
                OKR Management
              </CardTitle>
              <CardDescription>
                Create, edit, and manage objectives, key results, and initiatives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/okr-management" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-violet-600" />
                Visual Builder
              </CardTitle>
              <CardDescription>
                Build and visualize OKR hierarchies with drag-and-drop
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/visual-builder" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-violet-600" />
                AI Assistant
              </CardTitle>
              <CardDescription>
                Get AI-powered insights and recommendations for your OKRs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/ai-assistant" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-violet-600" />
                Check-ins
              </CardTitle>
              <CardDescription>
                Track progress with regular check-ins and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/check-ins" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-600" />
                Analytics
              </CardTitle>
              <CardDescription>
                Deep insights into OKR performance and execution health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/analytics" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-violet-600" />
                Settings
              </CardTitle>
              <CardDescription>
                Configure organizations, workspaces, teams, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/settings" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Common Tasks */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Common Tasks</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-neutral-900">Create Your First OKR</h3>
            <p className="text-sm text-neutral-600">
              Learn how to create objectives and key results in{' '}
              <Link href="/docs/okr-management#creating-objectives" className="text-violet-600 hover:underline">
                OKR Management
              </Link>
            </p>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-neutral-900">Update Progress</h3>
            <p className="text-sm text-neutral-600">
              Record check-ins and track progress in{' '}
              <Link href="/docs/check-ins" className="text-violet-600 hover:underline">
                Check-ins
              </Link>
            </p>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-neutral-900">Visualize Alignment</h3>
            <p className="text-sm text-neutral-600">
              Use the visual builder to see OKR connections in{' '}
              <Link href="/docs/visual-builder" className="text-violet-600 hover:underline">
                Visual Builder
              </Link>
            </p>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-neutral-900">Set Up Your Team</h3>
            <p className="text-sm text-neutral-600">
              Configure workspaces and teams in{' '}
              <Link href="/docs/settings" className="text-violet-600 hover:underline">
                Settings
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
