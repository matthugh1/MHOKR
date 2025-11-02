import { Period } from '@okr-nexus/types'

/**
 * Calculate end date based on start date and period type
 */
export function calculateEndDate(startDate: Date | string, period: Period): Date {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = new Date(start)

  switch (period) {
    case Period.MONTHLY:
      end.setMonth(end.getMonth() + 1)
      break
    case Period.QUARTERLY:
      end.setMonth(end.getMonth() + 3)
      break
    case Period.ANNUAL:
      end.setFullYear(end.getFullYear() + 1)
      break
    case Period.CUSTOM:
      // For custom, return 3 months as default
      end.setMonth(end.getMonth() + 3)
      break
  }

  return end
}

/**
 * Get default start and end dates for a given period
 */
export function getDefaultDatesForPeriod(period: Period): { startDate: Date; endDate: Date } {
  const now = new Date()
  const startDate = new Date(now)
  
  // Set start date to beginning of current period
  switch (period) {
    case Period.MONTHLY:
      startDate.setDate(1)
      break
    case Period.QUARTERLY: {
      // Start of current quarter
      const currentMonth = startDate.getMonth()
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3
      startDate.setMonth(quarterStartMonth)
      startDate.setDate(1)
      break
    }
    case Period.ANNUAL:
      // Start of current year
      startDate.setMonth(0)
      startDate.setDate(1)
      break
    case Period.CUSTOM:
      // Just use current date
      break
  }

  const endDate = calculateEndDate(startDate, period)
  
  return { startDate, endDate }
}

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
 * Format period as a readable string (e.g., "Q4 2025", "Oct 2025")
 */
export function formatPeriod(period: Period, startDate: Date | string): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const year = start.getFullYear()

  switch (period) {
    case Period.MONTHLY:
      return start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    case Period.QUARTERLY: {
      const quarter = Math.floor(start.getMonth() / 3) + 1
      return `Q${quarter} ${year}`
    }
    case Period.ANNUAL:
      return `${year}`
    case Period.CUSTOM:
      return 'Custom'
  }
}

/**
 * Validate that a date range is consistent with the period type
 */
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string,
  period: Period
): { valid: boolean; message?: string } {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate

  // Basic validation: end must be after start
  if (end <= start) {
    return { valid: false, message: 'End date must be after start date' }
  }

  // Calculate expected duration in days
  const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  // Validate based on period type (with some tolerance)
  switch (period) {
    case Period.MONTHLY:
      if (durationDays < 25 || durationDays > 35) {
        return { 
          valid: false, 
          message: 'Monthly period should be approximately 30 days' 
        }
      }
      break
    case Period.QUARTERLY:
      if (durationDays < 85 || durationDays > 95) {
        return { 
          valid: false, 
          message: 'Quarterly period should be approximately 90 days (3 months)' 
        }
      }
      break
    case Period.ANNUAL:
      if (durationDays < 360 || durationDays > 370) {
        return { 
          valid: false, 
          message: 'Annual period should be approximately 365 days (1 year)' 
        }
      }
      break
    case Period.CUSTOM:
      // Custom periods have no duration constraints
      break
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
 * Get period label for display
 */
export function getPeriodLabel(period: Period): string {
  switch (period) {
    case Period.MONTHLY:
      return 'Monthly'
    case Period.QUARTERLY:
      return 'Quarterly'
    case Period.ANNUAL:
      return 'Annual'
    case Period.CUSTOM:
      return 'Custom'
  }
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
 * Period filter option for UI
 */
export interface PeriodFilterOption {
  value: string
  label: string
  period: Period
  year: number
  quarter?: number
  month?: number
  startDate: Date
  endDate: Date
}

/**
 * Check if an OKR's dates match a specific period
 */
export function doesOKRMatchPeriod(
  okrStartDate: Date | string,
  okrEndDate: Date | string,
  periodOption: PeriodFilterOption
): boolean {
  const okrStart = typeof okrStartDate === 'string' ? new Date(okrStartDate) : okrStartDate
  const okrEnd = typeof okrEndDate === 'string' ? new Date(okrEndDate) : okrEndDate
  
  // Check if the OKR's dates overlap with or are contained within the period
  // An OKR matches if it starts or ends within the period, or fully contains the period
  return (
    (okrStart <= periodOption.endDate && okrEnd >= periodOption.startDate)
  )
}

/**
 * Generate available period filter options
 * Returns periods for the past year, current year, and next year
 */
export function getAvailablePeriodFilters(): PeriodFilterOption[] {
  const options: PeriodFilterOption[] = []
  const currentYear = getCurrentYear()
  const currentMonth = new Date().getMonth()
  const _currentQuarter = getQuarterFromDate(new Date())
  
  // Add years (past, current, next)
  for (let year = currentYear - 1; year <= currentYear + 1; year++) {
    const yearDates = getYearDates(year)
    options.push({
      value: `annual-${year}`,
      label: `${year}`,
      period: Period.ANNUAL,
      year,
      startDate: yearDates.startDate,
      endDate: yearDates.endDate
    })
  }
  
  // Add quarters for current year and next year
  for (let year = currentYear; year <= currentYear + 1; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      const quarterDates = getQuarterDates(quarter, year)
      options.push({
        value: `quarterly-${year}-Q${quarter}`,
        label: `Q${quarter} ${year}`,
        period: Period.QUARTERLY,
        year,
        quarter,
        startDate: quarterDates.startDate,
        endDate: quarterDates.endDate
      })
    }
  }
  
  // Add months for current year (past 3 months through next 3 months)
  const startMonth = Math.max(0, currentMonth - 3)
  const endMonth = Math.min(11, currentMonth + 3)
  
  for (let month = startMonth; month <= endMonth; month++) {
    const monthDates = getMonthDates(month, currentYear)
    options.push({
      value: `monthly-${currentYear}-${month}`,
      label: `${getMonthName(month)} ${currentYear}`,
      period: Period.MONTHLY,
      year: currentYear,
      month,
      startDate: monthDates.startDate,
      endDate: monthDates.endDate
    })
  }
  
  // Add next year's first few months if we're near year end
  if (currentMonth >= 9) { // October or later
    for (let month = 0; month <= 2; month++) {
      const monthDates = getMonthDates(month, currentYear + 1)
      options.push({
        value: `monthly-${currentYear + 1}-${month}`,
        label: `${getMonthName(month)} ${currentYear + 1}`,
        period: Period.MONTHLY,
        year: currentYear + 1,
        month,
        startDate: monthDates.startDate,
        endDate: monthDates.endDate
      })
    }
  }
  
  return options
}

/**
 * Get the current period filter (what period we're currently in)
 */
export function getCurrentPeriodFilter(): string {
  const now = new Date()
  const quarter = getQuarterFromDate(now)
  const year = now.getFullYear()
  
  return `quarterly-${year}-Q${quarter}`
}

