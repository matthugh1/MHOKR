import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrganizationService } from '../organization.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { RBACService } from '../../rbac/rbac.service';

describe('OrganizationService - Tenant Isolation', () => {
  let service: OrganizationService;
  let prisma: PrismaService;

  const orgA = { id: 'org-a', name: 'Organization A', slug: 'org-a', createdAt: new Date(), updatedAt: new Date() };
  const orgB = { id: 'org-b', name: 'Organization B', slug: 'org-b', createdAt: new Date(), updatedAt: new Date() };

  const mockPrismaService = {
    organization: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    roleAssignment: {
      findMany: jest.fn(),
    },
  };

  const mockAuditLogService = {
    record: jest.fn(),
  };

  const mockRBACService = {
    assignRole: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: RBACService,
          useValue: mockRBACService,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll() - Tenant Isolation', () => {
    it('should return empty array for user with no organisation', async () => {
      const result = await service.findAll(undefined);
      expect(result).toEqual([]);
      expect(mockPrismaService.organization.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for user with empty organisation', async () => {
      const result = await service.findAll('');
      expect(result).toEqual([]);
      expect(mockPrismaService.organization.findMany).not.toHaveBeenCalled();
    });

    it('should return all organisations for SUPERUSER (null)', async () => {
      mockPrismaService.organization.findMany.mockResolvedValue([orgA, orgB]);
      mockPrismaService.roleAssignment.findMany.mockResolvedValue([]);

      const result = await service.findAll(null);

      expect(result).toEqual([orgA, orgB]);
      expect(mockPrismaService.organization.findMany).toHaveBeenCalledWith({
        include: {
          workspaces: {
            include: {
              teams: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return only user\'s organisation for normal user', async () => {
      mockPrismaService.roleAssignment.findMany.mockResolvedValue([
        { scopeId: 'org-a' },
      ]);
      mockPrismaService.organization.findMany.mockResolvedValue([orgA]);

      const result = await service.findAll('org-a');

      expect(result).toEqual([orgA]);
      expect(mockPrismaService.organization.findMany).toHaveBeenCalledWith({
        where: {
          id: 'org-a',
        },
        include: {
          workspaces: {
            include: {
              teams: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array if user has no role assignments', async () => {
      mockPrismaService.roleAssignment.findMany.mockResolvedValue([]);

      const result = await service.findAll('org-a');

      expect(result).toEqual([]);
      expect(mockPrismaService.organization.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findById() - Tenant Isolation', () => {
    it('should throw NotFoundException for user with no organisation', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(orgA);

      await expect(service.findById('org-a', undefined)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for user with empty organisation', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(orgA);

      await expect(service.findById('org-a', '')).rejects.toThrow(NotFoundException);
    });

    it('should return any organisation for SUPERUSER (null)', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(orgA);

      const result = await service.findById('org-a', null);

      expect(result).toEqual(orgA);
    });

    it('should return organisation if it matches user\'s tenant', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(orgA);

      const result = await service.findById('org-a', 'org-a');

      expect(result).toEqual(orgA);
    });

    it('should throw NotFoundException if organisation does not match user\'s tenant (don\'t leak existence)', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(orgB);

      await expect(service.findById('org-b', 'org-a')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if organisation does not exist', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent', 'org-a')).rejects.toThrow(NotFoundException);
    });
  });
});


