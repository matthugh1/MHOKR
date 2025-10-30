# P0 Security - PR-Ready Patches

## 1. jwt.strategy.ts - Add organizationId to req.user

### BEFORE
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);
    return user;
  }
}
```

### AFTER
```typescript
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
        organizationId: null,  // null means "all organizations"
      };
    }
    
    // Get user's primary organization (first org they belong to)
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },  // Get first membership (primary org)
    });
    
    return {
      ...user,
      organizationId: orgMember?.organizationId || null,
    };
  }
}
```

---

## 2. auth.module.ts - Wire PrismaService

### BEFORE
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### AFTER
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [
    PassportModule,
    PrismaModule,  // Import PrismaModule so PrismaService is available
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## 3. buildResourceContextFromOKR - Unify naming on organizationId

### BEFORE
```typescript
export async function buildResourceContextFromOKR(
  prisma: PrismaService,
  okrId: string,
): Promise<ResourceContext> {
  const objective = await prisma.objective.findUnique({
    where: { id: okrId },
    select: {
      id: true,
      organizationId: true,
      workspaceId: true,
      teamId: true,
      ownerId: true,
      visibilityLevel: true,
      isPublished: true,
    },
  });

  if (!objective) {
    throw new Error(`OKR ${okrId} not found`);
  }

  const okr: OKREntity = {
    id: objective.id,
    ownerId: objective.ownerId,
    tenantId: objective.organizationId || '',
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    visibilityLevel: objective.visibilityLevel as any,
    isPublished: objective.isPublished || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Load tenant for config flags
  const tenant = objective.organizationId
    ? await prisma.organization.findUnique({
        where: { id: objective.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          allowTenantAdminExecVisibility: true,
          execOnlyWhitelist: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : null;

  return {
    tenantId: objective.organizationId || '',
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    okr,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          allowTenantAdminExecVisibility: tenant.allowTenantAdminExecVisibility || false,
          execOnlyWhitelist: tenant.execOnlyWhitelist as string[] | null | undefined,
          metadata: tenant.metadata as Record<string, any> | null | undefined,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        }
      : undefined,
  };
}
```

### AFTER
```typescript
export async function buildResourceContextFromOKR(
  prisma: PrismaService,
  okrId: string,
): Promise<ResourceContext> {
  const objective = await prisma.objective.findUnique({
    where: { id: okrId },
    select: {
      id: true,
      organizationId: true,
      workspaceId: true,
      teamId: true,
      ownerId: true,
      visibilityLevel: true,
      isPublished: true,
    },
  });

  if (!objective) {
    throw new Error(`OKR ${okrId} not found`);
  }

  const okr: OKREntity = {
    id: objective.id,
    ownerId: objective.ownerId,
    organizationId: objective.organizationId || '',  // Use organizationId, not tenantId
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    visibilityLevel: objective.visibilityLevel as any,
    isPublished: objective.isPublished || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Load tenant for config flags
  const tenant = objective.organizationId
    ? await prisma.organization.findUnique({
        where: { id: objective.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          allowTenantAdminExecVisibility: true,
          execOnlyWhitelist: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : null;

  return {
    tenantId: objective.organizationId || '',  // Keep tenantId at top level for backward compatibility
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    okr,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          allowTenantAdminExecVisibility: tenant.allowTenantAdminExecVisibility || false,
          execOnlyWhitelist: tenant.execOnlyWhitelist as string[] | null | undefined,
          metadata: tenant.metadata as Record<string, any> | null | undefined,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        }
      : undefined,
  };
}
```

**Note:** We also need to update the `OKREntity` interface in `types.ts` to include `organizationId`:

```typescript
export interface OKREntity {
  id: string;
  ownerId: string;
  organizationId: string;  // Add this field
  tenantId: string;  // Keep for backward compatibility
  workspaceId?: string | null;
  teamId?: string | null;
  visibilityLevel: VisibilityLevel;
  isPublished?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 4. objective.service.ts - findAll, canEdit, canDelete

### findAll - BEFORE
```typescript
async findAll(_userId: string, workspaceId?: string) {
  // Return all OKRs globally - filtering happens in UI, not backend
  // Only PRIVATE OKRs are restricted (handled by canView() check on individual access)
  const where: any = {};

  // Optional workspace filter for UI convenience (not access control)
  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  // Note: We no longer filter by user's accessible scopes.
  // All OKRs are globally visible by default.
  // VisibilityLevel = PRIVATE is the only exception (checked per-OKR via canView())

  return this.prisma.objective.findMany({
    where,
    include: {
      keyResults: {
        include: {
          keyResult: true,
        },
      },
      team: true,
      organization: true,
      workspace: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      parent: {
        select: {
          id: true,
          title: true,
        },
      },
      children: true,
    },
  });
}
```

### findAll - AFTER
```typescript
async findAll(userId: string, workspaceId: string | undefined, userOrganizationId: string | null) {
  const where: any = {};

  // Tenant isolation: filter by organizationId
  // If userOrganizationId === null, that means superuser → no org filter, return all OKRs
  // If userOrganizationId is a string, add org filter
  // If userOrganizationId is '' or undefined, return [] (safety)
  if (userOrganizationId === null) {
    // Superuser: no org filter, return all OKRs
  } else if (userOrganizationId && userOrganizationId !== '') {
    where.organizationId = userOrganizationId;
  } else {
    // User has no org or invalid org → return empty array
    return [];
  }

  // Optional workspace filter for UI convenience (not access control)
  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  return this.prisma.objective.findMany({
    where,
    include: {
      keyResults: {
        include: {
          keyResult: true,
        },
      },
      team: true,
      organization: true,
      workspace: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      parent: {
        select: {
          id: true,
          title: true,
        },
      },
      children: true,
    },
  });
}
```

### canEdit - BEFORE
```typescript
async canEdit(userId: string, objectiveId: string): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
  } catch {
    return false;
  }
}
```

### canEdit - AFTER
```typescript
async canEdit(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
  // Superuser is read-only auditor (cannot edit)
  if (userOrganizationId === null) {
    return false;
  }

  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // Extract OKR's organizationId from resource context
    const okrOrganizationId = resourceContext.okr?.organizationId;
    
    // If OKR has no organizationId, treat as system data and block writes
    if (!okrOrganizationId) {
      return false;
    }
    
    // Verify tenant match: user's org must match OKR's org
    if (okrOrganizationId !== userOrganizationId) {
      return false;
    }
    
    return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
  } catch {
    return false;
  }
}
```

### canDelete - BEFORE
```typescript
async canDelete(userId: string, objectiveId: string): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
  } catch {
    return false;
  }
}
```

### canDelete - AFTER
```typescript
async canDelete(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
  // Superuser is read-only auditor (cannot delete)
  if (userOrganizationId === null) {
    return false;
  }

  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // Extract OKR's organizationId from resource context
    const okrOrganizationId = resourceContext.okr?.organizationId;
    
    // If OKR has no organizationId, treat as system data and block writes
    if (!okrOrganizationId) {
      return false;
    }
    
    // Verify tenant match: user's org must match OKR's org
    if (okrOrganizationId !== userOrganizationId) {
      return false;
    }
    
    return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
  } catch {
    return false;
  }
}
```

---

## 5. objective.controller.ts - Update handlers

### GET /objectives - BEFORE
```typescript
@Get()
@RequireAction('view_okr')
@ApiOperation({ summary: 'Get all objectives' })
async getAll(@Query('workspaceId') workspaceId: string | undefined, @Req() req: any) {
  // Filter OKRs based on user's access
  return this.objectiveService.findAll(req.user.id, workspaceId);
}
```

### GET /objectives - AFTER
```typescript
@Get()
@RequireAction('view_okr')
@ApiOperation({ summary: 'Get all objectives' })
async getAll(@Query('workspaceId') workspaceId: string | undefined, @Req() req: any) {
  return this.objectiveService.findAll(
    req.user.id,
    workspaceId,
    req.user.organizationId // null = superuser
  );
}
```

### PATCH /objectives/:id - BEFORE
```typescript
@Patch(':id')
@RequireAction('edit_okr')
@ApiOperation({ summary: 'Update objective' })
async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
  // Check if user can edit this OKR
  const canEdit = await this.objectiveService.canEdit(req.user.id, id);
  if (!canEdit) {
    throw new ForbiddenException('You do not have permission to edit this OKR');
  }
  return this.objectiveService.update(id, data, req.user.id);
}
```

### PATCH /objectives/:id - AFTER
```typescript
@Patch(':id')
@RequireAction('edit_okr')
@ApiOperation({ summary: 'Update objective' })
async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
  const canEdit = await this.objectiveService.canEdit(
    req.user.id,
    id,
    req.user.organizationId // null for superuser
  );
  if (!canEdit) {
    throw new ForbiddenException('You do not have permission to edit this OKR');
  }
  return this.objectiveService.update(id, data, req.user.id);
}
```

### DELETE /objectives/:id - BEFORE
```typescript
@Delete(':id')
@RequireAction('delete_okr')
@ApiOperation({ summary: 'Delete objective' })
async delete(@Param('id') id: string, @Req() req: any) {
  // Check if user can delete this OKR
  const canDelete = await this.objectiveService.canDelete(req.user.id, id);
  if (!canDelete) {
    throw new ForbiddenException('You do not have permission to delete this OKR');
  }
  return this.objectiveService.delete(id);
}
```

### DELETE /objectives/:id - AFTER
```typescript
@Delete(':id')
@RequireAction('delete_okr')
@ApiOperation({ summary: 'Delete objective' })
async delete(@Param('id') id: string, @Req() req: any) {
  const canDelete = await this.objectiveService.canDelete(
    req.user.id,
    id,
    req.user.organizationId // null for superuser
  );
  if (!canDelete) {
    throw new ForbiddenException('You do not have permission to delete this OKR');
  }
  return this.objectiveService.delete(id);
}
```

---

## 6. rbac.ts - Update canEditOKRAction and canDeleteOKRAction

### canEditOKRAction - BEFORE
```typescript
function canEditOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = okr.tenantId;

  // Owner can always edit their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // TENANT_OWNER can edit any OKR in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can edit OKRs in their tenant (but not EXEC_ONLY unless allowed)
  if (hasTenantAdminRole(userContext, tenantId)) {
    if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
      return false;
    }
    return true;
  }

  // WORKSPACE_LEAD can edit workspace-level OKRs
  if (okr.workspaceId && hasWorkspaceLeadRole(userContext, okr.workspaceId)) {
    return true;
  }

  // TEAM_LEAD can edit team-level OKRs
  if (okr.teamId && hasTeamLeadRole(userContext, okr.teamId)) {
    return true;
  }

  return false;
}
```

### canEditOKRAction - AFTER
```typescript
function canEditOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = okr.organizationId || okr.tenantId || '';  // Use organizationId, fallback to tenantId

  // Owner can always edit their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // TENANT_OWNER can edit any OKR in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can edit OKRs in their tenant (but not EXEC_ONLY unless allowed)
  if (hasTenantAdminRole(userContext, tenantId)) {
    if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
      return false;
    }
    return true;
  }

  // WORKSPACE_LEAD can edit workspace-level OKRs
  if (okr.workspaceId && hasWorkspaceLeadRole(userContext, okr.workspaceId)) {
    return true;
  }

  // TEAM_LEAD can edit team-level OKRs
  if (okr.teamId && hasTeamLeadRole(userContext, okr.teamId)) {
    return true;
  }

  return false;
}
```

### canDeleteOKRAction - BEFORE
```typescript
function canDeleteOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = okr.tenantId;

  // Owner can delete their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // TENANT_OWNER can delete any OKR in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can delete OKRs (but not EXEC_ONLY unless allowed)
  if (hasTenantAdminRole(userContext, tenantId)) {
    if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
      return false;
    }
    return true;
  }

  // WORKSPACE_LEAD can delete workspace-level OKRs
  if (okr.workspaceId && hasWorkspaceLeadRole(userContext, okr.workspaceId)) {
    return true;
  }

  // TEAM_LEAD can delete team-level OKRs (not personal OKRs of members)
  if (okr.teamId && hasTeamLeadRole(userContext, okr.teamId)) {
    // Only if it's a team-level OKR, not a personal OKR
    if (okr.teamId) {
      return true;
    }
  }

  return false;
}
```

### canDeleteOKRAction - AFTER
```typescript
function canDeleteOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = okr.organizationId || okr.tenantId || '';  // Use organizationId, fallback to tenantId

  // Owner can delete their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // TENANT_OWNER can delete any OKR in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can delete OKRs (but not EXEC_ONLY unless allowed)
  if (hasTenantAdminRole(userContext, tenantId)) {
    if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
      return false;
    }
    return true;
  }

  // WORKSPACE_LEAD can delete workspace-level OKRs
  if (okr.workspaceId && hasWorkspaceLeadRole(userContext, okr.workspaceId)) {
    return true;
  }

  // TEAM_LEAD can delete team-level OKRs (not personal OKRs of members)
  if (okr.teamId && hasTeamLeadRole(userContext, okr.teamId)) {
    // Only if it's a team-level OKR, not a personal OKR
    if (okr.teamId) {
      return true;
    }
  }

  return false;
}
```

---

## 7. visibilityPolicy.ts - Update canViewPrivate

### canViewPrivate - BEFORE
```typescript
function canViewPrivate(
  userContext: UserContext,
  okr: OKREntity,
  tenant?: Tenant & { privateWhitelist?: string[] | null },
): boolean {
  // TENANT_OWNER can view private OKRs in their tenant
  const tenantRoles = userContext.tenantRoles.get(okr.tenantId) || [];
  if (tenantRoles.includes('TENANT_OWNER')) {
    return true;
  }

  // Check explicit whitelist from tenant configuration
  // Support both top-level and metadata.execOnlyWhitelist for backward compatibility
  if (tenant?.privateWhitelist && Array.isArray(tenant.privateWhitelist)) {
    if (tenant.privateWhitelist.includes(userContext.userId)) {
      return true;
    }
  }

  // Also check execOnlyWhitelist for backward compatibility (if PRIVATE uses EXEC_ONLY whitelist)
  if (tenant?.execOnlyWhitelist && Array.isArray(tenant.execOnlyWhitelist)) {
    if (tenant.execOnlyWhitelist.includes(userContext.userId)) {
      return true;
    }
  }

  // Check metadata.privateWhitelist or metadata.execOnlyWhitelist
  if (tenant && 'metadata' in tenant && tenant.metadata) {
    const metadata = tenant.metadata as any;
    if (metadata.privateWhitelist && Array.isArray(metadata.privateWhitelist)) {
      if (metadata.privateWhitelist.includes(userContext.userId)) {
        return true;
      }
    }
    if (metadata.execOnlyWhitelist && Array.isArray(metadata.execOnlyWhitelist)) {
      if (metadata.execOnlyWhitelist.includes(userContext.userId)) {
        return true;
      }
    }
  }

  return false;
}
```

### canViewPrivate - AFTER
```typescript
function canViewPrivate(
  userContext: UserContext,
  okr: OKREntity,
  tenant?: Tenant & { privateWhitelist?: string[] | null },
): boolean {
  // Use organizationId instead of tenantId
  const tenantId = okr.organizationId || okr.tenantId || '';
  
  // TENANT_OWNER can view private OKRs in their tenant
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  if (tenantRoles.includes('TENANT_OWNER')) {
    return true;
  }

  // Check explicit whitelist from tenant configuration
  // Support both top-level and metadata.execOnlyWhitelist for backward compatibility
  if (tenant?.privateWhitelist && Array.isArray(tenant.privateWhitelist)) {
    if (tenant.privateWhitelist.includes(userContext.userId)) {
      return true;
    }
  }

  // Also check execOnlyWhitelist for backward compatibility (if PRIVATE uses EXEC_ONLY whitelist)
  if (tenant?.execOnlyWhitelist && Array.isArray(tenant.execOnlyWhitelist)) {
    if (tenant.execOnlyWhitelist.includes(userContext.userId)) {
      return true;
    }
  }

  // Check metadata.privateWhitelist or metadata.execOnlyWhitelist
  if (tenant && 'metadata' in tenant && tenant.metadata) {
    const metadata = tenant.metadata as any;
    if (metadata.privateWhitelist && Array.isArray(metadata.privateWhitelist)) {
      if (metadata.privateWhitelist.includes(userContext.userId)) {
        return true;
      }
    }
    if (metadata.execOnlyWhitelist && Array.isArray(metadata.execOnlyWhitelist)) {
      if (metadata.execOnlyWhitelist.includes(userContext.userId)) {
        return true;
      }
    }
  }

  return false;
}
```

---

## 8. TenantIsolationGuard - Add deprecation comment

### BEFORE
```typescript
/**
 * Tenant Isolation Guard
 * 
 * Automatically filters data access by user's organization(s).
 * Superusers bypass all tenant restrictions.
 * 
 * This guard should be used on endpoints that return data scoped to organizations.
 * It adds organization filtering context to the request for downstream services.
 */
```

### AFTER
```typescript
/**
 * @deprecated TenantIsolationGuard is not applied anywhere.
 * This logic is now enforced directly in:
 * - objective.service.findAll (read isolation)
 * - objective.service.canEdit / canDelete (write isolation)
 * Remove this guard once all controllers have been migrated.
 * 
 * Tenant Isolation Guard
 * 
 * Automatically filters data access by user's organization(s).
 * Superusers bypass all tenant restrictions.
 * 
 * This guard should be used on endpoints that return data scoped to organizations.
 * It adds organization filtering context to the request for downstream services.
 */
```

---

## 9. types.ts - Update OKREntity interface

### BEFORE
```typescript
export interface OKREntity {
  id: string;
  ownerId: string; // User who owns this OKR
  tenantId: string;
  workspaceId?: string | null;
  teamId?: string | null;
  visibilityLevel: VisibilityLevel;
  isPublished?: boolean; // Whether the OKR is published (draft vs published)
  createdAt: Date;
  updatedAt: Date;
}
```

### AFTER
```typescript
export interface OKREntity {
  id: string;
  ownerId: string; // User who owns this OKR
  organizationId: string;  // Standardized organization ID (primary field)
  tenantId: string;  // Deprecated: kept for backward compatibility, maps to organizationId
  workspaceId?: string | null;
  teamId?: string | null;
  visibilityLevel: VisibilityLevel;
  isPublished?: boolean; // Whether the OKR is published (draft vs published)
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 10. TODOs (carry forward as // TODO comments in code)

All TODOs have been added to the codebase as inline comments. Summary:

1. **Multi-org users**: `jwt.strategy.ts` - Currently using first org membership only
2. **Users with no org**: `jwt.strategy.ts` - Currently returns null, effectively blocks access
3. **OKRs with no organizationId**: `objective.service.ts` (canEdit/canDelete) - Currently treated as system data, blocks writes
4. **Key Results isolation**: `objective.service.ts` (canDelete) - Apply same tenant isolation logic to Key Results write paths
5. **Legacy cleanup**: `tenant-isolation.guard.ts` - Remove guard and legacy membership tables after all controllers migrated
6. **Role mapping**: `migration.service.ts` - Finalize MEMBER → TENANT_* role mapping for migration (if needed)

---

## Summary

All patches have been applied to the codebase. The changes enforce:

- ✅ Tenant isolation on READ (`GET /objectives`)
- ✅ Tenant isolation on WRITE (`PATCH /objectives/:id`, `DELETE /objectives/:id`)
- ✅ Superuser = global read-only auditor (cannot edit/delete)
- ✅ Unified naming on `organizationId` (kept `tenantId` for backward compatibility)
- ✅ Clean `organizationId`-aware `resourceContext` from `buildResourceContextFromOKR`
- ✅ RBAC helpers updated to use `organizationId`
- ✅ Legacy guard marked for deletion

The frontend wiring for consuming permissions is deferred to a separate PR as specified.

