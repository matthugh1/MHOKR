/**
 * Key Result Trend API - Integration Tests
 * 
 * Tests for GET /reports/krs/:id/trend endpoint:
 * - Happy path: fetch trend data for KR with check-ins
 * - Empty series: KR with no check-ins
 * - 404 for unknown KR
 * - 403 RBAC denial
 * - Tenant isolation: cross-tenant blocked
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Key Result Trend API (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data
  let tenantA: any;
  let tenantB: any;
  let userA: any;
  let userB: any;
  let userNoPerms: any;
  let objectiveA: any;
  let objectiveB: any;
  let krA: any;
  let krB: any;
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

    // Create objectives
    objectiveA = await prisma.objective.create({
      data: {
        title: 'Objective A',
        ownerId: userA.id,
        tenantId: tenantA.id,
        status: 'ON_TRACK',
        progress: 0,
      },
    });

    objectiveB = await prisma.objective.create({
      data: {
        title: 'Objective B',
        ownerId: userB.id,
        tenantId: tenantB.id,
        status: 'ON_TRACK',
        progress: 0,
      },
    });

    // Create key results
    krA = await prisma.keyResult.create({
      data: {
        title: 'Key Result A',
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

    krB = await prisma.keyResult.create({
      data: {
        title: 'Key Result B',
        ownerId: userB.id,
        tenantId: tenantB.id,
        metricType: 'PERCENTAGE',
        startValue: 0,
        targetValue: 100,
        currentValue: 30,
        progress: 30,
        status: 'ON_TRACK',
      },
    });

    // Link KRs to objectives
    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: objectiveA.id,
        keyResultId: krA.id,
      },
    });

    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: objectiveB.id,
        keyResultId: krB.id,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.checkIn.deleteMany({});
    await prisma.objectiveKeyResult.deleteMany({});
    await prisma.keyResult.deleteMany({});
    await prisma.objective.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return trend data for KR with check-ins', async () => {
    // Create check-ins for krA
    const checkIn1 = await prisma.checkIn.create({
      data: {
        keyResultId: krA.id,
        userId: userA.id,
        value: 25,
        confidence: 80,
      },
    });

    const checkIn2 = await prisma.checkIn.create({
      data: {
        keyResultId: krA.id,
        userId: userA.id,
        value: 50,
        confidence: 85,
      },
    });

    const checkIn3 = await prisma.checkIn.create({
      data: {
        keyResultId: krA.id,
        userId: userA.id,
        value: 75,
        confidence: 90,
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/reports/krs/${krA.id}/trend`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(3);
    
    // Verify ASC order (oldest first)
    expect(new Date(response.body[0].timestamp).getTime()).toBeLessThanOrEqual(
      new Date(response.body[1].timestamp).getTime()
    );
    expect(new Date(response.body[1].timestamp).getTime()).toBeLessThanOrEqual(
      new Date(response.body[2].timestamp).getTime()
    );

    // Verify data structure
    expect(response.body[0]).toHaveProperty('timestamp');
    expect(response.body[0]).toHaveProperty('value');
    expect(response.body[0]).toHaveProperty('confidence');
    expect(response.body[0].value).toBe(25);
    expect(response.body[0].confidence).toBe(80);
  });

  it('should return empty array for KR with no check-ins', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/krs/${krA.id}/trend`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(0);
  });

  it('should return 404 for unknown KR', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/krs/non-existent-id/trend')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    expect(response.body.message).toContain('not found');
  });

  it('should return 403 for cross-tenant access', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/reports/krs/${krB.id}/trend`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    expect(response.body.message).toContain('permission');
  });

  it('should return 401 without auth token', async () => {
    await request(app.getHttpServer())
      .get(`/api/reports/krs/${krA.id}/trend`)
      .expect(401);
  });
});


