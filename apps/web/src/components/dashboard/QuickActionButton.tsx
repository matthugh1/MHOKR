'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionButtonProps {
  label: string
  onClick: () => Promise<void> | void
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'sm' | 'default' | 'lg'
  icon?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  className?: string
}

export function QuickActionButton({
  label,
  onClick,
  variant = 'default',
  size = 'sm',
  icon,
  disabled = false,
  loading = false,
  className,
}: QuickActionButtonProps) {
  const handleClick = async () => {
    if (disabled || loading) return
    await onClick()
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn("w-full justify-start gap-2", className)}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon
      )}
      {label}
    </Button>
  )
}

