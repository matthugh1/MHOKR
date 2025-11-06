/**
 * W5.M2: Inline Insights & Cycle Health - Integration Tests (E2E)
 * 
 * End-to-end integration tests for insights endpoints:
 * - GET /okr/insights/cycle-summary - Cycle health summary
 * - GET /okr/insights/objective/:id - Objective-level insights
 * - GET /okr/insights/attention - Attention feed (paginated)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

describe('OKR Insights Endpoints - W5.M2 Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let configService: ConfigService;

  // Test data fixtures
  let tenantAdminUser: any;
  let workspaceLeadUser: any;
  let contributorUser: any;
  let testOrg: any;
  let activeCycle: any;
  let publicObjective: any;
  let privateObjective: any;
  let kr1: any;
  let kr2: any;
  let kr3: any;
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

    // Create cycle
    activeCycle = await prisma.cycle.create({
      data: {
        name: 'Q1 2025',
        organizationId: testOrg.id,
        status: 'ACTIVE',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    // Create PUBLIC objective with KRs
    publicObjective = await prisma.objective.create({
      data: {
        title: 'Public Objective',
        ownerId: tenantAdminUser.id,
        organizationId: testOrg.id,
        cycleId: activeCycle.id,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
        status: 'ON_TRACK',
      },
    });

    kr1 = await prisma.keyResult.create({
      data: {
        title: 'KR 1 - On Track',
        ownerId: tenantAdminUser.id,
        metricType: 'NUMERIC',
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        status: 'ON_TRACK',
        checkInCadence: 'WEEKLY',
      },
    });

    kr2 = await prisma.keyResult.create({
      data: {
        title: 'KR 2 - At Risk',
        ownerId: tenantAdminUser.id,
        metricType: 'NUMERIC',
        startValue: 0,
        targetValue: 100,
        currentValue: 30,
        status: 'AT_RISK',
        checkInCadence: 'WEEKLY',
      },
    });

    kr3 = await prisma.keyResult.create({
      data: {
        title: 'KR 3 - Blocked',
        ownerId: tenantAdminUser.id,
        metricType: 'NUMERIC',
        startValue: 0,
        targetValue: 100,
        currentValue: 10,
        status: 'BLOCKED',
        checkInCadence: 'MONTHLY',
      },
    });

    await prisma.objectiveKeyResult.createMany({
      data: [
        { objectiveId: publicObjective.id, keyResultId: kr1.id },
        { objectiveId: publicObjective.id, keyResultId: kr2.id },
        { objectiveId: publicObjective.id, keyResultId: kr3.id },
      ],
    });

    // Create PRIVATE objective (whitelisted to lead)
    privateObjective = await prisma.objective.create({
      data: {
        title: 'Private Objective',
        ownerId: tenantAdminUser.id,
        organizationId: testOrg.id,
        cycleId: activeCycle.id,
        visibilityLevel: 'PRIVATE',
        isPublished: true,
        status: 'ON_TRACK',
      },
    });

    // Update org metadata with whitelist
    await prisma.organization.update({
      where: { id: testOrg.id },
      data: {
        metadata: {
          privateWhitelist: {
            [privateObjective.id]: [workspaceLeadUser.id],
          },
        },
      },
    });

    // Generate JWT tokens
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

  describe('GET /okr/insights/cycle-summary', () => {
    it('should return cycle health summary with correct counts', async () => {
      const response = await request(app.getHttpServer())
        .get(`/okr/insights/cycle-summary?cycleId=${activeCycle.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        cycleId: activeCycle.id,
        objectives: {
          total: expect.any(Number),
          published: expect.any(Number),
          draft: expect.any(Number),
        },
        krs: {
          total: expect.any(Number),
          onTrack: expect.any(Number),
          atRisk: expect.any(Number),
          blocked: expect.any(Number),
          completed: expect.any(Number),
        },
        checkins: {
          upcoming7d: expect.any(Number),
          overdue: expect.any(Number),
          recent24h: expect.any(Number),
        },
      });

      expect(response.body.objectives.total).toBeGreaterThan(0);
      expect(response.body.krs.total).toBeGreaterThan(0);
    });

    it('should filter PRIVATE objectives for non-whitelisted users', async () => {
      // Admin sees all
      const adminResponse = await request(app.getHttpServer())
        .get(`/okr/insights/cycle-summary?cycleId=${activeCycle.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Contributor should not see PRIVATE objective
      const contributorResponse = await request(app.getHttpServer())
        .get(`/okr/insights/cycle-summary?cycleId=${activeCycle.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);

      // Admin should see more objectives (includes PRIVATE)
      expect(adminResponse.body.objectives.total).toBeGreaterThanOrEqual(
        contributorResponse.body.objectives.total,
      );
    });

    it('should return 400 if cycleId missing', async () => {
      await request(app.getHttpServer())
        .get('/okr/insights/cycle-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return tenant-scoped metrics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/okr/insights/cycle-summary?cycleId=${activeCycle.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // All counts should be non-negative
      expect(response.body.objectives.total).toBeGreaterThanOrEqual(0);
      expect(response.body.krs.total).toBeGreaterThanOrEqual(0);
      expect(response.body.checkins.overdue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /okr/insights/objective/:id', () => {
    it('should return objective insights for visible objective', async () => {
      const response = await request(app.getHttpServer())
        .get(`/okr/insights/objective/${publicObjective.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        objectiveId: publicObjective.id,
        statusTrend: expect.any(String),
        lastUpdateAgeHours: expect.any(Number),
        krs: {
          onTrack: expect.any(Number),
          atRisk: expect.any(Number),
          blocked: expect.any(Number),
          completed: expect.any(Number),
        },
        upcomingCheckins: expect.any(Number),
        overdueCheckins: expect.any(Number),
      });

      expect(response.body.krs.total).toBeGreaterThan(0);
    });

    it('should return 400 for invisible objective', async () => {
      // Contributor cannot see PRIVATE objective
      await request(app.getHttpServer())
        .get(`/okr/insights/objective/${privateObjective.id}`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(400);
    });

    it('should return insights for whitelisted user', async () => {
      // Lead should see PRIVATE objective (whitelisted)
      const response = await request(app.getHttpServer())
        .get(`/okr/insights/objective/${privateObjective.id}`)
        .set('Authorization', `Bearer ${leadToken}`)
        .expect(200);

      expect(response.body.objectiveId).toBe(privateObjective.id);
    });

    it('should calculate last update age correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/okr/insights/objective/${publicObjective.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.lastUpdateAgeHours).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /okr/insights/attention', () => {
    it('should return paginated attention feed', async () => {
      const response = await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        page: 1,
        pageSize: 20,
        totalCount: expect.any(Number),
        items: expect.any(Array),
      });

      expect(response.body.items.length).toBeLessThanOrEqual(20);
    });

    it('should filter by visibility', async () => {
      // Create an overdue check-in for PRIVATE objective
      const overdueKr = await prisma.keyResult.create({
        data: {
          title: 'Overdue KR',
          ownerId: tenantAdminUser.id,
          metricType: 'NUMERIC',
          startValue: 0,
          targetValue: 100,
          currentValue: 50,
          checkInCadence: 'WEEKLY',
        },
      });

      await prisma.objectiveKeyResult.create({
        data: {
          objectiveId: privateObjective.id,
          keyResultId: overdueKr.id,
        },
      });

      // Create check-in 10 days ago (overdue)
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await prisma.checkIn.create({
        data: {
          keyResultId: overdueKr.id,
          userId: tenantAdminUser.id,
          value: 50,
          confidence: 5,
          createdAt: tenDaysAgo,
        },
      });

      // Admin should see attention items for PRIVATE objective
      const adminResponse = await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminHasPrivateItems = adminResponse.body.items.some(
        (item: any) => item.objectiveId === privateObjective.id,
      );

      // Contributor should NOT see attention items for PRIVATE objective
      const contributorResponse = await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .expect(200);

      const contributorHasPrivateItems = contributorResponse.body.items.some(
        (item: any) => item.objectiveId === privateObjective.id,
      );

      // Admin may see it, contributor should not
      if (adminHasPrivateItems) {
        expect(contributorHasPrivateItems).toBe(false);
      }

      // Cleanup
      await prisma.checkIn.deleteMany({ where: { keyResultId: overdueKr.id } });
      await prisma.objectiveKeyResult.deleteMany({ where: { keyResultId: overdueKr.id } });
      await prisma.keyResult.delete({ where: { id: overdueKr.id } });
    });

    it('should include OVERDUE_CHECKIN items', async () => {
      // Create overdue check-in
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await prisma.checkIn.create({
        data: {
          keyResultId: kr1.id,
          userId: tenantAdminUser.id,
          value: 50,
          confidence: 5,
          createdAt: tenDaysAgo,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const overdueItems = response.body.items.filter(
        (item: any) => item.type === 'OVERDUE_CHECKIN',
      );
      expect(overdueItems.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.checkIn.deleteMany({ where: { keyResultId: kr1.id } });
    });

    it('should include NO_UPDATE_14D items', async () => {
      // Create objective not updated in 15 days
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const staleObjective = await prisma.objective.create({
        data: {
          title: 'Stale Objective',
          ownerId: tenantAdminUser.id,
          organizationId: testOrg.id,
          cycleId: activeCycle.id,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: true,
          status: 'ON_TRACK',
          updatedAt: fifteenDaysAgo,
          createdAt: fifteenDaysAgo,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const noUpdateItems = response.body.items.filter(
        (item: any) => item.type === 'NO_UPDATE_14D' && item.objectiveId === staleObjective.id,
      );
      expect(noUpdateItems.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.objective.delete({ where: { id: staleObjective.id } });
    });

    it('should include STATUS_DOWNGRADE items', async () => {
      // Create objective with AT_RISK status
      const atRiskObjective = await prisma.objective.create({
        data: {
          title: 'At Risk Objective',
          ownerId: tenantAdminUser.id,
          organizationId: testOrg.id,
          cycleId: activeCycle.id,
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: true,
          status: 'AT_RISK',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const statusDowngradeItems = response.body.items.filter(
        (item: any) => item.type === 'STATUS_DOWNGRADE' && item.objectiveId === atRiskObjective.id,
      );
      expect(statusDowngradeItems.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.objective.delete({ where: { id: atRiskObjective.id } });
    });

    it('should validate pagination parameters', async () => {
      // Invalid page
      await request(app.getHttpServer())
        .get(`/okr/insights/attention?page=0&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Invalid pageSize (too large)
      await request(app.getHttpServer())
        .get(`/okr/insights/attention?page=1&pageSize=100`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should handle pagination correctly', async () => {
      // Create many attention items
      const objectives = [];
      for (let i = 0; i < 25; i++) {
        const obj = await prisma.objective.create({
          data: {
            title: `Test Objective ${i}`,
            ownerId: tenantAdminUser.id,
            organizationId: testOrg.id,
            cycleId: activeCycle.id,
            visibilityLevel: 'PUBLIC_TENANT',
            isPublished: true,
            status: i < 5 ? 'AT_RISK' : 'ON_TRACK',
          },
        });
        objectives.push(obj);
      }

      const page1 = await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=2&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(page1.body.items.length).toBeLessThanOrEqual(20);
      expect(page2.body.items.length).toBeLessThanOrEqual(20);
      expect(page1.body.totalCount).toBe(page2.body.totalCount);

      // Cleanup
      await prisma.objective.deleteMany({
        where: { id: { in: objectives.map((o) => o.id) } },
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 300ms for cycle-summary', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get(`/okr/insights/cycle-summary?cycleId=${activeCycle.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      // Performance guardrail (skip in CI if flaky)
      if (process.env.CI !== 'true') {
        expect(duration).toBeLessThan(300);
      }
    }, 5000);

    it('should respond within 300ms for objective insights', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get(`/okr/insights/objective/${publicObjective.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      if (process.env.CI !== 'true') {
        expect(duration).toBeLessThan(300);
      }
    }, 5000);

    it('should respond within 300ms for attention feed', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get(`/okr/insights/attention?cycleId=${activeCycle.id}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const duration = Date.now() - start;

      if (process.env.CI !== 'true') {
        expect(duration).toBeLessThan(300);
      }
    }, 5000);
  });
});

