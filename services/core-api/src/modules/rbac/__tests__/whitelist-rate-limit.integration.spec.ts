/**
 * Rate Limiting Tests for Whitelist Endpoints
 * 
 * Tests that rate limiting is enforced on whitelist endpoints:
 * - POST /rbac/whitelist/:tenantId/add
 * - POST /rbac/whitelist/:tenantId/remove
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Whitelist Endpoints Rate Limiting', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantA: any;
  let userA: any;
  let userB: any;
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
    // Create test tenant and users
    tenantA = await prisma.organization.create({
      data: {
        name: `Test Tenant ${Date.now()}`,
      },
    });

    userA = await prisma.user.create({
      data: {
        email: `user-a-${Date.now()}@test.com`,
        name: 'Test User A',
        password: 'hashed-password',
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `user-b-${Date.now()}@test.com`,
        name: 'Test User B',
        password: 'hashed-password',
      },
    });

    // Create tenant admin role for userA
    await prisma.rbacAssignment.create({
      data: {
        userId: userA.id,
        tenantId: tenantA.id,
        role: 'TENANT_ADMIN',
      },
    });

    tokenA = jwtService.sign({ id: userA.id, tenantId: tenantA.id });
  });

  afterEach(async () => {
    await prisma.rbacAssignment.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('should enforce rate limit on POST /rbac/whitelist/:tenantId/add', async () => {
    // Make 30 requests (limit is 30 per minute)
    const requests = Array.from({ length: 30 }, () =>
      request(app.getHttpServer())
        .post(`/rbac/whitelist/${tenantA.id}/add`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userB.id })
    );

    const responses = await Promise.all(requests);
    
    // All should succeed (or fail with 400/403/404, but not 429)
    responses.forEach((res) => {
      expect([200, 400, 403, 404]).toContain(res.status);
    });

    // 31st request should be rate limited
    const rateLimitedResponse = await request(app.getHttpServer())
      .post(`/rbac/whitelist/${tenantA.id}/add`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userId: userB.id });

    expect(rateLimitedResponse.status).toBe(429);
  }, 10000);

  it('should enforce rate limit on POST /rbac/whitelist/:tenantId/remove', async () => {
    // First add user to whitelist
    await prisma.organization.update({
      where: { id: tenantA.id },
      data: {
        execOnlyWhitelist: [userB.id],
      },
    });

    // Make 30 requests (limit is 30 per minute)
    const requests = Array.from({ length: 30 }, () =>
      request(app.getHttpServer())
        .post(`/rbac/whitelist/${tenantA.id}/remove`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userB.id })
    );

    const responses = await Promise.all(requests);
    
    // All should succeed (or fail with 400/403/404, but not 429)
    responses.forEach((res) => {
      expect([200, 400, 403, 404]).toContain(res.status);
    });

    // 31st request should be rate limited
    const rateLimitedResponse = await request(app.getHttpServer())
      .post(`/rbac/whitelist/${tenantA.id}/remove`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userId: userB.id });

    expect(rateLimitedResponse.status).toBe(429);
  }, 10000);
});


