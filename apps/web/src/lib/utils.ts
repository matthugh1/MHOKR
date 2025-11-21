import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number with K (thousands) or M (millions) suffix with 2 decimal places
 * Examples:
 * - 1500000 -> "1.50M"
 * - 2500 -> "2.50K"
 * - 999 -> "999"
 * - 1234567 -> "1.23M"
 */
export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '—'
  }

  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1000000) {
    return `${sign}${(absValue / 1000000).toFixed(2)}M`
  } else if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(2)}K`
  } else {
    // For numbers less than 1000, show with 2 decimal places if needed
    return value % 1 === 0 ? value.toString() : value.toFixed(2)
  }
}

/**
 * Clamps a progress percentage to the valid range of 0-100
 * This prevents displaying invalid progress values like 102415000%
 * Examples:
 * - 102415000 -> 100
 * - -5 -> 0
 * - 76.43 -> 76.43
 */
export function clampProgress(progress: number | undefined | null): number {
  if (progress === undefined || progress === null || isNaN(progress)) {
    return 0
  }
  return Math.max(0, Math.min(100, progress))
}











