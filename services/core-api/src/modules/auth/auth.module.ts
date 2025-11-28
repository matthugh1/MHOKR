import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AzureAdStrategy } from './strategies/azure-ad.strategy';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { JwksVerifier } from './utils/jwks-verifier';
import { RBACModule } from '../rbac/rbac.module';

@Module({
  imports: [
    PassportModule,
    PrismaModule,  // Import PrismaModule so PrismaService is available
    RBACModule,     // Import RBACModule for RBACService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret || jwtSecret === 'default-secret') {
          throw new Error(
            'JWT_SECRET must be set and cannot be "default-secret". ' +
            'Please set a secure value in your environment variables.',
          );
        }
        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn: '24h',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AzureAdStrategy, JwksVerifier],
  exports: [AuthService, JwksVerifier],
})
export class AuthModule { }

