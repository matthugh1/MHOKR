// NOTE [phase14-hardening]:
// This view is not part of the current demo path.
// We intentionally downgraded it to a placeholder to unblock TypeScript and lint.
// Do not reintroduce untyped code here without adding tests.

'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function AIAssistantPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <h1 className="text-2xl font-semibold text-neutral-900 mb-2">AI Assistant</h1>
            <p className="text-sm text-neutral-500">Coming soon</p>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
