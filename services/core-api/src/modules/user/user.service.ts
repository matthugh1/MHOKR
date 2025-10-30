import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        teamMembers: {
          include: {
            team: true,
          },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByKeycloakId(keycloakId: string) {
    return this.prisma.user.findUnique({
      where: { keycloakId },
    });
  }

  async getUserContext(userId: string) {
    // Get user with all memberships: direct (organization/workspace) and indirect (through teams)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        // Direct organization memberships
        organizationMembers: {
          include: {
            organization: true,
          },
        },
        // Direct workspace memberships
        workspaceMembers: {
          include: {
            workspace: {
              include: {
                organization: true,
                parentWorkspace: true,
                childWorkspaces: true,
              },
            },
          },
        },
        // Team memberships (indirect path to workspaces/organizations)
        teamMembers: {
          include: {
            team: {
              include: {
                workspace: {
                  include: {
                    organization: true,
                    parentWorkspace: true,
                    childWorkspaces: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Combine direct and indirect organization memberships
    const directOrgs = user.organizationMembers.map(om => om.organization);
    const indirectOrgs = user.teamMembers.map(tm => tm.team.workspace.organization);
    const allOrgs = [...directOrgs, ...indirectOrgs];
    const organizations = allOrgs.filter((org, index, self) => 
      index === self.findIndex(o => o.id === org.id)
    );

    // Combine direct and indirect workspace memberships
    const directWorkspaces = user.workspaceMembers.map(wm => wm.workspace);
    const indirectWorkspaces = user.teamMembers.map(tm => tm.team.workspace);
    const allWorkspaces = [...directWorkspaces, ...indirectWorkspaces];
    const workspaces = allWorkspaces.filter((ws, index, self) => 
      index === self.findIndex(w => w.id === ws.id)
    );

    // Get teams with their roles (optional - teams are optional)
    const teams = user.teamMembers.map(tm => ({
      id: tm.team.id,
      name: tm.team.name,
      role: tm.role,
      workspaceId: tm.team.workspaceId,
      workspace: tm.team.workspace.name,
    }));

    // Default context for OKR creation
    // Prioritize direct workspace membership over indirect
    const defaultOrganization = organizations[0] || null;
    const defaultWorkspace = directWorkspaces[0] || indirectWorkspaces[0] || null;
    const defaultTeam = teams[0] || null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: defaultOrganization,
      organizations,
      workspace: defaultWorkspace,
      workspaces,
      team: defaultTeam,
      teams,
      defaultOKRContext: {
        workspaceId: defaultWorkspace?.id || null,
        teamId: defaultTeam?.id || null,
        ownerId: user.id,
      },
    };
  }

  async createUser(
    data: { 
      email: string; 
      name: string; 
      password: string; 
      organizationId: string; // REQUIRED - all users must belong to an organization
      workspaceId: string; // REQUIRED - all users must belong to a workspace
      role?: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER';
      workspaceRole?: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER';
    },
  ) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${data.organizationId} not found`);
    }

    // Verify workspace exists and belongs to the organization
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: data.workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${data.workspaceId} not found`);
    }

    if (workspace.organizationId !== data.organizationId) {
      throw new ConflictException(`Workspace ${data.workspaceId} does not belong to organization ${data.organizationId}`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user and assign to organization and workspace in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // ALWAYS add user to organization (mandatory)
      await tx.organizationMember.create({
        data: {
          userId: newUser.id,
          organizationId: data.organizationId,
          role: data.role || 'MEMBER',
        },
      });

      // ALWAYS add user to workspace (mandatory)
      await tx.workspaceMember.create({
        data: {
          userId: newUser.id,
          workspaceId: data.workspaceId,
          role: data.workspaceRole || 'MEMBER',
        },
      });

      return newUser;
    });

    return user;
  }

  async resetPassword(userId: string, newPassword: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    return { message: 'Password reset successfully' };
  }

  async updateUser(userId: string, data: { name?: string; email?: string }) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being changed and if it already exists
    if (data.email && data.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }
}

