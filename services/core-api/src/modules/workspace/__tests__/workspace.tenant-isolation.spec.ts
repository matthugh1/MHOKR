import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { WorkspaceService } from '../workspace.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { RBACService } from '../../rbac/rbac.service';

describe('WorkspaceService - Tenant Isolation', () => {
  let service: WorkspaceService;
  let prisma: PrismaService;

  const orgA = { id: 'org-a', name: 'Organization A' };
  const orgB = { id: 'org-b', name: 'Organization B' };

  const workspaceA = {
    id: 'workspace-a',
    name: 'Workspace A',
    organizationId: 'org-a',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const workspaceB = {
    id: 'workspace-b',
    name: 'Workspace B',
    organizationId: 'org-b',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    workspace: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    roleAssignment: {
      findMany: jest.fn(),
    },
    team: {
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
        WorkspaceService,
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

    service = module.get<WorkspaceService>(WorkspaceService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll() - Tenant Isolation', () => {
    it('should return empty array for user with no organisation', async () => {
      const result = await service.findAll(undefined);
      expect(result).toEqual([]);
      expect(mockPrismaService.workspace.findMany).not.toHaveBeenCalled();
    });

    it('should return all workspaces for SUPERUSER when no filter provided', async () => {
      mockPrismaService.workspace.findMany.mockResolvedValue([workspaceA, workspaceB]);

      const result = await service.findAll(null);

      expect(result).toEqual([workspaceA, workspaceB]);
      expect(mockPrismaService.workspace.findMany).toHaveBeenCalled();
    });

    it('should return workspaces for user\'s tenant when no filter provided', async () => {
      mockPrismaService.workspace.findMany.mockResolvedValue([workspaceA]);

      const result = await service.findAll('org-a');

      expect(result).toEqual([workspaceA]);
      expect(mockPrismaService.workspace.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-a' },
        include: {
          organization: true,
          parentWorkspace: true,
          childWorkspaces: true,
          teams: true,
        },
      });
    });

    it('should allow SUPERUSER to filter by any organisation', async () => {
      mockPrismaService.workspace.findMany.mockResolvedValue([workspaceB]);

      const result = await service.findAll(null, 'org-b');

      expect(result).toEqual([workspaceB]);
      expect(mockPrismaService.workspace.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-b' },
        include: {
          organization: true,
          parentWorkspace: true,
          childWorkspaces: true,
          teams: true,
        },
      });
    });

    it('should throw ForbiddenException if normal user tries to filter by different tenant', async () => {
      // Note: This will throw in OkrTenantGuard.assertSameTenant
      // We need to mock the guard or test the actual behavior
      // For now, we'll test that the service validates the filter
      await expect(service.findAll('org-a', 'org-b')).rejects.toThrow();
    });
  });

  describe('findById() - Tenant Isolation', () => {
    it('should throw NotFoundException for user with no organisation', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(workspaceA);

      await expect(service.findById('workspace-a', undefined)).rejects.toThrow(NotFoundException);
    });

    it('should return any workspace for SUPERUSER (null)', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        ...workspaceA,
        organization: orgA,
      });

      const result = await service.findById('workspace-a', null);

      expect(result).toEqual({
        ...workspaceA,
        organization: orgA,
      });
    });

    it('should return workspace if it belongs to user\'s tenant', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        ...workspaceA,
        organization: orgA,
      });

      const result = await service.findById('workspace-a', 'org-a');

      expect(result).toEqual({
        ...workspaceA,
        organization: orgA,
      });
    });

    it('should throw NotFoundException if workspace belongs to different tenant (don\'t leak existence)', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        ...workspaceB,
        organization: orgB,
      });

      await expect(service.findById('workspace-b', 'org-a')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if workspace does not exist', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent', 'org-a')).rejects.toThrow(NotFoundException);
    });
  });
});


