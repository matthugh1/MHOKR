/**
 * @module BuildStamp
 * 
 * Displays build metadata (version, environment, git SHA) in the UI.
 * Used to identify which build is currently running during demos and debugging.
 * 
 * See DESIGN_SYSTEM.md for design token references.
 */

import { APP_VERSION, GIT_SHA, DEPLOY_ENV } from '@/version'

interface BuildStampProps {
  variant: 'inline' | 'footer'
}

/**
 * BuildStamp component displays version, environment, and git SHA information.
 * 
 * Variants:
 * - "inline": Compact badge-style display for headers
 * - "footer": Subtle footer text for drawers/modals
 */
export function BuildStamp({ variant }: BuildStampProps) {
  if (variant === 'inline') {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600 shadow-sm">
        {APP_VERSION} • {DEPLOY_ENV} • <span className="font-mono">{GIT_SHA}</span>
      </div>
    )
  }

  // footer variant
  return (
    <div className="mt-4 text-[10px] text-neutral-400">
      Build {APP_VERSION} ({GIT_SHA} · {DEPLOY_ENV})
    </div>
  )
}

// TODO [phase7-hardening]: theme this with tokens if design system evolves

