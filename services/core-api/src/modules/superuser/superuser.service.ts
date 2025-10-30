import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SuperuserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
   * Add user to organization (superuser only)
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

    // Check if already a member
    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (existing) {
      // Update role
      return this.prisma.organizationMember.update({
        where: { id: existing.id },
        data: { role },
      });
    }

    // Add to organization
    return this.prisma.organizationMember.create({
      data: {
        userId,
        organizationId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Remove user from organization (superuser only)
   */
  async removeUserFromOrganization(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    return this.prisma.organizationMember.delete({
      where: { id: membership.id },
    });
  }

  /**
   * List all organizations (superuser only)
   */
  async listOrganizations() {
    return this.prisma.organization.findMany({
      include: {
        workspaces: {
          include: {
            teams: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * List all users (superuser only)
   */
  async listAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isSuperuser: true,
        createdAt: true,
        organizationMembers: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
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

