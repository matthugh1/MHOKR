import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RBACService } from '../rbac/rbac.service';
import { Role } from '../rbac/types';

@Injectable()
export class SuperuserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private rbacService: RBACService,
  ) {}

  /**
   * Check if user is a superuser
   */
  async isSuperuser(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperuser: true },
    });
    return user?.isSuperuser || false;
  }

  /**
   * Create a new superuser
   */
  async createSuperuser(data: { email: string; name: string; password: string }) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      // If user exists, just make them superuser
      return this.prisma.user.update({
        where: { id: existingUser.id },
        data: { isSuperuser: true },
        select: {
          id: true,
          email: true,
          name: true,
          isSuperuser: true,
        },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create new superuser
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: hashedPassword,
        isSuperuser: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
      },
    });
  }

  /**
   * Promote existing user to superuser
   */
  async promoteToSuperuser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isSuperuser: true },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
      },
    });
  }

  /**
   * Revoke superuser status
   */
  async revokeSuperuser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isSuperuser: false },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
      },
    });
  }

  /**
   * List all superusers
   */
  async listSuperusers() {
    return this.prisma.user.findMany({
      where: { isSuperuser: true },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create a new organization (superuser only)
   */
  async createOrganization(data: { name: string; slug: string }) {
    // Check if slug already exists
    const existing = await this.prisma.organization.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new ConflictException(`Organization with slug "${data.slug}" already exists`);
    }

    return this.prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
      },
      include: {
        workspaces: true,
      },
    });
  }

  /**
   * Map legacy organization role to RBAC role
   */
  private mapLegacyOrgRoleToRBAC(legacyRole: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER'): Role {
    switch (legacyRole) {
      case 'ORG_ADMIN':
        return 'TENANT_ADMIN';
      case 'VIEWER':
        return 'TENANT_VIEWER';
      case 'MEMBER':
      default:
        return 'TENANT_VIEWER';
    }
  }

  /**
   * Add user to organization (superuser only) - Phase 4: RBAC only
   */
  async addUserToOrganization(
    userId: string,
    organizationId: string,
    role: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER',
  ) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${organizationId} not found`);
    }

    // Map legacy role to RBAC role
    const rbacRole = this.mapLegacyOrgRoleToRBAC(role);

    // Assign RBAC role (Phase 4: RBAC only)
    await this.rbacService.assignRole(
      userId,
      rbacRole,
      'TENANT',
      organizationId,
      userId, // Superuser is the actor
      organizationId,
    );

    // Return format compatible with legacy API
    return {
      userId,
      organizationId,
      role,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    };
  }

  /**
   * Remove user from organization (superuser only) - Phase 4: RBAC only
   */
  async removeUserFromOrganization(userId: string, organizationId: string) {
    // Check if user has role assignments (Phase 4: RBAC only)
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
    });

    if (roleAssignments.length === 0) {
      throw new NotFoundException('User is not a member of this organization');
    }

    // Revoke all RBAC role assignments for this user at this organization
    for (const assignment of roleAssignments) {
      await this.rbacService.revokeRole(
        userId,
        assignment.role as Role,
        'TENANT',
        organizationId,
        userId, // Superuser is the actor
        organizationId,
      );
    }

    return { success: true };
  }

  /**
   * List all organizations (superuser only) - Phase 4: RBAC only
   */
  async listOrganizations() {
    return this.prisma.organization.findMany({
      include: {
        workspaces: {
          include: {
            teams: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * List all users (superuser only) - Phase 4: RBAC only
   */
  async listAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Impersonate a user (superuser only)
   * Generates a token for the target user
   */
  async impersonateUser(superuserId: string, targetUserId: string) {
    // Verify superuser is actually a superuser
    const isSuper = await this.isSuperuser(superuserId);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can impersonate users');
    }

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    // Generate JWT token for target user
    const accessToken = this.jwtService.sign({
      sub: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      impersonatedBy: superuserId, // Track who is impersonating
    });

    const nameParts = targetUser.name.split(' ');

    return {
      user: {
        ...targetUser,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        role: 'user',
        isSuperuser: targetUser.isSuperuser || false,
      },
      accessToken,
      impersonatedBy: superuserId,
    };
  }
}

