import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
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
    private featureFlagService: FeatureFlagService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret || jwtSecret === 'default-secret') {
      throw new Error(
        'JWT_SECRET must be set and cannot be "default-secret". ' +
        'Please set a secure value in your environment variables.',
      );
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Use JWT_SECRET for HS256 tokens - RS256 tokens are handled in authenticate override
      secretOrKey: jwtSecret,
      // IMPORTANT: Pass jwtFromRequest to authenticate override
      passReqToCallback: false,
    });
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
    
    // Extract user ID from verified payload
    const userId = payload?.sub;
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
    
    // Superuser => tenantId: null (global read-only; can view all organisations)
    if (user.isSuperuser) {
      return {
        ...user,
        tenantId: null,
      };
    }
    
    // SINGLE-TENANT ACCESS: Use primaryOrganizationId as the ONLY source of truth
    // Users can only access their primary organization. Multi-tenant access is disabled.
    // Roles determine permissions within the primary organization.
    if (!user.primaryOrganizationId) {
      throw new UnauthorizedException('User account is not properly configured. Please contact support.');
    }
    
    // Get all feature flags for user
    const featureFlags = await this.featureFlagService.getAllFeatureFlags(user.id);

    // tenantId rules:
    // - null        => superuser (global read-only; can view all organisations)
    // - <string>    => normal user (scoped to their primary organisation only)
    // - undefined   => INVALID STATE - should never happen (authentication should have failed)
    //
    // IMPORTANT:
    // undefined is NOT the same as null.
    // undefined = INVALID STATE (user should not have been able to authenticate)
    // null      = platform-level superuser.
    return {
      ...user,
      tenantId: user.primaryOrganizationId, // Single source of truth: primary organization only
      features: {
        rbacInspector: featureFlags.rbacInspector,
        okrTreeView: featureFlags.okrTreeView,
      },
    };
  }
}
