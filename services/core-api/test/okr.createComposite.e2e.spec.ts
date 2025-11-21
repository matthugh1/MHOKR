/**
 * W5.M1: Composite OKR Creation - Integration Tests (E2E)
 * 
 * End-to-end integration tests for POST /okr/create-composite endpoint:
 * - Happy path with PUBLIC_TENANT
 * - PRIVATE objective with whitelist visibility enforcement
 * - Rate limit enforcement
 * - Visibility inheritance for Key Results
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

describe('POST /okr/create-composite - W5.M1 Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let configService: ConfigService;

  // Test data fixtures
  let tenantAdminUser: any;
  let workspaceLeadUser: any;
  let contributorUser: any;
  let testOrg: any;
  let activeCycle: any;
  let lockedCycle: any;
  let adminToken: string;
  let leadToken: string;
  let contributorToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Create test fixtures
    testOrg = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org',
      },
    });

    tenantAdminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        name: 'Admin User',
        password: 'hashed-password',
      },
    });

    workspaceLeadUser = await prisma.user.create({
      data: {
        email: 'lead@test.com',
        name: 'Lead User',
        password: 'hashed-password',
      },
    });

    contributorUser = await prisma.user.create({
      data: {
        email: 'contributor@test.com',
        name: 'Contributor User',
        password: 'hashed-password',
      },
    });

    // Assign roles
    await prisma.roleAssignment.create({
      data: {
        userId: tenantAdminUser.id,
        role: 'TENANT_ADMIN',
        scopeType: 'TENANT',
        scopeId: testOrg.id,
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: workspaceLeadUser.id,
        role: 'WORKSPACE_LEAD',
        scopeType: 'TENANT',
        scopeId: testOrg.id,
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: contributorUser.id,
        role: 'CONTRIBUTOR',
        scopeType: 'TENANT',
        scopeId: testOrg.id,
      },
    });

    // Create cycles
    activeCycle = await prisma.cycle.create({
      data: {
        name: 'Q1 2025',
        organizationId: testOrg.id,
        status: 'ACTIVE',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    lockedCycle = await prisma.cycle.create({
      data: {
        name: 'Q4 2024',
        organizationId: testOrg.id,
        status: 'LOCKED',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-12-31'),
      },
    });

    // Generate JWT tokens using JWT_SECRET
    const jwtSecret = configService.get<string>('JWT_SECRET') || 'default-secret';
    
    adminToken = jwt.sign(
      {
        sub: tenantAdminUser.id,
        email: tenantAdminUser.email,
        organizationId: testOrg.id,
      },
      jwtSecret,
      { expiresIn: '24h' },
    );

    leadToken = jwt.sign(
      {
        sub: workspaceLeadUser.id,
        email: workspaceLeadUser.email,
        organizationId: testOrg.id,
      },
      jwtSecret,
      { expiresIn: '24h' },
    );

    contributorToken = jwt.sign(
      {
        sub: contributorUser.id,
        email: contributorUser.email,
        organizationId: testOrg.id,
      },
      jwtSecret,
      { expiresIn: '24h' },
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.objectiveKeyResult.deleteMany({
      where: { objective: { organizationId: testOrg.id } },
    });
    await prisma.keyResult.deleteMany({
      where: { objectives: { some: { objective: { organizationId: testOrg.id } } } },
    });
    await prisma.objective.deleteMany({
      where: { organizationId: testOrg.id },
    });
    await prisma.roleAssignment.deleteMany({
      where: { scopeId: testOrg.id },
    });
    await prisma.cycle.deleteMany({
      where: { organizationId: testOrg.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [tenantAdminUser.id, workspaceLeadUser.id, contributorUser.id] } },
    });
    await prisma.organization.delete({
      where: { id: testOrg.id },
    });

    await app.close();
  });

  describe('Happy Path - PUBLIC_TENANT', () => {
    it('should create objective + KR and return 200 with ids, then appear in /okr/overview page 1', async () => {
      const payload = {
        objective: {
          title: 'Reduce churn Q1',
          ownerUserId: tenantAdminUser.id,
          cycleId: activeCycle.id,
          visibilityLevel: 'PUBLIC_TENANT',
          goalType: 'COMMITTED',
        },
        keyResults: [
          {
            title: 'NRR ≥ 110%',
            metricType: 'PERCENT',
            targetValue: 110,
            ownerUserId: tenantAdminUser.id,
            startValue: 100,
            updateCadence: 'MONTHLY',
            goalType: 'COMMITTED',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/okr/create-composite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      expect(response.body).toMatchObject({
        objectiveId: expect.any(String),
        keyResultIds: expect.arrayContaining([expect.any(String)]),
        publishState: 'PUBLISHED',
        status: 'ON_TRACK',
        visibilityLevel: 'PUBLIC_TENANT',
      });

      const objectiveId = response.body.objectiveId;

      // Verify it appears in /okr/overview page 1
      const overviewResponse = await request(app.getHttpServer())
        .get(`/okr/overview?organizationId=${testOrg.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const createdObjective = overviewResponse.body.objectives.find(
        (o: any) => o.objectiveId === objectiveId,
      );

      expect(createdObjective).toBeDefined();
      expect(createdObjective.title).toBe('Reduce churn Q1');
      expect(createdObjective.publishState).toBe('PUBLISHED');
      expect(createdObjective.status).toBe('ON_TRACK');
      expect(createdObjective.goalType).toBe('COMMITTED');
      expect(createdObjective.keyResults).toHaveLength(1);
      expect(createdObjective.keyResults[0].title).toBe('NRR ≥ 110%');
      expect(createdObjective.keyResults[0].goalType).toBe('COMMITTED');
      // Verify createdBy is auto-populated
      expect(createdObjective.createdBy).toBe(tenantAdminUser.id);
    });
  });

  describe('Viva Goals Features', () => {
    it('should create Objective with NOT_STARTED status', async () => {
      const payload = {
        objective: {
          title: 'New Objective Not Started',
          ownerUserId: tenantAdminUser.id,
          cycleId: activeCycle.id,
          visibilityLevel: 'PUBLIC_TENANT',
          status: 'NOT_STARTED',
          goalType: 'ASPIRATIONAL',
        },
        keyResults: [],
      };

      const response = await request(app.getHttpServer())
        .post('/okr/create-composite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      expect(response.body.status).toBe('NOT_STARTED');
      expect(response.body.goalType).toBe('ASPIRATIONAL');
    });

    it('should create Key Result with teamId', async () => {
      // Create a team first
      const testWorkspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          tenantId: testOrg.id,
        },
      });

      const testTeam = await prisma.team.create({
        data: {
          name: 'Test Team',
          workspaceId: testWorkspace.id,
        },
      });

      const payload = {
        objective: {
          title: 'Objective with Team KR',
          ownerUserId: tenantAdminUser.id,
          cycleId: activeCycle.id,
          visibilityLevel: 'PUBLIC_TENANT',
        },
        keyResults: [
          {
            title: 'KR with Team',
            metricType: 'PERCENT',
            targetValue: 100,
            ownerUserId: tenantAdminUser.id,
            startValue: 0,
            teamId: testTeam.id,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/okr/create-composite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      const kr = await prisma.keyResult.findUnique({
        where: { id: response.body.keyResultIds[0] },
      });

      expect(kr?.teamId).toBe(testTeam.id);

      // Cleanup
      await prisma.objective.delete({ where: { id: response.body.objectiveId } });
      await prisma.team.delete({ where: { id: testTeam.id } });
      await prisma.workspace.delete({ where: { id: testWorkspace.id } });
    });

    it('should create Initiative with goalType, teamId, and progress', async () => {
      const objective = await prisma.objective.create({
        data: {
          title: 'Parent Objective',
          ownerId: tenantAdminUser.id,
          tenantId: testOrg.id,
          cycleId: activeCycle.id,
          status: 'ON_TRACK',
          progress: 0,
        },
      });

      const testWorkspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          tenantId: testOrg.id,
        },
      });

      const testTeam = await prisma.team.create({
        data: {
          name: 'Test Team',
          workspaceId: testWorkspace.id,
        },
      });

      const payload = {
        title: 'Test Initiative',
        objectiveId: objective.id,
        ownerId: tenantAdminUser.id,
        goalType: 'COMMITTED',
        teamId: testTeam.id,
        progress: 75,
      };

      const response = await request(app.getHttpServer())
        .post('/initiatives')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      expect(response.body.goalType).toBe('COMMITTED');
      expect(response.body.teamId).toBe(testTeam.id);
      expect(response.body.progress).toBe(75);
      expect(response.body.createdBy).toBe(tenantAdminUser.id);

      // Cleanup
      await prisma.initiative.delete({ where: { id: response.body.id } });
      await prisma.team.delete({ where: { id: testTeam.id } });
      await prisma.workspace.delete({ where: { id: testWorkspace.id } });
      await prisma.objective.delete({ where: { id: objective.id } });
    });
  });

  describe('PRIVATE Visibility with Whitelist', () => {
    it('should create PRIVATE objective visible only to whitelisted users and admins', async () => {
      const payload = {
        objective: {
          title: 'Board plan',
          ownerUserId: tenantAdminUser.id,
          cycleId: activeCycle.id,
          visibilityLevel: 'PRIVATE',
          whitelistUserIds: [workspaceLeadUser.id],
        },
        keyResults: [
          {
            title: 'Close Series B',
            metricType: 'BOOLEAN',
            targetValue: true,
            ownerUserId: tenantAdminUser.id,
            updateCadence: 'MONTHLY',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/okr/create-composite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      const objectiveId = response.body.objectiveId;

      // Admin should see it
      const adminOverview = await request(app.getHttpServer())
        .get(`/okr/overview?organizationId=${testOrg.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminSeesObjective = adminOverview.body.objectives.find(
        (o: any) => o.objectiveId === objectiveId,
      );
      expect(adminSeesObjective).toBeDefined();

      // Whitelisted user should see it
      const leadOverview = await request(app.getHttpServer())
        .get(`/okr/overview?organizationId=${testOrg.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${leadToken}`)
        .expect(200);

      const leadSeesObjective = leadOverview.body.objectives.find(
        (o: any) => o.objectiveId === objectiveId,
      );
      expect(leadSeesObjective).toBeDefined();

      // Non-whitelisted contributor should NOT see it
      const contributorOverview = await request(app.getHttpServer())
        .get(`/okr/overview?organizationId=${testOrg.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);

      const contributorSeesObjective = contributorOverview.body.objectives.find(
        (o: any) => o.objectiveId === objectiveId,
      );
      expect(contributorSeesObjective).toBeUndefined();
    });
  });

  describe('Visibility Inheritance - Key Results', () => {
    it('should hide Key Results when parent Objective is not visible', async () => {
      // Create a PRIVATE objective with whitelist
      const payload = {
        objective: {
          title: 'Exec strategy',
          ownerUserId: tenantAdminUser.id,
          cycleId: activeCycle.id,
          visibilityLevel: 'PRIVATE',
          whitelistUserIds: [workspaceLeadUser.id],
        },
        keyResults: [
          {
            title: 'Secure partnerships',
            metricType: 'NUMERIC',
            targetValue: 5,
            ownerUserId: tenantAdminUser.id,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/okr/create-composite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      const objectiveId = response.body.objectiveId;

      // Non-whitelisted contributor should NOT see the objective or its KRs
      const contributorOverview = await request(app.getHttpServer())
        .get(`/okr/overview?organizationId=${testOrg.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);

      const contributorSeesObjective = contributorOverview.body.objectives.find(
        (o: any) => o.objectiveId === objectiveId,
      );
      expect(contributorSeesObjective).toBeUndefined();

      // Even if we query directly, KRs should be hidden
      const allObjectives = contributorOverview.body.objectives;
      const allKRs = allObjectives.flatMap((o: any) => o.keyResults || []);
      const hiddenKR = allKRs.find((kr: any) => kr.title === 'Secure partnerships');
      expect(hiddenKR).toBeUndefined();
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should return 429 after 30 requests per minute', async () => {
      const payload = {
        objective: {
          title: 'Rate limit test',
          ownerUserId: tenantAdminUser.id,
          cycleId: activeCycle.id,
          visibilityLevel: 'PUBLIC_TENANT',
        },
        keyResults: [
          {
            title: 'Test KR',
            metricType: 'NUMERIC',
            targetValue: 1,
            ownerUserId: tenantAdminUser.id,
          },
        ],
      };

      // Make 31 requests rapidly
      const requests = Array.from({ length: 31 }, () =>
        request(app.getHttpServer())
          .post('/okr/create-composite')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload),
      );

      const responses = await Promise.allSettled(requests);

      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429,
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000); // Extended timeout for rate limit test
  });

  describe('Governance - Cycle Lock', () => {
    it('should return 403 if non-admin tries to create in LOCKED cycle', async () => {
      const payload = {
        objective: {
          title: 'Should fail',
          ownerUserId: workspaceLeadUser.id,
          cycleId: lockedCycle.id,
          visibilityLevel: 'PUBLIC_TENANT',
        },
        keyResults: [
          {
            title: 'x',
            metricType: 'NUMERIC',
            targetValue: 1,
            ownerUserId: workspaceLeadUser.id,
            updateCadence: 'WEEKLY',
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/okr/create-composite')
        .set('Authorization', `Bearer ${leadToken}`)
        .send(payload)
        .expect(403);
    });

    it('should allow admin to create in LOCKED cycle', async () => {
      const payload = {
        objective: {
          title: 'Admin can create',
          ownerUserId: tenantAdminUser.id,
          cycleId: lockedCycle.id,
          visibilityLevel: 'PUBLIC_TENANT',
        },
        keyResults: [
          {
            title: 'Admin KR',
            metricType: 'NUMERIC',
            targetValue: 1,
            ownerUserId: tenantAdminUser.id,
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/okr/create-composite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);
    });
  });
});

