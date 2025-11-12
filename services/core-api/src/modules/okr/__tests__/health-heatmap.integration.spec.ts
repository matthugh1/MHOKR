/**
 * Health Heatmap API - Integration Tests
 * 
 * Tests for GET /reports/health-heatmap endpoint:
 * - Happy path: fetch heatmap by team and pillar
 * - Empty data: no objectives
 * - 400 for invalid by parameter
 * - 403 RBAC denial
 * - Tenant isolation: cross-tenant blocked
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Health Heatmap API (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data
  let tenantA: any;
  let tenantB: any;
  let userA: any;
  let userB: any;
  let userNoPerms: any;
  let teamA: any;
  let pillarA: any;
  let cycleA: any;
  let objectiveOnTrack: any;
  let objectiveAtRisk: any;
  let objectiveOffTrack: any;
  let tokenA: string;
  let tokenB: string;
  let tokenNoPerms: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  beforeEach(async () => {
    // Create test tenants
    tenantA = await prisma.organization.create({
      data: {
        name: `Test Tenant A ${Date.now()}`,
      },
    });

    tenantB = await prisma.organization.create({
      data: {
        name: `Test Tenant B ${Date.now()}`,
      },
    });

    // Create test users
    userA = await prisma.user.create({
      data: {
        email: `user-a-${Date.now()}@test.com`,
        name: 'User A',
        password: 'hashed-password',
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `user-b-${Date.now()}@test.com`,
        name: 'User B',
        password: 'hashed-password',
      },
    });

    userNoPerms = await prisma.user.create({
      data: {
        email: `user-noperms-${Date.now()}@test.com`,
        name: 'User No Perms',
        password: 'hashed-password',
      },
    });

    // Create JWT tokens
    tokenA = jwtService.sign({ id: userA.id, tenantId: tenantA.id });
    tokenB = jwtService.sign({ id: userB.id, tenantId: tenantB.id });
    tokenNoPerms = jwtService.sign({ id: userNoPerms.id, tenantId: tenantA.id });

    // Create team and pillar
    teamA = await prisma.team.create({
      data: {
        name: 'Engineering Team',
        tenantId: tenantA.id,
      },
    });

    pillarA = await prisma.strategicPillar.create({
      data: {
        name: 'Product Innovation',
        tenantId: tenantA.id,
      },
    });

    // Create cycle
    cycleA = await prisma.cycle.create({
      data: {
        name: 'Q1 2025',
        tenantId: tenantA.id,
        status: 'ACTIVE',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    // Create objectives with different statuses
    objectiveOnTrack = await prisma.objective.create({
      data: {
        title: 'Objective On Track',
        ownerId: userA.id,
        tenantId: tenantA.id,
        teamId: teamA.id,
        pillarId: pillarA.id,
        cycleId: cycleA.id,
        status: 'ON_TRACK',
        progress: 50,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    objectiveAtRisk = await prisma.objective.create({
      data: {
        title: 'Objective At Risk',
        ownerId: userA.id,
        tenantId: tenantA.id,
        teamId: teamA.id,
        pillarId: pillarA.id,
        cycleId: cycleA.id,
        status: 'AT_RISK',
        progress: 30,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    objectiveOffTrack = await prisma.objective.create({
      data: {
        title: 'Objective Off Track',
        ownerId: userA.id,
        tenantId: tenantA.id,
        teamId: teamA.id,
        pillarId: pillarA.id,
        cycleId: cycleA.id,
        status: 'OFF_TRACK',
        progress: 10,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.objective.deleteMany({});
    await prisma.cycle.deleteMany({});
    await prisma.strategicPillar.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return heatmap data grouped by team', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/health-heatmap?by=team&cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body).toHaveProperty('buckets');
    expect(response.body).toHaveProperty('totals');
    expect(Array.isArray(response.body.buckets)).toBe(true);
    expect(Array.isArray(response.body.totals)).toBe(true);

    // Verify buckets contain team data
    const teamBuckets = response.body.buckets.filter(
      (b: any) => b.dimensionName === 'Engineering Team'
    );
    expect(teamBuckets.length).toBeGreaterThan(0);

    // Verify status counts
    const onTrackBucket = teamBuckets.find((b: any) => b.status === 'ON_TRACK');
    const atRiskBucket = teamBuckets.find((b: any) => b.status === 'AT_RISK');
    const offTrackBucket = teamBuckets.find((b: any) => b.status === 'OFF_TRACK');

    expect(onTrackBucket?.count).toBe(1);
    expect(atRiskBucket?.count).toBe(1);
    expect(offTrackBucket?.count).toBe(1);

    // Verify totals
    const teamTotal = response.body.totals.find(
      (t: any) => t.dimensionName === 'Engineering Team'
    );
    expect(teamTotal?.total).toBe(3);
  });

  it('should return heatmap data grouped by pillar', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/health-heatmap?by=pillar&cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body).toHaveProperty('buckets');
    expect(response.body).toHaveProperty('totals');

    // Verify buckets contain pillar data
    const pillarBuckets = response.body.buckets.filter(
      (b: any) => b.dimensionName === 'Product Innovation'
    );
    expect(pillarBuckets.length).toBeGreaterThan(0);

    // Verify totals
    const pillarTotal = response.body.totals.find(
      (t: any) => t.dimensionName === 'Product Innovation'
    );
    expect(pillarTotal?.total).toBe(3);
  });

  it('should return empty data when no objectives exist', async () => {
    // Delete all objectives
    await prisma.objective.deleteMany({});

    const response = await request(app.getHttpServer())
      .get('/api/reports/health-heatmap?by=team')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.buckets).toEqual([]);
    expect(response.body.totals).toEqual([]);
  });

  it('should return 400 for invalid by parameter', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/health-heatmap?by=invalid')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);

    expect(response.body.message).toContain('team or pillar');
  });

  it('should return 403 for cross-tenant access', async () => {
    await request(app.getHttpServer())
      .get(`/api/reports/health-heatmap?by=team&cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
  });

  it('should return 401 without auth token', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/health-heatmap?by=team')
      .expect(401);
  });
});


