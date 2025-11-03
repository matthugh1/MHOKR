import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

function getBuildTag(): string | null {
  return process.env.BUILD_TAG || null;
}

@ApiTags('System')
@Controller('system')
export class SystemController {
  @Get('status')
  @ApiOperation({ summary: 'Get system status and enforcement capabilities' })
  getStatus() {
    return {
      ok: true,
      service: 'core-api',
      gitTag: getBuildTag(),
      buildTimestamp: new Date().toISOString(),
      enforcement: {
        rbacGuard: true,
        tenantIsolation: true,
        visibilityFiltering: true,
        auditLogging: true,
      },
    };
  }
}


