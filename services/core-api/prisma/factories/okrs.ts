/**
 * OKR Factory
 * 
 * Generates deterministic OKR data (objectives, key results, initiatives) for seeding.
 */

import { PrismaClient, VisibilityLevel, OKRStatus, MetricType, InitiativeStatus, CheckInCadence } from '@prisma/client';
import { generateObjectiveId, generateKeyResultId, generateInitiativeId } from './ids';
import { randomFloat, weightedChoice } from './rng';

export interface ObjectiveSeedData {
  title: string;
  description?: string;
  scopeType: 'tenant' | 'workspace' | 'team';
  scopeId: string | null;
  cycleId: string;
  ownerId: string;
  visibilityLevel: VisibilityLevel;
  isPublished: boolean;
  status: OKRStatus;
  progress: number;
  startDate: Date;
  endDate: Date;
  pillarId?: string;
}

export interface KeyResultSeedData {
  title: string;
  description?: string;
  ownerId: string;
  metricType: MetricType;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit?: string;
  status: OKRStatus;
  progress: number;
  visibilityLevel: VisibilityLevel;
  isPublished: boolean;
  checkInCadence: CheckInCadence | null;
  cycleId: string;
  startDate: Date;
  endDate: Date;
}

export interface InitiativeSeedData {
  title: string;
  description?: string;
  ownerId: string;
  status: InitiativeStatus;
  cycleId: string;
  startDate: Date;
  endDate: Date;
}

type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export async function createObjective(
  prisma: PrismaClient | PrismaTransactionClient,
  orgId: string,
  data: ObjectiveSeedData,
): Promise<string> {
  const objectiveId = generateObjectiveId(
    orgId,
    data.scopeType,
    data.scopeId,
    data.cycleId,
    data.title,
  );

  const existing = await prisma.objective.findFirst({
    where: {
      organizationId: orgId,
      workspaceId: data.scopeType === 'workspace' ? data.scopeId : null,
      teamId: data.scopeType === 'team' ? data.scopeId : null,
      cycleId: data.cycleId,
      title: data.title,
    },
  });

  const objectiveData = {
    title: data.title,
    description: data.description,
    organizationId: data.scopeType === 'tenant' ? orgId : null,
    workspaceId: data.scopeType === 'workspace' ? data.scopeId : null,
    teamId: data.scopeType === 'team' ? data.scopeId : null,
    cycleId: data.cycleId,
    ownerId: data.ownerId,
    visibilityLevel: data.visibilityLevel,
    isPublished: data.isPublished,
    status: data.status,
    progress: data.progress,
    startDate: data.startDate,
    endDate: data.endDate,
    pillarId: data.pillarId || null,
  };

  if (existing) {
    await prisma.objective.update({
      where: { id: existing.id },
      data: objectiveData,
    });
    return existing.id;
  }

  const objective = await prisma.objective.create({
    data: {
      id: objectiveId,
      ...objectiveData,
    },
  });

  return objective.id;
}

export async function createKeyResult(
  prisma: PrismaClient | PrismaTransactionClient,
  objectiveId: string,
  data: KeyResultSeedData,
): Promise<string> {
  const keyResultId = generateKeyResultId(objectiveId, data.title);

  const existing = await prisma.keyResult.findFirst({
    where: {
      title: data.title,
      ownerId: data.ownerId,
      cycleId: data.cycleId,
    },
  });

  const keyResultData = {
    title: data.title,
    description: data.description,
    ownerId: data.ownerId,
    metricType: data.metricType,
    startValue: data.startValue,
    targetValue: data.targetValue,
    currentValue: data.currentValue,
    unit: data.unit,
    status: data.status,
    progress: data.progress,
    visibilityLevel: data.visibilityLevel,
    isPublished: data.isPublished,
    checkInCadence: data.checkInCadence,
    cycleId: data.cycleId,
    startDate: data.startDate,
    endDate: data.endDate,
  };

  if (existing) {
    await prisma.keyResult.update({
      where: { id: existing.id },
      data: keyResultData,
    });
    return existing.id;
  }

  const keyResult = await prisma.keyResult.create({
    data: {
      id: keyResultId,
      ...keyResultData,
    },
  });

  await prisma.objectiveKeyResult.upsert({
    where: {
      objectiveId_keyResultId: {
        objectiveId: objectiveId,
        keyResultId: keyResult.id,
      },
    },
    update: {},
    create: {
      objectiveId: objectiveId,
      keyResultId: keyResult.id,
    },
  });

  return keyResult.id;
}

export async function createInitiative(
  prisma: PrismaClient | PrismaTransactionClient,
  objectiveId: string,
  data: InitiativeSeedData,
): Promise<string> {
  const initiativeId = generateInitiativeId(objectiveId, data.title);

  const existing = await prisma.initiative.findFirst({
    where: {
      objectiveId: objectiveId,
      title: data.title,
    },
  });

  const initiativeData = {
    title: data.title,
    description: data.description,
    objectiveId: objectiveId,
    cycleId: data.cycleId,
    ownerId: data.ownerId,
    status: data.status,
    startDate: data.startDate,
    endDate: data.endDate,
  };

  if (existing) {
    await prisma.initiative.update({
      where: { id: existing.id },
      data: initiativeData,
    });
    return existing.id;
  }

  const initiative = await prisma.initiative.create({
    data: {
      id: initiativeId,
      ...initiativeData,
    },
  });

  return initiative.id;
}

export function generateRandomStatus(cycleStatus: string): OKRStatus {
  if (cycleStatus === 'ARCHIVED') {
    return weightedChoice([
      { item: 'COMPLETED' as OKRStatus, weight: 0.8 },
      { item: 'ON_TRACK' as OKRStatus, weight: 0.2 },
    ]);
  }

  return weightedChoice([
    { item: 'ON_TRACK' as OKRStatus, weight: 0.6 },
    { item: 'AT_RISK' as OKRStatus, weight: 0.25 },
    { item: 'OFF_TRACK' as OKRStatus, weight: 0.05 },
    { item: 'COMPLETED' as OKRStatus, weight: 0.1 },
  ]);
}

export function generateRandomProgress(status: OKRStatus): number {
  switch (status) {
    case 'COMPLETED':
      return randomFloat(95, 100);
    case 'ON_TRACK':
      return randomFloat(40, 80);
    case 'AT_RISK':
      return randomFloat(20, 50);
    case 'OFF_TRACK':
      return randomFloat(0, 30);
    case 'CANCELLED':
      return randomFloat(0, 20);
    default:
      return randomFloat(0, 100);
  }
}

export type SeedSize = 'tiny' | 'demo' | 'full';

export interface SeedSizeConfig {
  tenantObjectivesPerCycle: number;
  workspaceObjectivesPerCycle: number;
  teamObjectivesPerCycle: number;
}

export const SEED_SIZE_CONFIGS: Record<SeedSize, SeedSizeConfig> = {
  tiny: {
    tenantObjectivesPerCycle: 2,
    workspaceObjectivesPerCycle: 1,
    teamObjectivesPerCycle: 1,
  },
  demo: {
    tenantObjectivesPerCycle: 6,
    workspaceObjectivesPerCycle: 3,
    teamObjectivesPerCycle: 2,
  },
  full: {
    tenantObjectivesPerCycle: 8,
    workspaceObjectivesPerCycle: 5,
    teamObjectivesPerCycle: 3,
  },
};

export const TENANT_OBJECTIVE_TEMPLATES = [
  { verb: 'Improve', noun: 'Customer Satisfaction', metric: 'NPS' },
  { verb: 'Drive', noun: 'Revenue Growth', metric: 'revenue' },
  { verb: 'Enhance', noun: 'Product Quality', metric: 'defect rate' },
  { verb: 'Accelerate', noun: 'Time to Market', metric: 'release cycle' },
  { verb: 'Strengthen', noun: 'Team Engagement', metric: 'eNPS' },
  { verb: 'Optimise', noun: 'Operational Efficiency', metric: 'cost per unit' },
  { verb: 'Expand', noun: 'Market Presence', metric: 'market share' },
  { verb: 'Build', noun: 'Strategic Partnerships', metric: 'partnerships' },
];

export const WORKSPACE_OBJECTIVE_TEMPLATES: Record<string, Array<{ verb: string; noun: string; metric: string }>> = {
  Sales: [
    { verb: 'Increase', noun: 'Sales Pipeline', metric: 'pipeline value' },
    { verb: 'Improve', noun: 'Win Rate', metric: 'conversion rate' },
    { verb: 'Reduce', noun: 'Sales Cycle Length', metric: 'days to close' },
    { verb: 'Enhance', noun: 'Account Management', metric: 'retention rate' },
    { verb: 'Grow', noun: 'Enterprise Accounts', metric: 'new accounts' },
  ],
  Support: [
    { verb: 'Improve', noun: 'First Contact Resolution', metric: 'FCR rate' },
    { verb: 'Reduce', noun: 'Average Handling Time', metric: 'AHT' },
    { verb: 'Increase', noun: 'Customer Satisfaction', metric: 'CSAT' },
    { verb: 'Enhance', noun: 'Knowledge Base', metric: 'article views' },
    { verb: 'Optimise', noun: 'Support Efficiency', metric: 'tickets per agent' },
  ],
  Marketing: [
    { verb: 'Increase', noun: 'Lead Generation', metric: 'MQLs' },
    { verb: 'Improve', noun: 'Content Engagement', metric: 'engagement rate' },
    { verb: 'Grow', noun: 'Brand Awareness', metric: 'brand mentions' },
    { verb: 'Optimise', noun: 'Conversion Funnel', metric: 'conversion rate' },
    { verb: 'Enhance', noun: 'Marketing ROI', metric: 'ROI' },
  ],
  Product: [
    { verb: 'Launch', noun: 'New Features', metric: 'features shipped' },
    { verb: 'Improve', noun: 'User Experience', metric: 'usability score' },
    { verb: 'Increase', noun: 'Product Adoption', metric: 'adoption rate' },
    { verb: 'Enhance', noun: 'Product Quality', metric: 'bug rate' },
    { verb: 'Accelerate', noun: 'Innovation', metric: 'patents filed' },
  ],
  Engineering: [
    { verb: 'Improve', noun: 'Code Quality', metric: 'code coverage' },
    { verb: 'Reduce', noun: 'Deployment Time', metric: 'deployment frequency' },
    { verb: 'Enhance', noun: 'System Reliability', metric: 'uptime' },
    { verb: 'Optimise', noun: 'Performance', metric: 'response time' },
    { verb: 'Increase', noun: 'Developer Productivity', metric: 'velocity' },
  ],
  People: [
    { verb: 'Improve', noun: 'Employee Retention', metric: 'retention rate' },
    { verb: 'Enhance', noun: 'Learning & Development', metric: 'training hours' },
    { verb: 'Strengthen', noun: 'Company Culture', metric: 'engagement score' },
    { verb: 'Accelerate', noun: 'Talent Acquisition', metric: 'time to hire' },
    { verb: 'Optimise', noun: 'Performance Management', metric: 'review completion' },
  ],
};

export const TEAM_OBJECTIVE_TEMPLATES = [
  { verb: 'Deliver', noun: 'Quarterly Goals', metric: 'goals achieved' },
  { verb: 'Improve', noun: 'Team Velocity', metric: 'sprint velocity' },
  { verb: 'Enhance', noun: 'Collaboration', metric: 'cross-team work' },
  { verb: 'Reduce', noun: 'Technical Debt', metric: 'debt points' },
  { verb: 'Increase', noun: 'Code Quality', metric: 'code review score' },
];

export function generateObjectiveTitle(
  template: { verb: string; noun: string; metric: string },
): string {
  return `${template.verb} ${template.noun}`;
}

export function generateKeyResultTitle(
  template: { verb: string; noun: string; metric: string },
  index: number,
): string {
  const actions = [
    `Raise ${template.metric} by X%`,
    `Reduce ${template.metric} by Y%`,
    `Achieve ${template.metric} target`,
    `Improve ${template.metric} score`,
  ];
  return actions[index % actions.length];
}

export function generateInitiativeTitle(
  objectiveTitle: string,
  index: number,
): string {
  const prefixes = [
    'Launch',
    'Implement',
    'Deploy',
    'Complete',
    'Enhance',
  ];
  const suffix = objectiveTitle.split(' ').slice(1).join(' ');
  return `${prefixes[index % prefixes.length]} ${suffix} Initiative`;
}
