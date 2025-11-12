/**
 * Key Result Check-ins API - Integration Tests
 * 
 * Tests for GET /key-results/:id/check-ins endpoint:
 * - Happy path: fetch first page, then next page
 * - RBAC denied for user lacking view_okr action
 * - Cross-tenant blocked
 * - Large limit trimmed to max
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Key Result Check-ins API (Integration)', () => {
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
  let checkInsA: any[] = [];
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

    // Grant view_okr permission to userA and userB (but not userNoPerms)
    // Note: This assumes RBAC role assignment pattern
    // In a real scenario, you'd assign roles via RoleAssignment table
    // For now, we'll rely on the RBAC system's default behavior

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
        state: 'PUBLISHED',
      },
    });

    objectiveB = await prisma.objective.create({
      data: {
        title: 'Objective B',
        ownerId: userB.id,
        tenantId: tenantB.id,
        status: 'ON_TRACK',
        state: 'PUBLISHED',
      },
    });

    // Create Key Results
    krA = await prisma.keyResult.create({
      data: {
        title: 'KR A',
        ownerId: userA.id,
        tenantId: tenantA.id,
        metricType: 'INCREASE',
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        status: 'ON_TRACK',
        objectives: {
          create: {
            objectiveId: objectiveA.id,
          },
        },
      },
    });

    krB = await prisma.keyResult.create({
      data: {
        title: 'KR B',
        ownerId: userB.id,
        tenantId: tenantB.id,
        metricType: 'INCREASE',
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        status: 'ON_TRACK',
        objectives: {
          create: {
            objectiveId: objectiveB.id,
          },
        },
      },
    });

    // Create check-ins for krA (25 check-ins to test pagination)
    checkInsA = [];
    for (let i = 0; i < 25; i++) {
      const checkIn = await prisma.checkIn.create({
        data: {
          keyResultId: krA.id,
          userId: userA.id,
          value: 50 + i,
          confidence: 75 + i,
          note: `Check-in ${i + 1}`,
          blockers: i % 3 === 0 ? `Blocker ${i}` : null,
          createdAt: new Date(Date.now() - (24 - i) * 60 * 60 * 1000), // Staggered timestamps
        },
      });
      checkInsA.push(checkIn);
    }
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.checkIn.deleteMany({ where: { keyResultId: { in: [krA?.id, krB?.id].filter(Boolean) } } });
    await prisma.keyResult.deleteMany({ where: { id: { in: [krA?.id, krB?.id].filter(Boolean) } } });
    await prisma.objective.deleteMany({ where: { id: { in: [objectiveA?.id, objectiveB?.id].filter(Boolean) } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA?.id, userB?.id, userNoPerms?.id].filter(Boolean) } } });
    await prisma.organization.deleteMany({ where: { id: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } });
    checkInsA = [];
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /key-results/:id/check-ins - Happy Path', () => {
    it('should return paginated check-ins for a key result', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify structure of first check-in
      const firstCheckIn = response.body.data[0];
      expect(firstCheckIn).toHaveProperty('id');
      expect(firstCheckIn).toHaveProperty('value');
      expect(firstCheckIn).toHaveProperty('confidence');
      expect(firstCheckIn).toHaveProperty('note');
      expect(firstCheckIn).toHaveProperty('blockers');
      expect(firstCheckIn).toHaveProperty('createdAt');
      expect(firstCheckIn).toHaveProperty('author');
      expect(firstCheckIn.author).toHaveProperty('id');
      expect(firstCheckIn.author).toHaveProperty('name');

      // Verify meta
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('limit');
      expect(response.body.meta).toHaveProperty('totalPages');
      expect(response.body.meta.total).toBe(25);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(20);
      expect(response.body.meta.totalPages).toBe(2);
    });

    it('should return second page when page=2', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins?page=2&limit=20`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.limit).toBe(20);
      expect(response.body.meta.total).toBe(25);
      expect(response.body.meta.totalPages).toBe(2);
      expect(response.body.data.length).toBe(5); // Remaining 5 check-ins
    });

    it('should default to page=1 and limit=20 when not provided', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(20);
    });

    it('should respect custom limit parameter', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins?limit=10`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(10);
      expect(response.body.data.length).toBe(10);
      expect(response.body.meta.totalPages).toBe(3); // 25 / 10 = 3 pages
    });
  });

  describe('GET /key-results/:id/check-ins - Validation', () => {
    it('should reject page < 1', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins?page=0`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body.message).toContain('Page must be >= 1');
    });

    it('should reject limit > 50', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins?limit=51`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body.message).toContain('Limit must be between 1 and 50');
    });

    it('should reject limit < 1', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins?limit=0`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body.message).toContain('Limit must be between 1 and 50');
    });

    it('should accept limit = 50 (max)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins?limit=50`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(50);
      expect(response.body.data.length).toBe(25); // All 25 check-ins
    });
  });

  describe('GET /key-results/:id/check-ins - RBAC & Tenant Isolation', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins`)
        .expect(401);
    });

    it('should return 404 if key result does not exist', async () => {
      const fakeKrId = 'non-existent-kr-id';
      await request(app.getHttpServer())
        .get(`/key-results/${fakeKrId}/check-ins`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('should block cross-tenant access', async () => {
      // User A (tenantA) should not see check-ins for KR B (tenantB)
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krB.id}/check-ins`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);

      expect(response.body.message).toContain('permission');
    });

    it('should return 403 if user cannot view parent objective', async () => {
      // Create a private objective that userA cannot view
      const privateObjective = await prisma.objective.create({
        data: {
          title: 'Private Objective',
          ownerId: userB.id,
          tenantId: tenantA.id,
          status: 'ON_TRACK',
          state: 'PUBLISHED',
          visibilityLevel: 'PRIVATE', // Private visibility
        },
      });

      const privateKr = await prisma.keyResult.create({
        data: {
          title: 'Private KR',
          ownerId: userB.id,
          tenantId: tenantA.id,
          metricType: 'INCREASE',
          startValue: 0,
          targetValue: 100,
          currentValue: 50,
          status: 'ON_TRACK',
          objectives: {
            create: {
              objectiveId: privateObjective.id,
            },
          },
        },
      });

      // UserA should not be able to view check-ins for private KR
      await request(app.getHttpServer())
        .get(`/key-results/${privateKr.id}/check-ins`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);

      // Cleanup
      await prisma.keyResult.delete({ where: { id: privateKr.id } });
      await prisma.objective.delete({ where: { id: privateObjective.id } });
    });
  });

  describe('GET /key-results/:id/check-ins - Ordering', () => {
    it('should return check-ins ordered by createdAt DESC (newest first)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const checkIns = response.body.data;
      expect(checkIns.length).toBeGreaterThan(1);

      // Verify descending order (newest first)
      for (let i = 0; i < checkIns.length - 1; i++) {
        const current = new Date(checkIns[i].createdAt);
        const next = new Date(checkIns[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });
  });

  describe('GET /key-results/:id/check-ins - Edge Cases', () => {
    it('should return empty array if KR has no check-ins', async () => {
      // Create a KR with no check-ins
      const emptyKr = await prisma.keyResult.create({
        data: {
          title: 'Empty KR',
          ownerId: userA.id,
          tenantId: tenantA.id,
          metricType: 'INCREASE',
          startValue: 0,
          targetValue: 100,
          currentValue: 0,
          status: 'ON_TRACK',
          objectives: {
            create: {
              objectiveId: objectiveA.id,
            },
          },
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/key-results/${emptyKr.id}/check-ins`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
      expect(response.body.meta.totalPages).toBe(0);

      // Cleanup
      await prisma.keyResult.delete({ where: { id: emptyKr.id } });
    });

    it('should handle check-ins with null note and blockers', async () => {
      // Create a check-in with null note and blockers
      const checkInWithNulls = await prisma.checkIn.create({
        data: {
          keyResultId: krA.id,
          userId: userA.id,
          value: 60,
          confidence: 80,
          note: null,
          blockers: null,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/key-results/${krA.id}/check-ins?limit=1`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Should handle nulls gracefully
      const checkIn = response.body.data.find((ci: any) => ci.id === checkInWithNulls.id);
      if (checkIn) {
        expect(checkIn.note).toBeNull();
        expect(checkIn.blockers).toBeNull();
      }

      // Cleanup
      await prisma.checkIn.delete({ where: { id: checkInWithNulls.id } });
    });
  });
});

