'use client'

import { BUILD_VERSION, BUILD_ENV, BUILD_GIT_SHA } from '@/version'

export interface BuildStampProps {
  variant?: 'inline' | 'footer'
  className?: string
}

/**
 * @module BuildStamp
 * @see {@link file:///docs/BUILD_INFO.md Build Information Documentation}
 * 
 * BuildStamp - Displays build provenance (version, env, git sha)
 * 
 * Mandatory on any page we demo live. Must appear on:
 * - Analytics header
 * - OKRs header
 * - Builder header
 * - AI dashboard header
 * - ActivityDrawer footer
 * 
 * @example
 * ```tsx
 * <BuildStamp variant="inline" />
 * ```
 */
export function BuildStamp({ variant = 'inline', className = '' }: BuildStampProps) {
  const shortSha = BUILD_GIT_SHA.substring(0, 7)
  const displayText = `${BUILD_VERSION} • ${BUILD_ENV} • ${shortSha}`

  if (variant === 'footer') {
    return (
      <div className={`text-[10px] text-neutral-400 text-center py-2 ${className}`}>
        {displayText}
      </div>
    )
  }

  return (
    <div className={`text-[10px] text-neutral-500 font-mono ${className}`}>
      {displayText}
    </div>
  )
}
