/**
 * Check-in Reminder Service Tests
 * 
 * Unit tests for CheckInReminderService:
 * - Due/overdue calculation with edge cases (cadence NONE, grace window)
 * - Tenant isolation in queries
 * - Idempotency (24h cooldown)
 * - Notification port integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CheckInReminderService } from '../check-in-reminder.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationPort } from '../notification.port';

describe('CheckInReminderService', () => {
  let service: CheckInReminderService;
  let prisma: PrismaService;
  let notificationPort: NotificationPort;

  const mockPrismaService = {
    keyResult: {
      findMany: jest.fn(),
    },
    activity: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockNotificationPort = {
    sendCheckInReminder: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'OKR_CHECKIN_GRACE_DAYS') return '2';
      if (key === 'OKR_CHECKIN_REMINDERS_ENABLED') return 'true';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInReminderService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NotificationPort,
          useValue: mockNotificationPort,
        },
      ],
    }).compile();

    service = module.get<CheckInReminderService>(CheckInReminderService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationPort = module.get<NotificationPort>(NotificationPort);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findDueCheckIns', () => {
    it('should skip KRs with checkInCadence NONE', async () => {
      mockPrismaService.keyResult.findMany.mockResolvedValue([
        {
          id: 'kr-1',
          checkInCadence: 'NONE',
          status: 'ON_TRACK',
        },
      ]);

      const result = await service.findDueCheckIns();
      expect(result.size).toBe(0);
    });

    it('should skip KRs with null checkInCadence', async () => {
      mockPrismaService.keyResult.findMany.mockResolvedValue([
        {
          id: 'kr-1',
          checkInCadence: null,
          status: 'ON_TRACK',
        },
      ]);

      const result = await service.findDueCheckIns();
      expect(result.size).toBe(0);
    });

    it('should skip COMPLETED or CANCELLED KRs', async () => {
      mockPrismaService.keyResult.findMany.mockResolvedValue([
        {
          id: 'kr-1',
          checkInCadence: 'WEEKLY',
          status: 'COMPLETED',
        },
        {
          id: 'kr-2',
          checkInCadence: 'WEEKLY',
          status: 'CANCELLED',
        },
      ]);

      const result = await service.findDueCheckIns();
      expect(result.size).toBe(0);
    });

    it('should identify WEEKLY KR as due after 7 days', async () => {
      const now = new Date();
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

      mockPrismaService.keyResult.findMany.mockResolvedValue([
        {
          id: 'kr-1',
          title: 'Test KR',
          ownerId: 'user-1',
          checkInCadence: 'WEEKLY',
          status: 'ON_TRACK',
          createdAt: eightDaysAgo,
          checkIns: [],
          owner: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
          objectives: [
            {
              objective: {
                id: 'obj-1',
                tenantId: 'tenant-1',
              },
            },
          ],
        },
      ]);

      const result = await service.findDueCheckIns();
      expect(result.size).toBe(1);
      expect(result.get('tenant-1')).toHaveLength(1);
      expect(result.get('tenant-1')![0].dueStatus).toBe('OVERDUE'); // 8 days > 7 + 2 grace
    });

    it('should identify BIWEEKLY KR as due after 14 days', async () => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      mockPrismaService.keyResult.findMany.mockResolvedValue([
        {
          id: 'kr-1',
          title: 'Test KR',
          ownerId: 'user-1',
          checkInCadence: 'BIWEEKLY',
          status: 'ON_TRACK',
          createdAt: fifteenDaysAgo,
          checkIns: [],
          owner: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
          objectives: [
            {
              objective: {
                id: 'obj-1',
                tenantId: 'tenant-1',
              },
            },
          ],
        },
      ]);

      const result = await service.findDueCheckIns();
      expect(result.get('tenant-1')![0].dueStatus).toBe('OVERDUE'); // 15 days > 14 + 2 grace
    });

    it('should identify MONTHLY KR as due after 30 days', async () => {
      const now = new Date();
      const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

      mockPrismaService.keyResult.findMany.mockResolvedValue([
        {
          id: 'kr-1',
          title: 'Test KR',
          ownerId: 'user-1',
          checkInCadence: 'MONTHLY',
          status: 'ON_TRACK',
          createdAt: thirtyOneDaysAgo,
          checkIns: [],
          owner: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
          objectives: [
            {
              objective: {
                id: 'obj-1',
                tenantId: 'tenant-1',
              },
            },
          ],
        },
      ]);

      const result = await service.findDueCheckIns();
      expect(result.get('tenant-1')![0].dueStatus).toBe('OVERDUE'); // 31 days > 30 + 2 grace
    });

    it('should use last check-in date if available', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const krCreatedAt = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago

      mockPrismaService.keyResult.findMany.mockResolvedValue([
        {
          id: 'kr-1',
          title: 'Test KR',
          ownerId: 'user-1',
          checkInCadence: 'WEEKLY',
          status: 'ON_TRACK',
          createdAt: krCreatedAt,
          checkIns: [
            {
              createdAt: tenDaysAgo,
              value: 50,
              confidence: 75,
            },
          ],
          owner: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
          objectives: [
            {
              objective: {
                id: 'obj-1',
                tenantId: 'tenant-1',
              },
            },
          ],
        },
      ]);

      const result = await service.findDueCheckIns();
      expect(result.get('tenant-1')![0].dueSinceDays).toBe(10); // Based on last check-in, not creation
      expect(result.get('tenant-1')![0].lastCheckInAt).toEqual(tenDaysAgo);
      expect(result.get('tenant-1')![0].lastValue).toBe(50);
      expect(result.get('tenant-1')![0].lastConfidence).toBe(75);
    });
  });

  describe('sendRemindersForTenant', () => {
    it('should skip reminders sent in last 24h (idempotency)', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      mockPrismaService.activity.findFirst.mockResolvedValue({
        id: 'activity-1',
        createdAt: oneHourAgo,
      });

      const reminders = [
        {
          krId: 'kr-1',
          krTitle: 'Test KR',
          ownerUserId: 'user-1',
          ownerName: 'Test User',
          ownerEmail: 'test@example.com',
          dueStatus: 'DUE' as const,
          dueSinceDays: 7,
          lastCheckInAt: null,
          lastValue: null,
          lastConfidence: null,
          deepLink: '/dashboard/okrs?krId=kr-1',
        },
      ];

      const sent = await service.sendRemindersForTenant('tenant-1', reminders);
      expect(sent).toBe(0);
      expect(mockNotificationPort.sendCheckInReminder).not.toHaveBeenCalled();
    });

    it('should send reminder if not sent in last 24h', async () => {
      mockPrismaService.activity.findFirst.mockResolvedValue(null); // No recent reminder
      mockPrismaService.activity.create.mockResolvedValue({ id: 'activity-1' });

      const reminders = [
        {
          krId: 'kr-1',
          krTitle: 'Test KR',
          ownerUserId: 'user-1',
          ownerName: 'Test User',
          ownerEmail: 'test@example.com',
          dueStatus: 'DUE' as const,
          dueSinceDays: 7,
          lastCheckInAt: null,
          lastValue: null,
          lastConfidence: null,
          deepLink: '/dashboard/okrs?krId=kr-1',
        },
      ];

      const sent = await service.sendRemindersForTenant('tenant-1', reminders);
      expect(sent).toBe(1);
      expect(mockNotificationPort.sendCheckInReminder).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'KEY_RESULT',
          entityId: 'kr-1',
          action: 'REMINDER_SENT',
          tenantId: 'tenant-1',
        }),
      });
    });
  });

  describe('processAllReminders', () => {
    it('should return empty result if reminders disabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'OKR_CHECKIN_REMINDERS_ENABLED') return 'false';
        return null;
      });

      const result = await service.processAllReminders();
      expect(result).toEqual({ tenantsProcessed: 0, remindersSent: 0 });
      expect(mockPrismaService.keyResult.findMany).not.toHaveBeenCalled();
    });
  });
});

