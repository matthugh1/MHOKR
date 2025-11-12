/**
 * Telemetry timing hook
 * 
 * W5.M3: Lightweight timing utility for UX performance tracking
 */

export function useUxTiming(name: string) {
  const startTimeRef = React.useRef<number | null>(null)

  const start = () => {
    startTimeRef.current = performance.now()
  }

  const end = () => {
    if (startTimeRef.current === null) return

    const elapsed = performance.now() - startTimeRef.current
    const elapsedMs = Math.round(elapsed)

    // Log through existing telemetry or console fallback
    console.log(`[Telemetry] ${name}`, {
      durationMs: elapsedMs,
      timestamp: new Date().toISOString(),
    })

    startTimeRef.current = null
    return elapsedMs
  }

  return { start, end }
}

// Standalone version for use outside React components
export function markTiming(name: string): () => number {
  const start = performance.now()
  return () => {
    const elapsed = Math.round(performance.now() - start)
    console.log(`[Telemetry] ${name}`, {
      durationMs: elapsed,
      timestamp: new Date().toISOString(),
    })
    return elapsed
  }
}

// React import needed for hook
import React from 'react'

