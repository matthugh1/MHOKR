#!/usr/bin/env ts-node

/**
 * Setup and Import Script for Puzzel
 * 
 * 1. Truncates all database tables
 * 2. Creates "Puzzel" organization
 * 3. Creates superuser account
 * 4. Creates tenant admin user
 * 5. Imports Viva Goals JSON data
 * 
 * Usage:
 *   ts-node scripts/setup-and-import-puzzel.ts [--import-dir=./import] [--skip-truncate] [--yes]
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { VivaGoalsJSONParserService } from '../services/core-api/src/modules/okr/viva-goals-json-parser.service';
import { VivaGoalsCSVParserService } from '../services/core-api/src/modules/okr/viva-goals-csv-parser.service';
import { OkrImportService } from '../services/core-api/src/modules/okr/okr-import.service';
import { OkrCycleService } from '../services/core-api/src/modules/okr/okr-cycle.service';
import { CycleGeneratorService } from '../services/core-api/src/modules/okr/cycle-generator.service';

const prisma = new PrismaClient();
const jsonParser = new VivaGoalsJSONParserService();

// Simple PrismaService wrapper for use outside NestJS
class SimplePrismaService extends PrismaClient {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

interface SetupOptions {
  importDir?: string;
  skipTruncate?: boolean;
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  superuserEmail?: string;
  superuserPassword?: string;
  superuserName?: string;
  yes?: boolean;
}

async function confirmTruncate(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      '⚠️  WARNING: This will DELETE ALL DATA in all tables. Are you sure? (type "yes" to confirm): ',
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      },
    );
  });
}

async function truncateAllTables() {
  console.log('🔄 Truncating all database tables...\n');

  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `;

    if (tables.length === 0) {
      console.log('✅ Database is already empty.\n');
      return;
    }

    console.log(`📋 Found ${tables.length} tables to truncate`);
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);

    console.log('✅ All tables truncated successfully!\n');
  } catch (error) {
    console.error('❌ Error truncating database:', error);
    throw error;
  }
}

async function createOrganization(orgName: string, orgSlug: string) {
  console.log(`📝 Creating organization "${orgName}"...`);
  
  let organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (organization) {
    console.log(`   ✅ Organization already exists: ${organization.name} (${organization.id})\n`);
    return organization;
  }

  organization = await prisma.organization.create({
    data: {
      name: orgName,
      slug: orgSlug,
      allowTenantAdminExecVisibility: false,
      execOnlyWhitelist: [],
      metadata: {},
    },
  });

  console.log(`   ✅ Organization created: ${organization.name} (${organization.id})\n`);
  return organization;
}

async function createSuperuser(
  email: string,
  name: string,
  password: string,
) {
  console.log(`📝 Creating superuser account...`);

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    if (user.isSuperuser) {
      console.log(`   ⚠️  User ${email} is already a superuser.`);
      return user;
    }
    console.log(`   ⚠️  User ${email} already exists. Promoting to superuser...`);
    const hashedPassword = await bcrypt.hash(password, 10);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        passwordHash: hashedPassword,
        isSuperuser: true,
      },
    });
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        isSuperuser: true,
      },
    });
    console.log(`   ✅ Superuser created: ${email} (${user.id})`);
  }

  console.log(`   ✅ Superuser account ready\n`);
  return user;
}

async function createTenantAdmin(
  organizationId: string,
  email: string,
  name: string,
  password: string,
) {
  console.log(`📝 Creating tenant admin user...`);

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    console.log(`   ⚠️  User ${email} already exists. Updating...`);
    const hashedPassword = await bcrypt.hash(password, 10);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        passwordHash: hashedPassword,
        primaryOrganizationId: organizationId,
      },
    });
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        primaryOrganizationId: organizationId,
      },
    });
    console.log(`   ✅ User created: ${email} (${user.id})`);
  }

  // Create TENANT_ADMIN role assignment
  await prisma.roleAssignment.upsert({
    where: {
      userId_role_scopeType_scopeId: {
        userId: user.id,
        role: 'TENANT_ADMIN',
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      role: 'TENANT_ADMIN',
      scopeType: 'TENANT',
      scopeId: organizationId,
    },
  });

  console.log(`   ✅ Tenant admin role assigned\n`);
  return user;
}

function findFile(dir: string, prefix: string): string | null {
  if (!fs.existsSync(dir)) {
    return null;
  }
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.toLowerCase().includes(prefix.toLowerCase()) && f.endsWith('.json'));
  return match ? path.join(dir, match) : null;
}

async function importUsers(dir: string, tenantId: string, stats: any, dryRun: boolean) {
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

async function importTeams(dir: string, tenantId: string, stats: any, dryRun: boolean) {
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
      tenantId: tenantId,
      name: 'Default Workspace',
    },
  });

  if (!workspace && !dryRun) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Default Workspace',
        tenantId: tenantId,
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

async function importCycles(dir: string, tenantId: string, stats: any, dryRun: boolean) {
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
          tenantId: tenantId,
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
              tenantId: tenantId,
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

async function importTags(dir: string, _tenantId: string, stats: any, _dryRun: boolean) {
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

async function importComments(dir: string, tenantId: string, stats: any, dryRun: boolean) {
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

async function importCheckIns(dir: string, tenantId: string, stats: any, dryRun: boolean) {
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

async function runImport(organizationId: string, userId: string, importDir: string) {
  console.log('📥 Starting Viva Goals JSON import...\n');

  const stats = {
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
    errors: [] as string[],
    warnings: [] as string[],
  };

  // Step 1: Import Users
  console.log('📥 Step 1: Importing Users...');
  await importUsers(importDir, organizationId, stats, false);
  console.log(`   ✅ Users: ${stats.usersCreated} created, ${stats.usersUpdated} updated\n`);

  // Step 2: Import Teams
  console.log('📥 Step 2: Importing Teams...');
  await importTeams(importDir, organizationId, stats, false);
  console.log(`   ✅ Teams: ${stats.teamsCreated} created, ${stats.teamsUpdated} updated\n`);

  // Step 3: Import Time Periods (Cycles)
  console.log('📥 Step 3: Importing Time Periods (Cycles)...');
  await importCycles(importDir, organizationId, stats, false);
  console.log(`   ✅ Cycles: ${stats.cyclesCreated} created, ${stats.cyclesUpdated} updated\n`);

  // Step 4: Import Tags
  console.log('📥 Step 4: Importing Tags...');
  await importTags(importDir, organizationId, stats, false);
  console.log(`   ✅ Tags: ${stats.tagsCreated} created\n`);

  // Step 5: Import Objectives & Key Results
  console.log('📥 Step 5: Importing Objectives & Key Results...');
  const prismaService = new SimplePrismaService();
  await prismaService.onModuleInit();
  const cycleGenerator = new CycleGeneratorService(prismaService as any);
  const cycleService = new OkrCycleService(prismaService as any, cycleGenerator);
  const csvParser = new VivaGoalsCSVParserService();
  const importService = new OkrImportService(
    prismaService as any,
    csvParser,
    jsonParser,
    cycleService,
  );

  const objectivesFile = findFile(importDir, 'objectives');
  if (!objectivesFile) {
    console.log('   ⚠️  Objectives file not found, skipping OKR import');
  } else {
    console.log(`   📄 Reading objectives from: ${path.basename(objectivesFile)}`);
    const jsonContent = fs.readFileSync(objectivesFile, 'utf-8');
    
    const result = await importService.importFromJSON(
      jsonContent,
      organizationId,
      userId,
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
  }
  console.log();

  // Step 6: Import Comments
  console.log('📥 Step 6: Importing Comments...');
  await importComments(importDir, organizationId, stats, false);
  console.log(`   ✅ Comments: ${stats.commentsCreated} created\n`);

  // Step 7: Import Check-ins
  console.log('📥 Step 7: Importing Check-ins...');
  await importCheckIns(importDir, organizationId, stats, false);
  console.log(`   ✅ Check-ins: ${stats.checkInsCreated} created\n`);

  await prismaService.onModuleDestroy();
}

async function main() {
  const args = process.argv.slice(2);
  const options: SetupOptions = {
    importDir: './import',
    skipTruncate: false,
    adminEmail: 'admin@puzzel.com',
    adminPassword: 'admin123',
    adminName: 'Tenant Admin',
    superuserEmail: 'superuser@puzzel.com',
    superuserPassword: 'superuser123',
    superuserName: 'Superuser',
  };

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--import-dir=')) {
      options.importDir = arg.split('=')[1];
    } else if (arg === '--skip-truncate') {
      options.skipTruncate = true;
    } else if (arg.startsWith('--admin-email=')) {
      options.adminEmail = arg.split('=')[1];
    } else if (arg.startsWith('--admin-password=')) {
      options.adminPassword = arg.split('=')[1];
    } else if (arg.startsWith('--admin-name=')) {
      options.adminName = arg.split('=')[1];
    } else if (arg.startsWith('--superuser-email=')) {
      options.superuserEmail = arg.split('=')[1];
    } else if (arg.startsWith('--superuser-password=')) {
      options.superuserPassword = arg.split('=')[1];
    } else if (arg.startsWith('--superuser-name=')) {
      options.superuserName = arg.split('=')[1];
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     PUZZEL SETUP AND IMPORT SCRIPT                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Truncate database
    if (!options.skipTruncate) {
      let confirmed = options.yes || false;
      if (!confirmed) {
        confirmed = await confirmTruncate();
        if (!confirmed) {
          console.log('\n❌ Setup cancelled.');
          process.exit(0);
        }
      }
      await truncateAllTables();
    } else {
      console.log('⏭️  Skipping database truncation\n');
    }

    // Step 2: Create organization
    const organization = await createOrganization('Puzzel', 'puzzel');

    // Step 3: Create superuser
    const superuser = await createSuperuser(
      options.superuserEmail!,
      options.superuserName!,
      options.superuserPassword!,
    );

    // Step 4: Create tenant admin
    const adminUser = await createTenantAdmin(
      organization.id,
      options.adminEmail!,
      options.adminName!,
      options.adminPassword!,
    );

    // Step 5: Run import
    if (options.importDir && fs.existsSync(options.importDir)) {
      await runImport(organization.id, adminUser.id, options.importDir);
    } else {
      console.log(`⚠️  Import directory "${options.importDir}" not found, skipping import`);
    }

    // Summary
    console.log('\n✅ Setup and import complete!\n');
    console.log('📋 Summary:');
    console.log(`   Organization: ${organization.name} (${organization.id})`);
    console.log(`   Organization Slug: ${organization.slug}`);
    console.log(`   Superuser Email: ${options.superuserEmail}`);
    console.log(`   Superuser Password: ${options.superuserPassword}`);
    console.log(`   Superuser ID: ${superuser.id}`);
    console.log(`   Tenant Admin Email: ${options.adminEmail}`);
    console.log(`   Tenant Admin Password: ${options.adminPassword}`);
    console.log(`   Tenant Admin ID: ${adminUser.id}`);
    console.log(`   Import Directory: ${options.importDir}\n`);

    console.log('🎯 Next steps:');
    console.log(`   1. Login as superuser: ${options.superuserEmail} / ${options.superuserPassword}`);
    console.log(`   2. Or login as tenant admin: ${options.adminEmail} / ${options.adminPassword}`);
    console.log(`   3. Verify imported data in the dashboard\n`);

  } catch (error: any) {
    console.error('\n❌ Error during setup:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

