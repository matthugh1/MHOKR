#!/usr/bin/env ts-node

/**
 * OKRs, Objectives, Key Results
 * 
 * Creates objectives, key results, and initiatives across tenant, workspace, and team levels.
 * Supports size presets: tiny (~30), demo (~160), full (~260).
 */

import { PrismaClient, VisibilityLevel, MetricType, CheckInCadence } from '@prisma/client';
import {
  createObjective,
  createKeyResult,
  createInitiative,
  generateRandomStatus,
  generateRandomProgress,
  SEED_SIZE_CONFIGS,
  SeedSize,
  generateObjectiveTitle,
  generateKeyResultTitle,
  generateInitiativeTitle,
  TENANT_OBJECTIVE_TEMPLATES,
  WORKSPACE_OBJECTIVE_TEMPLATES,
  TEAM_OBJECTIVE_TEMPLATES,
} from '../../services/core-api/prisma/factories/okrs';
import { randomInt, randomFloat, shuffle, randomChoice } from '../../services/core-api/prisma/factories/rng';

const prisma = new PrismaClient();

async function createOKRs(
  orgId: string,
  workspaceIds: Map<string, string>,
  teamIds: Map<string, string>,
  cycleIds: Map<string, string>,
  userIds: Map<string, string>,
  size: SeedSize = 'demo',
): Promise<void> {
  console.log(`🎯 Creating OKRs (size: ${size})...`);

  const config = SEED_SIZE_CONFIGS[size];
  const founderEmail = 'founder@puzzelcx.local';
  const founderId = userIds.get(founderEmail)!;

  const cycles = [
    { name: 'Q4 2025', status: 'ACTIVE', id: cycleIds.get('Q4 2025')!, start: new Date('2025-10-01'), end: new Date('2025-12-31') },
    { name: 'Q1 2026', status: 'ACTIVE', id: cycleIds.get('Q1 2026')!, start: new Date('2026-01-01'), end: new Date('2026-03-31') },
    { name: 'Q2 2026', status: 'DRAFT', id: cycleIds.get('Q2 2026')!, start: new Date('2026-04-01'), end: new Date('2026-06-30') },
    { name: 'Q3 2026', status: 'ARCHIVED', id: cycleIds.get('Q3 2026')!, start: new Date('2026-07-01'), end: new Date('2026-09-30') },
  ];

  const whitelistIds: string[] = [founderId];
  const adminEmails = ['admin1@puzzelcx.local', 'admin2@puzzelcx.local'];
  adminEmails.forEach(email => {
    const id = userIds.get(email);
    if (id) whitelistIds.push(id);
  });

  let totalObjectives = 0;
  let totalKRs = 0;
  let totalInitiatives = 0;

  for (const cycle of cycles) {
    const isActive = cycle.status === 'ACTIVE';
    const isArchived = cycle.status === 'ARCHIVED';
    const isDraft = cycle.status === 'DRAFT';

    const publishRate = isActive ? 0.7 : isDraft ? 0 : 1;
    const templates = shuffle([...TENANT_OBJECTIVE_TEMPLATES]);

    for (let i = 0; i < config.tenantObjectivesPerCycle; i++) {
      const template = templates[i % templates.length];
      const title = generateObjectiveTitle(template);
      const isPrivate = i === config.tenantObjectivesPerCycle - 1;
      const visibilityLevel: VisibilityLevel = isPrivate ? 'PRIVATE' : 'PUBLIC_TENANT';
      const isPublished = randomFloat(0, 1) < publishRate;

      const status = generateRandomStatus(cycle.status);
      const progress = generateRandomProgress(status);

      await prisma.$transaction(async (tx) => {
        const objectiveId = await createObjective(tx, orgId, {
          title,
          description: `${template.verb} ${template.noun} across all departments and teams`,
          scopeType: 'tenant',
          scopeId: null,
          cycleId: cycle.id,
          ownerId: founderId,
          visibilityLevel,
          isPublished,
          status,
          progress,
          startDate: cycle.start,
          endDate: cycle.end,
        });

        const krCount = randomInt(2, 4);
        const krCadences: CheckInCadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];
        const metricTypes: MetricType[] = ['INCREASE', 'DECREASE', 'REACH', 'MAINTAIN'];

        for (let j = 0; j < krCount; j++) {
          const krTitle = generateKeyResultTitle(template, j);
          const krStatus = generateRandomStatus(cycle.status);
          const krProgress = generateRandomProgress(krStatus);
          const cadence = randomChoice(krCadences);

          await createKeyResult(tx, objectiveId, {
            title: krTitle.replace('X', String(randomInt(10, 25))).replace('Y', String(randomInt(5, 15))),
            description: `Key result ${j + 1} for ${title}`,
            ownerId: founderId,
            metricType: randomChoice(metricTypes),
            startValue: randomFloat(50, 70),
            targetValue: randomFloat(80, 100),
            currentValue: randomFloat(60, 90),
            unit: 'percentage',
            status: krStatus,
            progress: krProgress,
            visibilityLevel,
            isPublished,
            checkInCadence: cadence,
            cycleId: cycle.id,
            startDate: cycle.start,
            endDate: cycle.end,
          });
          totalKRs++;
        }

        const initiativeCount = randomInt(1, 3);
        for (let k = 0; k < initiativeCount; k++) {
          const initTitle = generateInitiativeTitle(title, k);
          await createInitiative(tx, objectiveId, {
            title: initTitle,
            description: `Supporting initiative for ${title}`,
            ownerId: founderId,
            status: isArchived ? 'COMPLETED' : randomChoice(['IN_PROGRESS', 'NOT_STARTED', 'COMPLETED']),
            cycleId: cycle.id,
            startDate: cycle.start,
            endDate: cycle.end,
          });
          totalInitiatives++;
        }
      });

      totalObjectives++;
    }

    for (const [workspaceName, workspaceId] of workspaceIds.entries()) {
      const workspaceTemplates = WORKSPACE_OBJECTIVE_TEMPLATES[workspaceName] || TEAM_OBJECTIVE_TEMPLATES;
      const shuffledTemplates = shuffle([...workspaceTemplates]);

      for (let i = 0; i < config.workspaceObjectivesPerCycle; i++) {
        const template = shuffledTemplates[i % shuffledTemplates.length];
        const title = generateObjectiveTitle(template);
        const isPublished = randomFloat(0, 1) < publishRate;

        const status = generateRandomStatus(cycle.status);
        const progress = generateRandomProgress(status);

        const workspaceLeads = Array.from(userIds.entries())
          .filter(([email]) => email.includes(`workspace-lead-${workspaceName.toLowerCase()}`))
          .map(([, id]) => id);
        const ownerId = workspaceLeads.length > 0 ? workspaceLeads[0] : founderId;

        await prisma.$transaction(async (tx) => {
          const objectiveId = await createObjective(tx, orgId, {
            title,
            description: `${template.verb} ${template.noun} for ${workspaceName} workspace`,
            scopeType: 'workspace',
            scopeId: workspaceId,
            cycleId: cycle.id,
            ownerId,
            visibilityLevel: 'PUBLIC_TENANT',
            isPublished,
            status,
            progress,
            startDate: cycle.start,
            endDate: cycle.end,
          });

          const krCount = randomInt(2, 4);
          const krCadences: CheckInCadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];
          const metricTypes: MetricType[] = ['INCREASE', 'DECREASE', 'REACH', 'MAINTAIN'];

          for (let j = 0; j < krCount; j++) {
            const krTitle = generateKeyResultTitle(template, j);
            const krStatus = generateRandomStatus(cycle.status);
            const krProgress = generateRandomProgress(krStatus);
            const cadence = randomChoice(krCadences);

            await createKeyResult(tx, objectiveId, {
              title: krTitle.replace('X', String(randomInt(10, 25))).replace('Y', String(randomInt(5, 15))),
              description: `Key result ${j + 1} for ${title}`,
              ownerId,
              metricType: randomChoice(metricTypes),
              startValue: randomFloat(50, 70),
              targetValue: randomFloat(80, 100),
              currentValue: randomFloat(60, 90),
              unit: 'percentage',
              status: krStatus,
              progress: krProgress,
              visibilityLevel: 'PUBLIC_TENANT',
              isPublished,
              checkInCadence: cadence,
              cycleId: cycle.id,
              startDate: cycle.start,
              endDate: cycle.end,
            });
            totalKRs++;
          }

          const initiativeCount = randomInt(1, 3);
          for (let k = 0; k < initiativeCount; k++) {
            const initTitle = generateInitiativeTitle(title, k);
            await createInitiative(tx, objectiveId, {
              title: initTitle,
              description: `Supporting initiative for ${title}`,
              ownerId,
              status: isArchived ? 'COMPLETED' : randomChoice(['IN_PROGRESS', 'NOT_STARTED', 'COMPLETED']),
              cycleId: cycle.id,
              startDate: cycle.start,
              endDate: cycle.end,
            });
            totalInitiatives++;
          }
        });

        totalObjectives++;
      }
    }

    for (const [key, teamId] of teamIds.entries()) {
      const [, teamName] = key.split(':');
      const shuffledTemplates = shuffle([...TEAM_OBJECTIVE_TEMPLATES]);

      for (let i = 0; i < config.teamObjectivesPerCycle; i++) {
        const template = shuffledTemplates[i % shuffledTemplates.length];
        const title = generateObjectiveTitle(template);
        const isPublished = randomFloat(0, 1) < publishRate;

        const status = generateRandomStatus(cycle.status);
        const progress = generateRandomProgress(status);

        const teamLeads = Array.from(userIds.entries())
          .filter(([email]) => email.includes(`team-lead-${teamName.toLowerCase().replace(/\s+/g, '-')}`))
          .map(([, id]) => id);
        const ownerId = teamLeads.length > 0 ? teamLeads[0] : founderId;

        await prisma.$transaction(async (tx) => {
          const objectiveId = await createObjective(tx, orgId, {
            title,
            description: `${template.verb} ${template.noun} for ${teamName} team`,
            scopeType: 'team',
            scopeId: teamId,
            cycleId: cycle.id,
            ownerId,
            visibilityLevel: 'PUBLIC_TENANT',
            isPublished,
            status,
            progress,
            startDate: cycle.start,
            endDate: cycle.end,
          });

          const krCount = randomInt(2, 4);
          const krCadences: CheckInCadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];
          const metricTypes: MetricType[] = ['INCREASE', 'DECREASE', 'REACH', 'MAINTAIN'];

          for (let j = 0; j < krCount; j++) {
            const krTitle = generateKeyResultTitle(template, j);
            const krStatus = generateRandomStatus(cycle.status);
            const krProgress = generateRandomProgress(krStatus);
            const cadence = randomChoice(krCadences);

            await createKeyResult(tx, objectiveId, {
              title: krTitle.replace('X', String(randomInt(10, 25))).replace('Y', String(randomInt(5, 15))),
              description: `Key result ${j + 1} for ${title}`,
              ownerId,
              metricType: randomChoice(metricTypes),
              startValue: randomFloat(50, 70),
              targetValue: randomFloat(80, 100),
              currentValue: randomFloat(60, 90),
              unit: 'percentage',
              status: krStatus,
              progress: krProgress,
              visibilityLevel: 'PUBLIC_TENANT',
              isPublished,
              checkInCadence: cadence,
              cycleId: cycle.id,
              startDate: cycle.start,
              endDate: cycle.end,
            });
            totalKRs++;
          }

          const initiativeCount = randomInt(1, 3);
          for (let k = 0; k < initiativeCount; k++) {
            const initTitle = generateInitiativeTitle(title, k);
            await createInitiative(tx, objectiveId, {
              title: initTitle,
              description: `Supporting initiative for ${title}`,
              ownerId,
              status: isArchived ? 'COMPLETED' : randomChoice(['IN_PROGRESS', 'NOT_STARTED', 'COMPLETED']),
              cycleId: cycle.id,
              startDate: cycle.start,
              endDate: cycle.end,
            });
            totalInitiatives++;
          }
        });

        totalObjectives++;
      }
    }
  }

  console.log(`✅ Created ${totalObjectives} objectives, ${totalKRs} key results, ${totalInitiatives} initiatives`);
}

if (require.main === module) {
  console.error('❌ This script should be run via the orchestrator');
  process.exit(1);
}

export { createOKRs };
