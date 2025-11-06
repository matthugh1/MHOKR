/**
 * Analytics service for telemetry events
 * 
 * Minimal implementation that dispatches custom events.
 * Ready for swap to a proper analytics service (e.g., PostHog, Mixpanel).
 */

export function track(name: string, payload: Record<string, unknown> = {}) {
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('analytics', {
          detail: { name, ...payload },
        })
      )
    }
  } catch (error) {
    // Silently fail - analytics should not break the app
  }
}

