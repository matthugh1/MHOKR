/**
 * Initiative Audit Logging Tests
 * 
 * Unit tests for InitiativeService audit logging:
 * - CREATE: logs full entity snapshot in 'after' field
 * - UPDATE: logs full entity snapshots in 'before' and 'after' fields
 * - DELETE: logs full entity snapshot in 'before' field
 * - State changes: detects status changes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { InitiativeService } from '../initiative.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RBACService } from '../../rbac/rbac.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { ActivityService } from '../../activity/activity.service';
import { NotFoundException } from '@nestjs/common';

describe('InitiativeService - Audit Logging', () => {
  let service: InitiativeService;
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
      findUnique: jest.fn(),
    },
    initiative: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockRBACService = {
    canPerformAction: jest.fn(),
  };

  const mockActivityService = {
    createActivity: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitiativeService,
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
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<InitiativeService>(InitiativeService);
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

      const createdInitiative = {
        id: 'init-1',
        title: 'Test Initiative',
        description: 'Test Description',
        keyResultId: null,
        objectiveId: objectiveId,
        tenantId: tenantId,
        cycleId: 'cycle-1',
        ownerId: userId,
        status: 'IN_PROGRESS',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        dueDate: new Date('2024-12-31'),
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
      mockPrismaService.initiative.create.mockResolvedValue(createdInitiative);

      await service.create(
        {
          title: 'Test Initiative',
          ownerId: userId,
          objectiveId: objectiveId,
          tenantId: tenantId,
        },
        userId,
        tenantId,
      );

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'INITIATIVE',
        entityId: 'init-1',
        userId: userId,
        tenantId: tenantId,
        action: 'CREATED',
        metadata: {
          before: null,
          after: expect.objectContaining({
            id: 'init-1',
            title: 'Test Initiative',
            description: 'Test Description',
            objectiveId: objectiveId,
            tenantId: tenantId,
            ownerId: userId,
            status: 'IN_PROGRESS',
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

      const initiativeBefore = {
        id: 'init-1',
        title: 'Original Title',
        description: 'Original Description',
        keyResultId: null,
        objectiveId: 'obj-1',
        tenantId: tenantId,
        cycleId: 'cycle-1',
        ownerId: userId,
        status: 'IN_PROGRESS',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        dueDate: new Date('2024-12-31'),
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      const initiativeAfter = {
        ...initiativeBefore,
        title: 'Updated Title',
        updatedAt: new Date(),
      };

      mockPrismaService.initiative.findUnique
        .mockResolvedValueOnce(initiativeBefore) // First call for before snapshot
        .mockResolvedValueOnce({
          objectiveId: 'obj-1',
          objective: { tenantId: tenantId, cycleId: 'cycle-1' },
        });
      mockPrismaService.initiative.update.mockResolvedValue(initiativeAfter);

      await service.update('init-1', { title: 'Updated Title' }, userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'INITIATIVE',
        entityId: 'init-1',
        userId: userId,
        tenantId: tenantId,
        action: 'UPDATED',
        metadata: expect.objectContaining({
          before: expect.objectContaining({
            id: 'init-1',
            title: 'Original Title',
            description: 'Original Description',
            status: 'IN_PROGRESS',
          }),
          after: expect.objectContaining({
            id: 'init-1',
            title: 'Updated Title',
            description: 'Original Description',
            status: 'IN_PROGRESS',
          }),
        }),
      });
    });

    it('should detect and log status change to COMPLETED', async () => {
      const userId = 'user-1';
      const tenantId = 'tenant-1';
      const now = new Date();

      const initiativeBefore = {
        id: 'init-1',
        title: 'Test Initiative',
        description: null,
        keyResultId: null,
        objectiveId: 'obj-1',
        tenantId: tenantId,
        cycleId: 'cycle-1',
        ownerId: userId,
        status: 'IN_PROGRESS',
        startDate: null,
        endDate: null,
        dueDate: null,
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      const initiativeAfter = {
        ...initiativeBefore,
        status: 'COMPLETED',
        updatedAt: new Date(),
      };

      mockPrismaService.initiative.findUnique
        .mockResolvedValueOnce(initiativeBefore)
        .mockResolvedValueOnce({
          objectiveId: 'obj-1',
          objective: { tenantId: tenantId, cycleId: 'cycle-1' },
        });
      mockPrismaService.initiative.update.mockResolvedValue(initiativeAfter);

      await service.update('init-1', { status: 'COMPLETED' }, userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'INITIATIVE',
        entityId: 'init-1',
        userId: userId,
        tenantId: tenantId,
        action: 'COMPLETED',
        metadata: expect.objectContaining({
          statusChanged: true,
          before: expect.objectContaining({ status: 'IN_PROGRESS' }),
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

      const initiative = {
        id: 'init-1',
        title: 'Test Initiative',
        description: 'Test Description',
        keyResultId: null,
        objectiveId: 'obj-1',
        tenantId: tenantId,
        cycleId: 'cycle-1',
        ownerId: userId,
        status: 'IN_PROGRESS',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        dueDate: new Date('2024-12-31'),
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
        objective: {
          id: 'obj-1',
          tenantId: tenantId,
        },
      };

      mockPrismaService.initiative.findUnique.mockResolvedValue(initiative);
      mockPrismaService.initiative.delete.mockResolvedValue(initiative);

      await service.delete('init-1', userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'INITIATIVE',
        entityId: 'init-1',
        userId: userId,
        tenantId: tenantId,
        action: 'DELETED',
        metadata: {
          before: expect.objectContaining({
            id: 'init-1',
            title: 'Test Initiative',
            description: 'Test Description',
            objectiveId: 'obj-1',
            tenantId: tenantId,
            ownerId: userId,
            status: 'IN_PROGRESS',
          }),
          after: null,
        },
      });
    });
  });
});

