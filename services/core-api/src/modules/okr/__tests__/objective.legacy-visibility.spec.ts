import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ObjectiveService } from '../objective.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RBACService } from '../../rbac/rbac.service';
import { OkrProgressService } from '../okr-progress.service';
import { ActivityService } from '../../activity/activity.service';
import { OkrGovernanceService } from '../okr-governance.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { OkrStateTransitionService } from '../okr-state-transition.service';

describe('ObjectiveService - Legacy Visibility Validation', () => {
  let service: ObjectiveService;
  let prisma: PrismaService;
  let rbacService: RBACService;

  const mockPrismaService = {
    objective: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
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
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockRBACService = {
    canPerformAction: jest.fn(),
  };

  const mockOkrProgressService = {
    refreshObjectiveProgressCascade: jest.fn(),
  };

  const mockActivityService = {
    createActivity: jest.fn(),
  };

  const mockOkrGovernanceService = {
    checkAllLocksForObjective: jest.fn(),
  };

  const mockAuditLogService = {
    record: jest.fn(),
  };

  const mockStateTransitionService = {
    calculateObjectiveStateFromLegacy: jest.fn(),
    assertObjectiveStateTransition: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObjectiveService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RBACService, useValue: mockRBACService },
        { provide: OkrProgressService, useValue: mockOkrProgressService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: OkrGovernanceService, useValue: mockOkrGovernanceService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: OkrStateTransitionService, useValue: mockStateTransitionService },
      ],
    }).compile();

    service = module.get<ObjectiveService>(ObjectiveService);
    prisma = module.get<PrismaService>(PrismaService);
    rbacService = module.get<RBACService>(RBACService);

    jest.clearAllMocks();
  });

  describe('create() - Legacy Visibility Rejection', () => {
    const validData = {
      title: 'Test Objective',
      ownerId: 'user-1',
      tenantId: 'org-1',
      workspaceId: 'workspace-1',
      cycleId: 'cycle-1',
      visibilityLevel: 'PUBLIC_TENANT',
      startDate: new Date(),
      endDate: new Date(),
    };

    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.workspace.findUnique.mockResolvedValue({ id: 'workspace-1', tenantId: 'org-1' });
      mockPrismaService.cycle.findUnique.mockResolvedValue({ id: 'cycle-1', tenantId: 'org-1', status: 'ACTIVE' });
      mockRBACService.canPerformAction.mockResolvedValue(true);
      mockPrismaService.objective.create.mockResolvedValue({ id: 'obj-1', ...validData });
      mockStateTransitionService.calculateObjectiveStateFromLegacy.mockReturnValue('DRAFT');
    });

    it('should reject WORKSPACE_ONLY visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'WORKSPACE_ONLY' };

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow('Legacy visibility level \'WORKSPACE_ONLY\' is no longer supported');
    });

    it('should reject TEAM_ONLY visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'TEAM_ONLY' };

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow('Legacy visibility level \'TEAM_ONLY\' is no longer supported');
    });

    it('should reject MANAGER_CHAIN visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'MANAGER_CHAIN' };

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow('Legacy visibility level \'MANAGER_CHAIN\' is no longer supported');
    });

    it('should reject EXEC_ONLY visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'EXEC_ONLY' };

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow('Legacy visibility level \'EXEC_ONLY\' is no longer supported');
    });

    it('should accept PUBLIC_TENANT visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'PUBLIC_TENANT' };

      await service.create(data, 'user-1', 'org-1');

      expect(mockPrismaService.objective.create).toHaveBeenCalled();
    });

    it('should accept PRIVATE visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'PRIVATE', whitelistUserIds: ['user-2'] };
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-2' }]);

      await service.create(data, 'user-1', 'org-1');

      expect(mockPrismaService.objective.create).toHaveBeenCalled();
    });
  });

  describe('update() - Legacy Visibility Rejection', () => {
    const existingObjective = {
      id: 'obj-1',
      title: 'Test Objective',
      ownerId: 'user-1',
      tenantId: 'org-1',
      workspaceId: 'workspace-1',
      cycleId: 'cycle-1',
      visibilityLevel: 'PUBLIC_TENANT',
      status: 'ON_TRACK',
      isPublished: false,
      state: 'DRAFT',
      progress: 0,
      parentId: null,
      startDate: new Date(),
      endDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockPrismaService.objective.findUnique.mockResolvedValue(existingObjective);
      mockPrismaService.objective.update.mockResolvedValue({ ...existingObjective, title: 'Updated' });
      mockRBACService.canPerformAction.mockResolvedValue(true);
      mockOkrGovernanceService.checkAllLocksForObjective.mockResolvedValue(undefined);
      mockStateTransitionService.calculateObjectiveStateFromLegacy.mockReturnValue('DRAFT');
      mockStateTransitionService.assertObjectiveStateTransition.mockReturnValue(undefined);
    });

    it('should reject WORKSPACE_ONLY visibility level on update', async () => {
      const updateData = { visibilityLevel: 'WORKSPACE_ONLY' };

      await expect(
        service.update('obj-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update('obj-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow('Legacy visibility level \'WORKSPACE_ONLY\' is no longer supported');
    });

    it('should reject TEAM_ONLY visibility level on update', async () => {
      const updateData = { visibilityLevel: 'TEAM_ONLY' };

      await expect(
        service.update('obj-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject MANAGER_CHAIN visibility level on update', async () => {
      const updateData = { visibilityLevel: 'MANAGER_CHAIN' };

      await expect(
        service.update('obj-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject EXEC_ONLY visibility level on update', async () => {
      const updateData = { visibilityLevel: 'EXEC_ONLY' };

      await expect(
        service.update('obj-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept PUBLIC_TENANT visibility level on update', async () => {
      const updateData = { visibilityLevel: 'PUBLIC_TENANT' };

      await service.update('obj-1', updateData, 'user-1', 'org-1');

      expect(mockPrismaService.objective.update).toHaveBeenCalled();
    });

    it('should accept PRIVATE visibility level on update', async () => {
      const updateData = { visibilityLevel: 'PRIVATE' };

      await service.update('obj-1', updateData, 'user-1', 'org-1');

      expect(mockPrismaService.objective.update).toHaveBeenCalled();
    });
  });
});


