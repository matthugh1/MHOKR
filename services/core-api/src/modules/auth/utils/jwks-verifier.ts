/**
 * JWKS Token Verifier
 * 
 * Provides token verification for both:
 * 1. Internal HS256 tokens (signed with JWT_SECRET)
 * 2. Keycloak RS256 tokens (signed with Keycloak's public keys via JWKS)
 * 
 * Token is fully verified before this point.
 * If verification fails, we throw UnauthorizedException.
 */

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

export interface VerifiedTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  [key: string]: any;
}

@Injectable()
export class JwksVerifier {
  private readonly logger = new Logger(JwksVerifier.name);
  private jwksClientInstance: jwksClient.JwksClient | null = null;
  private readonly keycloakUrl: string | null;
  private readonly keycloakRealm: string | null;
  private readonly keycloakClientId: string | null;
  private readonly jwtSecret: string;
  private readonly devBypassAuth: boolean;

  constructor(private configService: ConfigService) {
    this.keycloakUrl = this.configService.get<string>('KEYCLOAK_URL') || null;
    this.keycloakRealm = this.configService.get<string>('KEYCLOAK_REALM') || null;
    this.keycloakClientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID') || null;
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
    
    // DEV_BYPASS_AUTH: Only allowed in development mode - NOT FOR PROD
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const bypassFlag = this.configService.get<string>('DEV_BYPASS_AUTH') === 'true';
    this.devBypassAuth = nodeEnv === 'development' && bypassFlag;

    if (this.devBypassAuth) {
      this.logger.warn(
        '⚠️  DEV_BYPASS_AUTH is enabled. Token verification is bypassed. NOT FOR PRODUCTION!'
      );
    }

    // Initialize JWKS client if Keycloak is configured
    if (this.keycloakUrl && this.keycloakRealm) {
      const jwksUri = `${this.keycloakUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/certs`;
      this.jwksClientInstance = jwksClient.default({
        jwksUri,
        cache: true,
        cacheMaxAge: 86400000, // 24 hours
        rateLimit: true,
        jwksRequestsPerMinute: 5,
      });
      this.logger.log(`JWKS client initialized for ${jwksUri}`);
    } else {
      this.logger.warn('Keycloak not configured - only internal HS256 tokens will be verified');
    }
  }

  /**
   * Verify a JWT token.
   * 
   * Supports:
   * - HS256 tokens (internal, signed with JWT_SECRET)
   * - RS256 tokens (Keycloak, verified via JWKS)
   * 
   * Token is fully verified before this point.
   * If verification fails, we throw UnauthorizedException.
   * 
   * @param token - The JWT token to verify
   * @returns Verified token payload
   * @throws UnauthorizedException if token is invalid, expired, or verification fails
   */
  async verifyToken(token: string): Promise<VerifiedTokenPayload> {
    // DEV_BYPASS_AUTH: Only in development mode - NOT FOR PROD
    if (this.devBypassAuth) {
      this.logger.debug('DEV_BYPASS_AUTH: Decoding token without verification');
      try {
        const decoded = jwt.decode(token, { complete: true }) as any;
        if (!decoded || !decoded.payload) {
          throw new UnauthorizedException('Invalid token format');
        }
        return decoded.payload as VerifiedTokenPayload;
      } catch (error) {
        throw new UnauthorizedException('Failed to decode token');
      }
    }

    // Decode token header to determine algorithm
    const decoded = jwt.decode(token, { complete: true }) as any;
    if (!decoded || !decoded.header) {
      throw new UnauthorizedException('Invalid token format');
    }

    const algorithm = decoded.header.alg;

    // Route to appropriate verification based on algorithm
    if (algorithm === 'HS256') {
      return this.verifyInternalToken(token);
    } else if (algorithm === 'RS256' || algorithm === 'RS384' || algorithm === 'RS512') {
      return this.verifyKeycloakToken(token);
    } else {
      throw new UnauthorizedException(`Unsupported token algorithm: ${algorithm}`);
    }
  }

  /**
   * Verify internal HS256 token (signed with JWT_SECRET)
   * 
   * Token is fully verified before this point.
   * If verification fails, we throw UnauthorizedException.
   */
  private verifyInternalToken(token: string): VerifiedTokenPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as VerifiedTokenPayload;

      // Token is fully verified before this point
      // If verification fails, jwt.verify throws an error
      return payload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token signature');
      } else if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not yet valid');
      }
      throw new UnauthorizedException('Token verification failed');
    }
  }

  /**
   * Verify Keycloak RS256 token (signed with Keycloak's public keys via JWKS)
   * 
   * Token is fully verified before this point.
   * If verification fails, we throw UnauthorizedException.
   */
  private async verifyKeycloakToken(token: string): Promise<VerifiedTokenPayload> {
    if (!this.jwksClientInstance) {
      throw new UnauthorizedException('Keycloak JWKS client not configured');
    }

    try {
      // Decode to get kid (key ID) from header
      const decoded = jwt.decode(token, { complete: true }) as any;
      if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new UnauthorizedException('Token missing key ID (kid)');
      }

      // Get signing key from JWKS
      const key = await this.getSigningKey(decoded.header.kid);

      // Verify token signature and decode payload
      const payload = jwt.verify(token, key, {
        algorithms: ['RS256', 'RS384', 'RS512'],
      }) as VerifiedTokenPayload;

      // Verify issuer (iss)
      if (this.keycloakUrl && this.keycloakRealm) {
        const expectedIssuer = `${this.keycloakUrl}/realms/${this.keycloakRealm}`;
        if (payload.iss !== expectedIssuer) {
          throw new UnauthorizedException(`Invalid token issuer: ${payload.iss}`);
        }
      }

      // Verify audience (aud) if client ID is configured
      if (this.keycloakClientId) {
        const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!aud.includes(this.keycloakClientId)) {
          throw new UnauthorizedException(`Invalid token audience: ${payload.aud}`);
        }
      }

      // Verify expiration (exp) - jwt.verify already checks this, but we verify it's present
      if (!payload.exp) {
        throw new UnauthorizedException('Token missing expiration (exp)');
      }

      // Token is fully verified before this point
      // If verification fails, jwt.verify throws an error
      return payload;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      } else if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token signature');
      } else if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not yet valid');
      }
      this.logger.error('Keycloak token verification error:', error);
      throw new UnauthorizedException('Token verification failed');
    }
  }

  /**
   * Get signing key from JWKS
   */
  private async getSigningKey(kid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.jwksClientInstance) {
        reject(new Error('JWKS client not initialized'));
        return;
      }

      this.jwksClientInstance.getSigningKey(kid, (err, key) => {
        if (err) {
          reject(err);
          return;
        }
        if (!key) {
          reject(new Error('Signing key not found'));
          return;
        }
        const signingKey = key.getPublicKey();
        resolve(signingKey);
      });
    });
  }
}



