import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ObjectiveService } from '../objective.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RBACService } from '../../rbac/rbac.service';
import { OkrProgressService } from '../okr-progress.service';
import { ActivityService } from '../../activity/activity.service';
import { OkrGovernanceService } from '../okr-governance.service';
import { AuditLogService } from '../../audit/audit-log.service';

describe('ObjectiveService - Tenant Isolation', () => {
  let service: ObjectiveService;

  const objectiveA = {
    id: 'objective-a',
    title: 'Objective A',
    tenantId: 'org-a',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const objectiveB = {
    id: 'objective-b',
    title: 'Objective B',
    tenantId: 'org-b',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    objective: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockRBACService = {
    canPerformAction: jest.fn(),
  };

  const mockOkrProgressService = {
    calculateProgress: jest.fn(),
  };

  const mockActivityService = {
    record: jest.fn(),
  };

  const mockOkrGovernanceService = {
    validatePublish: jest.fn(),
  };

  const mockAuditLogService = {
    record: jest.fn(),
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
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<ObjectiveService>(ObjectiveService);

    jest.clearAllMocks();
  });

  describe('findById() - Tenant Isolation (Defense-in-Depth)', () => {
    it('should return objective without tenant validation if userOrganizationId is undefined (backward compatibility)', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue(objectiveA);

      const result = await service.findById('objective-a');

      expect(result).toEqual(objectiveA);
    });

    it('should return any objective for SUPERUSER (null)', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue(objectiveA);

      const result = await service.findById('objective-a', null);

      expect(result).toEqual(objectiveA);
    });

    it('should return objective if it belongs to user\'s tenant', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue(objectiveA);

      const result = await service.findById('objective-a', 'org-a');

      expect(result).toEqual(objectiveA);
    });

    it('should throw NotFoundException if objective belongs to different tenant (don\'t leak existence)', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue(objectiveB);

      await expect(service.findById('objective-b', 'org-a')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if objective has empty tenantId and user is not SUPERUSER', async () => {
      const objectiveNoOrg = {
        ...objectiveA,
        tenantId: '',
      };
      mockPrismaService.objective.findUnique.mockResolvedValue(objectiveNoOrg);

      await expect(service.findById('objective-a', 'org-a')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if objective does not exist', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent', 'org-a')).rejects.toThrow(NotFoundException);
    });
  });
});


