'use client'

import React from 'react'
import { cn } from '@/lib/utils'

/**
 * PageContainer - Standardized page layout wrapper
 * 
 * UX Principles:
 * - Wide content width for data-dense pages (1600px = optimal for OKRs, tables, analytics)
 * - Responsive padding (reduces on mobile)
 * - Context-aware backgrounds (neutral for dashboards, white for forms)
 * 
 * Page Types:
 * - 'content': Wide content (OKRs, Analytics, Dashboard) - 1600px, neutral/white bg
 * - 'form': Forms and settings - 1600px, white bg, tighter padding
 * - 'dashboard': Special dashboard pages - 1600px, neutral bg with optional gradient
 */

interface PageContainerProps {
  children: React.ReactNode
  variant?: 'content' | 'form' | 'dashboard'
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '7xl' | '8xl' | 'full'
  background?: 'white' | 'neutral' | 'none'
  padding?: 'sm' | 'md' | 'lg'
  /** Enable gradient overlay (dashboard variant only) */
  withGradient?: boolean
}

export function PageContainer({ 
  children, 
  variant = 'content',
  maxWidth,
  background,
  padding,
  withGradient = false
}: PageContainerProps) {
  // Variant-based defaults (UX-optimized for wider pages)
  const variantDefaults = {
    content: { maxWidth: '8xl', background: 'white', padding: 'lg' },
    form: { maxWidth: '8xl', background: 'white', padding: 'md' },
    dashboard: { maxWidth: '8xl', background: 'neutral', padding: 'lg' },
  }
  
  const resolved = {
    maxWidth: maxWidth || variantDefaults[variant].maxWidth,
    background: background || variantDefaults[variant].background,
    padding: padding || variantDefaults[variant].padding,
  }
  
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '7xl': 'max-w-7xl',
    '8xl': 'max-w-[1600px]',
    full: 'max-w-full'
  }
  
  const backgroundClasses = {
    white: 'bg-white',
    neutral: 'bg-neutral-50',
    none: ''
  }
  
  // Responsive padding (reduces on mobile)
  const paddingClasses = {
    sm: 'p-4 sm:p-6',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  }
  
  return (
    <div className={cn(
      backgroundClasses[resolved.background],
      'min-h-screen relative',
      withGradient && variant === 'dashboard' && 'overflow-hidden'
    )}>
      {/* Gradient overlay for dashboard pages */}
      {withGradient && variant === 'dashboard' && (
        <div className="absolute top-0 left-0 w-full h-[160px] bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
      )}
      
      <div className={cn(
        maxWidthClasses[resolved.maxWidth],
        'mx-auto relative',
        paddingClasses[resolved.padding]
      )}>
        {children}
      </div>
    </div>
  )
}

