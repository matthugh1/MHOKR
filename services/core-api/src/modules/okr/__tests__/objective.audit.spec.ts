/**
 * Objective Audit Logging Tests
 * 
 * Unit tests for ObjectiveService audit logging:
 * - CREATE: logs full entity snapshot in 'after' field
 * - UPDATE: logs full entity snapshots in 'before' and 'after' fields
 * - DELETE: logs full entity snapshot in 'before' field
 * - State changes: detects status and publish state changes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ObjectiveService } from '../objective.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RBACService } from '../../rbac/rbac.service';
import { OkrProgressService } from '../okr-progress.service';
import { ActivityService } from '../../activity/activity.service';
import { OkrGovernanceService } from '../okr-governance.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ObjectiveService - Audit Logging', () => {
  let service: ObjectiveService;
  let activityService: ActivityService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    cycle: {
      findUnique: jest.fn(),
    },
    objective: {
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

  const mockOkrProgressService = {
    refreshObjectiveProgressCascade: jest.fn().mockResolvedValue(undefined),
  };

  const mockOkrGovernanceService = {
    checkAllLocksForObjective: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObjectiveService,
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

    service = module.get<ObjectiveService>(ObjectiveService);
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
      const now = new Date();

      const createdObjective = {
        id: 'obj-1',
        title: 'Test Objective',
        description: 'Test Description',
        tenantId: tenantId,
        workspaceId: 'workspace-1',
        teamId: null,
        pillarId: null,
        cycleId: 'cycle-1',
        ownerId: userId,
        parentId: null,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: 'ON_TRACK',
        progress: 0,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: tenantId });
      mockPrismaService.objective.create.mockResolvedValue(createdObjective);

      await service.create(
        {
          title: 'Test Objective',
          ownerId: userId,
          tenantId: tenantId,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        },
        userId,
        tenantId,
      );

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'OBJECTIVE',
        entityId: 'obj-1',
        userId: userId,
        tenantId: tenantId,
        action: 'CREATED',
        metadata: {
          before: null,
          after: expect.objectContaining({
            id: 'obj-1',
            title: 'Test Objective',
            description: 'Test Description',
            tenantId: tenantId,
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

      const objectiveBefore = {
        id: 'obj-1',
        title: 'Original Title',
        description: 'Original Description',
        tenantId: tenantId,
        workspaceId: 'workspace-1',
        teamId: null,
        pillarId: null,
        cycleId: 'cycle-1',
        ownerId: userId,
        parentId: null,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: 'ON_TRACK',
        progress: 50,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      const objectiveAfter = {
        ...objectiveBefore,
        title: 'Updated Title',
        progress: 75,
        updatedAt: new Date(),
      };

      mockPrismaService.objective.findUnique
        .mockResolvedValueOnce(objectiveBefore) // First call for before snapshot
        .mockResolvedValueOnce(objectiveBefore); // Second call for governance check
      mockPrismaService.objective.update.mockResolvedValue(objectiveAfter);

      await service.update('obj-1', { title: 'Updated Title', progress: 75 }, userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'OBJECTIVE',
        entityId: 'obj-1',
        userId: userId,
        tenantId: tenantId,
        action: 'UPDATED',
        metadata: expect.objectContaining({
          before: expect.objectContaining({
            id: 'obj-1',
            title: 'Original Title',
            progress: 50,
            status: 'ON_TRACK',
          }),
          after: expect.objectContaining({
            id: 'obj-1',
            title: 'Updated Title',
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

      const objectiveBefore = {
        id: 'obj-1',
        title: 'Test Objective',
        description: null,
        tenantId: tenantId,
        workspaceId: null,
        teamId: null,
        pillarId: null,
        cycleId: 'cycle-1',
        ownerId: userId,
        parentId: null,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: 'ON_TRACK',
        progress: 50,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      const objectiveAfter = {
        ...objectiveBefore,
        status: 'COMPLETED',
        progress: 100,
        updatedAt: new Date(),
      };

      mockPrismaService.objective.findUnique
        .mockResolvedValueOnce(objectiveBefore)
        .mockResolvedValueOnce(objectiveBefore);
      mockPrismaService.objective.update.mockResolvedValue(objectiveAfter);

      await service.update('obj-1', { status: 'COMPLETED' }, userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'OBJECTIVE',
        entityId: 'obj-1',
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

    it('should detect and log publish state change', async () => {
      const userId = 'user-1';
      const tenantId = 'tenant-1';
      const now = new Date();

      const objectiveBefore = {
        id: 'obj-1',
        title: 'Test Objective',
        description: null,
        tenantId: tenantId,
        workspaceId: null,
        teamId: null,
        pillarId: null,
        cycleId: 'cycle-1',
        ownerId: userId,
        parentId: null,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: 'ON_TRACK',
        progress: 50,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
      };

      const objectiveAfter = {
        ...objectiveBefore,
        isPublished: true,
        updatedAt: new Date(),
      };

      mockPrismaService.objective.findUnique
        .mockResolvedValueOnce(objectiveBefore)
        .mockResolvedValueOnce(objectiveBefore);
      mockPrismaService.objective.update.mockResolvedValue(objectiveAfter);

      await service.update('obj-1', { isPublished: true }, userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'OBJECTIVE',
        entityId: 'obj-1',
        userId: userId,
        tenantId: tenantId,
        action: 'UPDATED',
        metadata: expect.objectContaining({
          wasPublish: true,
          publishStateChanged: true,
          before: expect.objectContaining({ isPublished: false }),
          after: expect.objectContaining({ isPublished: true }),
        }),
      });
    });
  });

  describe('delete() - Audit Logging', () => {
    it('should log DELETED action with full entity snapshot in before field', async () => {
      const userId = 'user-1';
      const tenantId = 'tenant-1';
      const now = new Date();

      const objective = {
        id: 'obj-1',
        title: 'Test Objective',
        description: 'Test Description',
        tenantId: tenantId,
        workspaceId: 'workspace-1',
        teamId: null,
        pillarId: null,
        cycleId: 'cycle-1',
        ownerId: userId,
        parentId: null,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: 'ON_TRACK',
        progress: 50,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        positionX: 0,
        positionY: 0,
        createdAt: now,
        updatedAt: now,
        keyResults: [],
        initiatives: [],
        children: [],
      };

      mockPrismaService.objective.findUnique.mockResolvedValue(objective);
      mockPrismaService.objective.delete.mockResolvedValue(objective);

      await service.delete('obj-1', userId, tenantId);

      expect(mockActivityService.createActivity).toHaveBeenCalledWith({
        entityType: 'OBJECTIVE',
        entityId: 'obj-1',
        userId: userId,
        tenantId: tenantId,
        action: 'DELETED',
        metadata: {
          before: expect.objectContaining({
            id: 'obj-1',
            title: 'Test Objective',
            description: 'Test Description',
            tenantId: tenantId,
            status: 'ON_TRACK',
            progress: 50,
          }),
          after: null,
        },
      });
    });
  });
});

