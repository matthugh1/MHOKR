/**
 * RBAC Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RBACService } from './rbac.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACCacheService } from './rbac-cache.service';
import { Role, ScopeType } from './types';

describe('RBACService', () => {
  let service: RBACService;
  let prisma: PrismaService;
  let cacheService: RBACCacheService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    roleAssignment: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
    clear: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RBACService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: RBACCacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<RBACService>(RBACService);
    prisma = module.get<PrismaService>(PrismaService);
    cacheService = module.get<RBACCacheService>(RBACCacheService);

    jest.clearAllMocks();
  });

  describe('buildUserContext', () => {
    it('should build user context from database', async () => {
      const userId = 'user-1';
      
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        isSuperuser: false,
      });

      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          id: 'ra-1',
          userId,
          role: 'TENANT_ADMIN',
          scopeType: 'TENANT',
          scopeId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        isSuperuser: false,
      }).mockResolvedValueOnce({
        managerId: null,
      });

      mockCacheService.get.mockResolvedValue(null);

      const context = await service.buildUserContext(userId);

      expect(context.userId).toBe(userId);
      expect(context.isSuperuser).toBe(false);
      expect(context.tenantRoles.get('tenant-1')).toContain('TENANT_ADMIN');
    });

    it('should use cache if available', async () => {
      const userId = 'user-1';
      const cachedContext = {
        userId,
        isSuperuser: false,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
        directReports: [],
      };

      mockCacheService.get.mockResolvedValue(cachedContext);

      const context = await service.buildUserContext(userId);

      expect(context).toEqual(cachedContext);
      expect(mockPrisma.roleAssignment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('assignRole', () => {
    it('should assign a role to a user', async () => {
      const userId = 'user-1';
      const role: Role = 'TENANT_ADMIN';
      const scopeType: ScopeType = 'TENANT';
      const scopeId = 'tenant-1';

      mockPrisma.roleAssignment.upsert.mockResolvedValue({
        id: 'ra-1',
        userId,
        role,
        scopeType,
        scopeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const assignment = await service.assignRole(
        userId,
        role,
        scopeType,
        scopeId,
        'admin-1',
      );

      expect(assignment.userId).toBe(userId);
      expect(assignment.role).toBe(role);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(userId);
    });

    it('should throw error if scopeId is missing for non-PLATFORM scope', async () => {
      await expect(
        service.assignRole('user-1', 'TENANT_ADMIN', 'TENANT', null, 'admin-1'),
      ).rejects.toThrow('scopeId is required');
    });
  });

  describe('revokeRole', () => {
    it('should revoke a role from a user', async () => {
      const userId = 'user-1';
      const role: Role = 'TENANT_ADMIN';
      const scopeType: ScopeType = 'TENANT';
      const scopeId = 'tenant-1';

      mockPrisma.roleAssignment.deleteMany.mockResolvedValue({ count: 1 });

      await service.revokeRole(userId, role, scopeType, scopeId, 'admin-1');

      expect(mockPrisma.roleAssignment.deleteMany).toHaveBeenCalledWith({
        where: {
          userId,
          role,
          scopeType,
          scopeId,
        },
      });
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(userId);
    });
  });

  describe('canPerformAction', () => {
    it('should check if user can perform an action', async () => {
      const userId = 'user-1';
      
      // Mock user context
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        isSuperuser: false,
      });

      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          id: 'ra-1',
          userId,
          role: 'TENANT_ADMIN',
          scopeType: 'TENANT',
          scopeId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        isSuperuser: false,
      }).mockResolvedValueOnce({
        managerId: null,
      });

      mockCacheService.get.mockResolvedValue(null);

      const canManage = await service.canPerformAction(
        userId,
        'manage_users',
        {
          tenantId: 'tenant-1',
        },
      );

      expect(canManage).toBe(true);
    });
  });
});




