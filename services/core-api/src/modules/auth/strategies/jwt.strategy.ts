import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { JwksVerifier } from '../utils/jwks-verifier';

/**
 * JWT Strategy with proper token verification
 * 
 * Token is fully verified before this point.
 * If verification fails, we throw UnauthorizedException.
 * 
 * Supports:
 * - Internal HS256 tokens (signed with JWT_SECRET)
 * - Keycloak RS256 tokens (verified via JWKS)
 * 
 * Note: We override the authenticate method to use our custom JWKS verifier
 * for proper token verification before building req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
    private prisma: PrismaService,
    private jwksVerifier: JwksVerifier,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Use JWT_SECRET for HS256 tokens - RS256 tokens are handled in authenticate override
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  /**
   * Override authenticate to properly verify tokens before validation
   * 
   * Token is fully verified before this point.
   * If verification fails, we throw UnauthorizedException.
   */
  async authenticate(req: any): Promise<void> {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    
    if (!token) {
      return this.fail(new UnauthorizedException('Missing token'), 401);
    }

    try {
      // Token is fully verified before this point.
      // If verification fails, jwksVerifier.verifyToken throws UnauthorizedException.
      const payload = await this.jwksVerifier.verifyToken(token);
      
      // Call validate with verified payload
      const user = await this.validate(payload);
      if (!user) {
        return this.fail(new UnauthorizedException('User validation failed'), 401);
      }
      
      this.success(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return this.fail(error, 401);
      }
      return this.fail(new UnauthorizedException('Token verification failed'), 401);
    }
  }

  /**
   * Validate JWT token payload and build req.user
   * 
   * Token is fully verified before this point.
   * If verification fails, we throw UnauthorizedException.
   * 
   * auth.service.validateUser() MUST NOT trust unverified data.
   * We only call it after token is cryptographically verified.
   */
  async validate(payload: any) {
    // Token is fully verified before this point.
    // If verification fails, authenticate() will throw UnauthorizedException.
    
    // Extract user ID from verified payload
    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Token missing subject (sub)');
    }

    // Validate user exists in database
    // auth.service.validateUser() MUST NOT trust unverified data.
    // We only call it after token is cryptographically verified.
    const user = await this.authService.validateUser(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    // Superuser => organizationId: null (global read-only; can view all organisations)
    if (user.isSuperuser) {
      return {
        ...user,
        organizationId: null,
      };
    }
    
    // Get user's primary organization (first org they belong to)
    // TODO: Support multi-org users (currently using first org membership only)
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },  // Get first membership (primary org)
    });
    
    // organizationId rules:
    // - null        => superuser (global read-only; can view all organisations)
    // - <string>    => normal user (scoped to that organisation)
    // - undefined   => user with no organisation membership (no tenant access; GET /objectives returns [])
    //
    // IMPORTANT:
    // undefined is NOT the same as null.
    // undefined = not assigned anywhere.
    // null      = platform-level superuser.
    return {
      ...user,
      organizationId: orgMember?.organizationId || undefined,  // Normal user: string or undefined (not null)
    };
  }
}

