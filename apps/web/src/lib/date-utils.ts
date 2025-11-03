/**
 * Format a date range for display
 */
export function formatDateRange(start: Date | string, end: Date | string): string {
  const startDate = typeof start === 'string' ? new Date(start) : start
  const endDate = typeof end === 'string' ? new Date(end) : end

  const options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }

  const startStr = startDate.toLocaleDateString('en-US', options)
  const endStr = endDate.toLocaleDateString('en-US', options)

  return `${startStr} - ${endStr}`
}

/**
 * Validate that a date range is consistent (end date after start date)
 */
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string
): { valid: boolean; message?: string } {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate

  // Basic validation: end must be after start
  if (end <= start) {
    return { valid: false, message: 'End date must be after start date' }
  }

  return { valid: true }
}

/**
 * Calculate progress percentage based on time elapsed
 */
export function calculateTimeProgress(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  const now = new Date()

  if (now < start) return 0
  if (now > end) return 100

  const totalDuration = end.getTime() - start.getTime()
  const elapsed = now.getTime() - start.getTime()

  return Math.round((elapsed / totalDuration) * 100)
}

/**
 * Format date for HTML date input (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

/**
 * Get quarter number (1-4) from a date
 */
export function getQuarterFromDate(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date
  return Math.floor(d.getMonth() / 3) + 1
}

/**
 * Get start and end dates for a specific quarter and year
 */
export function getQuarterDates(quarter: number, year: number): { startDate: Date; endDate: Date } {
  const startMonth = (quarter - 1) * 3
  const startDate = new Date(year, startMonth, 1)
  const endDate = new Date(year, startMonth + 3, 0) // Last day of the quarter
  
  return { startDate, endDate }
}

/**
 * Get start and end dates for a specific month and year
 */
export function getMonthDates(month: number, year: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0) // Last day of the month
  
  return { startDate, endDate }
}

/**
 * Get start and end dates for a specific year
 */
export function getYearDates(year: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, 0, 1) // January 1st
  const endDate = new Date(year, 11, 31) // December 31st
  
  return { startDate, endDate }
}

/**
 * Get current year
 */
export function getCurrentYear(): number {
  return new Date().getFullYear()
}

/**
 * Get available years (current year +/- 3)
 */
export function getAvailableYears(): number[] {
  const currentYear = getCurrentYear()
  const years: number[] = []
  for (let i = currentYear - 3; i <= currentYear + 3; i++) {
    years.push(i)
  }
  return years
}

/**
 * Get month name from number (0-11)
 */
export function getMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return monthNames[month]
}

/**
 * Check if an OKR's dates overlap with a date range
 */
export function doesOKRMatchDateRange(
  okrStartDate: Date | string,
  okrEndDate: Date | string,
  rangeStartDate: Date | string,
  rangeEndDate: Date | string
): boolean {
  const okrStart = typeof okrStartDate === 'string' ? new Date(okrStartDate) : okrStartDate
  const okrEnd = typeof okrEndDate === 'string' ? new Date(okrEndDate) : okrEndDate
  const rangeStart = typeof rangeStartDate === 'string' ? new Date(rangeStartDate) : rangeStartDate
  const rangeEnd = typeof rangeEndDate === 'string' ? new Date(rangeEndDate) : rangeEndDate
  
  // Check if the OKR's dates overlap with or are contained within the range
  return (
    (okrStart <= rangeEnd && okrEnd >= rangeStart)
  )
}

/**
 * Get the current period filter (what quarter we're currently in)
 */
export function getCurrentPeriodFilter(): string {
  const now = new Date()
  const quarter = getQuarterFromDate(now)
  const year = now.getFullYear()
  
  return `quarterly-${year}-Q${quarter}`
}
