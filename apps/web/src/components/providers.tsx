'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'
import { AuthProvider } from '@/contexts/auth.context'
import { WorkspaceProvider } from '@/contexts/workspace.context'
import { FeedbackProvider } from '@/contexts/feedback.context'
import { PostHogProvider } from '@/components/providers/posthog-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/toaster'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <ErrorBoundary>
      <PostHogProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WorkspaceProvider>
              <FeedbackProvider>
                {children}
                <Toaster />
              </FeedbackProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </QueryClientProvider>
      </PostHogProvider>
    </ErrorBoundary>
  )
}

