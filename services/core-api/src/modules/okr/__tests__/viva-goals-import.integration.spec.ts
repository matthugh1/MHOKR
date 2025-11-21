/**
 * Viva Goals CSV Import - Integration Tests
 * 
 * Tests for POST /okr/import endpoint:
 * - Happy path: import CSV with Objectives and Key Results
 * - Topological sorting: parents imported before children
 * - Deduplication: re-import updates existing records
 * - Multiple owners: first owner + contributors
 * - Auto-create teams: creates teams if not found
 * - Check-in import: imports historical check-ins
 * - Error handling: invalid CSV, missing users, etc.
 * - Tenant isolation: cross-tenant blocked
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { VivaGoalsCSVParserService } from '../viva-goals-csv-parser.service';

describe('Viva Goals CSV Import (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let parserService: VivaGoalsCSVParserService;

  // Test data
  let tenantA: any;
  let tenantB: any;
  let userA: any;
  let userB: any;
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
    parserService = moduleFixture.get<VivaGoalsCSVParserService>(VivaGoalsCSVParserService);
  });

  beforeEach(async () => {
    // Create test tenants
    tenantA = await prisma.organization.create({
      data: {
        name: `Test Org A ${Date.now()}`,
        slug: `test-org-a-${Date.now()}`,
      },
    });

    tenantB = await prisma.organization.create({
      data: {
        name: `Test Org B ${Date.now()}`,
        slug: `test-org-b-${Date.now()}`,
      },
    });

    // Create test users
    userA = await prisma.user.create({
      data: {
        email: `user-a-${Date.now()}@test.com`,
        name: 'User A',
        passwordHash: 'hashed',
        primaryOrganizationId: tenantA.id,
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `user-b-${Date.now()}@test.com`,
        name: 'User B',
        passwordHash: 'hashed',
        primaryOrganizationId: tenantB.id,
      },
    });

    // Create JWT tokens
    tokenA = jwtService.sign({ id: userA.id, tenantId: tenantA.id });
    tokenB = jwtService.sign({ id: userB.id, tenantId: tenantB.id });
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.checkIn.deleteMany({ where: { keyResult: { tenantId: tenantA.id } } });
    await prisma.checkIn.deleteMany({ where: { keyResult: { tenantId: tenantB.id } } });
    await prisma.objectiveKeyResult.deleteMany({ where: { objective: { tenantId: tenantA.id } } });
    await prisma.objectiveKeyResult.deleteMany({ where: { objective: { tenantId: tenantB.id } } });
    await prisma.keyResultContributor.deleteMany({ where: { keyResult: { tenantId: tenantA.id } } });
    await prisma.objectiveContributor.deleteMany({ where: { objective: { tenantId: tenantA.id } } });
    await prisma.keyResult.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.keyResult.deleteMany({ where: { tenantId: tenantB.id } });
    await prisma.objective.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.objective.deleteMany({ where: { tenantId: tenantB.id } });
    await prisma.team.deleteMany({ where: { workspace: { tenantId: tenantA.id } } });
    await prisma.team.deleteMany({ where: { workspace: { tenantId: tenantB.id } } });
    await prisma.workspace.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.workspace.deleteMany({ where: { tenantId: tenantB.id } });
    await prisma.cycle.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.cycle.deleteMany({ where: { tenantId: tenantB.id } });
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
    await prisma.organization.delete({ where: { id: tenantA.id } });
    await prisma.organization.delete({ where: { id: tenantB.id } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CSV Parser', () => {
    it('should parse CSV with Objectives and Key Results', () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,
2325365,Test Key Result,Commercial,User A,User A,Annual 2025,2025-01-01,2025-12-31,,"Test Objective(weight: 14.29%, Id: 2295704)",Progress,%,100,Key result,Aspirational Goal,0,2024-12-19 16:24:00 UTC,2025-03-10,25,25,On Track,On track in Q1,,Checkin Date: 2025-03-10; User: User A; Note: On track in Q1; Metric Name: Progress; Status: On Track; Current Value: 25%; Activity Date: 2025-03-10 20:57:08 UTC;,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      const parsed = parserService.parseCSV(csv);

      expect(parsed.length).toBe(2);
      expect(parsed[0].objectType).toBe('Objective');
      expect(parsed[0].externalId).toBe('2295704');
      expect(parsed[0].title).toBe('Test Objective');
      expect(parsed[1].objectType).toBe('Key result');
      expect(parsed[1].externalId).toBe('2325365');
      expect(parsed[1].parentExternalId).toBe('2295704');
      expect(parsed[1].parentWeight).toBe(14.29);
      expect(parsed[1].checkins.length).toBe(1);
      expect(parsed[1].checkins[0].user).toBe('User A');
      expect(parsed[1].checkins[0].currentValue).toBe(25);
    });

    it('should parse multiple owners', () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,User A,"User A, User B",Annual 2025,2025-01-01,2025-12-31,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      const parsed = parserService.parseCSV(csv);

      expect(parsed[0].owners).toEqual(['User A', 'User B']);
    });

    it('should parse check-ins correctly', () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2325365,Test KR,Commercial,User A,User A,Annual 2025,2025-01-01,2025-12-31,,"Test Objective(weight: 14.29%, Id: 2295704)",Progress,%,100,Key result,Aspirational Goal,0,2024-12-19 16:24:00 UTC,2025-03-10,25,25,On Track,On track in Q1,,Checkin Date: 2025-03-10; User: User A; Note: On track in Q1; Metric Name: Progress; Status: On Track; Current Value: 25%; Activity Date: 2025-03-10 20:57:08 UTC;,Checkin Date: 2025-04-10; User: User A; Note: Still on track; Status: On Track; Current Value: 30%; Activity Date: 2025-04-10 20:57:08 UTC;,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      const parsed = parserService.parseCSV(csv);

      expect(parsed[0].checkins.length).toBe(2);
      expect(parsed[0].checkins[0].checkinDate).toBe('2025-03-10');
      expect(parsed[0].checkins[0].note).toBe('On track in Q1');
      expect(parsed[0].checkins[1].checkinDate).toBe('2025-04-10');
    });
  });

  describe('POST /okr/import', () => {
    it('should import CSV with Objectives and Key Results', async () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,
2325365,Test Key Result,Commercial,User A,User A,Annual 2025,2025-01-01,2025-12-31,,"Test Objective(weight: 14.29%, Id: 2295704)",Progress,%,100,Key result,Aspirational Goal,0,2024-12-19 16:24:00 UTC,2025-03-10,25,25,On Track,On track in Q1,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      const response = await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantA.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.objectivesCreated).toBe(1);
      expect(response.body.keyResultsCreated).toBe(1);
      expect(response.body.errors.length).toBe(0);

      // Verify Objective was created
      const objective = await prisma.objective.findFirst({
        where: {
          tenantId: tenantA.id,
          source: 'VIVA_GOALS',
          externalId: '2295704',
        },
      });

      expect(objective).toBeTruthy();
      expect(objective.title).toBe('Test Objective');
      expect(objective.status).toBe('AT_RISK');

      // Verify Key Result was created
      const keyResult = await prisma.keyResult.findFirst({
        where: {
          tenantId: tenantA.id,
          source: 'VIVA_GOALS',
          externalId: '2325365',
        },
      });

      expect(keyResult).toBeTruthy();
      expect(keyResult.title).toBe('Test Key Result');
      expect(keyResult.status).toBe('ON_TRACK');

      // Verify link between Objective and Key Result
      const link = await prisma.objectiveKeyResult.findFirst({
        where: {
          objectiveId: objective.id,
          keyResultId: keyResult.id,
        },
      });

      expect(link).toBeTruthy();
      expect(link.weight).toBeCloseTo(0.1429, 4);
    });

    it('should handle topological sorting - parents before children', async () => {
      // CSV with child before parent (wrong order)
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295706,Child Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,"Parent Objective(weight: 0%, Id: 2295704)",Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:45 UTC,2025-11-20,0,0,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,
2295704,Parent Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      const response = await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantA.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.objectivesCreated).toBe(2);

      // Verify parent was imported first (check by order in database)
      const objectives = await prisma.objective.findMany({
        where: {
          tenantId: tenantA.id,
          source: 'VIVA_GOALS',
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(objectives.length).toBe(2);
      // Parent should be imported first
      const parent = objectives.find((o: any) => o.externalId === '2295704');
      const child = objectives.find((o: any) => o.externalId === '2295706');
      expect(parent.createdAt.getTime()).toBeLessThanOrEqual(child.createdAt.getTime());
      expect(child.parentId).toBe(parent.id);
    });

    it('should deduplicate on re-import', async () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      // First import
      const response1 = await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantA.id,
        })
        .expect(200);

      expect(response1.body.objectivesCreated).toBe(1);
      expect(response1.body.objectivesUpdated).toBe(0);

      // Second import (should update)
      const csvUpdated = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Updated Test Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,80,80,On Track,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      const response2 = await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csvUpdated,
          tenantId: tenantA.id,
        })
        .expect(200);

      expect(response2.body.objectivesCreated).toBe(0);
      expect(response2.body.objectivesUpdated).toBe(1);

      // Verify update
      const objective = await prisma.objective.findFirst({
        where: {
          tenantId: tenantA.id,
          source: 'VIVA_GOALS',
          externalId: '2295704',
        },
      });

      expect(objective.title).toBe('Updated Test Objective');
      expect(objective.progress).toBe(80);
      expect(objective.status).toBe('ON_TRACK');
    });

    it('should handle multiple owners - first owner + contributors', async () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,User A,"User A, User B",Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantA.id,
        })
        .expect(200);

      const objective = await prisma.objective.findFirst({
        where: {
          tenantId: tenantA.id,
          source: 'VIVA_GOALS',
          externalId: '2295704',
        },
        include: {
          contributors: true,
        },
      });

      expect(objective.ownerId).toBe(userA.id);
      expect(objective.contributors.length).toBe(1);
      expect(objective.contributors[0].userId).toBe(userB.id);
    });

    it('should auto-create teams if not found', async () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,New Team Name,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantA.id,
        })
        .expect(200);

      const team = await prisma.team.findFirst({
        where: {
          name: 'New Team Name',
          workspace: {
            tenantId: tenantA.id,
          },
        },
      });

      expect(team).toBeTruthy();

      const objective = await prisma.objective.findFirst({
        where: {
          tenantId: tenantA.id,
          source: 'VIVA_GOALS',
          externalId: '2295704',
        },
      });

      expect(objective.teamId).toBe(team.id);
    });

    it('should import historical check-ins', async () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,
2325365,Test Key Result,Commercial,User A,User A,Annual 2025,2025-01-01,2025-12-31,,"Test Objective(weight: 14.29%, Id: 2295704)",Progress,%,100,Key result,Aspirational Goal,0,2024-12-19 16:24:00 UTC,2025-03-10,25,25,On Track,On track in Q1,,Checkin Date: 2025-03-10; User: User A; Note: On track in Q1; Metric Name: Progress; Status: On Track; Current Value: 25%; Activity Date: 2025-03-10 20:57:08 UTC;,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantA.id,
        })
        .expect(200);

      const keyResult = await prisma.keyResult.findFirst({
        where: {
          tenantId: tenantA.id,
          source: 'VIVA_GOALS',
          externalId: '2325365',
        },
      });

      const checkIns = await prisma.checkIn.findMany({
        where: {
          keyResultId: keyResult.id,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(checkIns.length).toBe(1);
      expect(checkIns[0].userId).toBe(userA.id);
      expect(checkIns[0].note).toBe('On track in Q1');
      expect(checkIns[0].value).toBeCloseTo(25, 1);
    });

    it('should enforce tenant isolation', async () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      // Try to import to wrong tenant
      await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantB.id, // Wrong tenant
        })
        .expect(403);
    });

    it('should handle missing users gracefully', async () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,Non Existent User,Non Existent User,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      const response = await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantA.id,
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
      expect(response.body.errors[0].error).toContain('Could not resolve owner');
    });

    it('should skip Deliverables with warning', async () => {
      const csv = `Id,Title,Team,Creator,Owner,Period,Start Date,End Date,Description,"Aligned To (weight, Objective ID)",Metric Name,Unit,Target,Object Type,Goal Type,Start,Created At,Last Check-in,Progress %,Actual Progress,Status,Last Check-in Note,Score,Checkins
2295704,Test Objective,Puzzel,User A,User A,Annual 2025,2025-01-01,2025-12-31,,,Progress,%,100,Objective,Aspirational Goal,0,2024-12-09 14:36:20 UTC,2025-11-20,64,64,At Risk,,,,,,,,,,,,,,,,,,,,,,,,,,,
2324371,Test Deliverable,Commercial,User A,User A,Q1 2025,2025-01-01,2025-03-31,,"Test Objective(weight: 0%, Id: 2295704)",Progress,%,100,Deliverable,Aspirational Goal,0,2024-12-19 13:21:43 UTC,2025-05-02,80,80,Closed,,,,,,,,,,,,,,,,,,,,,,,,,,,,`;

      const response = await request.default(app.getHttpServer())
        .post('/okr/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          csvContent: csv,
          tenantId: tenantA.id,
        })
        .expect(200);

      expect(response.body.warnings.length).toBeGreaterThan(0);
      expect(response.body.warnings[0]).toContain('Deliverable');
      expect(response.body.objectivesCreated).toBe(1);
      // Deliverable should not be imported
      const deliverable = await prisma.keyResult.findFirst({
        where: {
          tenantId: tenantA.id,
          source: 'VIVA_GOALS',
          externalId: '2324371',
        },
      });
      expect(deliverable).toBeNull();
    });
  });
});

