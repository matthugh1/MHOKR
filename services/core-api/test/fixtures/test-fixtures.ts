/**
 * W5.M1: Test Fixtures and Utilities
 * 
 * Shared test utilities for creating test data:
 * - User factories (tenant admin, workspace lead, contributor, superuser)
 * - Organization/Cycle factories
 * - Objective/KeyResult factories
 * - JWT token generation
 * - Mock AuditLog sink
 */

import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

export class TestFixtures {
  constructor(
    private prisma: PrismaClient,
    private jwtService: JwtService,
  ) {}

  /**
   * Create a test organization
   */
  async createOrganization(data?: { name?: string; slug?: string }) {
    return this.prisma.organization.create({
      data: {
        name: data?.name || `Test Org ${Date.now()}`,
        slug: data?.slug || `test-org-${Date.now()}`,
      },
    });
  }

  /**
   * Create a test user
   */
  async createUser(data?: { email?: string; name?: string; password?: string }) {
    return this.prisma.user.create({
      data: {
        email: data?.email || `test-${Date.now()}@example.com`,
        name: data?.name || 'Test User',
        password: data?.password || 'hashed-password',
      },
    });
  }

  /**
   * Create a tenant admin user with role assignment
   */
  async createTenantAdmin(organizationId: string) {
    const user = await this.createUser({
      email: `admin-${Date.now()}@test.com`,
      name: 'Tenant Admin',
    });

    await this.prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: 'TENANT_ADMIN',
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
    });

    return user;
  }

  /**
   * Create a workspace lead user with role assignment
   */
  async createWorkspaceLead(organizationId: string) {
    const user = await this.createUser({
      email: `lead-${Date.now()}@test.com`,
      name: 'Workspace Lead',
    });

    await this.prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: 'WORKSPACE_LEAD',
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
    });

    return user;
  }

  /**
   * Create a contributor user with role assignment
   */
  async createContributor(organizationId: string) {
    const user = await this.createUser({
      email: `contributor-${Date.now()}@test.com`,
      name: 'Contributor',
    });

    await this.prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: 'CONTRIBUTOR',
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
    });

    return user;
  }

  /**
   * Create an active cycle
   */
  async createActiveCycle(organizationId: string, data?: { name?: string; startDate?: Date; endDate?: Date }) {
    return this.prisma.cycle.create({
      data: {
        name: data?.name || `Q1 ${new Date().getFullYear()}`,
        organizationId,
        status: 'ACTIVE',
        startDate: data?.startDate || new Date(`${new Date().getFullYear()}-01-01`),
        endDate: data?.endDate || new Date(`${new Date().getFullYear()}-03-31`),
      },
    });
  }

  /**
   * Create a locked cycle
   */
  async createLockedCycle(organizationId: string, data?: { name?: string; startDate?: Date; endDate?: Date }) {
    return this.prisma.cycle.create({
      data: {
        name: data?.name || `Q4 ${new Date().getFullYear() - 1}`,
        organizationId,
        status: 'LOCKED',
        startDate: data?.startDate || new Date(`${new Date().getFullYear() - 1}-10-01`),
        endDate: data?.endDate || new Date(`${new Date().getFullYear() - 1}-12-31`),
      },
    });
  }

  /**
   * Create an archived cycle
   */
  async createArchivedCycle(organizationId: string, data?: { name?: string; startDate?: Date; endDate?: Date }) {
    return this.prisma.cycle.create({
      data: {
        name: data?.name || `Q3 ${new Date().getFullYear() - 1}`,
        organizationId,
        status: 'ARCHIVED',
        startDate: data?.startDate || new Date(`${new Date().getFullYear() - 1}-07-01`),
        endDate: data?.endDate || new Date(`${new Date().getFullYear() - 1}-09-30`),
      },
    });
  }

  /**
   * Generate JWT token for a user
   */
  generateToken(userId: string, organizationId: string | null, email?: string) {
    return this.jwtService.sign({
      sub: userId,
      email: email || `user-${userId}@test.com`,
      organizationId,
    });
  }

  /**
   * Cleanup test data
   */
  async cleanup(organizationId: string, userIds: string[]) {
    // Delete objectives and KRs
    await this.prisma.objectiveKeyResult.deleteMany({
      where: { objective: { organizationId } },
    });
    await this.prisma.keyResult.deleteMany({
      where: { objectives: { some: { objective: { organizationId } } } },
    });
    await this.prisma.objective.deleteMany({
      where: { organizationId },
    });

    // Delete role assignments
    await this.prisma.roleAssignment.deleteMany({
      where: { scopeId: organizationId },
    });

    // Delete cycles
    await this.prisma.cycle.deleteMany({
      where: { organizationId },
    });

    // Delete users
    await this.prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

    // Delete organization
    await this.prisma.organization.delete({
      where: { id: organizationId },
    });
  }
}

/**
 * Mock AuditLog sink for unit tests
 */
export class MockAuditLogSink {
  private logs: Array<{
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    organizationId: string | null;
    metadata?: any;
  }> = [];

  async record(params: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    organizationId: string | null;
    metadata?: any;
  }) {
    this.logs.push(params);
  }

  getLogs() {
    return [...this.logs];
  }

  getLogsByAction(action: string) {
    return this.logs.filter((log) => log.action === action);
  }

  getLogsByTargetId(targetId: string) {
    return this.logs.filter((log) => log.targetId === targetId);
  }

  clear() {
    this.logs = [];
  }
}


