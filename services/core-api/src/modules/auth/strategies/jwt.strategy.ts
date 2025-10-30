import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      return null;
    }
    
    // Superusers don't need organizationId (they see everything)
    if (user.isSuperuser) {
      return {
        ...user,
        organizationId: undefined,
      };
    }
    
    // Get user's primary organization (first org they belong to)
    // TODO: Support multi-org users (currently using first org membership only)
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },  // Get first membership (primary org)
    });
    
    // TODO: Define explicit behavior for users with no organization membership (currently returns null, effectively blocks access)
    return {
      ...user,
      organizationId: orgMember?.organizationId || null,
    };
  }
}

