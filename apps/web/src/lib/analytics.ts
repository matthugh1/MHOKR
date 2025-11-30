/**
 * Analytics service for telemetry events
 * 
 * Uses PostHog for product analytics, user adoption tracking, and error tracking.
 * Falls back to custom events if PostHog is not initialized.
 * 
 * To disable analytics temporarily, set NEXT_PUBLIC_ANALYTICS_ENABLED=false in .env.local
 */

// Check if analytics is enabled (defaults to true if not set)
const isAnalyticsEnabled = () => {
  if (typeof window === 'undefined') return false
  const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED
  // Default to true if not explicitly set to 'false'
  return enabled !== 'false'
}

// Lazy load PostHog to avoid SSR issues
function getPostHog() {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('posthog-js')
  } catch {
    return null
  }
}

/**
 * Track a custom event
 * @param name Event name (e.g., 'button_clicked', 'feature_used')
 * @param payload Additional event properties
 */
export function track(name: string, payload: Record<string, unknown> = {}) {
  // Early return if analytics is disabled
  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Tracking disabled:', name)
    }
    return
  }

  try {
    if (typeof window !== 'undefined') {
      const posthog = getPostHog()
      // Use PostHog if available and loaded
      if (posthog && posthog.default && posthog.default.__loaded) {
        try {
          posthog.default.capture(name, payload)
          return
        } catch (captureError) {
          // PostHog capture failed, fall through to custom events
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Analytics] PostHog capture failed, using fallback:', captureError)
          }
        }
      }

      // Fallback to custom events
      if (window.dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent('analytics', {
            detail: { name, ...payload },
          })
        )
      }
    }
  } catch (error) {
    // Silently fail - analytics should not break the app
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Failed to track event:', name, error)
    }
  }
}

/**
 * Identify a user
 * @param userId Unique user identifier
 * @param properties User properties (email, name, etc.)
 */
export function identify(userId: string, properties?: Record<string, unknown>) {
  if (!isAnalyticsEnabled()) return

  try {
    if (typeof window !== 'undefined') {
      const posthog = getPostHog()
      if (posthog && posthog.default && posthog.default.__loaded) {
        posthog.default.identify(userId, properties)
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Failed to identify user:', error)
    }
  }
}

/**
 * Reset user identification (e.g., on logout)
 */
export function reset() {
  if (!isAnalyticsEnabled()) return

  try {
    if (typeof window !== 'undefined') {
      const posthog = getPostHog()
      if (posthog && posthog.default && posthog.default.__loaded) {
        posthog.default.reset()
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Failed to reset:', error)
    }
  }
}

/**
 * Track an error
 * @param error Error object or message
 * @param context Additional context about the error
 */
export function trackError(error: Error | string, context?: Record<string, unknown>) {
  if (!isAnalyticsEnabled()) return

  try {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    track('error_occurred', {
      error_message: errorMessage,
      error_stack: errorStack,
      ...context,
    })

    // Also use PostHog's built-in error tracking if available
    if (typeof window !== 'undefined') {
      const posthog = getPostHog()
      if (posthog && posthog.default && posthog.default.__loaded) {
        posthog.default.capture('$exception', {
          $exception_message: errorMessage,
          $exception_stack: errorStack,
          ...context,
        })
      }
    }
  } catch (trackingError) {
    // Silently fail - error tracking should not break the app
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Failed to track error:', trackingError)
    }
  }
}

/**
 * Set user properties
 * @param properties User properties to set
 */
export function setUserProperties(properties: Record<string, unknown>) {
  if (!isAnalyticsEnabled()) return

  try {
    if (typeof window !== 'undefined') {
      const posthog = getPostHog()
      if (posthog && posthog.default && posthog.default.__loaded) {
        posthog.default.people.set(properties)
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Failed to set user properties:', error)
    }
  }
}

