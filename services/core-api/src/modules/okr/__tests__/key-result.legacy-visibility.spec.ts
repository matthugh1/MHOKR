import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { KeyResultService } from '../key-result.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RBACService } from '../../rbac/rbac.service';
import { OkrProgressService } from '../okr-progress.service';
import { ActivityService } from '../../activity/activity.service';
import { OkrGovernanceService } from '../okr-governance.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { OkrStateTransitionService } from '../okr-state-transition.service';

describe('KeyResultService - Legacy Visibility Validation', () => {
  let service: KeyResultService;
  let prisma: PrismaService;
  let rbacService: RBACService;

  const mockPrismaService = {
    keyResult: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    objective: {
      findUnique: jest.fn(),
    },
    objectiveKeyResult: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
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
    checkAllLocksForKeyResult: jest.fn(),
  };

  const mockAuditLogService = {
    record: jest.fn(),
  };

  const mockStateTransitionService = {
    calculateKeyResultStateFromLegacy: jest.fn(),
    assertKeyResultStateTransition: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyResultService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RBACService, useValue: mockRBACService },
        { provide: OkrProgressService, useValue: mockOkrProgressService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: OkrGovernanceService, useValue: mockOkrGovernanceService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: OkrStateTransitionService, useValue: mockStateTransitionService },
      ],
    }).compile();

    service = module.get<KeyResultService>(KeyResultService);
    prisma = module.get<PrismaService>(PrismaService);
    rbacService = module.get<RBACService>(RBACService);

    jest.clearAllMocks();
  });

  describe('create() - Legacy Visibility Rejection', () => {
    const validData = {
      title: 'Test Key Result',
      ownerId: 'user-1',
      tenantId: 'org-1',
      objectiveId: 'obj-1',
      metricType: 'NUMERIC',
      startValue: 0,
      targetValue: 100,
      currentValue: 0,
      visibilityLevel: 'PUBLIC_TENANT',
      status: 'ON_TRACK',
      progress: 0,
    };

    beforeEach(() => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: 'obj-1',
        tenantId: 'org-1',
        cycleId: 'cycle-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.keyResult.create.mockResolvedValue({ id: 'kr-1', ...validData });
      mockStateTransitionService.calculateKeyResultStateFromLegacy.mockReturnValue('DRAFT');
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
    });

    it('should reject MANAGER_CHAIN visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'MANAGER_CHAIN' };

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject EXEC_ONLY visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'EXEC_ONLY' };

      await expect(
        service.create(data, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept PUBLIC_TENANT visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'PUBLIC_TENANT' };

      await service.create(data, 'user-1', 'org-1');

      expect(mockPrismaService.keyResult.create).toHaveBeenCalled();
    });

    it('should accept PRIVATE visibility level', async () => {
      const data = { ...validData, visibilityLevel: 'PRIVATE' };

      await service.create(data, 'user-1', 'org-1');

      expect(mockPrismaService.keyResult.create).toHaveBeenCalled();
    });
  });

  describe('update() - Legacy Visibility Rejection', () => {
    const existingKeyResult = {
      id: 'kr-1',
      title: 'Test Key Result',
      ownerId: 'user-1',
      tenantId: 'org-1',
      visibilityLevel: 'PUBLIC_TENANT',
      status: 'ON_TRACK',
      isPublished: false,
      state: 'DRAFT',
      progress: 0,
      startValue: 0,
      targetValue: 100,
      currentValue: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockPrismaService.keyResult.findUnique
        .mockResolvedValueOnce(existingKeyResult)
        .mockResolvedValueOnce({
          ...existingKeyResult,
          objectives: [{
            objective: {
              id: 'obj-1',
              tenantId: 'org-1',
              state: 'DRAFT',
              isPublished: false,
              cycleId: 'cycle-1',
            },
          }],
        });
      mockPrismaService.keyResult.update.mockResolvedValue({ ...existingKeyResult, title: 'Updated' });
      mockRBACService.canPerformAction.mockResolvedValue(true);
      mockOkrGovernanceService.checkAllLocksForKeyResult.mockResolvedValue(undefined);
      mockStateTransitionService.calculateKeyResultStateFromLegacy.mockReturnValue('DRAFT');
      mockStateTransitionService.assertKeyResultStateTransition.mockReturnValue(undefined);
    });

    it('should reject WORKSPACE_ONLY visibility level on update', async () => {
      const updateData = { visibilityLevel: 'WORKSPACE_ONLY' };

      await expect(
        service.update('kr-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject TEAM_ONLY visibility level on update', async () => {
      const updateData = { visibilityLevel: 'TEAM_ONLY' };

      await expect(
        service.update('kr-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject MANAGER_CHAIN visibility level on update', async () => {
      const updateData = { visibilityLevel: 'MANAGER_CHAIN' };

      await expect(
        service.update('kr-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject EXEC_ONLY visibility level on update', async () => {
      const updateData = { visibilityLevel: 'EXEC_ONLY' };

      await expect(
        service.update('kr-1', updateData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept PUBLIC_TENANT visibility level on update', async () => {
      const updateData = { visibilityLevel: 'PUBLIC_TENANT' };

      await service.update('kr-1', updateData, 'user-1', 'org-1');

      expect(mockPrismaService.keyResult.update).toHaveBeenCalled();
    });

    it('should accept PRIVATE visibility level on update', async () => {
      const updateData = { visibilityLevel: 'PRIVATE' };

      await service.update('kr-1', updateData, 'user-1', 'org-1');

      expect(mockPrismaService.keyResult.update).toHaveBeenCalled();
    });
  });
});


