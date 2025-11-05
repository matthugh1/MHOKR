import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TeamService } from '../team.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { RBACService } from '../../rbac/rbac.service';

describe('TeamService - Tenant Isolation', () => {
  let service: TeamService;
  let prisma: PrismaService;

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

  const teamA = {
    id: 'team-a',
    name: 'Team A',
    workspaceId: 'workspace-a',
    workspace: workspaceA,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const teamB = {
    id: 'team-b',
    name: 'Team B',
    workspaceId: 'workspace-b',
    workspace: workspaceB,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    team: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
    roleAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
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
        TeamService,
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

    service = module.get<TeamService>(TeamService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll() - Tenant Isolation', () => {
    it('should return empty array for user with no organisation', async () => {
      const result = await service.findAll(undefined);
      expect(result).toEqual([]);
      expect(mockPrismaService.team.findMany).not.toHaveBeenCalled();
    });

    it('should return all teams for SUPERUSER when no filter provided', async () => {
      mockPrismaService.team.findMany.mockResolvedValue([teamA, teamB]);

      const result = await service.findAll(null);

      expect(result).toEqual([teamA, teamB]);
    });

    it('should return teams in user\'s tenant when no filter provided', async () => {
      mockPrismaService.team.findMany.mockResolvedValue([teamA]);

      const result = await service.findAll('org-a');

      expect(result).toEqual([teamA]);
      expect(mockPrismaService.team.findMany).toHaveBeenCalledWith({
        where: {
          workspace: {
            organizationId: 'org-a',
          },
        },
        include: {
          workspace: true,
        },
      });
    });

    it('should validate workspace belongs to tenant when filterWorkspaceId provided', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(workspaceA);
      mockPrismaService.team.findMany.mockResolvedValue([teamA]);

      const result = await service.findAll('org-a', 'workspace-a');

      expect(result).toEqual([teamA]);
      expect(mockPrismaService.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: 'workspace-a' },
        select: { organizationId: true },
      });
    });

    it('should return empty array if workspace does not exist (don\'t leak existence)', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(null);

      const result = await service.findAll('org-a', 'non-existent');

      expect(result).toEqual([]);
    });

    it('should throw if workspace belongs to different tenant', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(workspaceB);

      await expect(service.findAll('org-a', 'workspace-b')).rejects.toThrow();
    });
  });

  describe('findById() - Tenant Isolation', () => {
    it('should throw NotFoundException for user with no organisation', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(teamA);

      await expect(service.findById('team-a', undefined)).rejects.toThrow(NotFoundException);
    });

    it('should return any team for SUPERUSER (null)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(teamA);

      const result = await service.findById('team-a', null);

      expect(result).toEqual(teamA);
    });

    it('should return team if workspace belongs to user\'s tenant', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(teamA);

      const result = await service.findById('team-a', 'org-a');

      expect(result).toEqual(teamA);
    });

    it('should throw NotFoundException if team\'s workspace belongs to different tenant (don\'t leak existence)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(teamB);

      await expect(service.findById('team-b', 'org-a')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent', 'org-a')).rejects.toThrow(NotFoundException);
    });
  });
});


