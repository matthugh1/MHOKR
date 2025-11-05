import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../user.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { RBACService } from '../../rbac/rbac.service';

describe('UserService - Tenant Isolation', () => {
  let service: UserService;
  let prisma: PrismaService;

  const userA = {
    id: 'user-a',
    email: 'user-a@org-a.com',
    name: 'User A',
    passwordHash: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userB = {
    id: 'user-b',
    email: 'user-b@org-b.com',
    name: 'User B',
    passwordHash: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const tenantAssignmentA = {
    id: 'assignment-a',
    userId: 'user-a',
    scopeType: 'TENANT' as const,
    scopeId: 'org-a',
    role: 'TENANT_ADMIN' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const tenantAssignmentB = {
    id: 'assignment-b',
    userId: 'user-b',
    scopeType: 'TENANT' as const,
    scopeId: 'org-b',
    role: 'TENANT_ADMIN' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    roleAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
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
        UserService,
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

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll() - Tenant Isolation', () => {
    it('should return empty array for user with no organisation', async () => {
      const result = await service.findAll(undefined);
      expect(result).toEqual([]);
      expect(mockPrismaService.user.findMany).not.toHaveBeenCalled();
    });

    it('should return all users for SUPERUSER (null)', async () => {
      mockPrismaService.roleAssignment.findMany.mockResolvedValue([
        { userId: 'user-a', scopeId: 'org-a' },
        { userId: 'user-b', scopeId: 'org-b' },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([userA, userB]);

      const result = await service.findAll(null);

      expect(result).toEqual([userA, userB]);
    });

    it('should return only users from user\'s tenant', async () => {
      mockPrismaService.roleAssignment.findMany.mockResolvedValue([
        tenantAssignmentA,
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([userA]);

      const result = await service.findAll('org-a');

      expect(result).toEqual([userA]);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['user-a'] },
        },
        select: expect.any(Object),
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should return empty array if no users in tenant', async () => {
      mockPrismaService.roleAssignment.findMany.mockResolvedValue([]);

      const result = await service.findAll('org-a');

      expect(result).toEqual([]);
    });
  });

  describe('findById() - Tenant Isolation', () => {
    it('should return null for user with no organisation', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(userA);

      const result = await service.findById('user-a', undefined);

      expect(result).toBeNull();
    });

    it('should return any user for SUPERUSER (null)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(userA);

      const result = await service.findById('user-a', null);

      expect(result).toEqual(userA);
    });

    it('should return user if they belong to caller\'s tenant', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(userA);
      mockPrismaService.roleAssignment.findFirst.mockResolvedValue(tenantAssignmentA);

      const result = await service.findById('user-a', 'org-a');

      expect(result).toEqual(userA);
    });

    it('should return null if user does not belong to caller\'s tenant (don\'t leak existence)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(userB);
      mockPrismaService.roleAssignment.findFirst.mockResolvedValue(null);

      const result = await service.findById('user-b', 'org-a');

      expect(result).toBeNull();
    });

    it('should return null if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent', 'org-a');

      expect(result).toBeNull();
    });
  });
});


