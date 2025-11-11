import { Injectable, Logger } from '@nestjs/common';
import { NotificationPort } from './notification.port';

/**
 * Logging Notification Adapter
 * 
 * Default implementation that logs reminders instead of sending real notifications.
 * Replace with EmailNotificationAdapter or InAppNotificationAdapter in production.
 */
@Injectable()
export class LoggingNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(LoggingNotificationAdapter.name);

  async sendCheckInReminder(dto: {
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
  }): Promise<void> {
    this.logger.log(`[CHECK-IN REMINDER] ${dto.dueStatus}: ${dto.krTitle}`, {
      krId: dto.krId,
      ownerUserId: dto.ownerUserId,
      ownerName: dto.ownerName,
      ownerEmail: dto.ownerEmail,
      dueSinceDays: dto.dueSinceDays,
      lastCheckInAt: dto.lastCheckInAt,
      lastValue: dto.lastValue,
      lastConfidence: dto.lastConfidence,
      deepLink: dto.deepLink,
    });
  }
}

