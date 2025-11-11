import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CheckInReminderService } from './check-in-reminder.service';

/**
 * Check-in Reminder Scheduler
 * 
 * Runs periodic job to send check-in reminders for due/overdue Key Results.
 * Default: Daily at 9 AM (configurable via OKR_CHECKIN_CRON env var).
 * 
 * Feature flag: OKR_CHECKIN_REMINDERS_ENABLED (default: false)
 */
@Injectable()
export class CheckInReminderScheduler {
  private readonly logger = new Logger(CheckInReminderScheduler.name);
  private readonly remindersEnabled: boolean;

  constructor(
    private reminderService: CheckInReminderService,
    private configService: ConfigService,
  ) {
    this.remindersEnabled = this.configService.get<string>('OKR_CHECKIN_REMINDERS_ENABLED') === 'true';
  }

  /**
   * Scheduled job: Process check-in reminders
   * 
   * Runs daily (default 9 AM) or as configured via OKR_CHECKIN_CRON env var.
   * Format: CronExpression or cron string (e.g., "0 9 * * *" for 9 AM daily)
   * 
   * Feature flag: Only runs if OKR_CHECKIN_REMINDERS_ENABLED=true
   */
  @Cron(process.env.OKR_CHECKIN_CRON || CronExpression.EVERY_DAY_AT_9AM)
  async handleCheckInReminders() {
    if (!this.remindersEnabled) {
      this.logger.debug('Check-in reminders disabled via OKR_CHECKIN_REMINDERS_ENABLED');
      return;
    }

    this.logger.log('Running scheduled check-in reminder job...');

    try {
      const result = await this.reminderService.processAllReminders();
      this.logger.log(`Check-in reminder job completed: ${result.remindersSent} reminders sent to ${result.tenantsProcessed} tenants`);
    } catch (error) {
      this.logger.error('Check-in reminder job failed:', error);
    }
  }
}

