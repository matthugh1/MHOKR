/**
 * Cycle Health API - Integration Tests
 * 
 * Tests for GET /reports/cycle-health endpoint:
 * - Happy path: returns all four KPIs
 * - Totals by status calculation
 * - Average confidence calculation
 * - Coverage percentages calculation
 * - Empty cycle handling
 * - 403 RBAC denial
 * - Tenant isolation: cross-tenant blocked
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Cycle Health API (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data
  let tenantA: any;
  let tenantB: any;
  let userA: any;
  let userB: any;
  let cycleA: any;
  let objective1: any;
  let objective2: any;
  let kr1: any;
  let kr2: any;
  let kr3: any;
  let tokenA: string;
  let tokenB: string;

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

    // Create JWT tokens
    tokenA = jwtService.sign({ id: userA.id, tenantId: tenantA.id });
    tokenB = jwtService.sign({ id: userB.id, tenantId: tenantB.id });

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

    // Create objectives
    objective1 = await prisma.objective.create({
      data: {
        title: 'Objective 1',
        ownerId: userA.id,
        tenantId: tenantA.id,
        cycleId: cycleA.id,
        status: 'ON_TRACK',
        progress: 50,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    objective2 = await prisma.objective.create({
      data: {
        title: 'Objective 2',
        ownerId: userA.id,
        tenantId: tenantA.id,
        cycleId: cycleA.id,
        status: 'AT_RISK',
        progress: 30,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    // Create key results
    kr1 = await prisma.keyResult.create({
      data: {
        title: 'KR 1',
        ownerId: userA.id,
        tenantId: tenantA.id,
        metricType: 'PERCENTAGE',
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        progress: 50,
        status: 'ON_TRACK',
      },
    });

    kr2 = await prisma.keyResult.create({
      data: {
        title: 'KR 2',
        ownerId: userA.id,
        tenantId: tenantA.id,
        metricType: 'PERCENTAGE',
        startValue: 0,
        targetValue: 100,
        currentValue: 30,
        progress: 30,
        status: 'AT_RISK',
      },
    });

    kr3 = await prisma.keyResult.create({
      data: {
        title: 'KR 3',
        ownerId: userA.id,
        tenantId: tenantA.id,
        metricType: 'PERCENTAGE',
        startValue: 0,
        targetValue: 100,
        currentValue: 70,
        progress: 70,
        status: 'ON_TRACK',
      },
    });

    // Link KRs to objectives
    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: objective1.id,
        keyResultId: kr1.id,
      },
    });

    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: objective1.id,
        keyResultId: kr2.id,
      },
    });

    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: objective2.id,
        keyResultId: kr3.id,
      },
    });

    // Create check-ins with confidence values
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

    await prisma.checkIn.create({
      data: {
        keyResultId: kr1.id,
        userId: userA.id,
        value: 50,
        confidence: 80,
        createdAt: tenDaysAgo, // Within last 14 days
      },
    });

    await prisma.checkIn.create({
      data: {
        keyResultId: kr2.id,
        userId: userA.id,
        value: 30,
        confidence: 60,
        createdAt: tenDaysAgo, // Within last 14 days
      },
    });

    await prisma.checkIn.create({
      data: {
        keyResultId: kr3.id,
        userId: userA.id,
        value: 70,
        confidence: 70,
        createdAt: twentyDaysAgo, // Outside last 14 days
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.checkIn.deleteMany({});
    await prisma.objectiveKeyResult.deleteMany({});
    await prisma.keyResult.deleteMany({});
    await prisma.objective.deleteMany({});
    await prisma.cycle.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return cycle health summary with all KPIs', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/cycle-health?cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body).toHaveProperty('totalsByStatus');
    expect(response.body).toHaveProperty('avgConfidence');
    expect(response.body).toHaveProperty('coverage');

    // Check totals by status
    expect(response.body.totalsByStatus.ON_TRACK).toBe(1);
    expect(response.body.totalsByStatus.AT_RISK).toBe(1);

    // Check average confidence (80 + 60 + 70) / 3 = 70
    expect(response.body.avgConfidence).toBeCloseTo(70, 1);

    // Check coverage: objective1 has 2 KRs, objective2 has 1 KR
    // So 1 out of 2 objectives has ≥2 KRs = 50%
    expect(response.body.coverage.objectivesWith2PlusKRsPct).toBeCloseTo(50, 1);

    // Check-in coverage: kr1 and kr2 have check-ins within 14 days, kr3 does not
    // So 2 out of 3 KRs = 66.67%
    expect(response.body.coverage.krsWithRecentCheckInPct).toBeCloseTo(66.67, 1);
  });

  it('should return 400 if cycleId is missing', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/cycle-health')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
  });

  it('should return empty data for empty cycle', async () => {
    // Create empty cycle
    const emptyCycle = await prisma.cycle.create({
      data: {
        name: 'Empty Cycle',
        tenantId: tenantA.id,
        status: 'ACTIVE',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-06-30'),
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/reports/cycle-health?cycleId=${emptyCycle.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.totalsByStatus.ON_TRACK).toBe(0);
    expect(response.body.totalsByStatus.AT_RISK).toBe(0);
    expect(response.body.avgConfidence).toBeNull();
    expect(response.body.coverage.objectivesWith2PlusKRsPct).toBe(0);
    expect(response.body.coverage.krsWithRecentCheckInPct).toBe(0);

    // Cleanup
    await prisma.cycle.delete({ where: { id: emptyCycle.id } });
  });

  it('should return 403 for cross-tenant access', async () => {
    await request(app.getHttpServer())
      .get(`/api/reports/cycle-health?cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
  });

  it('should return 401 without auth token', async () => {
    await request(app.getHttpServer())
      .get(`/api/reports/cycle-health?cycleId=${cycleA.id}`)
      .expect(401);
  });
});


