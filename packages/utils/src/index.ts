// Shared utility functions for OKR Nexus

import { OKRStatus, MetricType } from '@okr-nexus/types';

/**
 * Calculate progress percentage based on start, current, and target values
 */
export function calculateProgress(
  startValue: number,
  currentValue: number,
  targetValue: number,
  metricType: MetricType,
): number {
  if (targetValue === startValue) return 0;

  let progress: number;

  switch (metricType) {
    case MetricType.INCREASE:
      progress = ((currentValue - startValue) / (targetValue - startValue)) * 100;
      break;
    case MetricType.DECREASE:
      progress = ((startValue - currentValue) / (startValue - targetValue)) * 100;
      break;
    case MetricType.REACH:
    case MetricType.MAINTAIN:
      progress = (currentValue / targetValue) * 100;
      break;
    default:
      progress = 0;
  }

  return Math.max(0, Math.min(100, progress));
}

/**
 * Determine OKR status based on progress and time elapsed
 */
export function determineOKRStatus(
  progress: number,
  startDate: Date,
  endDate: Date,
  currentDate: Date = new Date(),
): OKRStatus {
  if (progress >= 100) return OKRStatus.COMPLETED;

  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = currentDate.getTime() - startDate.getTime();
  const timeProgress = (elapsed / totalDuration) * 100;

  // If we're behind schedule by more than 15%
  if (timeProgress - progress > 15) return OKRStatus.OFF_TRACK;

  // If we're behind schedule by 5-15%
  if (timeProgress - progress > 5) return OKRStatus.AT_RISK;

  return OKRStatus.ON_TRACK;
}

/**
 * Generate a slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format date to ISO string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse date from string
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(date: Date): boolean {
  return date > new Date();
}

/**
 * Get quarter from date
 */
export function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

/**
 * Get quarter date range
 */
export function getQuarterDateRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate a random hex color
 */
export function randomColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

/**
 * Delay execution for a specified time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await delay(delayMs * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError!;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}




