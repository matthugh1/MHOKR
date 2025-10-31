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
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACService } from './rbac.service';
import { Action, ResourceContext } from './types';
import { RBAC_ACTION_KEY, RBAC_RESOURCE_CONTEXT_KEY } from './rbac.decorator';
import { buildResourceContextFromRequest } from './helpers';

@Injectable()
export class RBACGuard implements CanActivate {
  private readonly logger = new Logger(RBACGuard.name);

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

    // Check if user is superuser early (before building resource context)
    // Superusers have organizationId: null and may not have tenant roles
    const userContext = await this.rbacService.buildUserContext(user.id, true);
    if (userContext.isSuperuser) {
      // For superusers, check if the action is allowed without requiring tenantId
      // Superusers can perform these actions even without a tenant context
      const superuserAllowedActions: Action[] = [
        'manage_users',
        'manage_workspaces',
        'manage_teams',
        'manage_tenant_settings',
        'view_okr',
        'view_all_okrs',
        'export_data',
        'impersonate_user',
      ];
      
      if (superuserAllowedActions.includes(action)) {
        // Extract organizationId from query params if available (for tenant-scoped requests)
        // This allows superusers to access resources in specific organizations
        const extractedContext = this.extractResourceContextFromRequest(request);
        const tenantId = extractedContext?.tenantId || '';
        
        // Allow superuser access - they can access across all tenants
        // Use extracted tenantId if available, otherwise empty string for platform-level access
        const minimalContext: ResourceContext = {
          tenantId, // Use extracted tenantId if available, otherwise empty string
          workspaceId: extractedContext?.workspaceId || null,
          teamId: extractedContext?.teamId || null,
        };
        
        // Verify the action is allowed for superusers
        const authorized = await this.rbacService.canPerformAction(
          user.id,
          action,
          minimalContext,
        );
        
        if (authorized) {
          return true;
        }
      }
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
            // Check if user is superuser (already built above, reuse it)
            if (userContext.isSuperuser) {
              // Superusers can access without tenantId for certain actions
              // Use empty string as tenantId - the can() function will handle superuser logic
              resourceContext = {
                tenantId: '', // Empty string allows superuser logic to work
                workspaceId: null,
                teamId: null,
              };
            } else {
              // Try to get tenantId from multiple sources
              let tenantId = '';
              
              // 1. First try: user's organizationId from JWT token
              if (user.organizationId) {
                tenantId = user.organizationId;
              }
              
              // 2. Second try: first tenant from user's tenant roles
              if (!tenantId && userContext.tenantRoles && userContext.tenantRoles.size > 0) {
                // tenantRoles is a Map, iterate to get first key
                for (const tid of userContext.tenantRoles.keys()) {
                  tenantId = tid;
                  break;
                }
              }
              
              // 3. Third try: extract from request params/query (for list endpoints)
              if (!tenantId) {
                const extracted = this.extractResourceContextFromRequest(request);
                tenantId = extracted?.tenantId || '';
              }
              
              // For actions that require tenant context (view_okr, manage_users, etc.),
              // allow using organizationId to derive tenantId even if not explicitly in request
              // This allows authenticated users to access tenant-scoped endpoints
              if (tenantId) {
                resourceContext = {
                  tenantId,
                  workspaceId: null,
                  teamId: null,
                };
                
                // Debug logging for tenant-scoped endpoints
                this.logger.log(`Built resourceContext from user.organizationId`, {
                  action,
                  userId: user.id,
                  userEmail: user.email,
                  userOrganizationId: user.organizationId,
                  derivedTenantId: tenantId,
                  resourceContext,
                });
              } else {
                // If user has no tenant context at all, deny access
                this.logger.error(`No tenantId found for user`, {
                  userId: user.id,
                  userEmail: user.email,
                  userOrganizationId: user.organizationId,
                  action,
                });
                throw new ForbiddenException(
                  `User does not have permission to ${action}: No tenant context available. User must belong to an organization.`,
                );
              }
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
      
      // Additional debug info
      const debugInfo = {
        userId: user.id,
        userEmail: user.email,
        userOrganizationId: user.organizationId,
        action,
        resourceContext,
        tenantRoles,
        allTenantRoles: Array.from(userContext.tenantRoles.entries()),
        isSuperuser: userContext.isSuperuser,
      };
      
      this.logger.error('RBAC Authorization Failed', JSON.stringify(debugInfo, null, 2));
      
      throw new ForbiddenException(
        `User does not have permission to ${action}. TenantId: ${resourceContext.tenantId}, UserOrganizationId: ${user.organizationId}, TenantRoles: ${JSON.stringify(tenantRoles)}`,
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

