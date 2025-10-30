import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from './permission.service';
import { PERMISSIONS_KEY } from './permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get user from request (set by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract context from request (params, body, query)
    const contextData = {
      organizationId:
        request.params?.organizationId || request.body?.organizationId,
      workspaceId: request.params?.workspaceId || request.body?.workspaceId,
      teamId: request.params?.teamId || request.body?.teamId,
      okrId: request.params?.id || request.params?.objectiveId,
      okrOwnerId: request.body?.ownerId,
    };

    // Check if user has at least one of the required permissions
    for (const permission of requiredPermissions) {
      const hasPermission = await this.permissionService.hasPermission(
        user.id,
        permission,
        contextData,
      );

      if (hasPermission) {
        return true;
      }
    }

    // If none of the permissions match, deny access
    throw new ForbiddenException(
      `Permission denied. Required: ${requiredPermissions.join(' or ')}`,
    );
  }
}


