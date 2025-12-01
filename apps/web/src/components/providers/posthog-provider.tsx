'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

// Suppress PostHog fetch errors globally
if (typeof window !== 'undefined') {
  // Add unhandled rejection handler for PostHog network errors
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason
    // Suppress PostHog fetch errors
    if (
      reason &&
      (reason?.message?.includes('Failed to fetch') ||
        reason?.message?.includes('NetworkError') ||
        (typeof reason === 'string' && reason.includes('fetch')))
    ) {
      // Check if it's a PostHog-related error by checking the stack
      const stack = reason?.stack || event.reason?.toString() || ''
      if (stack.includes('posthog') || stack.includes('PostHog') || stack.includes('posthog-js')) {
        event.preventDefault()
        if (process.env.NODE_ENV === 'development') {
          console.warn('[PostHog] Suppressed network error (non-critical):', reason?.message || reason)
        }
      }
    }
  })
}

// Check that PostHog is client-side (used to handle Next.js SSR)
if (typeof window !== 'undefined') {
  const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false'
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  // Remove trailing slash if present and fix common URL format issues
  let posthogHostRaw = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
  posthogHostRaw = posthogHostRaw.replace(/\/$/, '')
  // Fix common mistake: eu.posthog.com should be eu.i.posthog.com
  if (posthogHostRaw.includes('eu.posthog.com') && !posthogHostRaw.includes('eu.i.posthog.com')) {
    posthogHostRaw = posthogHostRaw.replace('eu.posthog.com', 'eu.i.posthog.com')
  }
  const posthogHost = posthogHostRaw

  if (analyticsEnabled && posthogKey) {
    try {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        // Capture pageviews automatically
        capture_pageview: false, // We'll handle this manually for better Next.js integration
        capture_pageleave: true, // Capture when users leave the page
        // Enable session replay (optional, can be disabled if privacy concerns)
        session_recording: {
          maskAllInputs: true, // Mask all input fields for privacy
          maskTextSelector: '[data-ph-mask]', // Allow selective masking
        },
        // Error tracking
        autocapture: true, // Automatically capture clicks, form submissions, etc.
        // Privacy settings
        respect_dnt: true, // Respect Do Not Track header
        // Persistence configuration
        persistence: 'localStorage+cookie',
        // Retry configuration
        request_batching: true,

        // Better error handling
        loaded: (posthogInstance) => {
          if (process.env.NODE_ENV === 'development') {
            posthogInstance.debug() // Enable debug mode
            console.log('[PostHog] Initialized successfully with host:', posthogHost)
          }
        },
        // Suppress network errors (PostHog will retry automatically)
        // Note: PostHog handles network errors internally, so fetch errors won't break the app
      })
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[PostHog] Initialization error:', error)
      }
    }
  } else if (process.env.NODE_ENV === 'development') {
    if (!analyticsEnabled) {
      console.log('[PostHog] Analytics disabled via NEXT_PUBLIC_ANALYTICS_ENABLED=false')
    } else if (!posthogKey) {
      console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY not set. Analytics will be disabled.')
    }
  }
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Track pageviews only if analytics is enabled
    const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false'
    if (analyticsEnabled && pathname && typeof window !== 'undefined') {
      try {
        // Check if PostHog is loaded and ready
        if (posthog && posthog.__loaded) {
          let url = window.origin + pathname
          if (searchParams && searchParams.toString()) {
            url = url + `?${searchParams.toString()}`
          }
          posthog.capture('$pageview', {
            $current_url: url,
          })
        }
      } catch (error) {
        // Silently fail - don't break the app if analytics fails
        if (process.env.NODE_ENV === 'development') {
          console.warn('[PostHog] Failed to capture pageview:', error)
        }
      }
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}

