'use client'

/**
 * Version Logger Component
 * 
 * Logs version information to console on app load for DevTools verification
 */

import { useEffect } from 'react'
import { logVersionInfo } from '@/utils/version'

export function VersionLogger() {
  useEffect(() => {
    logVersionInfo().catch(() => {
      // Silently fail if version.json not available
    })
  }, [])

  return null
}

