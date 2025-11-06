import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SuperuserController } from './superuser.controller';
import { SuperuserService } from './superuser.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RBACModule } from '../rbac/rbac.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => RBACModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret',
        signOptions: {
          expiresIn: '24h',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SuperuserController],
  providers: [SuperuserService],
  exports: [SuperuserService],
})
export class SuperuserModule {}


