/**
 * Rate Limiting Tests for Analytics Endpoints
 * 
 * Tests that rate limiting is enforced on analytics endpoints:
 * - GET /reports/krs/:id/trend
 * - GET /reports/health-heatmap
 * - GET /reports/at-risk
 * - GET /reports/cycle-health
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Analytics Endpoints Rate Limiting', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantA: any;
  let userA: any;
  let cycleA: any;
  let objectiveA: any;
  let krA: any;
  let tokenA: string;

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
    // Create test tenant and user
    tenantA = await prisma.organization.create({
      data: {
        name: `Test Tenant ${Date.now()}`,
      },
    });

    userA = await prisma.user.create({
      data: {
        email: `user-${Date.now()}@test.com`,
        name: 'Test User',
        password: 'hashed-password',
      },
    });

    tokenA = jwtService.sign({ id: userA.id, tenantId: tenantA.id });

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

    // Create objective and KR
    objectiveA = await prisma.objective.create({
      data: {
        title: 'Test Objective',
        ownerId: userA.id,
        tenantId: tenantA.id,
        cycleId: cycleA.id,
        status: 'ON_TRACK',
        progress: 50,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    krA = await prisma.keyResult.create({
      data: {
        title: 'Test KR',
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

    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: objectiveA.id,
        keyResultId: krA.id,
      },
    });
  });

  afterEach(async () => {
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

  it('should enforce rate limit on /reports/krs/:id/trend', async () => {
    // Make 30 requests (limit is 30 per minute)
    const requests = Array.from({ length: 30 }, () =>
      request(app.getHttpServer())
        .get(`/api/reports/krs/${krA.id}/trend`)
        .set('Authorization', `Bearer ${tokenA}`)
    );

    const responses = await Promise.all(requests);
    
    // All should succeed
    responses.forEach((res) => {
      expect([200, 404]).toContain(res.status);
    });

    // 31st request should be rate limited
    const rateLimitedResponse = await request(app.getHttpServer())
      .get(`/api/reports/krs/${krA.id}/trend`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(rateLimitedResponse.status).toBe(429);
  }, 10000);

  it('should enforce rate limit on /reports/health-heatmap', async () => {
    const requests = Array.from({ length: 30 }, () =>
      request(app.getHttpServer())
        .get('/api/reports/health-heatmap?by=team')
        .set('Authorization', `Bearer ${tokenA}`)
    );

    const responses = await Promise.all(requests);
    responses.forEach((res) => {
      expect([200]).toContain(res.status);
    });

    const rateLimitedResponse = await request(app.getHttpServer())
      .get('/api/reports/health-heatmap?by=team')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(rateLimitedResponse.status).toBe(429);
  }, 10000);

  it('should enforce rate limit on /reports/at-risk', async () => {
    const requests = Array.from({ length: 30 }, () =>
      request(app.getHttpServer())
        .get('/api/reports/at-risk')
        .set('Authorization', `Bearer ${tokenA}`)
    );

    const responses = await Promise.all(requests);
    responses.forEach((res) => {
      expect([200]).toContain(res.status);
    });

    const rateLimitedResponse = await request(app.getHttpServer())
      .get('/api/reports/at-risk')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(rateLimitedResponse.status).toBe(429);
  }, 10000);

  it('should enforce rate limit on /reports/cycle-health', async () => {
    const requests = Array.from({ length: 30 }, () =>
      request(app.getHttpServer())
        .get(`/api/reports/cycle-health?cycleId=${cycleA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
    );

    const responses = await Promise.all(requests);
    responses.forEach((res) => {
      expect([200]).toContain(res.status);
    });

    const rateLimitedResponse = await request(app.getHttpServer())
      .get(`/api/reports/cycle-health?cycleId=${cycleA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(rateLimitedResponse.status).toBe(429);
  }, 10000);
});


