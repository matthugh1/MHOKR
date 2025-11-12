/**
 * RBAC Test Utilities
 * 
 * Helper functions for testing RBAC functionality.
 */

import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from './rbac.service';
import { Role, ScopeType } from './types';

/**
 * Test user setup helper
 */
export class RBACTestHelper {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
  ) {}

  /**
   * Create a test user with roles
   */
  async createTestUserWithRoles(
    userId: string,
    roles: Array<{
      role: Role;
      scopeType: ScopeType;
      scopeId: string | null;
    }>,
    assignedBy: string = 'test',
  ): Promise<void> {
    for (const { role, scopeType, scopeId } of roles) {
      await this.rbacService.assignRole(userId, role, scopeType, scopeId, assignedBy, null);
    }
  }

  /**
   * Create a test tenant admin
   */
  async createTenantAdmin(
    userId: string,
    tenantId: string,
    assignedBy: string = 'test',
  ): Promise<void> {
    await this.rbacService.assignRole(
      userId,
      'TENANT_ADMIN',
      'TENANT',
      tenantId,
      assignedBy,
      null,
    );
  }

  /**
   * Create a test tenant owner
   */
  async createTenantOwner(
    userId: string,
    tenantId: string,
    assignedBy: string = 'test',
  ): Promise<void> {
    await this.rbacService.assignRole(
      userId,
      'TENANT_OWNER',
      'TENANT',
      tenantId,
      assignedBy,
      null,
    );
  }

  /**
   * Create a test workspace lead
   */
  async createWorkspaceLead(
    userId: string,
    workspaceId: string,
    assignedBy: string = 'test',
  ): Promise<void> {
    await this.rbacService.assignRole(
      userId,
      'WORKSPACE_LEAD',
      'WORKSPACE',
      workspaceId,
      assignedBy,
      null,
    );
  }

  /**
   * Create a test team lead
   */
  async createTeamLead(
    userId: string,
    teamId: string,
    assignedBy: string = 'test',
  ): Promise<void> {
    await this.rbacService.assignRole(
      userId,
      'TEAM_LEAD',
      'TEAM',
      teamId,
      assignedBy,
      null,
    );
  }

  /**
   * Clear all roles for a user
   */
  async clearUserRoles(userId: string): Promise<void> {
    await this.prisma.roleAssignment.deleteMany({
      where: { userId },
    });
    this.rbacService.invalidateUserContextCache(userId);
  }

  /**
   * Set manager relationship
   */
  async setManager(userId: string, managerId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { managerId },
    });
    // Invalidate both user caches
    this.rbacService.invalidateUserContextCache(userId);
    this.rbacService.invalidateUserContextCache(managerId);
  }

  /**
   * Create test tenant, workspace, and team hierarchy
   */
  async createTestHierarchy(): Promise<{
    tenantId: string;
    workspaceId: string;
    teamId: string;
  }> {
    const tenant = await this.prisma.organization.create({
      data: {
        name: 'Test Tenant',
        slug: `test-tenant-${Date.now()}`,
      },
    });

    const workspace = await this.prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        tenantId: tenant.id,
      },
    });

    const team = await this.prisma.team.create({
      data: {
        name: 'Test Team',
        workspaceId: workspace.id,
      },
    });

    return {
      tenantId: tenant.id,
      workspaceId: workspace.id,
      teamId: team.id,
    };
  }

  /**
   * Cleanup test data
   */
  async cleanup(tenantId: string): Promise<void> {
    // Delete in reverse order of dependencies
    await this.prisma.team.deleteMany({
      where: {
        workspace: {
          tenantId: tenantId,
        },
      },
    });

    await this.prisma.workspace.deleteMany({
      where: { tenantId: tenantId },
    });

    await this.prisma.organization.delete({
      where: { id: tenantId },
    });
  }
}

/**
 * Create a test helper instance
 */
export function createRBACTestHelper(
  prisma: PrismaService,
  rbacService: RBACService,
): RBACTestHelper {
  return new RBACTestHelper(prisma, rbacService);
}



