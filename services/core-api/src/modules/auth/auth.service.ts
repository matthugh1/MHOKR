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
    // This method verifies Keycloak tokens and syncs users to our database
    // Token is fully verified before this point.
    // If verification fails, we throw UnauthorizedException.
    
    // Note: This method should use the JwksVerifier, but we need to inject it
    // For now, we decode and verify manually - in production, use JwksVerifier service
    
    try {
      // Decode token to check algorithm
      const decoded = this.jwtService.decode(token, { complete: true }) as any;
      
      if (!decoded || !decoded.header || !decoded.payload) {
        throw new UnauthorizedException('Invalid token format');
      }

      // If this is an RS256 token (Keycloak), we need JWKS verification
      // For now, if it's HS256, verify with our secret
      if (decoded.header.alg === 'HS256') {
        const payload = this.jwtService.verify(token) as any;
        
        // Sync or create user in our database
        const user = await this.prisma.user.upsert({
          where: { id: payload.sub },
          update: {
            email: payload.email,
            name: payload.name || payload.preferred_username,
          },
          create: {
            email: payload.email,
            name: payload.name || payload.preferred_username,
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
      } else {
        // RS256 tokens require JWKS verification - this should be handled by JwksVerifier
        // For now, return error indicating proper verification is needed
        throw new UnauthorizedException('Keycloak token verification requires JWKS. Use JwksVerifier service.');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Validate user exists in database
   * 
   * MUST NOT trust unverified data.
   * This method should only be called after token is cryptographically verified.
   * 
   * @param userId - User ID from verified token payload (payload.sub)
   * @returns User object or null if not found
   */
  async validateUser(userId: string) {
    // MUST NOT trust unverified data.
    // This method should only be called after token is cryptographically verified.
    
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

