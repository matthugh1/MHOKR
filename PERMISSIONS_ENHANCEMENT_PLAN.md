# User Management & Permissions Enhancement Plan

## Executive Summary

This document outlines a comprehensive plan to enhance user management and permissions in the OKR Framework application. The current system has basic authentication and role definitions but lacks critical permission enforcement at the backend level, fine-grained access control, and proper role hierarchy management.

## Current State Analysis

### What Exists ✅

1. **Authentication**
   - JWT-based authentication via `JwtAuthGuard`
   - User registration and login
   - Basic user context retrieval

2. **Role Definitions**
   - Five roles defined: `ORG_ADMIN`, `WORKSPACE_OWNER`, `TEAM_LEAD`, `MEMBER`, `VIEWER`
   - Roles stored at team membership level (`TeamMember` model)

3. **Frontend Permission Hook**
   - Basic `usePermissions()` hook with limited checks
   - UI-level permission checks for OKR editing/deleting

4. **Organization Hierarchy**
   - Organization → Workspace → Team structure exists
   - Proper relationships maintained in database

### Critical Gaps ❌

1. **No Backend Permission Enforcement**
   - All endpoints only check if user is authenticated
   - No validation that user has permission to perform the action
   - Any authenticated user can view/edit/delete any OKR, workspace, or organization

2. **Incomplete Role Model**
   - Roles only exist at team level
   - No workspace-level role assignments
   - No organization-level role assignments
   - Missing role hierarchy and inheritance

3. **Missing Permission Granularity**
   - No separation between view/edit/delete permissions
   - `VIEWER` role exists but isn't enforced
   - No distinction between creating vs. managing OKRs

4. **No Access Control on OKRs**
   - OKR services don't check if user can access the OKR
   - No filtering of OKRs based on user's workspace/team memberships
   - Users can access OKRs outside their scope

5. **No Audit Trail**
   - No tracking of permission changes
   - No logging of access attempts

6. **Missing Permission Features**
   - No support for custom permissions
   - No permission inheritance from parent entities
   - No delegation of permissions

## Enhancement Plan

### Phase 1: Backend Permission Infrastructure (Foundation)

#### 1.1 Permission System Architecture

**Create Permission Service**
- Centralized permission checking service
- Role hierarchy management
- Permission caching for performance

**Key Components:**
```
services/core-api/src/modules/permissions/
├── permission.service.ts        # Core permission logic
├── permission.guard.ts          # NestJS guard for route protection
├── permission.decorator.ts      # Decorator for route-level permissions
├── role.service.ts              # Role management and hierarchy
└── permission.module.ts
```

**Permission Types:**
- `VIEW` - Read-only access
- `CREATE` - Create new entities
- `EDIT` - Modify existing entities
- `DELETE` - Remove entities
- `MANAGE` - Full administrative control
- `INVITE` - Invite users to workspace/team

#### 1.2 Role Hierarchy & Inheritance

**Define Clear Role Hierarchy:**
```
ORG_ADMIN
  └─ WORKSPACE_OWNER
      └─ TEAM_LEAD
          ├─ MEMBER
          └─ VIEWER
```

**Role Capabilities Matrix:**

| Permission | VIEWER | MEMBER | TEAM_LEAD | WORKSPACE_OWNER | ORG_ADMIN |
|------------|--------|--------|-----------|-----------------|-----------|
| View OKRs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create OKRs | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Own OKRs | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Team OKRs | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete OKRs | ❌ | ❌ | ✅* | ✅ | ✅ |
| Manage Team | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage Workspace | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Organization | ❌ | ❌ | ❌ | ❌ | ✅ |
| Invite Members | ❌ | ❌ | ✅ | ✅ | ✅ |

*Team Leads can delete team OKRs (not personal OKRs of members)

#### 1.3 Database Schema Enhancements

**Add Workspace-Level Roles:**
```prisma
model WorkspaceMember {
  id          String     @id @default(cuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspaceId String
  workspace   Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  role        MemberRole // WORKSPACE_OWNER, MEMBER, VIEWER
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([userId, workspaceId])
  @@index([userId])
  @@index([workspaceId])
  @@map("workspace_members")
}
```

**Add Organization-Level Roles:**
```prisma
model OrganizationMember {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  role           MemberRole   // ORG_ADMIN, MEMBER, VIEWER
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
  @@map("organization_members")
}
```

**Add Permission Audit Log:**
```prisma
model PermissionAudit {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  action         String       // "GRANT_ROLE", "REVOKE_ROLE", "CHANGE_ROLE"
  entityType     String       // "ORGANIZATION", "WORKSPACE", "TEAM"
  entityId       String
  previousRole   MemberRole?
  newRole        MemberRole?
  performedBy    String       // User ID who made the change
  metadata       Json?
  createdAt      DateTime     @default(now())

  @@index([userId])
  @@index([entityType, entityId])
  @@map("permission_audits")
}
```

#### 1.4 Permission Guards & Decorators

**Create Permission Guard:**
```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private permissionService: PermissionService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );
    
    if (!requiredPermissions) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    return this.permissionService.hasPermission(
      user.id,
      requiredPermissions,
      request.params,
      request.body,
    );
  }
}
```

**Create Permission Decorator:**
```typescript
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
```

### Phase 2: OKR Access Control

#### 2.1 OKR Permission Enforcement

**Enhance Objective Service:**
- Filter OKRs based on user's workspace/team access
- Check permissions before create/update/delete operations
- Implement view-level filtering

**Key Methods:**
```typescript
// Filter OKRs user can access
async findAll(userId: string, workspaceId?: string): Promise<Objective[]>

// Check if user can view specific OKR
async canView(userId: string, objectiveId: string): Promise<boolean>

// Check if user can edit specific OKR
async canEdit(userId: string, objectiveId: string): Promise<boolean>

// Check if user can delete specific OKR
async canDelete(userId: string, objectiveId: string): Promise<boolean>
```

**Access Rules:**
1. **View Access:**
   - Owner can always view
   - Team members can view team OKRs
   - Workspace members can view workspace OKRs
   - Organization members can view organization OKRs
   - VIEWER role allows read-only access

2. **Edit Access:**
   - Owner can always edit their OKRs
   - TEAM_LEAD+ can edit team OKRs
   - WORKSPACE_OWNER+ can edit workspace OKRs
   - ORG_ADMIN can edit organization OKRs
   - MEMBERs can only edit their own OKRs

3. **Delete Access:**
   - Owner can delete their own OKRs
   - TEAM_LEAD+ can delete team OKRs
   - WORKSPACE_OWNER+ can delete workspace OKRs
   - ORG_ADMIN can delete organization OKRs

#### 2.2 Apply Same Logic to Key Results & Initiatives

- Same permission model applied to KeyResults
- Same permission model applied to Initiatives
- Ensure consistency across all OKR entities

### Phase 3: Organization & Workspace Access Control

#### 3.1 Organization Management Permissions

**Enhance Organization Service:**
- Only ORG_ADMIN can create/update/delete organizations
- Members can view organization details
- VIEWER role limits to read-only

**Controller Updates:**
```typescript
@Post()
@RequirePermission('organization:create')
async create(@Body() data, @Req() req) {
  // Only ORG_ADMIN can create organizations
}

@Patch(':id')
@RequirePermission('organization:edit')
async update(@Param('id') id, @Body() data, @Req() req) {
  // Check user is ORG_ADMIN for this organization
}
```

#### 3.2 Workspace Management Permissions

**Access Rules:**
- WORKSPACE_OWNER+ can create/update/delete workspaces
- Team members can view workspace details
- WORKSPACE_OWNER can manage workspace settings

#### 3.3 Team Management Permissions

**Access Rules:**
- TEAM_LEAD+ can manage team members
- TEAM_LEAD+ can invite new members
- TEAM_LEAD+ can update team settings
- Members can view team details

### Phase 4: User Management Permissions

#### 4.1 User Invitation System

**Create Invitation Service:**
```typescript
class InvitationService {
  async inviteToTeam(teamId: string, email: string, role: MemberRole, inviterId: string)
  async inviteToWorkspace(workspaceId: string, email: string, role: MemberRole, inviterId: string)
  async acceptInvitation(token: string)
  async revokeInvitation(invitationId: string)
}
```

**Permission Checks:**
- Only TEAM_LEAD+ can invite to team
- Only WORKSPACE_OWNER+ can invite to workspace
- Only ORG_ADMIN can invite to organization

#### 4.2 Role Management

**Create Role Management Service:**
- Update user roles with proper permission checks
- Audit all role changes
- Prevent role escalation (users can't grant themselves higher roles)

### Phase 5: Frontend Enhancements

#### 5.1 Enhanced Permission Hook

**Expand `usePermissions` Hook:**
```typescript
const {
  // Existing
  canCreateWorkspace,
  canManageTeam,
  canEditOKR,
  canDeleteOKR,
  canInviteMembers,
  
  // New
  canViewOKR,
  canCreateOKR,
  canManageWorkspace,
  canManageOrganization,
  canChangeRoles,
  getUserRole,
  hasPermission,
} = usePermissions();
```

#### 5.2 UI Permission Checks

- Disable UI elements based on permissions
- Show permission indicators
- Display role badges
- Permission-aware routing

#### 5.3 Permission Error Handling

- Show appropriate error messages
- Redirect unauthorized users
- Display permission requirements

### Phase 6: Advanced Features

#### 6.1 Permission Inheritance

- Child entities inherit permissions from parent
- Workspace permissions cascade to teams
- Organization permissions cascade to workspaces

#### 6.2 Fine-Grained Permissions

**Custom Permission Types:**
- `okr:view:all` - View all OKRs in workspace
- `okr:edit:team` - Edit team OKRs
- `okr:delete:own` - Delete own OKRs only
- `team:invite` - Invite team members
- `workspace:settings` - Manage workspace settings

#### 6.3 Permission Groups

- Create permission groups (e.g., "OKR Manager", "Viewer")
- Assign groups to users
- Simplify permission management

#### 6.4 Delegation

- Temporary permission delegation
- Approval workflows for sensitive operations
- Permission expiration dates

## Implementation Priority

### 🔴 Critical (Must Have)
1. **Backend Permission Enforcement** - Phase 1
   - Without this, the system is insecure
   - Block all unauthorized access immediately

2. **OKR Access Control** - Phase 2
   - Core functionality of the application
   - Users shouldn't see/edit OKRs outside their scope

3. **Role Hierarchy Implementation** - Phase 1.2
   - Proper role definitions ensure correct access

### 🟡 High Priority (Should Have)
4. **Organization/Workspace Access Control** - Phase 3
   - Prevent unauthorized organization management

5. **User Invitation System** - Phase 4.1
   - Essential for team collaboration

6. **Enhanced Frontend Permissions** - Phase 5
   - Better UX with proper permission feedback

### 🟢 Medium Priority (Nice to Have)
7. **Workspace/Organization Level Roles** - Phase 1.3
   - Better granularity, but teams work for MVP

8. **Permission Audit Trail** - Phase 1.3
   - Important for compliance, not critical for MVP

9. **Advanced Features** - Phase 6
   - Can be added incrementally

## Security Considerations

### Data Isolation
- Ensure users can only access data within their organizations
- Prevent cross-organization data leakage
- Enforce workspace boundaries

### Role Escalation Prevention
- Users cannot grant themselves higher roles
- Role changes require appropriate permissions
- Audit all role modifications

### API Security
- All endpoints must check permissions
- Fail closed (deny if unsure)
- Rate limiting on permission checks

### Performance
- Cache permission lookups
- Batch permission checks
- Optimize database queries

## Testing Strategy

### Unit Tests
- Permission service logic
- Role hierarchy calculations
- Permission inheritance

### Integration Tests
- Endpoint permission enforcement
- OKR access filtering
- Role management operations

### E2E Tests
- User workflows with different roles
- Permission denial scenarios
- Role escalation attempts

## Migration Strategy

### Existing Data
1. Assign default roles to existing users
   - First user in organization → ORG_ADMIN
   - Team creators → TEAM_LEAD
   - Other users → MEMBER

2. Migrate existing team memberships
   - Preserve current role assignments
   - Add workspace-level roles where needed

3. Audit existing OKRs
   - Ensure all OKRs have valid owners
   - Fix any orphaned OKRs

### Rollout Plan
1. **Phase 1**: Deploy permission infrastructure (non-breaking)
2. **Phase 2**: Enable permission checks with feature flags
3. **Phase 3**: Gradual rollout per module
4. **Phase 4**: Full enforcement enabled

## Success Metrics

### Security Metrics
- Zero unauthorized access incidents
- 100% endpoint coverage for permission checks
- All OKRs properly scoped to user access

### Performance Metrics
- Permission checks < 50ms (95th percentile)
- No degradation in API response times
- Cache hit rate > 80%

### Usability Metrics
- Permission errors < 1% of requests
- User role management time < 2 minutes
- Invitation acceptance rate > 80%

## Dependencies

### External Libraries
- No new dependencies required
- Use existing NestJS guards and decorators
- Leverage Prisma for permission queries

### Infrastructure
- Database migration for new schema
- No infrastructure changes needed

## Timeline Estimate

- **Phase 1**: 2-3 weeks (Backend Infrastructure)
- **Phase 2**: 1-2 weeks (OKR Access Control)
- **Phase 3**: 1 week (Org/Workspace Control)
- **Phase 4**: 1 week (User Management)
- **Phase 5**: 1 week (Frontend Enhancements)
- **Phase 6**: 2-3 weeks (Advanced Features - optional)

**Total MVP (Phases 1-5)**: 6-8 weeks
**Full Implementation**: 9-12 weeks

## Next Steps

1. **Review & Approval** - Stakeholder review of this plan
2. **Phase 1 Kickoff** - Begin backend permission infrastructure
3. **Design Reviews** - Review permission service architecture
4. **Sprint Planning** - Break down into sprint-sized tasks
5. **Testing Strategy** - Define detailed test cases

---

## Appendix: Example Permission Checks

### Example 1: OKR View Endpoint
```typescript
@Get(':id')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('okr:view')
async getById(@Param('id') id: string, @Req() req: any) {
  // PermissionGuard checks if user can view this OKR
  // Service filters based on user's workspace/team access
  return this.objectiveService.findById(id, req.user.id);
}
```

### Example 2: OKR Create Endpoint
```typescript
@Post()
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('okr:create')
async create(@Body() data: any, @Req() req: any) {
  // Verify user has access to the workspace/team they're creating in
  await this.permissionService.verifyAccess(
    req.user.id,
    'workspace',
    data.workspaceId
  );
  
  return this.objectiveService.create({
    ...data,
    ownerId: req.user.id, // Ensure owner is the requester
  });
}
```

### Example 3: Role Update Endpoint
```typescript
@Patch(':teamId/members/:userId/role')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('team:manage')
async updateMemberRole(
  @Param('teamId') teamId: string,
  @Param('userId') userId: string,
  @Body() data: { role: MemberRole },
  @Req() req: any
) {
  // Verify requester can manage this team
  await this.permissionService.verifyTeamManagement(req.user.id, teamId);
  
  // Prevent role escalation (can't grant higher role than yourself)
  await this.permissionService.verifyRoleHierarchy(
    req.user.id,
    teamId,
    data.role
  );
  
  return this.teamService.updateMemberRole(teamId, userId, data.role);
}
```




