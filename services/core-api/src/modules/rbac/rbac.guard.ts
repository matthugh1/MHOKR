/**
 * RBAC Guard
 * 
 * NestJS guard for protecting routes with RBAC authorization checks.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACService } from './rbac.service';
import { Action, ResourceContext } from './types';
import { RBAC_ACTION_KEY, RBAC_RESOURCE_CONTEXT_KEY } from './rbac.decorator';
import { buildResourceContextFromRequest } from './helpers';

@Injectable()
export class RBACGuard implements CanActivate {
  constructor(
    private rbacService: RBACService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get action and resource context from decorators
    const action = this.reflector.getAllAndOverride<Action>(RBAC_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const resourceContextFn = this.reflector.getAllAndOverride<
      (request: any) => ResourceContext | Promise<ResourceContext>
    >(RBAC_RESOURCE_CONTEXT_KEY, [context.getHandler(), context.getClass()]);

    // If no action is specified, allow access (use @Public() or other guards)
    if (!action) {
      return true;
    }

    // Get user from request (set by JWT guard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Build resource context
    let resourceContext: ResourceContext;
    if (resourceContextFn) {
      resourceContext = await resourceContextFn(request);
    } else {
      // Try to extract from request params/body
      try {
        resourceContext = buildResourceContextFromRequest(request);
      } catch (error) {
        // Fallback to manual extraction
        const extractedContext = this.extractResourceContextFromRequest(request);
        
        // If tenantId couldn't be extracted, try to derive it from user context
        if (!extractedContext || !extractedContext.tenantId) {
          // Some endpoints might not explicitly provide tenantId (e.g., user-specific endpoints like /layout)
          // In such cases, try to derive it from the user's context
          if (action !== 'impersonate_user' && action !== 'manage_billing') {
            const userContext = await this.rbacService.buildUserContext(user.id, true);
            
            // Get first tenant from user's tenant roles
            let firstTenantId = '';
            if (userContext.tenantRoles && userContext.tenantRoles.size > 0) {
              // tenantRoles is a Map, iterate to get first key
              for (const tenantId of userContext.tenantRoles.keys()) {
                firstTenantId = tenantId;
                break;
              }
            }
            
            // Only create resource context if we found a tenant
            if (firstTenantId) {
              resourceContext = {
                tenantId: firstTenantId,
                workspaceId: null,
                teamId: null,
              };
            } else {
              // If user has no tenant roles, deny access
              throw new ForbiddenException(
                `User does not have permission to ${action}: No tenant context available`,
              );
            }
          } else {
            // For actions that don't require tenant context, still need to provide minimal context
            throw new ForbiddenException(
              `Cannot determine resource context: tenantId is required for action ${action}`,
            );
          }
        } else {
          // Use the extracted context
          resourceContext = extractedContext;
        }
      }
    }

    // Check authorization
    const authorized = await this.rbacService.canPerformAction(
      user.id,
      action,
      resourceContext,
    );

    if (!authorized) {
      // Debug logging
      const userContext = await this.rbacService.buildUserContext(user.id, false);
      const tenantRoles = resourceContext.tenantId 
        ? userContext.tenantRoles.get(resourceContext.tenantId) || []
        : [];
      throw new ForbiddenException(
        `User does not have permission to ${action}. TenantId: ${resourceContext.tenantId}, TenantRoles: ${JSON.stringify(tenantRoles)}, TenantRolesMap: ${JSON.stringify(Array.from(userContext.tenantRoles.entries()))}`,
      );
    }

    return true;
  }

  /**
   * Extract resource context from request
   * 
   * Tries to extract tenantId, workspaceId, teamId from request params or body.
   */
  private extractResourceContextFromRequest(request: any): ResourceContext | null {
    const params = request.params || {};
    const body = request.body || {};
    const query = request.query || {};

    // Prefer params, then body, then query
    const tenantId =
      params.tenantId || 
      params.organizationId || 
      body.tenantId || 
      body.organizationId || 
      query.tenantId || 
      query.organizationId;
    const workspaceId =
      params.workspaceId || body.workspaceId || query.workspaceId;
    const teamId = params.teamId || body.teamId || query.teamId;

    // Return null if tenantId is missing (caller will use fallback)
    if (!tenantId) {
      return null;
    }

    return {
      tenantId,
      workspaceId: workspaceId || null,
      teamId: teamId || null,
    };
  }
}

