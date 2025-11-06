/**
 * Cycle Factory
 * 
 * Generates deterministic cycle data for seeding.
 */

import { PrismaClient, CycleStatus } from '@prisma/client';
import { generateCycleId } from './ids';

export interface CycleSeedData {
  name: string;
  status: CycleStatus;
  startDate: Date;
  endDate: Date;
  isStandard: boolean;
}

export async function createCycle(
  prisma: PrismaClient,
  orgId: string,
  data: CycleSeedData,
): Promise<string> {
  const cycleId = generateCycleId(orgId, data.name);

  const existing = await prisma.cycle.findFirst({
    where: {
      organizationId: orgId,
      name: data.name,
    },
  });

  if (existing) {
    await prisma.cycle.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        isStandard: data.isStandard,
      },
    });
    return existing.id;
  }

  const cycle = await prisma.cycle.create({
    data: {
      id: cycleId,
      organizationId: orgId,
      name: data.name,
      status: data.status,
      startDate: data.startDate,
      endDate: data.endDate,
      isStandard: data.isStandard,
    },
  });

  return cycle.id;
}

export const STANDARD_CYCLES: CycleSeedData[] = [
  {
    name: 'Q4 2025',
    status: 'ACTIVE',
    startDate: new Date('2025-10-01'),
    endDate: new Date('2025-12-31'),
    isStandard: true,
  },
  {
    name: 'Q1 2026',
    status: 'ACTIVE',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-03-31'),
    isStandard: true,
  },
  {
    name: 'Q2 2026',
    status: 'DRAFT',
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-06-30'),
    isStandard: true,
  },
  {
    name: 'Q3 2026',
    status: 'ARCHIVED',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-09-30'),
    isStandard: true,
  },
];

