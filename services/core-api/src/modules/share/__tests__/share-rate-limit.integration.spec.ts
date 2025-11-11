/**
 * Rate Limiting Tests for Share Link Endpoints
 * 
 * Tests that rate limiting is enforced on share link endpoints:
 * - POST /okrs/:type/:id/share
 * - DELETE /share/:shareId
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Share Link Endpoints Rate Limiting', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantA: any;
  let userA: any;
  let cycleA: any;
  let objectiveA: any;
  let tokenA: string;
  let shareLinkId: string;

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

    // Create objective
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
        visibilityLevel: 'PUBLIC_TENANT',
      },
    });

    // Create a share link for revocation test
    const shareLink = await prisma.shareLink.create({
      data: {
        entityType: 'OBJECTIVE',
        entityId: objectiveA.id,
        tenantId: tenantA.id,
        createdBy: userA.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    shareLinkId = shareLink.id;
  });

  afterEach(async () => {
    await prisma.shareLink.deleteMany({});
    await prisma.objective.deleteMany({});
    await prisma.cycle.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('should enforce rate limit on POST /okrs/objectives/:id/share', async () => {
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    
    // Make 30 requests (limit is 30 per minute)
    const requests = Array.from({ length: 30 }, () =>
      request(app.getHttpServer())
        .post(`/okrs/objectives/${objectiveA.id}/share`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ expiresAt })
    );

    const responses = await Promise.all(requests);
    
    // All should succeed (or fail with 400/403/404, but not 429)
    responses.forEach((res) => {
      expect([200, 201, 400, 403, 404]).toContain(res.status);
    });

    // 31st request should be rate limited
    const rateLimitedResponse = await request(app.getHttpServer())
      .post(`/okrs/objectives/${objectiveA.id}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expiresAt });

    expect(rateLimitedResponse.status).toBe(429);
  }, 10000);

  it('should enforce rate limit on DELETE /share/:shareId', async () => {
    // Make 30 requests (limit is 30 per minute)
    const requests = Array.from({ length: 30 }, () =>
      request(app.getHttpServer())
        .delete(`/share/${shareLinkId}`)
        .set('Authorization', `Bearer ${tokenA}`)
    );

    const responses = await Promise.all(requests);
    
    // All should succeed (or fail with 400/403/404, but not 429)
    responses.forEach((res) => {
      expect([200, 400, 403, 404]).toContain(res.status);
    });

    // 31st request should be rate limited
    const rateLimitedResponse = await request(app.getHttpServer())
      .delete(`/share/${shareLinkId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(rateLimitedResponse.status).toBe(429);
  }, 10000);
});


