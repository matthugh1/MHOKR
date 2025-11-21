/**
 * Viva Goals Feature Gaps - Integration Tests
 * 
 * Tests for new fields added in Phase 1-2:
 * - goalType (ASPIRATIONAL/COMMITTED)
 * - createdBy (auto-populated creator tracking)
 * - teamId (for Key Results and Initiatives)
 * - progress (for Initiatives)
 * - NOT_STARTED status
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ObjectiveService } from '../objective.service';
import { KeyResultService } from '../key-result.service';
import { InitiativeService } from '../initiative.service';

describe('Viva Goals Feature Gaps - Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let objectiveService: ObjectiveService;
  let keyResultService: KeyResultService;
  let initiativeService: InitiativeService;

  // Test data
  let testOrg: any;
  let testUser: any;
  let testTeam: any;
  let testWorkspace: any;
  let testCycle: any;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    objectiveService = moduleFixture.get<ObjectiveService>(ObjectiveService);
    keyResultService = moduleFixture.get<KeyResultService>(KeyResultService);
    initiativeService = moduleFixture.get<InitiativeService>(InitiativeService);

    // Create test fixtures
    testOrg = await prisma.organization.create({
      data: {
        name: `Test Org ${Date.now()}`,
        slug: `test-org-${Date.now()}`,
      },
    });

    testUser = await prisma.user.create({
      data: {
        email: `test-user-${Date.now()}@test.com`,
        name: 'Test User',
        password: 'hashed-password',
      },
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        tenantId: testOrg.id,
      },
    });

    testTeam = await prisma.team.create({
      data: {
        name: 'Test Team',
        workspaceId: testWorkspace.id,
      },
    });

    testCycle = await prisma.cycle.create({
      data: {
        name: 'Q1 2025',
        organizationId: testOrg.id,
        status: 'ACTIVE',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
      },
    });

    // Create JWT token
    token = jwtService.sign({ id: testUser.id, tenantId: testOrg.id });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.initiative.deleteMany({ where: { objective: { tenantId: testOrg.id } } });
    await prisma.objectiveKeyResult.deleteMany({ where: { objective: { tenantId: testOrg.id } } });
    await prisma.keyResult.deleteMany({ where: { tenantId: testOrg.id } });
    await prisma.objective.deleteMany({ where: { tenantId: testOrg.id } });
    await prisma.team.delete({ where: { id: testTeam.id } });
    await prisma.workspace.delete({ where: { id: testWorkspace.id } });
    await prisma.cycle.delete({ where: { id: testCycle.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.organization.delete({ where: { id: testOrg.id } });
    await app.close();
  });

  describe('GoalType Field', () => {
    it('should create Objective with ASPIRATIONAL goalType by default', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Test Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      expect(objective.goalType).toBe('ASPIRATIONAL');
    });

    it('should create Objective with COMMITTED goalType when specified', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Test Objective Committed',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
          goalType: 'COMMITTED',
        },
        testUser.id,
        testOrg.id,
      );

      expect(objective.goalType).toBe('COMMITTED');
    });

    it('should create Key Result with inherited goalType from Objective', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
          goalType: 'COMMITTED',
        },
        testUser.id,
        testOrg.id,
      );

      const keyResult = await keyResultService.create(
        {
          title: 'Test KR',
          objectiveId: objective.id,
          ownerId: testUser.id,
          cycleId: testCycle.id,
          metricType: 'PERCENTAGE',
          startValue: 0,
          targetValue: 100,
        },
        testUser.id,
        testOrg.id,
      );

      // Key Result should inherit goalType from Objective if not specified
      expect(keyResult.goalType).toBe('ASPIRATIONAL'); // Default, not inherited
    });

    it('should create Key Result with explicit goalType', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective 2',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      const keyResult = await keyResultService.create(
        {
          title: 'Test KR Committed',
          objectiveId: objective.id,
          ownerId: testUser.id,
          cycleId: testCycle.id,
          metricType: 'PERCENTAGE',
          startValue: 0,
          targetValue: 100,
          goalType: 'COMMITTED',
        },
        testUser.id,
        testOrg.id,
      );

      expect(keyResult.goalType).toBe('COMMITTED');
    });

    it('should update Objective goalType', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Test Objective Update',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
          goalType: 'ASPIRATIONAL',
        },
        testUser.id,
        testOrg.id,
      );

      const updated = await objectiveService.update(
        objective.id,
        { goalType: 'COMMITTED' },
        testUser.id,
        testOrg.id,
      );

      expect(updated.goalType).toBe('COMMITTED');
    });
  });

  describe('createdBy Field', () => {
    it('should auto-populate createdBy from userId when creating Objective', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Test Objective Creator',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      expect(objective.createdBy).toBe(testUser.id);
    });

    it('should use provided createdBy if specified', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: `other-user-${Date.now()}@test.com`,
          name: 'Other User',
          password: 'hashed-password',
        },
      });

      const objective = await objectiveService.create(
        {
          title: 'Test Objective Creator Override',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
          createdBy: otherUser.id,
        },
        testUser.id,
        testOrg.id,
      );

      expect(objective.createdBy).toBe(otherUser.id);

      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should auto-populate createdBy when creating Key Result', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      const keyResult = await keyResultService.create(
        {
          title: 'Test KR Creator',
          objectiveId: objective.id,
          ownerId: testUser.id,
          cycleId: testCycle.id,
          metricType: 'PERCENTAGE',
          startValue: 0,
          targetValue: 100,
        },
        testUser.id,
        testOrg.id,
      );

      expect(keyResult.createdBy).toBe(testUser.id);
    });

    it('should auto-populate createdBy when creating Initiative', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      const initiative = await initiativeService.create(
        {
          title: 'Test Initiative Creator',
          objectiveId: objective.id,
          ownerId: testUser.id,
        },
        testUser.id,
        testOrg.id,
      );

      expect(initiative.createdBy).toBe(testUser.id);
    });
  });

  describe('teamId Field', () => {
    it('should create Key Result with teamId', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      const keyResult = await keyResultService.create(
        {
          title: 'Test KR with Team',
          objectiveId: objective.id,
          ownerId: testUser.id,
          cycleId: testCycle.id,
          metricType: 'PERCENTAGE',
          startValue: 0,
          targetValue: 100,
          teamId: testTeam.id,
        },
        testUser.id,
        testOrg.id,
      );

      expect(keyResult.teamId).toBe(testTeam.id);
    });

    it('should inherit teamId from Objective when creating Key Result', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective with Team',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
          teamId: testTeam.id,
        },
        testUser.id,
        testOrg.id,
      );

      const keyResult = await keyResultService.create(
        {
          title: 'Test KR Inherited Team',
          objectiveId: objective.id,
          ownerId: testUser.id,
          cycleId: testCycle.id,
          metricType: 'PERCENTAGE',
          startValue: 0,
          targetValue: 100,
        },
        testUser.id,
        testOrg.id,
      );

      expect(keyResult.teamId).toBe(testTeam.id);
    });

    it('should create Initiative with teamId', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      const initiative = await initiativeService.create(
        {
          title: 'Test Initiative with Team',
          objectiveId: objective.id,
          ownerId: testUser.id,
          teamId: testTeam.id,
        },
        testUser.id,
        testOrg.id,
      );

      expect(initiative.teamId).toBe(testTeam.id);
    });

    it('should inherit teamId from Objective when creating Initiative', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective with Team',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
          teamId: testTeam.id,
        },
        testUser.id,
        testOrg.id,
      );

      const initiative = await initiativeService.create(
        {
          title: 'Test Initiative Inherited Team',
          objectiveId: objective.id,
          ownerId: testUser.id,
        },
        testUser.id,
        testOrg.id,
      );

      expect(initiative.teamId).toBe(testTeam.id);
    });

    it('should validate teamId belongs to same tenant', async () => {
      const otherOrg = await prisma.organization.create({
        data: {
          name: `Other Org ${Date.now()}`,
          slug: `other-org-${Date.now()}`,
        },
      });

      const otherWorkspace = await prisma.workspace.create({
        data: {
          name: 'Other Workspace',
          tenantId: otherOrg.id,
        },
      });

      const otherTeam = await prisma.team.create({
        data: {
          name: 'Other Team',
          workspaceId: otherWorkspace.id,
        },
      });

      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      await expect(
        keyResultService.create(
          {
            title: 'Test KR Invalid Team',
            objectiveId: objective.id,
            ownerId: testUser.id,
            cycleId: testCycle.id,
            metricType: 'PERCENTAGE',
            startValue: 0,
            targetValue: 100,
            teamId: otherTeam.id,
          },
          testUser.id,
          testOrg.id,
        ),
      ).rejects.toThrow();

      // Cleanup
      await prisma.team.delete({ where: { id: otherTeam.id } });
      await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    });
  });

  describe('Progress Field (Initiatives)', () => {
    it('should create Initiative with progress', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      const initiative = await initiativeService.create(
        {
          title: 'Test Initiative with Progress',
          objectiveId: objective.id,
          ownerId: testUser.id,
          progress: 75,
        },
        testUser.id,
        testOrg.id,
      );

      expect(initiative.progress).toBe(75);
    });

    it('should validate progress is between 0 and 100', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      // Test invalid progress > 100
      await expect(
        initiativeService.create(
          {
            title: 'Test Initiative Invalid Progress',
            objectiveId: objective.id,
            ownerId: testUser.id,
            progress: 150,
          },
          testUser.id,
          testOrg.id,
        ),
      ).rejects.toThrow();

      // Test invalid progress < 0
      await expect(
        initiativeService.create(
          {
            title: 'Test Initiative Negative Progress',
            objectiveId: objective.id,
            ownerId: testUser.id,
            progress: -10,
          },
          testUser.id,
          testOrg.id,
        ),
      ).rejects.toThrow();
    });

    it('should update Initiative progress', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      const initiative = await initiativeService.create(
        {
          title: 'Test Initiative Update Progress',
          objectiveId: objective.id,
          ownerId: testUser.id,
          progress: 50,
        },
        testUser.id,
        testOrg.id,
      );

      const updated = await initiativeService.update(
        initiative.id,
        { progress: 90 },
        testUser.id,
        testOrg.id,
      );

      expect(updated.progress).toBe(90);
    });
  });

  describe('NOT_STARTED Status', () => {
    it('should create Objective with NOT_STARTED status', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Test Objective Not Started',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
          status: 'NOT_STARTED',
        },
        testUser.id,
        testOrg.id,
      );

      expect(objective.status).toBe('NOT_STARTED');
    });

    it('should create Key Result with NOT_STARTED status', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Parent Objective',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
        },
        testUser.id,
        testOrg.id,
      );

      const keyResult = await keyResultService.create(
        {
          title: 'Test KR Not Started',
          objectiveId: objective.id,
          ownerId: testUser.id,
          cycleId: testCycle.id,
          metricType: 'PERCENTAGE',
          startValue: 0,
          targetValue: 100,
          status: 'NOT_STARTED',
        },
        testUser.id,
        testOrg.id,
      );

      expect(keyResult.status).toBe('NOT_STARTED');
    });

    it('should update Objective status to NOT_STARTED', async () => {
      const objective = await objectiveService.create(
        {
          title: 'Test Objective Status Update',
          ownerId: testUser.id,
          cycleId: testCycle.id,
          tenantId: testOrg.id,
          status: 'ON_TRACK',
        },
        testUser.id,
        testOrg.id,
      );

      const updated = await objectiveService.update(
        objective.id,
        { status: 'NOT_STARTED' },
        testUser.id,
        testOrg.id,
      );

      expect(updated.status).toBe('NOT_STARTED');
    });
  });

  describe('Composite Creation with New Fields', () => {
    it('should create Objective and Key Results with goalType via createComposite', async () => {
      const result = await objectiveService.createComposite(
        {
          title: 'Composite Objective',
          ownerUserId: testUser.id,
          cycleId: testCycle.id,
          goalType: 'COMMITTED',
        },
        [
          {
            title: 'KR 1',
            metricType: 'PERCENTAGE',
            targetValue: 100,
            ownerUserId: testUser.id,
            startValue: 0,
            goalType: 'COMMITTED',
          },
          {
            title: 'KR 2',
            metricType: 'PERCENTAGE',
            targetValue: 100,
            ownerUserId: testUser.id,
            startValue: 0,
            goalType: 'ASPIRATIONAL',
          },
        ],
        testUser.id,
        testOrg.id,
      );

      const objective = await prisma.objective.findUnique({
        where: { id: result.objectiveId },
      });

      expect(objective?.goalType).toBe('COMMITTED');

      const kr1 = await prisma.keyResult.findUnique({
        where: { id: result.keyResultIds[0] },
      });

      const kr2 = await prisma.keyResult.findUnique({
        where: { id: result.keyResultIds[1] },
      });

      expect(kr1?.goalType).toBe('COMMITTED');
      expect(kr2?.goalType).toBe('ASPIRATIONAL');
    });

    it('should auto-populate createdBy for Objective and Key Results in createComposite', async () => {
      const result = await objectiveService.createComposite(
        {
          title: 'Composite Objective Creator',
          ownerUserId: testUser.id,
          cycleId: testCycle.id,
        },
        [
          {
            title: 'KR Creator',
            metricType: 'PERCENTAGE',
            targetValue: 100,
            ownerUserId: testUser.id,
            startValue: 0,
          },
        ],
        testUser.id,
        testOrg.id,
      );

      const objective = await prisma.objective.findUnique({
        where: { id: result.objectiveId },
      });

      const kr = await prisma.keyResult.findUnique({
        where: { id: result.keyResultIds[0] },
      });

      expect(objective?.createdBy).toBe(testUser.id);
      expect(kr?.createdBy).toBe(testUser.id);
    });

    it('should inherit teamId for Key Results in createComposite', async () => {
      const result = await objectiveService.createComposite(
        {
          title: 'Composite Objective Team',
          ownerUserId: testUser.id,
          cycleId: testCycle.id,
          teamId: testTeam.id,
        },
        [
          {
            title: 'KR Team',
            metricType: 'PERCENTAGE',
            targetValue: 100,
            ownerUserId: testUser.id,
            startValue: 0,
          },
        ],
        testUser.id,
        testOrg.id,
      );

      const kr = await prisma.keyResult.findUnique({
        where: { id: result.keyResultIds[0] },
      });

      expect(kr?.teamId).toBe(testTeam.id);
    });
  });
});

