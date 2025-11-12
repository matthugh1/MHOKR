/**
 * RBAC End-to-End Tests
 * 
 * Comprehensive tests covering critical deny cases:
 * 1. SUPERUSER deny (cannot edit/create/delete OKRs)
 * 2. Cycle lock deny (publish lock prevents non-admin edits)
 * 3. PRIVATE visibility deny (restricts read access)
 * 4. Tenant boundary deny (cross-tenant isolation)
 * 
 * Reference: docs/audit/RBAC_MATRIX_AUTO.md
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACModule } from './rbac.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { OkrModule } from '../okr/okr.module';
import { createRBACTestHelper } from './test-utils';
import { RBACService } from './rbac.service';
import { JwtService } from '@nestjs/jwt';

describe('RBAC E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rbacService: RBACService;
  let jwtService: JwtService;
  let testHelper: ReturnType<typeof createRBACTestHelper>;

  // Test data
  let tenantA: any;
  let tenantB: any;
  let workspaceA: any;
  let teamA: any;
  let superuserToken: string;
  let tenantOwnerToken: string;
  let tenantAdminToken: string;
  let teamLeadToken: string;
  let workspaceMemberToken: string;
  let tenantViewerToken: string;
  let crossTenantUserToken: string;

  // User IDs
  let superuserId: string;
  let tenantOwnerId: string;
  let tenantAdminId: string;
  let teamLeadId: string;
  let workspaceMemberId: string;
  let tenantViewerId: string;
  let crossTenantUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RBACModule, AuthModule, UserModule, OkrModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    rbacService = moduleFixture.get<RBACService>(RBACService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    testHelper = createRBACTestHelper(prisma, rbacService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create test tenants
    tenantA = await prisma.organization.create({
      data: {
        name: 'Tenant A Corp',
        slug: `tenant-a-${Date.now()}`,
      },
    });

    tenantB = await prisma.organization.create({
      data: {
        name: 'Tenant B Corp',
        slug: `tenant-b-${Date.now()}`,
      },
    });

    // Create workspace and team in Tenant A
    workspaceA = await prisma.workspace.create({
      data: {
        name: 'Engineering',
        tenantId: tenantA.id,
      },
    });

    teamA = await prisma.team.create({
      data: {
        name: 'Platform Team',
        workspaceId: workspaceA.id,
      },
    });

    // Create test users
    const superuser = await prisma.user.create({
      data: {
        email: `superuser-${Date.now()}@platform.com`,
        name: 'Super User',
        isSuperuser: true,
      },
    });
    superuserId = superuser.id;

    const tenantOwner = await prisma.user.create({
      data: {
        email: `owner-${Date.now()}@tenanta.com`,
        name: 'Tenant Owner',
      },
    });
    tenantOwnerId = tenantOwner.id;

    const tenantAdmin = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@tenanta.com`,
        name: 'Tenant Admin',
      },
    });
    tenantAdminId = tenantAdmin.id;

    const teamLead = await prisma.user.create({
      data: {
        email: `teamlead-${Date.now()}@tenanta.com`,
        name: 'Team Lead',
      },
    });
    teamLeadId = teamLead.id;

    const workspaceMember = await prisma.user.create({
      data: {
        email: `member-${Date.now()}@tenanta.com`,
        name: 'Workspace Member',
      },
    });
    workspaceMemberId = workspaceMember.id;

    const tenantViewer = await prisma.user.create({
      data: {
        email: `viewer-${Date.now()}@tenanta.com`,
        name: 'Tenant Viewer',
      },
    });
    tenantViewerId = tenantViewer.id;

    const crossTenantUser = await prisma.user.create({
      data: {
        email: `cross-${Date.now()}@tenantb.com`,
        name: 'Cross Tenant User',
      },
    });
    crossTenantUserId = crossTenantUser.id;

    // Assign roles
    await rbacService.assignRole(tenantOwnerId, 'TENANT_OWNER', 'TENANT', tenantA.id, superuserId, tenantA.id);
    await rbacService.assignRole(tenantAdminId, 'TENANT_ADMIN', 'TENANT', tenantA.id, tenantOwnerId, tenantA.id);
    await rbacService.assignRole(teamLeadId, 'TEAM_LEAD', 'TEAM', teamA.id, tenantOwnerId, tenantA.id);
    await rbacService.assignRole(workspaceMemberId, 'WORKSPACE_MEMBER', 'WORKSPACE', workspaceA.id, tenantOwnerId, tenantA.id);
    await rbacService.assignRole(tenantViewerId, 'TENANT_VIEWER', 'TENANT', tenantA.id, tenantOwnerId, tenantA.id);
    await rbacService.assignRole(crossTenantUserId, 'TENANT_ADMIN', 'TENANT', tenantB.id, superuserId, tenantB.id);

    // Generate JWT tokens
    superuserToken = jwtService.sign({ 
      id: superuserId, 
      email: superuser.email,
      isSuperuser: true,
      tenantId: null,
    });

    tenantOwnerToken = jwtService.sign({ 
      id: tenantOwnerId, 
      email: tenantOwner.email,
      tenantId: tenantA.id,
    });

    tenantAdminToken = jwtService.sign({ 
      id: tenantAdminId, 
      email: tenantAdmin.email,
      tenantId: tenantA.id,
    });

    teamLeadToken = jwtService.sign({ 
      id: teamLeadId, 
      email: teamLead.email,
      tenantId: tenantA.id,
    });

    workspaceMemberToken = jwtService.sign({ 
      id: workspaceMemberId, 
      email: workspaceMember.email,
      tenantId: tenantA.id,
    });

    tenantViewerToken = jwtService.sign({ 
      id: tenantViewerId, 
      email: tenantViewer.email,
      tenantId: tenantA.id,
    });

    crossTenantUserToken = jwtService.sign({ 
      id: crossTenantUserId, 
      email: crossTenantUser.email,
      tenantId: tenantB.id,
    });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.roleAssignment.deleteMany({
      where: {
        userId: {
          in: [
            superuserId,
            tenantOwnerId,
            tenantAdminId,
            teamLeadId,
            workspaceMemberId,
            tenantViewerId,
            crossTenantUserId,
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            superuserId,
            tenantOwnerId,
            tenantAdminId,
            teamLeadId,
            workspaceMemberId,
            tenantViewerId,
            crossTenantUserId,
          ],
        },
      },
    });

    await prisma.team.deleteMany({ where: { id: teamA.id } });
    await prisma.workspace.deleteMany({ where: { id: workspaceA.id } });
    await prisma.organization.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
  });

  describe('1. SUPERUSER Deny Cases', () => {
    /**
     * Reference: services/core-api/src/modules/rbac/rbac.ts:182-184
     * SUPERUSER can view but cannot edit/delete/create OKR content
     */

    it('DENY: SUPERUSER cannot create OKR', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${superuserToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes.find((s: any) => s.tenantId === tenantA.id);
      expect(scope).toBeDefined();
      expect(scope.actionsDenied).toContain('create_okr');
      expect(scope.actionsAllowed).not.toContain('create_okr');
    });

    it('DENY: SUPERUSER cannot edit OKR', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${superuserToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes.find((s: any) => s.tenantId === tenantA.id);
      expect(scope).toBeDefined();
      expect(scope.actionsDenied).toContain('edit_okr');
    });

    it('DENY: SUPERUSER cannot delete OKR', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${superuserToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes.find((s: any) => s.tenantId === tenantA.id);
      expect(scope).toBeDefined();
      expect(scope.actionsDenied).toContain('delete_okr');
    });

    it('DENY: SUPERUSER cannot publish OKR', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${superuserToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes.find((s: any) => s.tenantId === tenantA.id);
      expect(scope).toBeDefined();
      expect(scope.actionsDenied).toContain('publish_okr');
    });

    it('DENY: SUPERUSER cannot request check-in', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${superuserToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes.find((s: any) => s.tenantId === tenantA.id);
      expect(scope).toBeDefined();
      expect(scope.actionsDenied).toContain('request_checkin');
    });

    it('ALLOW: SUPERUSER can view OKRs', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${superuserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isSuperuser).toBe(true);
      
      // SUPERUSER has global view access (not scope-specific)
      // Check that view actions are available
      const canView = await rbacService.canPerformAction(
        superuserId,
        'view_okr',
        { tenantId: tenantA.id },
      );
      expect(canView).toBe(true);
    });

    it('ALLOW: SUPERUSER can impersonate users', async () => {
      const canImpersonate = await rbacService.canPerformAction(
        superuserId,
        'impersonate_user',
        { tenantId: tenantA.id },
      );
      expect(canImpersonate).toBe(true);
    });

    it('DENY: SUPERUSER cannot manage billing', async () => {
      const canManageBilling = await rbacService.canPerformAction(
        superuserId,
        'manage_billing',
        { tenantId: tenantA.id },
      );
      expect(canManageBilling).toBe(false);
    });
  });

  describe('2. Publish Lock (Cycle Lock) Deny', () => {
    /**
     * Reference: services/core-api/src/modules/rbac/rbac.ts:310-323
     * Once OKR is published, only TENANT_OWNER and TENANT_ADMIN can edit/delete
     */

    let publishedOkrId: string;
    let draftOkrId: string;

    beforeEach(async () => {
      // Create a published OKR owned by TEAM_LEAD
      const publishedOkr = await prisma.objective.create({
        data: {
          title: 'Published Team OKR',
          tenantId: tenantA.id,
          teamId: teamA.id,
          ownerId: teamLeadId,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      publishedOkrId = publishedOkr.id;

      // Create a draft OKR owned by TEAM_LEAD
      const draftOkr = await prisma.objective.create({
        data: {
          title: 'Draft Team OKR',
          tenantId: tenantA.id,
          teamId: teamA.id,
          ownerId: teamLeadId,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: false,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      draftOkrId = draftOkr.id;
    });

    afterEach(async () => {
      await prisma.objective.deleteMany({
        where: { id: { in: [publishedOkrId, draftOkrId] } },
      });
    });

    it('DENY: TEAM_LEAD cannot edit their own published OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: publishedOkrId } });
      
      const canEdit = await rbacService.canPerformAction(
        teamLeadId,
        'edit_okr',
        {
          tenantId: tenantA.id,
          teamId: teamA.id,
          okr: okr as any,
        },
      );

      expect(canEdit).toBe(false);
    });

    it('DENY: TEAM_LEAD cannot delete their own published OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: publishedOkrId } });
      
      const canDelete = await rbacService.canPerformAction(
        teamLeadId,
        'delete_okr',
        {
          tenantId: tenantA.id,
          teamId: teamA.id,
          okr: okr as any,
        },
      );

      expect(canDelete).toBe(false);
    });

    it('DENY: WORKSPACE_MEMBER cannot edit published OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: publishedOkrId } });
      
      const canEdit = await rbacService.canPerformAction(
        workspaceMemberId,
        'edit_okr',
        {
          tenantId: tenantA.id,
          workspaceId: workspaceA.id,
          okr: okr as any,
        },
      );

      expect(canEdit).toBe(false);
    });

    it('ALLOW: TEAM_LEAD can edit their own draft OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: draftOkrId } });
      
      const canEdit = await rbacService.canPerformAction(
        teamLeadId,
        'edit_okr',
        {
          tenantId: tenantA.id,
          teamId: teamA.id,
          okr: okr as any,
        },
      );

      expect(canEdit).toBe(true);
    });

    it('ALLOW: TENANT_ADMIN can edit published OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: publishedOkrId } });
      
      const canEdit = await rbacService.canPerformAction(
        tenantAdminId,
        'edit_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
        },
      );

      expect(canEdit).toBe(true);
    });

    it('ALLOW: TENANT_OWNER can edit published OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: publishedOkrId } });
      
      const canEdit = await rbacService.canPerformAction(
        tenantOwnerId,
        'edit_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
        },
      );

      expect(canEdit).toBe(true);
    });
  });

  describe('3. PRIVATE Visibility Deny', () => {
    /**
     * Reference: services/core-api/src/modules/rbac/visibilityPolicy.ts:46-48, 62-107
     * PRIVATE OKRs can only be viewed by owner, SUPERUSER, TENANT_OWNER, or whitelisted users
     */

    let privateOkrId: string;

    beforeEach(async () => {
      // Create a PRIVATE OKR owned by TENANT_OWNER
      const privateOkr = await prisma.objective.create({
        data: {
          title: 'Confidential M&A OKR',
          tenantId: tenantA.id,
          ownerId: tenantOwnerId,
          visibilityLevel: 'PRIVATE',
          isPublished: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      privateOkrId = privateOkr.id;
    });

    afterEach(async () => {
      await prisma.objective.deleteMany({ where: { id: privateOkrId } });
    });

    it('DENY: WORKSPACE_MEMBER cannot view PRIVATE OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: privateOkrId } });
      
      const canView = await rbacService.canPerformAction(
        workspaceMemberId,
        'view_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
        },
      );

      expect(canView).toBe(false);
    });

    it('DENY: TEAM_LEAD cannot view PRIVATE OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: privateOkrId } });
      
      const canView = await rbacService.canPerformAction(
        teamLeadId,
        'view_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
        },
      );

      expect(canView).toBe(false);
    });

    it('DENY: TENANT_ADMIN cannot view PRIVATE OKR (not whitelisted)', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: privateOkrId } });
      
      const canView = await rbacService.canPerformAction(
        tenantAdminId,
        'view_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
        },
      );

      expect(canView).toBe(false);
    });

    it('ALLOW: Owner can view their own PRIVATE OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: privateOkrId } });
      
      const canView = await rbacService.canPerformAction(
        tenantOwnerId,
        'view_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
        },
      );

      expect(canView).toBe(true);
    });

    it('ALLOW: SUPERUSER can view PRIVATE OKR', async () => {
      const okr = await prisma.objective.findUnique({ where: { id: privateOkrId } });
      
      const canView = await rbacService.canPerformAction(
        superuserId,
        'view_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
        },
      );

      expect(canView).toBe(true);
    });

    it('ALLOW: TENANT_OWNER can view PRIVATE OKR in their tenant', async () => {
      // Create another PRIVATE OKR owned by someone else
      const otherPrivateOkr = await prisma.objective.create({
        data: {
          title: 'Another Private OKR',
          tenantId: tenantA.id,
          ownerId: teamLeadId,
          visibilityLevel: 'PRIVATE',
          isPublished: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });

      const okr = await prisma.objective.findUnique({ where: { id: otherPrivateOkr.id } });
      
      const canView = await rbacService.canPerformAction(
        tenantOwnerId,
        'view_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
        },
      );

      expect(canView).toBe(true);

      await prisma.objective.delete({ where: { id: otherPrivateOkr.id } });
    });

    it('ALLOW: Whitelisted user can view PRIVATE OKR', async () => {
      // Add TENANT_ADMIN to private whitelist
      await prisma.organization.update({
        where: { id: tenantA.id },
        data: {
          metadata: {
            privateWhitelist: [tenantAdminId],
          },
        },
      });

      const okr = await prisma.objective.findUnique({ where: { id: privateOkrId } });
      const tenant = await prisma.organization.findUnique({ where: { id: tenantA.id } });
      
      const canView = await rbacService.canPerformAction(
        tenantAdminId,
        'view_okr',
        {
          tenantId: tenantA.id,
          okr: okr as any,
          tenant: tenant as any,
        },
      );

      expect(canView).toBe(true);
    });
  });

  describe('4. Tenant Boundary Deny', () => {
    /**
     * Reference: services/core-api/src/modules/rbac/rbac.service.ts:270-298
     * Users cannot perform actions across tenant boundaries
     */

    it('DENY: TENANT_ADMIN cannot assign roles in different tenant', async () => {
      // Attempt to assign role in Tenant B using Tenant A admin
      await expect(
        rbacService.assignRole(
          workspaceMemberId,
          'WORKSPACE_MEMBER',
          'WORKSPACE',
          workspaceA.id,
          tenantAdminId,
          tenantB.id, // Wrong tenant
        ),
      ).rejects.toThrow();
    });

    it('DENY: Cross-tenant user cannot view Tenant A effective permissions', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${crossTenantUserToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      // Should return empty scopes or no access to Tenant A
      const tenantAScopes = response.body.scopes.filter((s: any) => s.tenantId === tenantA.id);
      expect(tenantAScopes.length).toBe(0);
    });

    it('DENY: TEAM_LEAD cannot view OKR in different tenant', async () => {
      // Create OKR in Tenant B
      const tenantBOkr = await prisma.objective.create({
        data: {
          title: 'Tenant B OKR',
          tenantId: tenantB.id,
          ownerId: crossTenantUserId,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });

      const okr = await prisma.objective.findUnique({ where: { id: tenantBOkr.id } });
      
      const canView = await rbacService.canPerformAction(
        teamLeadId,
        'view_okr',
        {
          tenantId: tenantB.id,
          okr: okr as any,
        },
      );

      // TEAM_LEAD has no roles in Tenant B
      expect(canView).toBe(false);

      await prisma.objective.delete({ where: { id: tenantBOkr.id } });
    });

    it('DENY: WORKSPACE_MEMBER cannot access Tenant B data', async () => {
      const userContext = await rbacService.buildUserContext(workspaceMemberId);
      
      // Check that user has no roles in Tenant B
      const tenantBRoles = userContext.tenantRoles.get(tenantB.id);
      expect(tenantBRoles).toBeUndefined();
    });

    it('ALLOW: TENANT_ADMIN has full access within their own tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes.find((s: any) => s.tenantId === tenantA.id);
      expect(scope).toBeDefined();
      expect(scope.actionsAllowed).toContain('view_okr');
      expect(scope.actionsAllowed).toContain('edit_okr');
      expect(scope.actionsAllowed).toContain('manage_users');
    });

    it('ALLOW: SUPERUSER can access multiple tenants', async () => {
      const canViewA = await rbacService.canPerformAction(
        superuserId,
        'view_okr',
        { tenantId: tenantA.id },
      );

      const canViewB = await rbacService.canPerformAction(
        superuserId,
        'view_okr',
        { tenantId: tenantB.id },
      );

      expect(canViewA).toBe(true);
      expect(canViewB).toBe(true);
    });
  });

  describe('5. Additional Deny Cases', () => {
    it('DENY: TENANT_VIEWER cannot create OKR', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${tenantViewerToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes.find((s: any) => s.tenantId === tenantA.id);
      expect(scope).toBeDefined();
      expect(scope.actionsDenied).toContain('create_okr');
    });

    it('DENY: TENANT_VIEWER cannot request check-in', async () => {
      const canRequest = await rbacService.canPerformAction(
        tenantViewerId,
        'request_checkin',
        { tenantId: tenantA.id },
      );

      expect(canRequest).toBe(false);
    });

    it('ALLOW: TENANT_VIEWER can view OKRs', async () => {
      const canView = await rbacService.canPerformAction(
        tenantViewerId,
        'view_okr',
        { tenantId: tenantA.id },
      );

      expect(canView).toBe(true);
    });

    it('ALLOW: TENANT_VIEWER can export data', async () => {
      const canExport = await rbacService.canPerformAction(
        tenantViewerId,
        'export_data',
        { tenantId: tenantA.id },
      );

      expect(canExport).toBe(true);
    });

    it('DENY: Only TENANT_OWNER can manage billing', async () => {
      const tenantAdminCanManage = await rbacService.canPerformAction(
        tenantAdminId,
        'manage_billing',
        { tenantId: tenantA.id },
      );

      const teamLeadCanManage = await rbacService.canPerformAction(
        teamLeadId,
        'manage_billing',
        { tenantId: tenantA.id },
      );

      expect(tenantAdminCanManage).toBe(false);
      expect(teamLeadCanManage).toBe(false);
    });

    it('ALLOW: TENANT_OWNER can manage billing', async () => {
      const canManage = await rbacService.canPerformAction(
        tenantOwnerId,
        'manage_billing',
        { tenantId: tenantA.id },
      );

      expect(canManage).toBe(true);
    });
  });

  describe('6. GET /rbac/assignments/effective Endpoint', () => {
    it('should return effective permissions for current user', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${tenantAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId', tenantAdminId);
      expect(response.body).toHaveProperty('isSuperuser', false);
      expect(response.body).toHaveProperty('scopes');
      expect(Array.isArray(response.body.scopes)).toBe(true);

      const scope = response.body.scopes.find((s: any) => s.tenantId === tenantA.id);
      expect(scope).toBeDefined();
      expect(scope).toHaveProperty('effectiveRoles');
      expect(scope).toHaveProperty('actionsAllowed');
      expect(scope).toHaveProperty('actionsDenied');
      expect(scope.effectiveRoles).toContain('TENANT_ADMIN');
    });

    it('should filter by tenantId query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      expect(response.body.scopes.length).toBeGreaterThan(0);
      
      // All scopes should be for Tenant A
      response.body.scopes.forEach((scope: any) => {
        expect(scope.tenantId).toBe(tenantA.id);
      });
    });

    it('should filter by teamId query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .query({ tenantId: tenantA.id, teamId: teamA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes.find((s: any) => s.teamId === teamA.id);
      expect(scope).toBeDefined();
      expect(scope.effectiveRoles).toContain('TEAM_LEAD');
    });

    it('should return consistent results with rbac.ts switch logic', async () => {
      const response = await request(app.getHttpServer())
        .get('/rbac/assignments/effective')
        .set('Authorization', `Bearer ${tenantOwnerToken}`)
        .query({ tenantId: tenantA.id });

      expect(response.status).toBe(200);
      
      const scope = response.body.scopes[0];
      
      // TENANT_OWNER should have all non-platform actions allowed
      expect(scope.actionsAllowed).toContain('view_okr');
      expect(scope.actionsAllowed).toContain('edit_okr');
      expect(scope.actionsAllowed).toContain('delete_okr');
      expect(scope.actionsAllowed).toContain('create_okr');
      expect(scope.actionsAllowed).toContain('publish_okr');
      expect(scope.actionsAllowed).toContain('manage_users');
      expect(scope.actionsAllowed).toContain('manage_billing');
      expect(scope.actionsAllowed).toContain('manage_workspaces');
      expect(scope.actionsAllowed).toContain('manage_teams');
      expect(scope.actionsAllowed).toContain('manage_tenant_settings');
      expect(scope.actionsAllowed).toContain('export_data');

      // TENANT_OWNER cannot impersonate (only SUPERUSER)
      expect(scope.actionsDenied).toContain('impersonate_user');
    });
  });
});

