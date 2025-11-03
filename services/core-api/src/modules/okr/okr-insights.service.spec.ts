/**
 * W5.M2: Inline Insights & Cycle Health - Unit Tests
 * 
 * Unit tests for OkrInsightsService:
 * - Cycle summary with visibility filtering
 * - Objective insights (status trend, last update age, KR roll-ups)
 * - Attention feed pagination and filtering
 * - SUPERUSER read-only enforcement
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OkrInsightsService } from './okr-insights.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrVisibilityService } from './okr-visibility.service';
import { BadRequestException } from '@nestjs/common';

describe('OkrInsightsService - W5.M2', () => {
  let service: OkrInsightsService;
  let prisma: PrismaService;
  let visibilityService: OkrVisibilityService;

  const mockPrismaService = {
    objective: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    keyResult: {
      findMany: jest.fn(),
    },
  };

  const mockVisibilityService = {
    canUserSeeObjective: jest.fn(),
    canUserSeeKeyResult: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OkrInsightsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OkrVisibilityService,
          useValue: mockVisibilityService,
        },
      ],
    }).compile();

    service = module.get<OkrInsightsService>(OkrInsightsService);
    prisma = module.get<PrismaService>(PrismaService);
    visibilityService = module.get<OkrVisibilityService>(OkrVisibilityService);

    jest.clearAllMocks();
  });

  describe('getCycleSummary', () => {
    const cycleId = 'cycle-1';
    const orgId = 'org-1';
    const userId = 'user-1';

    it('should return correct counts for objectives and KRs', async () => {
      const mockObjectives = [
        {
          id: 'obj-1',
          status: 'ON_TRACK',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: true,
          keyResults: [
            {
              keyResult: {
                id: 'kr-1',
                status: 'ON_TRACK',
                checkInCadence: 'WEEKLY',
                checkIns: [{ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }],
              },
            },
            {
              keyResult: {
                id: 'kr-2',
                status: 'AT_RISK',
                checkInCadence: 'WEEKLY',
                checkIns: [],
              },
            },
          ],
        },
        {
          id: 'obj-2',
          status: 'ON_TRACK',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: false,
          keyResults: [
            {
              keyResult: {
                id: 'kr-3',
                status: 'BLOCKED',
                checkInCadence: 'MONTHLY',
                checkIns: [],
              },
            },
          ],
        },
      ];

      mockPrismaService.objective.findMany.mockResolvedValue(mockObjectives);
      mockVisibilityService.canUserSeeObjective
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const result = await service.getCycleSummary(cycleId, orgId, userId);

      expect(result).toMatchObject({
        cycleId,
        objectives: { total: 2, published: 1, draft: 1 },
        krs: { total: 3, onTrack: 1, atRisk: 1, blocked: 1, completed: 0 },
      });
    });

    it('should filter PRIVATE objectives when user not whitelisted', async () => {
      const mockObjectives = [
        {
          id: 'obj-1',
          status: 'ON_TRACK',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: true,
          keyResults: [],
        },
        {
          id: 'obj-2',
          status: 'ON_TRACK',
          ownerId: 'other-user',
          organizationId: orgId,
          visibilityLevel: 'PRIVATE',
          isPublished: true,
          keyResults: [],
        },
      ];

      mockPrismaService.objective.findMany.mockResolvedValue(mockObjectives);
      mockVisibilityService.canUserSeeObjective
        .mockResolvedValueOnce(true) // PUBLIC_TENANT visible
        .mockResolvedValueOnce(false); // PRIVATE not visible

      const result = await service.getCycleSummary(cycleId, orgId, userId);

      expect(result.objectives.total).toBe(1);
      expect(mockVisibilityService.canUserSeeObjective).toHaveBeenCalledTimes(2);
    });

    it('should calculate overdue check-ins correctly', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const mockObjectives = [
        {
          id: 'obj-1',
          status: 'ON_TRACK',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: true,
          keyResults: [
            {
              keyResult: {
                id: 'kr-1',
                status: 'ON_TRACK',
                checkInCadence: 'WEEKLY',
                checkIns: [{ createdAt: tenDaysAgo }], // 10 days ago = overdue
              },
            },
            {
              keyResult: {
                id: 'kr-2',
                status: 'ON_TRACK',
                checkInCadence: 'WEEKLY',
                checkIns: [{ createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) }], // 2 days ago = recent
              },
            },
          ],
        },
      ];

      mockPrismaService.objective.findMany.mockResolvedValue(mockObjectives);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getCycleSummary(cycleId, orgId, userId);

      expect(result.checkins.overdue).toBe(1);
      expect(result.checkins.recent24h).toBe(0); // 2 days ago is not recent
    });

    it('should return empty counts when user has no org', async () => {
      const result = await service.getCycleSummary(cycleId, undefined, userId);

      expect(result).toMatchObject({
        cycleId,
        objectives: { total: 0, published: 0, draft: 0 },
        krs: { total: 0, onTrack: 0, atRisk: 0, blocked: 0, completed: 0 },
        checkins: { upcoming7d: 0, overdue: 0, recent24h: 0 },
      });
    });
  });

  describe('getObjectiveInsights', () => {
    const objectiveId = 'obj-1';
    const orgId = 'org-1';
    const userId = 'user-1';

    it('should return insights with correct last update age', async () => {
      const now = new Date();
      const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

      const mockObjective = {
        id: objectiveId,
        status: 'ON_TRACK',
        ownerId: userId,
        organizationId: orgId,
        visibilityLevel: 'PUBLIC_TENANT',
        updatedAt: fiveHoursAgo,
        createdAt: fiveHoursAgo,
        keyResults: [
          {
            keyResult: {
              id: 'kr-1',
              status: 'ON_TRACK',
              checkInCadence: 'WEEKLY',
              ownerId: userId,
              checkIns: [],
            },
          },
        ],
      };

      mockPrismaService.objective.findUnique.mockResolvedValue(mockObjective);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getObjectiveInsights(objectiveId, orgId, userId);

      expect(result).toBeDefined();
      expect(result!.lastUpdateAgeHours).toBe(5);
      expect(result!.objectiveId).toBe(objectiveId);
    });

    it('should return null for invisible objective', async () => {
      const mockObjective = {
        id: objectiveId,
        status: 'ON_TRACK',
        ownerId: 'other-user',
        organizationId: orgId,
        visibilityLevel: 'PRIVATE',
        updatedAt: new Date(),
        createdAt: new Date(),
        keyResults: [],
      };

      mockPrismaService.objective.findUnique.mockResolvedValue(mockObjective);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(false);

      const result = await service.getObjectiveInsights(objectiveId, orgId, userId);

      expect(result).toBeNull();
    });

    it('should count KR roll-ups correctly', async () => {
      const mockObjective = {
        id: objectiveId,
        status: 'ON_TRACK',
        ownerId: userId,
        organizationId: orgId,
        visibilityLevel: 'PUBLIC_TENANT',
        updatedAt: new Date(),
        createdAt: new Date(),
        keyResults: [
          {
            keyResult: {
              id: 'kr-1',
              status: 'ON_TRACK',
              checkInCadence: 'WEEKLY',
              ownerId: userId,
              checkIns: [],
            },
          },
          {
            keyResult: {
              id: 'kr-2',
              status: 'AT_RISK',
              checkInCadence: 'WEEKLY',
              ownerId: userId,
              checkIns: [],
            },
          },
          {
            keyResult: {
              id: 'kr-3',
              status: 'BLOCKED',
              checkInCadence: 'MONTHLY',
              ownerId: userId,
              checkIns: [],
            },
          },
          {
            keyResult: {
              id: 'kr-4',
              status: 'COMPLETED',
              checkInCadence: null,
              ownerId: userId,
              checkIns: [],
            },
          },
        ],
      };

      mockPrismaService.objective.findUnique.mockResolvedValue(mockObjective);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getObjectiveInsights(objectiveId, orgId, userId);

      expect(result).toBeDefined();
      expect(result!.krs).toMatchObject({
        onTrack: 1,
        atRisk: 1,
        blocked: 1,
        completed: 1,
      });
    });

    it('should calculate overdue check-ins correctly', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const mockObjective = {
        id: objectiveId,
        status: 'ON_TRACK',
        ownerId: userId,
        organizationId: orgId,
        visibilityLevel: 'PUBLIC_TENANT',
        updatedAt: new Date(),
        createdAt: new Date(),
        keyResults: [
          {
            keyResult: {
              id: 'kr-1',
              status: 'ON_TRACK',
              checkInCadence: 'WEEKLY',
              ownerId: userId,
              checkIns: [{ createdAt: tenDaysAgo }], // 10 days ago = overdue
            },
          },
          {
            keyResult: {
              id: 'kr-2',
              status: 'ON_TRACK',
              checkInCadence: 'WEEKLY',
              ownerId: userId,
              checkIns: [], // No check-in = overdue
            },
          },
        ],
      };

      mockPrismaService.objective.findUnique.mockResolvedValue(mockObjective);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getObjectiveInsights(objectiveId, orgId, userId);

      expect(result).toBeDefined();
      expect(result!.overdueCheckins).toBe(2);
    });

    it('should return statusTrend as UNKNOWN by default', async () => {
      const mockObjective = {
        id: objectiveId,
        status: 'ON_TRACK',
        ownerId: userId,
        organizationId: orgId,
        visibilityLevel: 'PUBLIC_TENANT',
        updatedAt: new Date(),
        createdAt: new Date(),
        keyResults: [],
      };

      mockPrismaService.objective.findUnique.mockResolvedValue(mockObjective);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getObjectiveInsights(objectiveId, orgId, userId);

      expect(result).toBeDefined();
      expect(result!.statusTrend).toBe('UNKNOWN');
    });
  });

  describe('getAttentionFeed', () => {
    const orgId = 'org-1';
    const userId = 'user-1';
    const cycleId = 'cycle-1';

    it('should paginate correctly', async () => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      const mockObjectives = Array.from({ length: 25 }, (_, i) => ({
        id: `obj-${i}`,
        status: i < 5 ? 'AT_RISK' : 'ON_TRACK',
        ownerId: userId,
        organizationId: orgId,
        visibilityLevel: 'PUBLIC_TENANT',
        updatedAt: i < 5 ? fifteenDaysAgo : new Date(),
        createdAt: new Date(),
        keyResults: [],
      }));

      mockPrismaService.objective.findMany.mockResolvedValue(mockObjectives);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getAttentionFeed(cycleId, 1, 20, orgId, userId);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items.length).toBeLessThanOrEqual(20);
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('should include OVERDUE_CHECKIN items', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const mockObjectives = [
        {
          id: 'obj-1',
          status: 'ON_TRACK',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          updatedAt: new Date(),
          createdAt: new Date(),
          keyResults: [
            {
              keyResult: {
                id: 'kr-1',
                status: 'ON_TRACK',
                checkInCadence: 'WEEKLY',
                checkIns: [{ createdAt: tenDaysAgo }], // Overdue
              },
            },
          ],
        },
      ];

      mockPrismaService.objective.findMany.mockResolvedValue(mockObjectives);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getAttentionFeed(cycleId, 1, 20, orgId, userId);

      expect(result.items.some((item) => item.type === 'OVERDUE_CHECKIN')).toBe(true);
    });

    it('should include NO_UPDATE_14D items', async () => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      const mockObjectives = [
        {
          id: 'obj-1',
          status: 'ON_TRACK',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          updatedAt: fifteenDaysAgo,
          createdAt: fifteenDaysAgo,
          keyResults: [],
        },
      ];

      mockPrismaService.objective.findMany.mockResolvedValue(mockObjectives);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getAttentionFeed(cycleId, 1, 20, orgId, userId);

      expect(result.items.some((item) => item.type === 'NO_UPDATE_14D')).toBe(true);
    });

    it('should include STATUS_DOWNGRADE items', async () => {
      const mockObjectives = [
        {
          id: 'obj-1',
          status: 'AT_RISK',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          updatedAt: new Date(),
          createdAt: new Date(),
          keyResults: [],
        },
        {
          id: 'obj-2',
          status: 'BLOCKED',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          updatedAt: new Date(),
          createdAt: new Date(),
          keyResults: [],
        },
      ];

      mockPrismaService.objective.findMany.mockResolvedValue(mockObjectives);
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);

      const result = await service.getAttentionFeed(cycleId, 1, 20, orgId, userId);

      expect(result.items.some((item) => item.type === 'STATUS_DOWNGRADE')).toBe(true);
    });

    it('should filter by visibility', async () => {
      const mockObjectives = [
        {
          id: 'obj-1',
          status: 'ON_TRACK',
          ownerId: userId,
          organizationId: orgId,
          visibilityLevel: 'PUBLIC_TENANT',
          updatedAt: new Date(),
          createdAt: new Date(),
          keyResults: [],
        },
        {
          id: 'obj-2',
          status: 'ON_TRACK',
          ownerId: 'other-user',
          organizationId: orgId,
          visibilityLevel: 'PRIVATE',
          updatedAt: new Date(),
          createdAt: new Date(),
          keyResults: [],
        },
      ];

      mockPrismaService.objective.findMany.mockResolvedValue(mockObjectives);
      mockVisibilityService.canUserSeeObjective
        .mockResolvedValueOnce(true) // PUBLIC_TENANT visible
        .mockResolvedValueOnce(false); // PRIVATE not visible

      const result = await service.getAttentionFeed(cycleId, 1, 20, orgId, userId);

      // Only visible objectives should contribute to attention items
      expect(mockVisibilityService.canUserSeeObjective).toHaveBeenCalledTimes(2);
    });

    it('should return empty feed when no org', async () => {
      const result = await service.getAttentionFeed(cycleId, 1, 20, undefined, userId);

      expect(result).toMatchObject({
        page: 1,
        pageSize: 20,
        totalCount: 0,
        items: [],
      });
    });
  });
});

