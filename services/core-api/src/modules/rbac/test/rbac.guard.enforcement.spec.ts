/**
 * RBAC Guard Enforcement Tests
 * 
 * Tests for RBAC guard enforcement, SUPERUSER read-only, tenant isolation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACGuard } from '../rbac.guard';
import { RBACService } from '../rbac.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Action } from '../types';

describe('RBACGuard Enforcement', () => {
  let guard: RBACGuard;
  let rbacService: RBACService;
  let prismaService: PrismaService;
  let reflector: Reflector;

  const mockExecutionContext = (action: Action | undefined, user: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({
          user,
          url: '/test',
          path: '/test',
          params: {},
          body: {},
          query: {},
        })),
      })),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RBACGuard,
        {
          provide: RBACService,
          useValue: {
            buildUserContext: jest.fn(),
            canPerformAction: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RBACGuard>(RBACGuard);
    rbacService = module.get<RBACService>(RBACService);
    prismaService = module.get<PrismaService>(PrismaService);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('SUPERUSER Read-Only', () => {
    it('should allow SUPERUSER to view OKRs', async () => {
      const user = { id: 'superuser-id', email: 'super@test.com', isSuperuser: true };
      const context = mockExecutionContext('view_okr', user);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('view_okr');
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ isSuperuser: true } as any);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny SUPERUSER from editing OKRs', async () => {
      const user = { id: 'superuser-id', email: 'super@test.com', isSuperuser: true };
      const context = mockExecutionContext('edit_okr', user);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('edit_okr');
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ isSuperuser: true } as any);
      jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
        userId: 'superuser-id',
        isSuperuser: true,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      } as any);
      jest.spyOn(rbacService, 'canPerformAction').mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should deny SUPERUSER from deleting OKRs', async () => {
      const user = { id: 'superuser-id', email: 'super@test.com', isSuperuser: true };
      const context = mockExecutionContext('delete_okr', user);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('delete_okr');
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ isSuperuser: true } as any);
      jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
        userId: 'superuser-id',
        isSuperuser: true,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      } as any);
      jest.spyOn(rbacService, 'canPerformAction').mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should deny SUPERUSER from creating OKRs', async () => {
      const user = { id: 'superuser-id', email: 'super@test.com', isSuperuser: true };
      const context = mockExecutionContext('create_okr', user);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('create_okr');
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ isSuperuser: true } as any);
      jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
        userId: 'superuser-id',
        isSuperuser: true,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      } as any);
      jest.spyOn(rbacService, 'canPerformAction').mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should deny SUPERUSER from publishing OKRs', async () => {
      const user = { id: 'superuser-id', email: 'super@test.com', isSuperuser: true };
      const context = mockExecutionContext('publish_okr', user);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('publish_okr');
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ isSuperuser: true } as any);
      jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
        userId: 'superuser-id',
        isSuperuser: true,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      } as any);
      jest.spyOn(rbacService, 'canPerformAction').mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Publish Lock Enforcement', () => {
    it('should deny non-admin roles from publishing published OKRs', async () => {
      const user = { id: 'user-id', email: 'user@test.com', organizationId: 'org-1' };
      const context = mockExecutionContext('publish_okr', user);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('publish_okr');
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ isSuperuser: false } as any);
      jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
        userId: 'user-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['WORKSPACE_LEAD']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      } as any);
      jest.spyOn(rbacService, 'canPerformAction').mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Tenant Isolation', () => {
    it('should deny cross-tenant access attempts', async () => {
      const user = { id: 'user-id', email: 'user@test.com', organizationId: 'org-1' };
      const context = mockExecutionContext('view_okr', user);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('view_okr');
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ isSuperuser: false } as any);
      jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
        userId: 'user-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_ADMIN']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      } as any);
      
      // Mock canPerformAction to return false for cross-tenant
      jest.spyOn(rbacService, 'canPerformAction').mockImplementation(async (userId, action, resourceContext) => {
        // Simulate cross-tenant check
        if (resourceContext.tenantId !== 'org-1') {
          return false;
        }
        return true;
      });

      // Modify context to have different tenantId
      const contextWithCrossTenant = {
        ...context,
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            user,
            url: '/test',
            path: '/test',
            params: { tenantId: 'org-2' },
            body: {},
            query: {},
          })),
        })),
      } as any;

      await expect(guard.canActivate(contextWithCrossTenant)).rejects.toThrow(ForbiddenException);
    });
  });
});

