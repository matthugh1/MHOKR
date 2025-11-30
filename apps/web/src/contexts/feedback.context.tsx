'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { errorTracker, TrackedError } from '@/lib/error-tracker'
import api from '@/lib/api'
import { useAuth } from './auth.context'
import { track, trackError } from '@/lib/analytics'

interface FeedbackContextType {
  errors: TrackedError[]
  submitFeedback: (message: string) => Promise<void>
  clearErrors: () => void
  isSubmitting: boolean
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined)

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<TrackedError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()

  // Initialize error tracking on mount
  useEffect(() => {
    errorTracker.init()
    
    // Update errors periodically to reflect new errors
    const interval = setInterval(() => {
      setErrors(errorTracker.getErrors())
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  // Update errors when pathname changes (to capture page context)
  useEffect(() => {
    setErrors(errorTracker.getErrors())
  }, [pathname])

  const clearErrors = useCallback(() => {
    errorTracker.clearErrors()
    setErrors([])
  }, [])

  const submitFeedback = useCallback(async (message: string) => {
    if (!user) {
      throw new Error('You must be logged in to submit feedback')
    }

    setIsSubmitting(true)
    const startTime = Date.now()
    
    try {
      const recentErrors = errorTracker.getRecentErrors(10)
      const browserContext = errorTracker.getBrowserContext()

      await api.post('/feedback', {
        message,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        errors: recentErrors.length > 0 ? recentErrors : undefined,
        metadata: {
          screenWidth: browserContext.screenWidth,
          screenHeight: browserContext.screenHeight,
          timestamp: browserContext.timestamp,
        },
      })

      // Track successful feedback submission
      const duration = Date.now() - startTime
      track('feedback_submitted', {
        message_length: message.length,
        has_errors: recentErrors.length > 0,
        error_count: recentErrors.length,
        page: window.location.pathname,
        duration_ms: duration,
        // Include a summary of feedback sentiment (basic keyword detection)
        contains_bug_report: /bug|error|broken|issue|problem/i.test(message),
        contains_feature_request: /feature|add|suggest|improve|enhance/i.test(message),
        contains_praise: /great|good|love|excellent|awesome|thanks/i.test(message),
      })

      // Clear errors after successful submission
      clearErrors()
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      
      // Track failed feedback submission
      trackError(error as Error, {
        context: 'feedback_submission',
        message_length: message.length,
        page: window.location.pathname,
      })
      
      track('feedback_submission_failed', {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        page: window.location.pathname,
      })
      
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [user, clearErrors])

  return (
    <FeedbackContext.Provider
      value={{
        errors,
        submitFeedback,
        clearErrors,
        isSubmitting,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (context === undefined) {
    throw new Error('useFeedback must be used within a FeedbackProvider')
  }
  return context
}

