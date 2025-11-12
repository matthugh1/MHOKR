import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationPort } from './notification.port';
import { NOTIFICATION_PORT_TOKEN } from './notification.constants';
import { calculateCheckInDueStatus } from './check-in-due-calculator';
import { recordCheckInReminderScan, recordCheckInReminderSent, checkInTelemetry } from './check-in-telemetry';

/**
 * Check-in Reminder DTO
 */
export interface CheckInReminderDto {
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
}

/**
 * Check-in Reminder Service
 * 
 * Determines which Key Results are due or overdue for check-ins based on checkInCadence.
 * Multi-tenant safe; respects RBAC/visibility.
 */
@Injectable()
export class CheckInReminderService {
  private readonly logger = new Logger(CheckInReminderService.name);
  private readonly graceDays: number;
  private readonly remindersEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(NOTIFICATION_PORT_TOKEN) private notificationPort: NotificationPort,
  ) {
    this.graceDays = parseInt(this.configService.get<string>('OKR_CHECKIN_GRACE_DAYS') || '2', 10);
    this.remindersEnabled = this.configService.get<string>('OKR_CHECKIN_REMINDERS_ENABLED') === 'true';
  }


  /**
   * Find Key Results that are due or overdue for check-ins, grouped by tenant
   * 
   * @returns Map of tenantId -> CheckInReminderDto[]
   */
  async findDueCheckIns(): Promise<Map<string, CheckInReminderDto[]>> {
    if (!this.remindersEnabled) {
      this.logger.debug('Check-in reminders disabled via OKR_CHECKIN_REMINDERS_ENABLED');
      return new Map();
    }

    return checkInTelemetry.time('checkin.reminder.scan', async () => {
      const now = new Date();
      const results = new Map<string, CheckInReminderDto[]>();

      // Fetch all Key Results with checkInCadence set (not NONE or null)
      // Include latest check-in and owner info
      const keyResults = await this.prisma.keyResult.findMany({
        where: {
          checkInCadence: {
            not: null,
            notIn: ['NONE'],
          },
          // Only active KRs (not COMPLETED or CANCELLED)
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
        include: {
          checkIns: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              createdAt: true,
              value: true,
              confidence: true,
            },
          },
          objectives: {
            select: {
              objective: {
                select: {
                  id: true,
                  tenantId: true,
                },
              },
            },
            take: 1,
          },
        },
      });

      for (const kr of keyResults) {
        // Skip if no parent objective or tenantId
        const objective = kr.objectives[0]?.objective;
        if (!objective || !objective.tenantId) {
          continue;
        }

        // Use shared calculator
        const lastCheckIn = kr.checkIns[0];
        const lastCheckInAt = lastCheckIn?.createdAt || null;
        const dueStatus = calculateCheckInDueStatus(
          kr.checkInCadence,
          lastCheckInAt,
          kr.createdAt,
          this.graceDays,
          now,
        );

        // Skip if not due or overdue
        if (!dueStatus.isDue && !dueStatus.isOverdue) {
          continue;
        }

        if (dueStatus.isDue || dueStatus.isOverdue) {
          // Fetch owner separately since KeyResult doesn't have owner relation
          const owner = await this.prisma.user.findUnique({
            where: { id: kr.ownerId },
            select: { id: true, name: true, email: true },
          });

          // Skip if owner not found
          if (!owner) {
            this.logger.warn(`Skipping reminder for KR ${kr.id}: owner not found`);
            continue;
          }

          const reminderDueStatus: 'DUE' | 'OVERDUE' = dueStatus.isOverdue ? 'OVERDUE' : 'DUE';

          // Build deep link (assumes frontend route structure)
          const deepLink = `/dashboard/okrs?krId=${kr.id}`;

          const reminder: CheckInReminderDto = {
            krId: kr.id,
            krTitle: kr.title,
            ownerUserId: kr.ownerId,
            ownerName: owner.name,
            ownerEmail: owner.email,
            dueStatus: reminderDueStatus,
            dueSinceDays: dueStatus.daysSinceLastCheckIn,
            lastCheckInAt,
            lastValue: lastCheckIn?.value || null,
            lastConfidence: lastCheckIn?.confidence || null,
            deepLink,
          };

          // Group by tenant
          if (!results.has(objective.tenantId)) {
            results.set(objective.tenantId, []);
          }
          results.get(objective.tenantId)!.push(reminder);
        }
      }

      // Record scan telemetry
      recordCheckInReminderScan({
        totalKRsScanned: keyResults.length,
        tenantsFound: results.size,
        totalReminders: Array.from(results.values()).reduce((sum, arr) => sum + arr.length, 0),
      });

      return results;
    });
  }

  /**
   * Send reminders for a specific tenant
   * 
   * Includes idempotency check: only send if not sent in last 24h
   */
  async sendRemindersForTenant(tenantId: string, reminders: CheckInReminderDto[]): Promise<number> {
    let sentCount = 0;

    for (const reminder of reminders) {
      // Check if reminder was sent in last 24h (idempotency)
      const reminderKey = `checkin_reminder:${reminder.krId}:${this.getReminderPeriodKey(reminder.dueSinceDays)}`;
      const lastSent = await this.prisma.activity.findFirst({
        where: {
          entityType: 'KEY_RESULT',
          entityId: reminder.krId,
          action: 'REMINDER_SENT',
          tenantId: tenantId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      if (lastSent) {
        this.logger.debug(`Skipping duplicate reminder for KR ${reminder.krId} (sent ${lastSent.createdAt})`);
        continue;
      }

      try {
        // Send notification
        await this.notificationPort.sendCheckInReminder(reminder);

        // Log reminder sent in Activity table for idempotency
        await this.prisma.activity.create({
          data: {
            entityType: 'KEY_RESULT',
            entityId: reminder.krId,
            userId: reminder.ownerUserId,
            tenantId: tenantId,
            action: 'REMINDER_SENT',
            metadata: {
              reminderKey,
              dueStatus: reminder.dueStatus,
              dueSinceDays: reminder.dueSinceDays,
              krTitle: reminder.krTitle,
            },
          },
        });

        sentCount++;
        
        // Record telemetry
        recordCheckInReminderSent({
          krId: reminder.krId,
          tenantId: tenantId,
          dueStatus: reminder.dueStatus,
        });
        
        this.logger.log(`Sent ${reminder.dueStatus} reminder for KR ${reminder.krId} to ${reminder.ownerEmail || reminder.ownerUserId}`);
      } catch (error) {
        this.logger.error(`Failed to send reminder for KR ${reminder.krId}:`, error);
      }
    }

    return sentCount;
  }

  /**
   * Generate a period key for idempotency (groups reminders by approximate period)
   * Uses daysSinceLastCheckIn rounded to nearest cadence period
   */
  private getReminderPeriodKey(daysSinceLastCheckIn: number): string {
    // Round to nearest 7-day period for idempotency
    return Math.floor(daysSinceLastCheckIn / 7).toString();
  }

  /**
   * Process all due check-ins across all tenants
   * 
   * Called by scheduler.
   * Feature flag: Only runs if OKR_CHECKIN_REMINDERS_ENABLED=true
   */
  async processAllReminders(): Promise<{ tenantsProcessed: number; remindersSent: number }> {
    if (!this.remindersEnabled) {
      this.logger.debug('Check-in reminders disabled via OKR_CHECKIN_REMINDERS_ENABLED');
      return { tenantsProcessed: 0, remindersSent: 0 };
    }

    this.logger.log('Starting check-in reminder processing...');

    // Record scan telemetry with timing
    const dueCheckIns = await checkInTelemetry.time(
      'checkin.reminder.scan',
      () => this.findDueCheckIns(),
      {},
    );
    
    let totalSent = 0;

    for (const [tenantId, reminders] of dueCheckIns.entries()) {
      const sent = await this.sendRemindersForTenant(tenantId, reminders);
      totalSent += sent;
      this.logger.log(`Tenant ${tenantId}: ${sent}/${reminders.length} reminders sent`);
    }

    this.logger.log(`Check-in reminder processing complete: ${totalSent} reminders sent across ${dueCheckIns.size} tenants`);

    return {
      tenantsProcessed: dueCheckIns.size,
      remindersSent: totalSent,
    };
  }
}

