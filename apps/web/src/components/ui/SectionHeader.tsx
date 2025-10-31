'use client'

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

/**
 * SectionHeader - Consistent section header pattern for dashboard sections
 * 
 * Used for grouping related content with a title and optional subtitle/metadata.
 * Follows Phase 9 design tokens for consistent typography.
 * 
 * @example
 * ```tsx
 * <SectionHeader
 *   title="Recent Activity"
 *   subtitle="Last 10 check-ins"
 * />
 * ```
 */
export function SectionHeader({ title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-2 ${className}`}>
      <div className="text-sm font-medium text-neutral-900">
        {title}
      </div>
      {subtitle && (
        <div className="text-[11px] text-neutral-500">
          {subtitle}
        </div>
      )}
    </div>
  )
}

