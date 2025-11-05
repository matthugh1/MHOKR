#!/usr/bin/env ts-node

/**
 * Seed Orchestrator
 * 
 * Orchestrates the seed suite execution with dry-run, purge, and run modes.
 * Supports size presets: tiny (~30 objectives), demo (~160), full (~260).
 */

import { PrismaClient } from '@prisma/client';
import { bootstrapTenant } from './01_bootstrap_tenant';
import { createWorkspacesAndTeams } from './02_workspaces_teams';
import { createUsersAndRoles } from './03_users_and_roles';
import { createCycles } from './04_cycles';
import { createOKRs } from './05_okrs_objectives_krs';
import { createCheckInsAndRequests } from './07_checkins_and_requests';
import { configureRBACWhitelists } from './08_rbac_whitelists';
import { SEED_SIZE_CONFIGS, SeedSize } from '../../services/core-api/prisma/factories/okrs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const TENANT_SLUG = 'puzzel-cx-demo';

interface SeedOptions {
  dryRun: boolean;
  purge: boolean;
  tenant?: string;
  report: boolean;
  size: SeedSize;
}

function calculateCounts(size: SeedSize): Record<string, number> {
  const config = SEED_SIZE_CONFIGS[size];
  const cycles = ['Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026'];
  const tenantObjs = config.tenantObjectivesPerCycle * cycles.length;
  const workspaceObjs = config.workspaceObjectivesPerCycle * 6 * cycles.length;
  const teamObjs = config.teamObjectivesPerCycle * 20 * cycles.length;
  const totalObjectives = tenantObjs + workspaceObjs + teamObjs;
  const avgKRsPerObj = 3;
  const avgInitiativesPerObj = 2;

  return {
    organisations: 1,
    workspaces: 6,
    teams: 20,
    users: size === 'tiny' ? 25 : 200,
    cycles: 4,
    objectives: totalObjectives,
    keyResults: totalObjectives * avgKRsPerObj,
    initiatives: totalObjectives * avgInitiativesPerObj,
    checkIns: Math.floor(totalObjectives * avgKRsPerObj * 5),
    checkInRequests: 30,
    roleAssignments: size === 'tiny' ? 30 : 250,
  };
}

async function parseArgs(): Promise<SeedOptions> {
  const args = process.argv.slice(2);
  const options: SeedOptions = {
    dryRun: false,
    purge: false,
    report: false,
    size: 'demo',
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--purge') {
      options.purge = true;
    } else if (arg === '--report') {
      options.report = true;
    } else if (arg.startsWith('--tenant=')) {
      options.tenant = arg.split('=')[1];
    } else if (arg.startsWith('--size=')) {
      const sizeValue = arg.split('=')[1];
      if (['tiny', 'demo', 'full'].includes(sizeValue)) {
        options.size = sizeValue as SeedSize;
      }
    } else if (arg === '--size=tiny' || arg === '--size=demo' || arg === '--size=full') {
      options.size = arg.split('=')[1] as SeedSize;
    }
  }

  return options;
}

async function dryRun(size: SeedSize): Promise<void> {
  console.log(`🔍 DRY RUN MODE - No database writes (size: ${size})\n`);

  const counts = calculateCounts(size);

  console.log('📊 Planned Seed Data:');
  Object.entries(counts).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  const reportPath = path.join(__dirname, '../../docs/audit/SEED_DRY_RUN_REPORT.md');
  const reportContent = `# Seed Dry Run Report

**Generated:** ${new Date().toISOString()}
**Size:** ${size}

## Planned Counts

${Object.entries(counts).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}

## Configuration

- Tenant objectives per cycle: ${SEED_SIZE_CONFIGS[size].tenantObjectivesPerCycle}
- Workspace objectives per cycle: ${SEED_SIZE_CONFIGS[size].workspaceObjectivesPerCycle}
- Team objectives per cycle: ${SEED_SIZE_CONFIGS[size].teamObjectivesPerCycle}

## Notes

- All IDs will be deterministically generated via UUIDv5
- Seed is idempotent: re-running will not create duplicates
- Tenant slug: \`${TENANT_SLUG}\`
`;

  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n✅ Dry run report written to: ${reportPath}`);
}

async function purgeTenant(slug: string): Promise<void> {
  console.log(`🗑️  Purging tenant: ${slug}`);

  const org = await prisma.organization.findUnique({
    where: { slug },
  });

  if (!org) {
    console.log(`⚠️  Tenant not found: ${slug}`);
    return;
  }

  await prisma.organization.delete({
    where: { id: org.id },
  });

  console.log(`✅ Purged tenant: ${slug}`);
}

async function runSeed(tenantSlug: string, size: SeedSize): Promise<void> {
  console.log(`🌱 Running seed for tenant: ${tenantSlug} (size: ${size})\n`);

  const { orgId } = await bootstrapTenant();
  console.log('');

  const { workspaceIds, teamIds } = await createWorkspacesAndTeams(orgId);
  console.log('');

  const userIds = await createUsersAndRoles(orgId, workspaceIds, teamIds);
  console.log('');

  const cycleIds = await createCycles(orgId);
  console.log('');

  await createOKRs(orgId, workspaceIds, teamIds, cycleIds, userIds, size);
  console.log('');

  await createCheckInsAndRequests(orgId, cycleIds);
  console.log('');

  await configureRBACWhitelists(orgId, userIds);
  console.log('');

  console.log('✅ Seed complete!');
}

async function main(): Promise<void> {
  const options = await parseArgs();

  try {
    if (options.dryRun) {
      await dryRun(options.size);
      return;
    }

    if (options.purge) {
      const slug = options.tenant || TENANT_SLUG;
      await purgeTenant(slug);
      return;
    }

    const tenantSlug = options.tenant || TENANT_SLUG;
    await runSeed(tenantSlug, options.size);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { main, dryRun, purgeTenant, runSeed };
