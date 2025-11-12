/**
 * Key Result Audit Logging Tests
 * 
 * Unit tests for KeyResultService audit logging:
 * - CREATE: logs full entity snapshot in 'after' field
 * - UPDATE: logs full entity snapshots in 'before' and 'after' fields
 * - DELETE: logs full entity snapshot in 'before' field
 * - CHECK_IN: logs full entity snapshots with check-in details
 * - State changes: detects status and publish state changes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { KeyResultService } from '../key-result.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RBACService } from '../../rbac/rbac.service';
import { OkrProgressService } from '../okr-progress.service';
import { ActivityService } from '../../activity/activity.service';
import { OkrGovernanceService } from '../okr-governance.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { NotFoundException } from '@nestjs/common';

describe('KeyResultService - Audit Logging', () => {
  let service: KeyResultService;
  let activityService: ActivityService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    objective: {
      findUnique: jest.fn(),
    },
    keyResult: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    objectiveKeyResult: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    checkIn: {
      create: jest.fn(),
    },
  };

  const mockRBACService = {
    canPerformAction: jest.fn(),
  };

  const mockActivityService = {
    createActivity: jest.fn().mockResolvedValue(undefined),
  };

  const mockOkrProgressService = {
    refreshObjectiveProgressCascade: jest.fn().mockResolvedValue(undefined),
    refreshObjectiveProgressForKeyResult: jest.fn().mockResolvedValue(undefined),
  };

  const mockOkrGovernanceService = {
    checkAllLocksForKeyResult: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyResultService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RBACService,
          useValue: mockRBACService,
        },
        {
          provide: ActivityService,
          useValue: mockActivityService,
        },
        {
          provide: OkrProgressService,
          useValue: mockOkrProgressService,
        },
        {
          provide: OkrGovernanceService,
          useValue: mockOkrGovernanceService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<KeyResultService>(KeyResultService);
    activityService = module.get<ActivityService>(ActivityService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create() - Audit Logging', () => {
    it('should log CREATED action with full entity snapshot in after field', async () => {
      const userId = 'user-1';
      const tenantId = 'tenant-1';
      const objectiveId = 'obj-1';
      const now = new Date();

      const createdKr = {
        id: 'kr-1',
        title: 'Test Key Result',
        description: 'Test Description',
        ownerId: userId,
        tenantId: tenantId,
        metricType: 'NUMERIC',
        startValue: 0,
        targetValue: 100,
        currentValue: 0,
        unit: 'units',
        status: 'ON_TRACK',
        progress: 0,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        checkInCadence: 'WEEKLY',
        cycleId: 'cycle-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        tenantId: tenantId,
        cycleId: 'cycle-1',
      });
      mockPrismaService.keyResult.create.mockResolvedValue(createdKr);

      await service.create(
        {
          title: 'Test Key Result',
          ownerId: userId,
          objectiveId: objectiveId,
          metricType: 'NUMERIC',
          startValue: 0,
          targetValue: 100,
          tenantId: tenantId,
        },
        userId,
        tenantId,
      );

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'KEY_RESULT',
        entityId: 'kr-1',
        userId: userId,
        tenantId: tenantId,
        action: 'CREATED',
        metadata: {
          before: null,
          after: expect.objectContaining({
            id: 'kr-1',
            title: 'Test Key Result',
            description: 'Test Description',
            ownerId: userId,
            tenantId: tenantId,
            metricType: 'NUMERIC',
            startValue: 0,
            targetValue: 100,
            currentValue: 0,
            status: 'ON_TRACK',
            progress: 0,
            isPublished: false,
          }),
        },
      });
    });
  });

  describe('update() - Audit Logging', () => {
    it('should log UPDATED action with full entity snapshots in before and after fields', async () => {
      const userId = 'user-1';
      const tenantId = 'tenant-1';
      const now = new Date();

      const krBefore = {
        id: 'kr-1',
        title: 'Original Title',
        description: 'Original Description',
        ownerId: userId,
        tenantId: tenantId,
        metricType: 'NUMERIC',
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        unit: 'units',
        status: 'ON_TRACK',
        progress: 50,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        checkInCadence: 'WEEKLY',
        cycleId: 'cycle-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      const krAfter = {
        ...krBefore,
        title: 'Updated Title',
        currentValue: 75,
        progress: 75,
        updatedAt: new Date(),
      };

      mockPrismaService.keyResult.findUnique
        .mockResolvedValueOnce(krBefore) // First call for before snapshot
        .mockResolvedValueOnce({
          objectives: [{ objective: { id: 'obj-1', tenantId: tenantId, isPublished: false, cycleId: 'cycle-1' } }],
        });
      mockPrismaService.keyResult.update.mockResolvedValue(krAfter);

      await service.update('kr-1', { title: 'Updated Title', currentValue: 75 }, userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'KEY_RESULT',
        entityId: 'kr-1',
        userId: userId,
        tenantId: tenantId,
        action: 'UPDATED',
        metadata: expect.objectContaining({
          before: expect.objectContaining({
            id: 'kr-1',
            title: 'Original Title',
            currentValue: 50,
            progress: 50,
            status: 'ON_TRACK',
          }),
          after: expect.objectContaining({
            id: 'kr-1',
            title: 'Updated Title',
            currentValue: 75,
            progress: 75,
            status: 'ON_TRACK',
          }),
        }),
      });
    });

    it('should detect and log status change to COMPLETED', async () => {
      const userId = 'user-1';
      const tenantId = 'tenant-1';
      const now = new Date();

      const krBefore = {
        id: 'kr-1',
        title: 'Test KR',
        description: null,
        ownerId: userId,
        tenantId: tenantId,
        metricType: 'NUMERIC',
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        unit: null,
        status: 'ON_TRACK',
        progress: 50,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        checkInCadence: null,
        cycleId: 'cycle-1',
        startDate: null,
        endDate: null,
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      const krAfter = {
        ...krBefore,
        status: 'COMPLETED',
        currentValue: 100,
        progress: 100,
        updatedAt: new Date(),
      };

      mockPrismaService.keyResult.findUnique
        .mockResolvedValueOnce(krBefore)
        .mockResolvedValueOnce({
          objectives: [{ objective: { id: 'obj-1', tenantId: tenantId, isPublished: false, cycleId: 'cycle-1' } }],
        });
      mockPrismaService.keyResult.update.mockResolvedValue(krAfter);

      await service.update('kr-1', { status: 'COMPLETED', currentValue: 100 }, userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'KEY_RESULT',
        entityId: 'kr-1',
        userId: userId,
        tenantId: tenantId,
        action: 'COMPLETED',
        metadata: expect.objectContaining({
          statusChanged: true,
          before: expect.objectContaining({ status: 'ON_TRACK' }),
          after: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      });
    });
  });

  describe('delete() - Audit Logging', () => {
    it('should log DELETED action with full entity snapshot in before field', async () => {
      const userId = 'user-1';
      const tenantId = 'tenant-1';
      const now = new Date();

      const keyResult = {
        id: 'kr-1',
        title: 'Test Key Result',
        description: 'Test Description',
        ownerId: userId,
        tenantId: tenantId,
        metricType: 'NUMERIC',
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        unit: 'units',
        status: 'ON_TRACK',
        progress: 50,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        checkInCadence: 'WEEKLY',
        cycleId: 'cycle-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      mockPrismaService.keyResult.findUnique
        .mockResolvedValueOnce({
          objectives: [{ objective: { id: 'obj-1', tenantId: tenantId, isPublished: false, cycleId: 'cycle-1' } }],
        })
        .mockResolvedValueOnce(keyResult);
      mockPrismaService.objectiveKeyResult.findMany.mockResolvedValue([{ objectiveId: 'obj-1' }]);
      mockPrismaService.keyResult.delete.mockResolvedValue(keyResult);

      await service.delete('kr-1', userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'KEY_RESULT',
        entityId: 'kr-1',
        userId: userId,
        tenantId: tenantId,
        action: 'DELETED',
        metadata: {
          before: expect.objectContaining({
            id: 'kr-1',
            title: 'Test Key Result',
            description: 'Test Description',
            ownerId: userId,
            tenantId: tenantId,
            status: 'ON_TRACK',
            progress: 50,
          }),
          after: null,
        },
      });
    });
  });

  describe('createCheckIn() - Audit Logging', () => {
    it('should log check-in with full entity snapshots and check-in details', async () => {
      const userId = 'user-1';
      const tenantId = 'tenant-1';
      const keyResultId = 'kr-1';
      const now = new Date();

      const checkIn = {
        id: 'checkin-1',
        keyResultId: keyResultId,
        userId: userId,
        value: 75,
        confidence: 80,
        note: 'Making good progress',
        blockers: null,
        createdAt: now,
      };

      const krBefore = {
        id: keyResultId,
        title: 'Test KR',
        description: null,
        ownerId: userId,
        tenantId: tenantId,
        metricType: 'NUMERIC',
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        unit: null,
        status: 'ON_TRACK',
        progress: 50,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        checkInCadence: null,
        cycleId: 'cycle-1',
        startDate: null,
        endDate: null,
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      const krAfter = {
        ...krBefore,
        currentValue: 75,
        progress: 75,
        updatedAt: new Date(),
      };

      mockPrismaService.keyResult.findUnique
        .mockResolvedValueOnce({
          id: keyResultId,
          tenantId: tenantId,
          objectives: [{ objective: { id: 'obj-1', tenantId: tenantId, isPublished: false, cycleId: 'cycle-1' } }],
        })
        .mockResolvedValueOnce(krBefore);
      mockPrismaService.checkIn.create.mockResolvedValue(checkIn);
      mockPrismaService.keyResult.update.mockResolvedValue(krAfter);

      await service.createCheckIn(
        keyResultId,
        {
          userId: userId,
          value: 75,
          confidence: 80,
          note: 'Making good progress',
        },
        tenantId,
      );

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'KEY_RESULT',
        entityId: keyResultId,
        userId: userId,
        tenantId: tenantId,
        action: 'UPDATED',
        metadata: expect.objectContaining({
          checkIn: expect.objectContaining({
            id: 'checkin-1',
            value: 75,
            confidence: 80,
            note: 'Making good progress',
          }),
          before: expect.objectContaining({
            id: keyResultId,
            currentValue: 50,
            progress: 50,
          }),
          after: expect.objectContaining({
            id: keyResultId,
            currentValue: 75,
            progress: 75,
          }),
        }),
      });
    });
  });
});

