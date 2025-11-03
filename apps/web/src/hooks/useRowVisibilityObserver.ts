/**
 * Shared IntersectionObserver hook for row visibility
 * 
 * W5.M3: Centralised observer to avoid re-creating observers per row.
 * Uses rootMargin '200px' and configurable thresholds.
 */

import { useEffect, useRef, useCallback } from 'react'

interface UseRowVisibilityObserverOptions {
  rootMargin?: string
  threshold?: number | number[]
  enabled?: boolean
}

interface UseRowVisibilityObserverReturn {
  observe: (element: HTMLElement | null, callback: (isVisible: boolean) => void) => () => void
}

export function useRowVisibilityObserver(
  options: UseRowVisibilityObserverOptions = {},
): UseRowVisibilityObserverReturn {
  const { rootMargin = '200px', threshold = 0.1, enabled = true } = options
  const observerRef = useRef<IntersectionObserver | null>(null)
  const callbacksRef = useRef<Map<Element, (isVisible: boolean) => void>>(new Map())

  useEffect(() => {
    if (!enabled) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = callbacksRef.current.get(entry.target)
          if (callback) {
            callback(entry.isIntersecting)
          }
        })
      },
      {
        rootMargin,
        threshold,
      },
    )

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      callbacksRef.current.clear()
    }
  }, [rootMargin, threshold, enabled])

  const observe = useCallback(
    (element: HTMLElement | null, callback: (isVisible: boolean) => void) => {
      if (!element || !observerRef.current) return () => {}

      callbacksRef.current.set(element, callback)
      observerRef.current.observe(element)

      return () => {
        if (observerRef.current && callbacksRef.current.has(element)) {
          observerRef.current.unobserve(element)
          callbacksRef.current.delete(element)
        }
      }
    },
    [],
  )

  return { observe }
}

