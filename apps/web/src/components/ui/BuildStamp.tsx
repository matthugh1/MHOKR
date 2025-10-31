'use client'

import { APP_VERSION, GIT_SHA, DEPLOY_ENV } from '@/version'

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
  const shortSha = GIT_SHA.substring(0, 7)
  const displayText = `${APP_VERSION} • ${DEPLOY_ENV} • ${shortSha}`

  if (variant === 'footer') {
    return (
      <div className={`text-[10px] text-neutral-400 text-center py-2 ${className}`}>
        {displayText}
      </div>
    )
  }

  // inline variant
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600 shadow-sm ${className}`}>
      {displayText}
    </div>
  )
}

// TODO [phase7-hardening]: theme this with tokens if design system evolves
