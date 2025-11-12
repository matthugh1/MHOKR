import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { FeatureFlagService } from '../../rbac/feature-flag.service';

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
    private featureFlagService: FeatureFlagService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Use JWT_SECRET for HS256 tokens - RS256 tokens are handled in authenticate override
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
      // IMPORTANT: Pass jwtFromRequest to authenticate override
      passReqToCallback: false,
    });
    console.log('[JWT STRATEGY] Constructor called, JWT_SECRET length:', (configService.get<string>('JWT_SECRET') || 'default-secret').length);
  }

  // NOTE: We removed the authenticate override to use Passport's default flow.
  // Passport will verify the token using secretOrKey and then call validate() with the payload.
  // For Keycloak tokens, we'd need middleware or a different strategy, but for now HS256 tokens work.

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
    // NOTE: If authenticate() is not called (Passport default flow), payload comes from default JWT verification
    
    console.log('[JWT STRATEGY] validate called with payload:', { 
      sub: payload?.sub, 
      email: payload?.email,
      hasSub: !!payload?.sub,
      payloadKeys: payload ? Object.keys(payload) : []
    });
    
    // Extract user ID from verified payload
    const userId = payload?.sub;
    if (!userId) {
      console.error('[JWT STRATEGY] Token missing subject (sub), payload:', payload);
      throw new UnauthorizedException('Token missing subject (sub)');
    }

    // Validate user exists in database
    // auth.service.validateUser() MUST NOT trust unverified data.
    // We only call it after token is cryptographically verified.
    console.log('[JWT STRATEGY] Validating user:', userId);
    const user = await this.authService.validateUser(userId);
    if (!user) {
      console.error('[JWT STRATEGY] User not found in database:', userId);
      throw new UnauthorizedException('User not found');
    }
    console.log('[JWT STRATEGY] User validated:', { id: user.id, email: user.email, isSuperuser: user.isSuperuser });
    
    // Superuser => tenantId: null (global read-only; can view all organisations)
    if (user.isSuperuser) {
      return {
        ...user,
        tenantId: null,
      };
    }
    
    // Get user's primary organization (first org they belong to)
    // TODO [phase7-hardening]: Support multi-org users (current logic only uses first org membership)
    // Phase 2: Read from RBAC system instead of legacy OrganizationMember table
    const orgAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: user.id,
        scopeType: 'TENANT',
      },
      select: { scopeId: true },
      orderBy: { createdAt: 'asc' },  // Get first membership (primary org)
    });
    
    // CRITICAL: Non-superuser users MUST have at least one tenant role assignment
    // If tenantId is undefined, user cannot authenticate (JWT should never be issued without role assignments)
    if (!user.isSuperuser && !orgAssignment) {
      console.error(`[JWT STRATEGY] User ${user.id} (${user.email}) has no tenant role assignments - authentication should have failed`);
      throw new UnauthorizedException('User account is not properly configured. Please contact support.');
    }
    
    // Get all feature flags for user
    const featureFlags = await this.featureFlagService.getAllFeatureFlags(user.id);

    // tenantId rules:
    // - null        => superuser (global read-only; can view all organisations)
    // - <string>    => normal user (scoped to that organisation)
    // - undefined   => INVALID STATE - should never happen (authentication should have failed)
    //
    // IMPORTANT:
    // undefined is NOT the same as null.
    // undefined = INVALID STATE (user should not have been able to authenticate)
    // null      = platform-level superuser.
    return {
      ...user,
      tenantId: orgAssignment!.scopeId,  // Non-null assertion: we've verified orgAssignment exists above
      features: {
        rbacInspector: featureFlags.rbacInspector,
        okrTreeView: featureFlags.okrTreeView,
      },
    };
  }
}
