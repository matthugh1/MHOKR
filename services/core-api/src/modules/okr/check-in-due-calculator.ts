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
 * @param krCreatedAt - Key Result creation timestamp (used if no check-in)
 * @param graceDays - Grace period in days before marking overdue (default: 2)
 * @param now - Current timestamp (default: new Date())
 * @returns CheckInDueStatus with isDue, isOverdue, daysSinceLastCheckIn, cadenceDays, status
 */
export function calculateCheckInDueStatus(
  cadence: string | null | undefined,
  lastCheckInAt: Date | null,
  krCreatedAt: Date,
  graceDays: number = 2,
  now: Date = new Date(),
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

  // Calculate days since last check-in (or since KR creation if no check-in)
  let daysSinceLastCheckIn: number;
  if (!lastCheckInAt) {
    daysSinceLastCheckIn = Math.floor((now.getTime() - krCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    daysSinceLastCheckIn = Math.floor((now.getTime() - lastCheckInAt.getTime()) / (1000 * 60 * 60 * 24));
  }

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

