/**
 * At-Risk API - Integration Tests
 * 
 * Tests for GET /reports/at-risk endpoint:
 * - Happy path: fetch at-risk items by status and confidence
 * - Filter by cycleId, ownerId, teamId, pillarId
 * - Empty result when no at-risk items
 * - 403 RBAC denial
 * - Tenant isolation: cross-tenant blocked
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('At-Risk API (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data
  let tenantA: any;
  let tenantB: any;
  let userA: any;
  let userB: any;
  let teamA: any;
  let pillarA: any;
  let cycleA: any;
  let objectiveAtRisk: any;
  let objectiveOnTrack: any;
  let krAtRisk: any;
  let krLowConfidence: any;
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

    // Create objectives
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

    objectiveOnTrack = await prisma.objective.create({
      data: {
        title: 'Objective On Track',
        ownerId: userA.id,
        tenantId: tenantA.id,
        teamId: teamA.id,
        pillarId: pillarA.id,
        cycleId: cycleA.id,
        status: 'ON_TRACK',
        progress: 70,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    // Create key results
    krAtRisk = await prisma.keyResult.create({
      data: {
        title: 'KR At Risk',
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

    krLowConfidence = await prisma.keyResult.create({
      data: {
        title: 'KR Low Confidence',
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

    // Link KRs to objectives
    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: objectiveOnTrack.id,
        keyResultId: krAtRisk.id,
      },
    });

    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: objectiveOnTrack.id,
        keyResultId: krLowConfidence.id,
      },
    });

    // Create check-in with low confidence
    await prisma.checkIn.create({
      data: {
        keyResultId: krLowConfidence.id,
        userId: userA.id,
        value: 50,
        confidence: 40, // Below threshold of 50
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
    await prisma.strategicPillar.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return at-risk items by status', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/at-risk?cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);

    // Should include objective with AT_RISK status
    const atRiskObjective = response.body.find(
      (item: any) => item.entityType === 'OBJECTIVE' && item.status === 'AT_RISK'
    );
    expect(atRiskObjective).toBeDefined();
    expect(atRiskObjective.title).toBe('Objective At Risk');

    // Should include KR with AT_RISK status
    const atRiskKR = response.body.find(
      (item: any) => item.entityType === 'KEY_RESULT' && item.status === 'AT_RISK'
    );
    expect(atRiskKR).toBeDefined();
    expect(atRiskKR.title).toBe('KR At Risk');
  });

  it('should return at-risk items by confidence threshold', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/at-risk?cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // Should include KR with low confidence
    const lowConfidenceKR = response.body.find(
      (item: any) => item.entityType === 'KEY_RESULT' && item.confidence === 40
    );
    expect(lowConfidenceKR).toBeDefined();
    expect(lowConfidenceKR.title).toBe('KR Low Confidence');
    expect(lowConfidenceKR.status).toBe('ON_TRACK'); // Status is ON_TRACK but confidence is low
  });

  it('should filter by teamId', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/at-risk?teamId=${teamA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // All items should belong to teamA
    response.body.forEach((item: any) => {
      expect(item.dimensionRefs.teamId).toBe(teamA.id);
    });
  });

  it('should filter by pillarId', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/at-risk?pillarId=${pillarA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // All items should belong to pillarA
    response.body.forEach((item: any) => {
      expect(item.dimensionRefs.pillarId).toBe(pillarA.id);
    });
  });

  it('should filter by ownerId', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/at-risk?ownerId=${userA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // All items should be owned by userA
    response.body.forEach((item: any) => {
      expect(item.owner.id).toBe(userA.id);
    });
  });

  it('should return empty array when no at-risk items', async () => {
    // Delete all at-risk items
    await prisma.objective.update({
      where: { id: objectiveAtRisk.id },
      data: { status: 'ON_TRACK' },
    });
    await prisma.keyResult.update({
      where: { id: krAtRisk.id },
      data: { status: 'ON_TRACK' },
    });
    await prisma.checkIn.deleteMany({
      where: { keyResultId: krLowConfidence.id },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/reports/at-risk?cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should return 403 for cross-tenant access', async () => {
    await request(app.getHttpServer())
      .get(`/api/reports/at-risk?cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
  });

  it('should return 401 without auth token', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/at-risk')
      .expect(401);
  });
});


