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
import { PrismaService } from '../../common/prisma/prisma.service';
import { Action, ResourceContext } from './types';
import { RBAC_ACTION_KEY, RBAC_RESOURCE_CONTEXT_KEY } from './rbac.decorator';
import { buildResourceContextFromRequest } from './helpers';
import { withTenantContext } from '../../common/prisma/tenant-isolation.middleware';
import { AuthorisationService } from '../../policy/authorisation.service';
import { Inject, forwardRef } from '@nestjs/common';
import { recordDeny } from './rbac.telemetry';

@Injectable()
export class RBACGuard implements CanActivate {
  private readonly logger = new Logger(RBACGuard.name);

  private readonly useAuthCentre = process.env.RBAC_AUTHZ_CENTRE !== 'off';

  constructor(
    private rbacService: RBACService,
    private reflector: Reflector,
    private prisma: PrismaService,
    @Inject(forwardRef(() => AuthorisationService))
    private authorisationService: AuthorisationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get action and resource context from decorators
    const action = this.reflector.getAllAndOverride<Action>(RBAC_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Try to get resourceContextFn from handler first, then class
    // Use getAllAndOverride to check both handler and class, but prefer handler
    let resourceContextFn = this.reflector.getAllAndOverride<
      (request: any) => ResourceContext | Promise<ResourceContext>
    >(RBAC_RESOURCE_CONTEXT_KEY, [context.getHandler(), context.getClass()]);
    
    // Debug logging - check what metadata exists
    const handlerMetadata = this.reflector.get(RBAC_RESOURCE_CONTEXT_KEY, context.getHandler());
    const classMetadata = this.reflector.get(RBAC_RESOURCE_CONTEXT_KEY, context.getClass());
    
    this.logger.log(`[RBAC Guard] canActivate`, {
      action,
      hasResourceContextFn: !!resourceContextFn,
      hasHandlerMetadata: !!handlerMetadata,
      hasClassMetadata: !!classMetadata,
      handler: context.getHandler().name,
      className: context.getClass().name,
      resourceContextFnType: resourceContextFn ? typeof resourceContextFn : 'undefined',
      handlerMetadataType: handlerMetadata ? typeof handlerMetadata : 'undefined',
      classMetadataType: classMetadata ? typeof classMetadata : 'undefined',
    });

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

    // Set tenant context for Prisma middleware (defense-in-depth)
    // This allows the middleware to automatically filter queries
    return withTenantContext(user?.tenantId, async () => {
      return this.performAuthorizationCheck(context, action, resourceContextFn, request, user);
    });
  }

  private async performAuthorizationCheck(
    _context: ExecutionContext,
    action: Action,
    resourceContextFn: ((request: any) => ResourceContext | Promise<ResourceContext>) | undefined,
    request: any,
    user: any,
  ): Promise<boolean> {
    // Check superuser status directly from database (bypass cache for reliability)
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperuser: true },
    });

    const isSuperuser = userRecord?.isSuperuser === true;
    
    this.logger.log(`[RBAC Guard] Checking authorization`, {
      userId: user.id,
      userEmail: user.email,
      userTenantId: user.tenantId,
      dbIsSuperuser: userRecord?.isSuperuser,
      isSuperuser,
      action,
    });
    
    // Early return for superusers with allowed actions
    if (isSuperuser) {
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
        this.logger.log(`[RBAC Guard] SUPERUSER AUTHORIZED for ${action}`, {
          userId: user.id,
          action,
        });
        return true;
      }
    }
    
    // Build user context for regular authorization flow
    // CRITICAL: Don't use cache for authorization checks to ensure fresh role data
    // Cache might be stale if roles were recently assigned or changed
    const userContext = await this.rbacService.buildUserContext(user.id, false);

    // Build resource context
    let resourceContext: ResourceContext;
    if (resourceContextFn) {
      this.logger.log(`[RBAC Guard] Using resourceContextFn from decorator`, {
        action,
        userId: user.id,
        hasResourceContextFn: !!resourceContextFn,
      });
      try {
        resourceContext = await resourceContextFn(request);
        this.logger.log(`[RBAC Guard] Built resourceContext from decorator function`, {
          action,
          userId: user.id,
          resourceContext: {
            tenantId: resourceContext.tenantId,
            workspaceId: resourceContext.workspaceId,
            teamId: resourceContext.teamId,
            hasOkr: !!resourceContext.okr,
          },
        });
      } catch (error) {
        this.logger.error(`[RBAC Guard] Error building resourceContext from decorator function`, {
          action,
          userId: user.id,
          error: (error as Error).message,
          stack: (error as Error).stack,
        });
        throw error;
      }
    } else {
      this.logger.debug(`[RBAC Guard] No resourceContextFn found, using fallback`, {
        action,
        userId: user.id,
      });
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
              
              // 1. First try: extract from request body/params/query (POST/PUT requests often have tenantId in body)
              const extracted = this.extractResourceContextFromRequest(request);
              if (extracted?.tenantId) {
                tenantId = extracted.tenantId;
                this.logger.debug(`Extracted tenantId from request: ${tenantId}`, {
                  source: 'request',
                  hasBody: !!request.body,
                  bodyKeys: request.body ? Object.keys(request.body) : [],
                  hasParams: !!request.params,
                  paramsKeys: request.params ? Object.keys(request.params) : [],
                });
              }
              
              // 2. Second try: user's tenantId from JWT token
              if (!tenantId && user.tenantId) {
                tenantId = user.tenantId;
                this.logger.debug(`Using tenantId from user.tenantId: ${tenantId}`);
              }
              
              // 3. Third try: first tenant from user's tenant roles
              if (!tenantId && userContext.tenantRoles && userContext.tenantRoles.size > 0) {
                // tenantRoles is a Map, iterate to get first key
                for (const tid of userContext.tenantRoles.keys()) {
                  tenantId = tid;
                  break;
                }
                this.logger.debug(`Using tenantId from userContext.tenantRoles: ${tenantId}`);
              }
              
              // For actions that require tenant context (view_okr, manage_users, etc.),
              // allow using tenantId from user even if not explicitly in request
              // This allows authenticated users to access tenant-scoped endpoints
              if (tenantId) {
                resourceContext = {
                  tenantId,
                  workspaceId: null,
                  teamId: null,
                };
                
                // Debug logging for tenant-scoped endpoints
                this.logger.log(`Built resourceContext from user.tenantId`, {
                  action,
                  userId: user.id,
                  userEmail: user.email,
                  userTenantId: user.tenantId,
                  derivedTenantId: tenantId,
                  resourceContext,
                });
              } else {
                // If user has no tenant context at all, deny access
                this.logger.error(`No tenantId found for user`, {
                  userId: user.id,
                  userEmail: user.email,
                  userTenantId: user.tenantId,
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

    // Use centralised authorisation service if enabled
    if (this.useAuthCentre) {
      const decision = await this.authorisationService.can(
        userContext,
        action,
        resourceContext,
        user.tenantId,
      );

      if (!decision.allow) {
        const tenantRoles = resourceContext.tenantId 
          ? userContext.tenantRoles.get(resourceContext.tenantId) || []
          : [];
        
        const debugInfo = {
          userId: user.id,
          userEmail: user.email,
          userTenantId: user.tenantId,
          action,
          resourceContext,
          tenantRoles,
          isSuperuser: userContext.isSuperuser,
          reason: decision.reason,
        };
        
        this.logger.error('RBAC Authorization Failed', JSON.stringify(debugInfo, null, 2));
        
        // Record telemetry for deny event
        const route = request.url || request.path || 'unknown';
        recordDeny({
          action,
          role: tenantRoles.length > 0 ? tenantRoles[0] : 'UNKNOWN',
          route,
          reasonCode: decision.reason,
          userId: user.id,
          tenantId: resourceContext.tenantId,
        });
        
        throw new ForbiddenException(
          `User does not have permission to ${action}. Reason: ${decision.reason}`,
        );
      }

      return true;
    }

    // Legacy path (fallback if centre disabled)
    const authorized = await this.rbacService.canPerformAction(
      user.id,
      action,
      resourceContext,
    );

    if (!authorized) {
      // Debug logging
      const userContextForDebug = await this.rbacService.buildUserContext(user.id, false);
      const tenantRoles = resourceContext.tenantId 
        ? userContextForDebug.tenantRoles.get(resourceContext.tenantId) || []
        : [];
      
      // Additional debug info
      const debugInfo = {
        userId: user.id,
        userEmail: user.email,
        userTenantId: user.tenantId,
        action,
        resourceContext,
        tenantRoles,
        allTenantRoles: Array.from(userContextForDebug.tenantRoles.entries()),
        isSuperuser: userContextForDebug.isSuperuser,
      };
      
      this.logger.error('RBAC Authorization Failed', JSON.stringify(debugInfo, null, 2));
      
      // Record telemetry for deny event
      const route = request.url || request.path || 'unknown';
      recordDeny({
        action,
        role: tenantRoles.length > 0 ? tenantRoles[0] : 'UNKNOWN',
        route,
        reasonCode: 'PERMISSION_DENIED',
        userId: user.id,
        tenantId: resourceContext.tenantId,
      });
      
      throw new ForbiddenException(
        `User does not have permission to ${action}. TenantId: ${resourceContext.tenantId}, UserTenantId: ${user.tenantId}, TenantRoles: ${JSON.stringify(tenantRoles)}`,
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
    const url = request.url || '';
    const method = request.method || '';

    // For DELETE /organizations/:id, the id param is the tenantId
    // Check URL pattern to determine context
    const isOrganizationRoute = url.includes('/organizations/') || url.startsWith('/organizations/');
    
    // Log for debugging
    this.logger.debug(`Extracting resource context`, {
      url,
      method,
      params,
      isOrganizationRoute,
      hasParamsId: !!params.id,
    });
    
    // Prefer params, then body, then query
    // For organization routes, params.id is the tenantId
    const tenantId =
      params.tenantId || 
      (isOrganizationRoute && params.id ? params.id : null) || // For /organizations/:id routes
      body.tenantId || 
      query.tenantId;
    const workspaceId =
      params.workspaceId || body.workspaceId || query.workspaceId;
    const teamId = params.teamId || body.teamId || query.teamId;

    // Return null if tenantId is missing (caller will use fallback)
    if (!tenantId) {
      this.logger.debug(`No tenantId extracted from request`, {
        url,
        method,
        params,
        body,
        query,
      });
      return null;
    }

    this.logger.debug(`Extracted tenantId: ${tenantId}`, {
      tenantId,
      workspaceId,
      teamId,
    });

    return {
      tenantId,
      workspaceId: workspaceId || null,
      teamId: teamId || null,
    };
  }
}

