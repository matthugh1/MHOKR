/**
 * Breadcrumb component for OKR Tree view
 * Shows the path from root to currently selected node
 */

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  id: string
  title: string
  type: 'objective' | 'keyResult' | 'initiative'
}

interface OKRTreeBreadcrumbProps {
  items: BreadcrumbItem[]
  onItemClick?: (item: BreadcrumbItem) => void
  className?: string
}

export function OKRTreeBreadcrumb({ items, onItemClick, className }: OKRTreeBreadcrumbProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={cn('flex items-center gap-1 text-sm text-neutral-600', className)}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => onItemClick?.(item)}
            className={cn(
              'px-2 py-1 rounded hover:bg-neutral-100 transition-colors',
              index === items.length - 1 && 'font-medium text-neutral-900',
              onItemClick && 'cursor-pointer',
              !onItemClick && 'cursor-default'
            )}
            aria-current={index === items.length - 1 ? 'page' : undefined}
          >
            <span className="text-xs text-neutral-500 mr-1">
              {item.type === 'objective' ? 'O' : item.type === 'keyResult' ? 'KR' : 'I'}
            </span>
            {item.title}
          </button>
        </React.Fragment>
      ))}
    </nav>
  )
}


