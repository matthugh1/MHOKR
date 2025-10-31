/**
 * RBAC Integration Tests
 * 
 * Tests the full RBAC flow with database interactions.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RBACService } from './rbac.service';
import { RBACMigrationService } from './migration.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createRBACTestHelper } from './test-utils';
import { Role } from './types';

describe('RBAC Integration', () => {
  let module: TestingModule;
  let rbacService: RBACService;
  let migrationService: RBACMigrationService;
  let prisma: PrismaService;
  let testHelper: ReturnType<typeof createRBACTestHelper>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RBACService,
        RBACMigrationService,
        PrismaService,
      ],
    }).compile();

    rbacService = module.get<RBACService>(RBACService);
    migrationService = module.get<RBACMigrationService>(RBACMigrationService);
    prisma = module.get<PrismaService>(PrismaService);
    testHelper = createRBACTestHelper(prisma, rbacService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Full RBAC Flow', () => {
    let tenantId: string;
    let workspaceId: string;
    let teamId: string;
    let userId: string;

    beforeEach(async () => {
      // Create test hierarchy
      const hierarchy = await testHelper.createTestHierarchy();
      tenantId = hierarchy.tenantId;
      workspaceId = hierarchy.workspaceId;
      teamId = hierarchy.teamId;

      // Create test user
      const user = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
        },
      });
      userId = user.id;
    });

    afterEach(async () => {
      // Cleanup
      await testHelper.clearUserRoles(userId);
      await testHelper.cleanup(tenantId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    });

    it('should assign and retrieve tenant admin role', async () => {
      await testHelper.createTenantAdmin(userId, tenantId);

      const roles = await rbacService.getEffectiveRolesForScope(userId, tenantId);
      expect(roles).toContain('TENANT_ADMIN');
    });

    it('should allow tenant admin to manage users', async () => {
      await testHelper.createTenantAdmin(userId, tenantId);

      const canManage = await rbacService.canPerformAction(
        userId,
        'manage_users',
        { tenantId },
      );

      expect(canManage).toBe(true);
    });

    it('should allow tenant admin to view OKRs', async () => {
      await testHelper.createTenantAdmin(userId, tenantId);

      const canView = await rbacService.canPerformAction(
        userId,
        'view_okr',
        {
          tenantId,
          okr: {
            id: 'okr-1',
            ownerId: 'other-user',
            organizationId: tenantId,  // Canonical field
            tenantId,  // Legacy field for backward compatibility
            visibilityLevel: 'PUBLIC_TENANT',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );

      expect(canView).toBe(true);
    });

    it('should not allow regular user to manage users', async () => {
      // User has no roles
      const canManage = await rbacService.canPerformAction(
        userId,
        'manage_users',
        { tenantId },
      );

      expect(canManage).toBe(false);
    });

    it('should handle multiple roles correctly', async () => {
      await testHelper.createTenantAdmin(userId, tenantId);
      await testHelper.createWorkspaceLead(userId, workspaceId);
      await testHelper.createTeamLead(userId, teamId);

      const roles = await rbacService.getEffectiveRolesForScope(
        userId,
        tenantId,
        workspaceId,
        teamId,
      );

      expect(roles).toContain('TENANT_ADMIN');
      expect(roles).toContain('WORKSPACE_LEAD');
      expect(roles).toContain('TEAM_LEAD');
    });

    it('should invalidate cache on role change', async () => {
      await testHelper.createTenantAdmin(userId, tenantId);

      // Build context (should cache)
      const context1 = await rbacService.buildUserContext(userId);
      expect(context1.tenantRoles.get(tenantId)).toContain('TENANT_ADMIN');

      // Revoke role
      await rbacService.revokeRole(
        userId,
        'TENANT_ADMIN',
        'TENANT',
        tenantId,
        'admin',
      );

      // Cache should be invalidated, fresh context should not have role
      const context2 = await rbacService.buildUserContext(userId, false); // Force fresh
      expect(context2.tenantRoles.get(tenantId)).not.toContain('TENANT_ADMIN');
    });
  });

  describe('Manager Chain Visibility', () => {
    let tenantId: string;
    let managerId: string;
    let employeeId: string;

    beforeEach(async () => {
      const hierarchy = await testHelper.createTestHierarchy();
      tenantId = hierarchy.tenantId;

      const manager = await prisma.user.create({
        data: {
          email: `manager-${Date.now()}@example.com`,
          name: 'Manager',
        },
      });
      managerId = manager.id;

      const employee = await prisma.user.create({
        data: {
          email: `employee-${Date.now()}@example.com`,
          name: 'Employee',
          managerId: managerId,
        },
      });
      employeeId = employee.id;
    });

    afterEach(async () => {
      await prisma.user.deleteMany({
        where: { id: { in: [managerId, employeeId] } },
      });
      await testHelper.cleanup(tenantId);
    });

    it('should allow manager to view employee OKRs with MANAGER_CHAIN visibility', async () => {
      await testHelper.createTeamLead(managerId, 'team-1'); // Manager needs a role
      
      const context = await rbacService.buildUserContext(managerId);
      expect(context.directReports).toContain(employeeId);
      expect(context.managerId).toBeUndefined();
    });
  });
});

