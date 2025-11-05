/**
 * W5.M1: Composite OKR Creation - Unit Tests
 * 
 * Unit tests for ObjectiveService.createComposite() method:
 * - Happy path validation
 * - RBAC enforcement
 * - SUPERUSER hard-deny
 * - Governance (cycle lock)
 * - Tenant isolation
 * - PRIVATE visibility with whitelist
 * - KR owner validation
 * - AuditLog recording
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ObjectiveService } from '../objective.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RBACService } from '../../rbac/rbac.service';
import { OkrProgressService } from '../okr-progress.service';
import { ActivityService } from '../../activity/activity.service';
import { OkrGovernanceService } from '../okr-governance.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { KeyResultService } from '../key-result.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OkrTenantGuard } from '../tenant-guard';

describe('ObjectiveService.createComposite() - W5.M1', () => {
  let service: ObjectiveService;
  let prisma: PrismaService;
  let rbacService: RBACService;
  let auditLogService: AuditLogService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    cycle: {
      findUnique: jest.fn(),
    },
    objective: {
      create: jest.fn(),
    },
    keyResult: {
      create: jest.fn(),
    },
    objectiveKeyResult: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockRBACService = {
    canPerformAction: jest.fn(),
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockOkrProgressService = {
    refreshObjectiveProgressCascade: jest.fn().mockResolvedValue(undefined),
  };

  const mockActivityService = {
    createActivity: jest.fn().mockResolvedValue(undefined),
  };

  const mockOkrGovernanceService = {
    checkAllLocksForObjective: jest.fn(),
  };

  const mockKeyResultService = {};

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
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: OkrProgressService,
          useValue: mockOkrProgressService,
        },
        {
          provide: ActivityService,
          useValue: mockActivityService,
        },
        {
          provide: OkrGovernanceService,
          useValue: mockOkrGovernanceService,
        },
        {
          provide: KeyResultService,
          useValue: mockKeyResultService,
        },
      ],
    }).compile();

    service = module.get<ObjectiveService>(ObjectiveService);
    prisma = module.get<PrismaService>(PrismaService);
    rbacService = module.get<RBACService>(RBACService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validObjectiveData = {
    title: 'Reduce churn Q1',
    ownerUserId: 'user-1',
    cycleId: 'cycle-1',
    visibilityLevel: 'PUBLIC_TENANT' as const,
  };

  const validKeyResultsData = [
    {
      title: 'NRR ≥ 110%',
      metricType: 'PERCENT' as const,
      targetValue: 110,
      ownerUserId: 'user-1',
      startValue: 100,
    },
  ];

  const mockCycle = {
    id: 'cycle-1',
    status: 'ACTIVE',
    organizationId: 'org-1',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-03-31'),
  };

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    roleAssignments: [{ scopeType: 'TENANT', scopeId: 'org-1' }],
  };

  describe('Happy Path', () => {
    it('should create PUBLIC_TENANT objective + 1 KR and return ids with publishState=PUBLISHED', async () => {
      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true);

      const createdObjective = {
        id: 'objective-1',
        title: validObjectiveData.title,
        status: 'ON_TRACK',
        isPublished: true,
        visibilityLevel: 'PUBLIC_TENANT',
        organizationId: 'org-1',
        ownerId: validObjectiveData.ownerUserId,
        cycleId: validObjectiveData.cycleId,
      };

      const createdKR = {
        id: 'kr-1',
        title: validKeyResultsData[0].title,
        ownerId: validKeyResultsData[0].ownerUserId,
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          objective: { create: jest.fn().mockResolvedValue(createdObjective) },
          keyResult: { create: jest.fn().mockResolvedValue(createdKR) },
          objectiveKeyResult: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      // Execute
      const result = await service.createComposite(
        validObjectiveData,
        validKeyResultsData,
        'creator-1',
        'org-1',
      );

      // Assert
      expect(result).toEqual({
        objectiveId: 'objective-1',
        keyResultIds: ['kr-1'],
        publishState: 'PUBLISHED',
        status: 'ON_TRACK',
        visibilityLevel: 'PUBLIC_TENANT',
      });

      expect(mockRBACService.canPerformAction).toHaveBeenCalledWith(
        'creator-1',
        'create_okr',
        expect.objectContaining({ tenantId: 'org-1' }),
      );

      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'objective_created',
          targetType: 'OKR',
          targetId: 'objective-1',
        }),
      );

      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'key_result_created',
          targetType: 'OKR',
          targetId: 'kr-1',
        }),
      );
    });
  });

  describe('RBAC Enforcement', () => {
    it('should throw 403 if user lacks create_okr permission', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(false);

      await expect(
        service.createComposite(validObjectiveData, validKeyResultsData, 'user-2', 'org-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRBACService.canPerformAction).toHaveBeenCalledWith(
        'user-2',
        'create_okr',
        expect.any(Object),
      );
    });
  });

  describe('SUPERUSER Hard-Deny', () => {
    it('should throw 403 if userOrganizationId is null (SUPERUSER)', async () => {
      const spy = jest.spyOn(OkrTenantGuard, 'assertCanMutateTenant');
      spy.mockImplementation(() => {
        throw new ForbiddenException('Superusers are read-only; cannot modify resources.');
      });

      await expect(
        service.createComposite(validObjectiveData, validKeyResultsData, 'superuser-1', null),
      ).rejects.toThrow(ForbiddenException);

      spy.mockRestore();
    });
  });

  describe('Governance - Cycle Lock', () => {
    it('should throw 403 if cycle is LOCKED and user is not TENANT_ADMIN', async () => {
      const lockedCycle = { ...mockCycle, status: 'LOCKED' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(lockedCycle);
      mockRBACService.canPerformAction
        .mockResolvedValueOnce(true) // create_okr check
        .mockResolvedValueOnce(false); // edit_okr check (admin override)

      await expect(
        service.createComposite(validObjectiveData, validKeyResultsData, 'user-2', 'org-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRBACService.canPerformAction).toHaveBeenCalledWith(
        'user-2',
        'edit_okr',
        expect.any(Object),
      );
    });

    it('should allow creation if cycle is LOCKED but user is TENANT_ADMIN', async () => {
      const lockedCycle = { ...mockCycle, status: 'LOCKED' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(lockedCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true); // Both checks pass

      const createdObjective = {
        id: 'objective-1',
        status: 'ON_TRACK',
        isPublished: true,
        visibilityLevel: 'PUBLIC_TENANT',
        organizationId: 'org-1',
        ownerId: validObjectiveData.ownerUserId,
        cycleId: validObjectiveData.cycleId,
      };

      const createdKR = { id: 'kr-1', ownerId: validKeyResultsData[0].ownerUserId };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          objective: { create: jest.fn().mockResolvedValue(createdObjective) },
          keyResult: { create: jest.fn().mockResolvedValue(createdKR) },
          objectiveKeyResult: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      await expect(
        service.createComposite(validObjectiveData, validKeyResultsData, 'admin-1', 'org-1'),
      ).resolves.toBeDefined();
    });

    it('should throw 403 if cycle is ARCHIVED and user is not TENANT_ADMIN', async () => {
      const archivedCycle = { ...mockCycle, status: 'ARCHIVED' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(archivedCycle);
      mockRBACService.canPerformAction
        .mockResolvedValueOnce(true) // create_okr check
        .mockResolvedValueOnce(false); // edit_okr check

      await expect(
        service.createComposite(validObjectiveData, validKeyResultsData, 'user-2', 'org-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Tenant Isolation', () => {
    it('should throw 403 if userOrganizationId does not match cycle organizationId', async () => {
      const cycleDifferentOrg = { ...mockCycle, organizationId: 'org-2' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(cycleDifferentOrg);

      const spy = jest.spyOn(OkrTenantGuard, 'assertSameTenant');
      spy.mockImplementation(() => {
        throw new ForbiddenException('You do not have permission to modify resources outside your organization.');
      });

      await expect(
        service.createComposite(validObjectiveData, validKeyResultsData, 'user-1', 'org-1'),
      ).rejects.toThrow(ForbiddenException);

      spy.mockRestore();
    });
  });

  describe('PRIVATE Visibility', () => {
    it('should throw 400 if PRIVATE visibility but whitelistUserIds is missing', async () => {
      const privateObjectiveData = {
        ...validObjectiveData,
        visibilityLevel: 'PRIVATE' as const,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true);

      await expect(
        service.createComposite(privateObjectiveData, validKeyResultsData, 'admin-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 if PRIVATE visibility but whitelistUserIds is empty', async () => {
      const privateObjectiveData = {
        ...validObjectiveData,
        visibilityLevel: 'PRIVATE' as const,
        whitelistUserIds: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true);

      await expect(
        service.createComposite(privateObjectiveData, validKeyResultsData, 'admin-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 if whitelist users are not in same tenant', async () => {
      const privateObjectiveData = {
        ...validObjectiveData,
        visibilityLevel: 'PRIVATE' as const,
        whitelistUserIds: ['user-2'],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true);
      mockPrismaService.user.findMany.mockResolvedValue([]); // No users found (not in tenant)

      await expect(
        service.createComposite(privateObjectiveData, validKeyResultsData, 'admin-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 403 if non-admin tries to create PRIVATE objective', async () => {
      const privateObjectiveData = {
        ...validObjectiveData,
        visibilityLevel: 'PRIVATE' as const,
        whitelistUserIds: ['user-2'],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction
        .mockResolvedValueOnce(true) // create_okr check
        .mockResolvedValueOnce(false); // edit_okr check (admin required for PRIVATE)

      await expect(
        service.createComposite(privateObjectiveData, validKeyResultsData, 'user-2', 'org-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRBACService.canPerformAction).toHaveBeenCalledWith(
        'user-2',
        'edit_okr',
        expect.any(Object),
      );
    });
  });

  describe('Key Results Validation', () => {
    it('should throw 400 if no key results provided', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true);

      await expect(
        service.createComposite(validObjectiveData, [], 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 if KR title is empty', async () => {
      const invalidKR = [{ ...validKeyResultsData[0], title: '' }];

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true);

      await expect(
        service.createComposite(validObjectiveData, invalidKR, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 404 if KR owner does not exist', async () => {
      const invalidKR = [{ ...validKeyResultsData[0], ownerUserId: 'non-existent' }];

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // Objective owner exists
        .mockResolvedValueOnce(null); // KR owner does not exist
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true);

      await expect(
        service.createComposite(validObjectiveData, invalidKR, 'user-1', 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Required Fields Validation', () => {
    it('should throw 400 if objective title is missing', async () => {
      const invalidObjective = { ...validObjectiveData, title: '' };

      await expect(
        service.createComposite(invalidObjective, validKeyResultsData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 if ownerUserId is missing', async () => {
      const invalidObjective = { ...validObjectiveData, ownerUserId: '' };

      await expect(
        service.createComposite(invalidObjective, validKeyResultsData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 if cycleId is missing', async () => {
      const invalidObjective = { ...validObjectiveData, cycleId: '' };

      await expect(
        service.createComposite(invalidObjective, validKeyResultsData, 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 if organizationId is missing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.createComposite(validObjectiveData, validKeyResultsData, 'user-1', undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('AuditLog Recording', () => {
    it('should record objective_created and key_result_created audit entries', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
      mockRBACService.canPerformAction.mockResolvedValue(true);

      const createdObjective = {
        id: 'objective-1',
        title: validObjectiveData.title,
        status: 'ON_TRACK',
        isPublished: true,
        visibilityLevel: 'PUBLIC_TENANT',
        organizationId: 'org-1',
        ownerId: validObjectiveData.ownerUserId,
        cycleId: validObjectiveData.cycleId,
      };

      const createdKR = {
        id: 'kr-1',
        title: validKeyResultsData[0].title,
        ownerId: validKeyResultsData[0].ownerUserId,
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          objective: { create: jest.fn().mockResolvedValue(createdObjective) },
          keyResult: { create: jest.fn().mockResolvedValue(createdKR) },
          objectiveKeyResult: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      await service.createComposite(validObjectiveData, validKeyResultsData, 'creator-1', 'org-1');

      // AuditLog entries are recorded after transaction
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'creator-1',
          action: 'objective_created',
          targetType: 'OKR',
          targetId: 'objective-1',
          organizationId: 'org-1',
          metadata: expect.objectContaining({
            title: validObjectiveData.title,
            ownerId: validObjectiveData.ownerUserId,
            cycleId: validObjectiveData.cycleId,
            isPublished: true,
            visibilityLevel: 'PUBLIC_TENANT',
            keyResultIds: ['kr-1'],
          }),
        }),
      );

      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'creator-1',
          action: 'key_result_created',
          targetType: 'OKR',
          targetId: 'kr-1',
          organizationId: 'org-1',
          metadata: expect.objectContaining({
            title: validKeyResultsData[0].title,
            objectiveId: 'objective-1',
            ownerId: validKeyResultsData[0].ownerUserId,
          }),
        }),
      );
    });
  });
});


