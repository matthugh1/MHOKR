import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async register(data: { 
    email: string; 
    password: string; 
    firstName: string; 
    lastName: string;
    organizationId: string; // REQUIRED - all users must belong to an organization
    workspaceId: string; // REQUIRED - all users must belong to a workspace
  }) {
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
      throw new ConflictException(`Organization with ID ${data.organizationId} not found`);
    }

    // Verify workspace exists and belongs to the organization
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: data.workspaceId },
    });

    if (!workspace) {
      throw new ConflictException(`Workspace with ID ${data.workspaceId} not found`);
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
          name: `${data.firstName} ${data.lastName}`,
          passwordHash: hashedPassword,
        },
      });

      // ALWAYS add user to organization (mandatory)
      await tx.organizationMember.create({
        data: {
          userId: newUser.id,
          organizationId: data.organizationId,
          role: 'MEMBER', // Default role for self-registered users
        },
      });

      // ALWAYS add user to workspace (mandatory)
      await tx.workspaceMember.create({
        data: {
          userId: newUser.id,
          workspaceId: data.workspaceId,
          role: 'MEMBER', // Default role for self-registered users
        },
      });

      return newUser;
    });

    // Generate JWT
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    // Return user without password
    const { passwordHash, ...userWithoutPassword } = user;
    
    return {
      user: {
        ...userWithoutPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'user',
        isSuperuser: user.isSuperuser || false,
      },
      accessToken,
    };
  }

  async login(email: string, password: string) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    // Return user without password
    const { passwordHash, ...userWithoutPassword } = user;
    const nameParts = user.name.split(' ');
    
    return {
      user: {
        ...userWithoutPassword,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        role: 'user',
        isSuperuser: user.isSuperuser || false,
      },
      accessToken,
    };
  }

  async verifyKeycloakToken(token: string) {
    // TODO: Implement actual Keycloak token verification
    // For now, this is a placeholder that extracts user info and syncs with DB
    
    try {
      const decoded = this.jwtService.decode(token) as any;
      
      if (!decoded) {
        throw new Error('Invalid token');
      }

      // Sync or create user in our database
      const user = await this.prisma.user.upsert({
        where: { keycloakId: decoded.sub },
        update: {
          email: decoded.email,
          name: decoded.name || decoded.preferred_username,
        },
        create: {
          keycloakId: decoded.sub,
          email: decoded.email,
          name: decoded.name || decoded.preferred_username,
        },
      });

      // Generate our own JWT
      const accessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        name: user.name,
      });

      return {
        success: true,
        user,
        accessToken,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const { passwordHash, ...userWithoutPassword } = user;
    const nameParts = user.name.split(' ');
    
    return {
      ...userWithoutPassword,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      role: 'user',
      isSuperuser: user.isSuperuser || false,
    };
  }
}

