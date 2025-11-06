/**
 * Tenant-Scoped Decorator
 * 
 * Automatically validates that a resource parameter belongs to the caller's tenant.
 * 
 * Usage:
 * @Get(':id')
 * @TenantScoped('id')
 * async getById(@Param('id') id: string, @Req() req: any) {
 *   // Tenant already validated by decorator
 * }
 */

import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OkrTenantGuard } from '../../modules/okr/tenant-guard';

export const TenantScoped = createParamDecorator(
  (paramName: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const paramValue = request.params[paramName] || request.query[paramName];
    const userTenantId = request.user?.tenantId;

    if (!paramValue) {
      throw new ForbiddenException(`Parameter ${paramName} is required`);
    }

    // Validate tenant (throws if mismatch)
    OkrTenantGuard.assertSameTenant(paramValue, userTenantId);

    return paramValue;
  },
);


