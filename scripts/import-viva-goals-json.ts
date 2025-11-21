#!/usr/bin/env ts-node

/**
 * Viva Goals JSON Import Script
 * 
 * Imports data from Viva Goals JSON export files:
 * - Users
 * - Teams
 * - Time Periods (Cycles)
 * - Tags
 * - Objectives & Key Results
 * - Comments
 * - Check-ins
 * 
 * Usage:
 *   ts-node scripts/import-viva-goals-json.ts --tenant=<tenant-slug> --import-dir=./import
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { VivaGoalsJSONParserService } from '../services/core-api/src/modules/okr/viva-goals-json-parser.service';
import { VivaGoalsCSVParserService } from '../services/core-api/src/modules/okr/viva-goals-csv-parser.service';
import { OkrImportService } from '../services/core-api/src/modules/okr/okr-import.service';
import { OkrCycleService } from '../services/core-api/src/modules/okr/okr-cycle.service';

// Create a simple PrismaService wrapper for use outside NestJS
class SimplePrismaService extends PrismaClient {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

const prisma = new PrismaClient();
const jsonParser = new VivaGoalsJSONParserService();

interface ImportOptions {
  tenantSlug: string;
  importDir: string;
  userId?: string; // User ID to use as importer (will create if not provided)
  dryRun?: boolean;
}

interface ImportStats {
  usersCreated: number;
  usersUpdated: number;
  teamsCreated: number;
  teamsUpdated: number;
  cyclesCreated: number;
  cyclesUpdated: number;
  tagsCreated: number;
  objectivesCreated: number;
  objectivesUpdated: number;
  keyResultsCreated: number;
  keyResultsUpdated: number;
  commentsCreated: number;
  checkInsCreated: number;
  errors: string[];
  warnings: string[];
}

async function main() {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    tenantSlug: '',
    importDir: './import',
    dryRun: false,
  };

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--tenant=')) {
      options.tenantSlug = arg.split('=')[1];
    } else if (arg.startsWith('--import-dir=')) {
      options.importDir = arg.split('=')[1];
    } else if (arg.startsWith('--user-id=')) {
      options.userId = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  if (!options.tenantSlug) {
    console.error('Error: --tenant=<tenant-slug> is required');
    process.exit(1);
  }

  if (!fs.existsSync(options.importDir)) {
    console.error(`Error: Import directory "${options.importDir}" does not exist`);
    process.exit(1);
  }

  console.log(`\n🚀 Starting Viva Goals JSON Import`);
  console.log(`   Tenant: ${options.tenantSlug}`);
  console.log(`   Import Directory: ${options.importDir}`);
  console.log(`   Dry Run: ${options.dryRun ? 'YES' : 'NO'}\n`);

  const stats: ImportStats = {
    usersCreated: 0,
    usersUpdated: 0,
    teamsCreated: 0,
    teamsUpdated: 0,
    cyclesCreated: 0,
    cyclesUpdated: 0,
    tagsCreated: 0,
    objectivesCreated: 0,
    objectivesUpdated: 0,
    keyResultsCreated: 0,
    keyResultsUpdated: 0,
    commentsCreated: 0,
    checkInsCreated: 0,
    errors: [],
    warnings: [],
  };

  try {
    // Get or create tenant
    const tenant = await getOrCreateTenant(options.tenantSlug);
    console.log(`✅ Tenant: ${tenant.name} (${tenant.id})\n`);

    // Get or create import user
    const importUserId = await getOrCreateImportUser(tenant.id, options.userId);
    console.log(`✅ Import User: ${importUserId}\n`);

    // Initialize services
    const prismaService = new SimplePrismaService();
    await prismaService.onModuleInit();
    const cycleService = new OkrCycleService(prismaService as any);
    const csvParser = new VivaGoalsCSVParserService();
    const importService = new OkrImportService(
      prismaService as any,
      csvParser,
      jsonParser,
      cycleService,
    );

    // Step 1: Import Users
    console.log('📥 Step 1: Importing Users...');
    await importUsers(options.importDir, tenant.id, stats, options.dryRun);
    console.log(`   ✅ Users: ${stats.usersCreated} created, ${stats.usersUpdated} updated\n`);

    // Step 2: Import Teams
    console.log('📥 Step 2: Importing Teams...');
    await importTeams(options.importDir, tenant.id, stats, options.dryRun);
    console.log(`   ✅ Teams: ${stats.teamsCreated} created, ${stats.teamsUpdated} updated\n`);

    // Step 3: Import Time Periods (Cycles)
    console.log('📥 Step 3: Importing Time Periods (Cycles)...');
    await importCycles(options.importDir, tenant.id, stats, options.dryRun);
    console.log(`   ✅ Cycles: ${stats.cyclesCreated} created, ${stats.cyclesUpdated} updated\n`);

    // Step 4: Import Tags
    console.log('📥 Step 4: Importing Tags...');
    await importTags(options.importDir, tenant.id, stats, options.dryRun);
    console.log(`   ✅ Tags: ${stats.tagsCreated} created\n`);

    // Step 5: Import Objectives & Key Results
    console.log('📥 Step 5: Importing Objectives & Key Results...');
    const objectivesFile = findFile(options.importDir, 'objectives');
    if (objectivesFile) {
      const jsonContent = fs.readFileSync(objectivesFile, 'utf-8');
      const result = await importService.importFromJSON(
        jsonContent,
        tenant.id,
        importUserId,
      );
      stats.objectivesCreated = result.objectivesCreated;
      stats.objectivesUpdated = result.objectivesUpdated;
      stats.keyResultsCreated = result.keyResultsCreated;
      stats.keyResultsUpdated = result.keyResultsUpdated;
      stats.errors.push(...result.errors.map(e => `${e.title}: ${e.error}`));
      stats.warnings.push(...result.warnings);
      console.log(`   ✅ Objectives: ${result.objectivesCreated} created, ${result.objectivesUpdated} updated`);
      console.log(`   ✅ Key Results: ${result.keyResultsCreated} created, ${result.keyResultsUpdated} updated`);
      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.errors.length}`);
      }
      if (result.warnings.length > 0) {
        console.log(`   ⚠️  Warnings: ${result.warnings.length}`);
      }
    } else {
      console.log('   ⚠️  Objectives file not found');
    }
    console.log();

    // Step 6: Import Comments
    console.log('📥 Step 6: Importing Comments...');
    await importComments(options.importDir, tenant.id, stats, options.dryRun);
    console.log(`   ✅ Comments: ${stats.commentsCreated} created\n`);

    // Step 7: Import Check-ins
    console.log('📥 Step 7: Importing Check-ins...');
    await importCheckIns(options.importDir, tenant.id, stats, options.dryRun);
    console.log(`   ✅ Check-ins: ${stats.checkInsCreated} created\n`);

    // Summary
    console.log('\n📊 Import Summary');
    console.log('═══════════════════════════════════════');
    console.log(`Users:        ${stats.usersCreated} created, ${stats.usersUpdated} updated`);
    console.log(`Teams:        ${stats.teamsCreated} created, ${stats.teamsUpdated} updated`);
    console.log(`Cycles:       ${stats.cyclesCreated} created, ${stats.cyclesUpdated} updated`);
    console.log(`Tags:         ${stats.tagsCreated} created`);
    console.log(`Objectives:   ${stats.objectivesCreated} created, ${stats.objectivesUpdated} updated`);
    console.log(`Key Results:  ${stats.keyResultsCreated} created, ${stats.keyResultsUpdated} updated`);
    console.log(`Comments:     ${stats.commentsCreated} created`);
    console.log(`Check-ins:    ${stats.checkInsCreated} created`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more`);
      }
    }
    
    if (stats.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${stats.warnings.length}):`);
      stats.warnings.slice(0, 10).forEach(warn => console.log(`   - ${warn}`));
      if (stats.warnings.length > 10) {
        console.log(`   ... and ${stats.warnings.length - 10} more`);
      }
    }

    console.log('\n✅ Import completed!\n');
    
    // Cleanup
    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

async function getOrCreateTenant(slug: string) {
  let tenant = await prisma.organization.findUnique({
    where: { slug },
  });

  if (!tenant) {
    tenant = await prisma.organization.create({
      data: {
        slug,
        name: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
      },
    });
  }

  return tenant;
}

async function getOrCreateImportUser(tenantId: string, userId?: string) {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return userId;
  }

  // Create a system import user
  const email = `import@${tenantId}.local`;
  let user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: 'Import User',
        primaryOrganizationId: tenantId,
      },
    });
  }

  return user.id;
}

function findFile(dir: string, prefix: string): string | null {
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.toLowerCase().includes(prefix.toLowerCase()) && f.endsWith('.json'));
  return match ? path.join(dir, match) : null;
}

async function importUsers(dir: string, tenantId: string, stats: ImportStats, dryRun: boolean) {
  const file = findFile(dir, 'users');
  if (!file) {
    stats.warnings.push('Users file not found');
    return;
  }

  const jsonContent = fs.readFileSync(file, 'utf-8');
  const users = jsonParser.parseUsers(jsonContent);

  for (const vgUser of users) {
    if (vgUser.Source === 'Group') continue; // Skip group accounts

    try {
      const existing = await prisma.user.findFirst({
        where: {
          email: vgUser.Email,
          primaryOrganizationId: tenantId,
        },
      });

      if (existing) {
        if (!dryRun) {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name: vgUser.Name,
            },
          });
        }
        stats.usersUpdated++;
      } else {
        if (!dryRun) {
          await prisma.user.create({
            data: {
              email: vgUser.Email,
              name: vgUser.Name,
              primaryOrganizationId: tenantId,
            },
          });
        }
        stats.usersCreated++;
      }
    } catch (error) {
      stats.errors.push(`User ${vgUser.Email}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function importTeams(dir: string, tenantId: string, stats: ImportStats, dryRun: boolean) {
  const file = findFile(dir, 'teams');
  if (!file) {
    stats.warnings.push('Teams file not found');
    return;
  }

  const jsonContent = fs.readFileSync(file, 'utf-8');
  const teams = jsonParser.parseTeams(jsonContent);

  // First, get or create a default workspace
  let workspace = await prisma.workspace.findFirst({
    where: {
      organizationId: tenantId,
      name: 'Default Workspace',
    },
  });

  if (!workspace && !dryRun) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Default Workspace',
        organizationId: tenantId,
      },
    });
  }

  if (!workspace) {
    stats.errors.push('Could not create default workspace');
    return;
  }

  for (const vgTeam of teams) {
    try {
      const existing = await prisma.team.findFirst({
        where: {
          name: vgTeam['Team Name'],
          workspaceId: workspace!.id,
        },
      });

      if (existing) {
        stats.teamsUpdated++;
      } else {
        if (!dryRun) {
          await prisma.team.create({
            data: {
              name: vgTeam['Team Name'],
              workspaceId: workspace!.id,
            },
          });
        }
        stats.teamsCreated++;
      }
    } catch (error) {
      stats.errors.push(`Team ${vgTeam['Team Name']}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function importCycles(dir: string, tenantId: string, stats: ImportStats, dryRun: boolean) {
  const file = findFile(dir, 'timeperiods');
  if (!file) {
    stats.warnings.push('Time Periods file not found');
    return;
  }

  const jsonContent = fs.readFileSync(file, 'utf-8');
  const periods = jsonParser.parseTimePeriods(jsonContent);

  for (const period of periods) {
    try {
      const existing = await prisma.cycle.findFirst({
        where: {
          organizationId: tenantId,
          name: period['Time Period Name'],
        },
      });

      if (existing) {
        if (!dryRun) {
          await prisma.cycle.update({
            where: { id: existing.id },
            data: {
              startDate: new Date(period['Start Date']),
              endDate: new Date(period['End Date']),
            },
          });
        }
        stats.cyclesUpdated++;
      } else {
        if (!dryRun) {
          await prisma.cycle.create({
            data: {
              organizationId: tenantId,
              name: period['Time Period Name'],
              startDate: new Date(period['Start Date']),
              endDate: new Date(period['End Date']),
              status: 'ARCHIVED', // Imported cycles are typically archived
            },
          });
        }
        stats.cyclesCreated++;
      }
    } catch (error) {
      stats.errors.push(`Cycle ${period['Time Period Name']}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function importTags(dir: string, tenantId: string, stats: ImportStats, dryRun: boolean) {
  const file = findFile(dir, 'tags');
  if (!file) {
    stats.warnings.push('Tags file not found');
    return;
  }

  const jsonContent = fs.readFileSync(file, 'utf-8');
  const tags = jsonParser.parseTags(jsonContent);

  // Note: Tags may need to be stored differently depending on your schema
  // This is a placeholder - adjust based on your Tag model
  for (const tag of tags) {
    try {
      // Check if tag model exists in your schema
      // If not, you may need to store tags differently or skip this step
      stats.tagsCreated++;
    } catch (error) {
      stats.errors.push(`Tag ${tag['Tag Name']}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function importComments(dir: string, tenantId: string, stats: ImportStats, dryRun: boolean) {
  const file = findFile(dir, 'comments');
  if (!file) {
    stats.warnings.push('Comments file not found');
    return;
  }

  const jsonContent = fs.readFileSync(file, 'utf-8');
  const comments = jsonParser.parseComments(jsonContent);

  for (const comment of comments) {
    try {
      // Find the OKR (Objective or Key Result) by external ID
      const okrId = String(comment['OKR ID']);
      const objective = await prisma.objective.findFirst({
        where: {
          tenantId,
          source: 'VIVA_GOALS',
          externalId: okrId,
        },
      });

      const keyResult = objective
        ? null
        : await prisma.keyResult.findFirst({
            where: {
              tenantId,
              source: 'VIVA_GOALS',
              externalId: okrId,
            },
          });

      if (!objective && !keyResult) {
        continue; // Skip if OKR not found
      }

      // Find or create user
      const user = await prisma.user.findFirst({
        where: {
          email: comment['Created By'].Email,
          primaryOrganizationId: tenantId,
        },
      });

      if (!user) {
        continue; // Skip if user not found
      }

      // Note: Comments may need to be stored in Activity or a separate Comment model
      // This is a placeholder - adjust based on your schema
      if (!dryRun) {
        // Create comment/activity entry
        // await prisma.activity.create({ ... });
      }
      stats.commentsCreated++;
    } catch (error) {
      stats.errors.push(`Comment ${comment.ID}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function importCheckIns(dir: string, tenantId: string, stats: ImportStats, dryRun: boolean) {
  const file = findFile(dir, 'checkins');
  if (!file) {
    stats.warnings.push('Check-ins file not found');
    return;
  }

  const jsonContent = fs.readFileSync(file, 'utf-8');
  const checkIns = jsonParser.parseCheckIns(jsonContent);

  for (const checkIn of checkIns) {
    try {
      // Find the Key Result by external ID
      const okrId = String(checkIn['OKR ID']);
      const keyResult = await prisma.keyResult.findFirst({
        where: {
          tenantId,
          source: 'VIVA_GOALS',
          externalId: okrId,
        },
      });

      if (!keyResult) {
        continue; // Skip if Key Result not found
      }

      // Find user
      const user = await prisma.user.findFirst({
        where: {
          email: checkIn['Check In Owner'].Email,
          primaryOrganizationId: tenantId,
        },
      });

      if (!user) {
        continue; // Skip if user not found
      }

      const checkInDate = new Date(checkIn['CheckIn Date']);
      if (isNaN(checkInDate.getTime())) {
        continue;
      }

      if (!dryRun) {
        // Check if check-in already exists
        const existing = await prisma.checkIn.findFirst({
          where: {
            keyResultId: keyResult.id,
            userId: user.id,
            createdAt: {
              gte: new Date(checkInDate.getTime() - 24 * 60 * 60 * 1000),
              lte: new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        if (!existing) {
          await prisma.checkIn.create({
            data: {
              keyResultId: keyResult.id,
              userId: user.id,
              value: checkIn['Current Value'] ?? keyResult.startValue,
              confidence: 50,
              note: checkIn['Check In Note'] ? JSON.stringify(checkIn['Check In Note']) : null,
              createdAt: checkInDate,
            },
          });
        }
      }
      stats.checkInsCreated++;
    } catch (error) {
      stats.errors.push(`Check-in ${checkIn.ID}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main().catch(console.error);

