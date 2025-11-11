/**
 * Notification Port Interface
 * 
 * Abstraction for sending notifications (email, in-app, etc.)
 * Implementations: LoggingNotificationAdapter (default), EmailNotificationAdapter (future)
 */
export interface NotificationPort {
  /**
   * Send a check-in reminder notification
   * 
   * @param dto - Reminder data including KR details and recipient
   */
  sendCheckInReminder(dto: {
    krId: string;
    krTitle: string;
    ownerUserId: string;
    ownerName: string | null;
    ownerEmail: string | null;
    dueStatus: 'DUE' | 'OVERDUE';
    dueSinceDays: number;
    lastCheckInAt: Date | null;
    lastValue: number | null;
    lastConfidence: number | null;
    deepLink: string;
  }): Promise<void>;
}

