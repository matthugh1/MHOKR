/**
 * Check-in Due/Overdue Calculator
 * 
 * Shared utility for calculating whether a Key Result is due or overdue for check-in.
 * Used by both the reminder scheduler and reporting endpoints.
 */

export interface CheckInDueStatus {
  isDue: boolean;
  isOverdue: boolean;
  daysSinceLastCheckIn: number;
  cadenceDays: number;
  status: 'DUE' | 'OVERDUE' | 'ON_TIME';
}

/**
 * Get cadence days for a CheckInCadence enum value
 */
export function getCadenceDays(cadence: string | null | undefined): number {
  switch (cadence) {
    case 'WEEKLY':
      return 7;
    case 'BIWEEKLY':
      return 14;
    case 'MONTHLY':
      return 30;
    default:
      return 0;
  }
}

/**
 * Calculate due/overdue status for a Key Result
 * 
 * @param cadence - CheckInCadence enum value
 * @param lastCheckInAt - Last check-in timestamp (null if never checked in)
 * @param krCreatedAt - Key Result creation timestamp (used if no check-in and no startDate)
 * @param graceDays - Grace period in days before marking overdue (default: 2)
 * @param now - Current timestamp (default: new Date())
 * @param krStartDate - Optional Key Result start date (if provided and in the past, used instead of createdAt when no check-in)
 * @returns CheckInDueStatus with isDue, isOverdue, daysSinceLastCheckIn, cadenceDays, status
 */
export function calculateCheckInDueStatus(
  cadence: string | null | undefined,
  lastCheckInAt: Date | null,
  krCreatedAt: Date,
  graceDays: number = 2,
  now: Date = new Date(),
  krStartDate?: Date | null,
): CheckInDueStatus {
  const cadenceDays = getCadenceDays(cadence);
  
  if (cadenceDays === 0 || !cadence || cadence === 'NONE') {
    return {
      isDue: false,
      isOverdue: false,
      daysSinceLastCheckIn: 0,
      cadenceDays: 0,
      status: 'ON_TIME',
    };
  }

  // Calculate days since last check-in (or since KR start/creation if no check-in)
  let daysSinceLastCheckIn: number;
  let referenceDate: Date;
  
  if (!lastCheckInAt) {
    // No check-ins yet - determine reference date
    if (krStartDate && krStartDate.getTime() <= now.getTime()) {
      // KR has a start date that has passed - use it as reference
      referenceDate = krStartDate;
    } else if (krStartDate && krStartDate.getTime() > now.getTime()) {
      // KR has a start date in the future - not yet active
      return {
        isDue: false,
        isOverdue: false,
        daysSinceLastCheckIn: 0,
        cadenceDays,
        status: 'ON_TIME',
      };
    } else {
      // No start date - use creation date
      referenceDate = krCreatedAt;
    }
  } else {
    // Has check-ins - use last check-in date
    referenceDate = lastCheckInAt;
  }
  
  // If the reference date is in the future, 
  // the KR is not yet active, so it cannot be due or overdue
  if (referenceDate.getTime() > now.getTime()) {
    return {
      isDue: false,
      isOverdue: false,
      daysSinceLastCheckIn: 0,
      cadenceDays,
      status: 'ON_TIME',
    };
  }
  
  daysSinceLastCheckIn = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

  // Determine if due or overdue
  const isDue = daysSinceLastCheckIn >= cadenceDays;
  const isOverdue = daysSinceLastCheckIn > cadenceDays + graceDays;

  return {
    isDue,
    isOverdue,
    daysSinceLastCheckIn,
    cadenceDays,
    status: isOverdue ? 'OVERDUE' : isDue ? 'DUE' : 'ON_TIME',
  };
}

