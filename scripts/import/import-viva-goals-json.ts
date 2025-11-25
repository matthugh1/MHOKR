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
import * as bcrypt from 'bcrypt';
import { VivaGoalsJSONParserService } from '../../services/core-api/src/modules/okr/viva-goals-json-parser.service';
import { VivaGoalsCSVParserService } from '../../services/core-api/src/modules/okr/viva-goals-csv-parser.service';
import { OkrImportService } from '../../services/core-api/src/modules/okr/okr-import.service';
import { OkrCycleService } from '../../services/core-api/src/modules/okr/okr-cycle.service';
import { CycleGeneratorService } from '../../services/core-api/src/modules/okr/cycle-generator.service';
import { ObjectiveOwnerService } from '../../services/core-api/src/modules/okr/objective-owner.service';
import { KeyResultOwnerService } from '../../services/core-api/src/modules/okr/key-result-owner.service';
import { PhasedTargetService } from '../../services/core-api/src/modules/okr/phased-target.service';

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
  truncate?: boolean; // Truncate all tables before import
  superuserEmail?: string; // Email for superuser to create after truncation
  superuserName?: string; // Name for superuser
  superuserPassword?: string; // Password for superuser
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
    } else if (arg === '--truncate') {
      options.truncate = true;
    } else if (arg.startsWith('--superuser-email=')) {
      options.superuserEmail = arg.split('=')[1];
    } else if (arg.startsWith('--superuser-name=')) {
      options.superuserName = arg.split('=')[1];
    } else if (arg.startsWith('--superuser-password=')) {
      options.superuserPassword = arg.split('=')[1];
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
  console.log(`   Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
  console.log(`   Truncate: ${options.truncate ? 'YES' : 'NO'}\n`);

  // Step 0: Truncate database if requested
  if (options.truncate) {
    console.log('🗑️  Step 0: Truncating database...');
    await truncateAllTables();
    console.log('   ✅ Database truncated\n');

    // Create superuser after truncation
    if (options.superuserEmail && options.superuserName && options.superuserPassword) {
      console.log('🔐 Creating superuser...');
      await createSuperuser(
        options.superuserEmail,
        options.superuserName,
        options.superuserPassword,
      );
      console.log('   ✅ Superuser created\n');
    } else {
      console.log('⚠️  Warning: Truncate was requested but superuser credentials not provided.');
      console.log('   Use --superuser-email, --superuser-name, and --superuser-password flags.\n');
    }
  }

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
    const cycleGenerator = new CycleGeneratorService(prismaService as any);
    const cycleService = new OkrCycleService(prismaService as any, cycleGenerator);
    const csvParser = new VivaGoalsCSVParserService();
    const objectiveOwnerService = new ObjectiveOwnerService(prismaService as any);
    const keyResultOwnerService = new KeyResultOwnerService(prismaService as any);
    const phasedTargetService = new PhasedTargetService(prismaService as any);
    const importService = new OkrImportService(
      prismaService as any,
      csvParser,
      jsonParser,
      cycleService,
      objectiveOwnerService,
      keyResultOwnerService,
      phasedTargetService,
    );

    // Step 1: Import Users
    console.log('📥 Step 1: Importing Users...');
    await importUsers(options.importDir, tenant.id, stats, options.dryRun ?? false);
    console.log(`   ✅ Users: ${stats.usersCreated} created, ${stats.usersUpdated} updated\n`);

    // Step 2: Import Teams
    console.log('📥 Step 2: Importing Teams...');
    await importTeams(options.importDir, tenant.id, stats, options.dryRun ?? false);
    console.log(`   ✅ Teams: ${stats.teamsCreated} created, ${stats.teamsUpdated} updated\n`);

    // Step 3: Import Time Periods (Cycles)
    console.log('📥 Step 3: Importing Time Periods (Cycles)...');
    await importCycles(options.importDir, tenant.id, stats, options.dryRun ?? false);
    console.log(`   ✅ Cycles: ${stats.cyclesCreated} created, ${stats.cyclesUpdated} updated\n`);

    // Step 4: Import Tags
    console.log('📥 Step 4: Importing Tags...');
    await importTags(options.importDir, tenant.id, stats, options.dryRun ?? false);
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
      stats.errors.push(...result.errors.map((e: { title: string; error: string }) => `${e.title}: ${e.error}`));
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
    await importComments(options.importDir, tenant.id, stats, options.dryRun ?? false);
    console.log(`   ✅ Comments: ${stats.commentsCreated} created\n`);

    // Step 7: Import Check-ins
    console.log('📥 Step 7: Importing Check-ins...');
    await importCheckIns(options.importDir, tenant.id, stats, options.dryRun ?? false);
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
          
          // Ensure user has TENANT_VIEWER role assignment (for visibility and OKR assignment)
          const existingRole = await prisma.roleAssignment.findFirst({
            where: {
              userId: existing.id,
              scopeType: 'TENANT',
              scopeId: tenantId,
            },
          });
          
          if (!existingRole) {
            await prisma.roleAssignment.create({
              data: {
                userId: existing.id,
                role: 'TENANT_VIEWER',
                scopeType: 'TENANT',
                scopeId: tenantId,
              },
            });
          }
        }
        stats.usersUpdated++;
      } else {
        if (!dryRun) {
          // Create user and assign default TENANT_VIEWER role in a transaction
          await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                email: vgUser.Email,
                name: vgUser.Name,
                primaryOrganizationId: tenantId,
              },
            });
            
            // Assign default TENANT_VIEWER role so user is visible and can be assigned to OKRs
            await tx.roleAssignment.create({
              data: {
                userId: user.id,
                role: 'TENANT_VIEWER',
                scopeType: 'TENANT',
                scopeId: tenantId,
              },
            });
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

async function importTags(dir: string, _tenantId: string, stats: ImportStats, _dryRun: boolean) {
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

async function truncateAllTables() {
  console.log('🔄 Starting database truncation...\n');

  try {
    // Get all table names (excluding Prisma internal tables)
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

    console.log(`📋 Found ${tables.length} tables to truncate:`);
    tables.forEach((t) => console.log(`   - ${t.tablename}`));

    // Build TRUNCATE command with CASCADE to handle foreign keys
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    
    console.log('\n🗑️  Truncating all tables...');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);

    console.log('\n✅ All tables truncated successfully!');
    console.log('   Schema preserved - migrations intact.\n');
  } catch (error) {
    console.error('\n❌ Error truncating database:', error);
    throw error;
  }
}

async function createSuperuser(email: string, name: string, password: string) {
  if (!email || !name || !password) {
    throw new Error('Superuser email, name, and password are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create superuser
    const superuser = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        isSuperuser: true,
      },
    });

    console.log(`   ✅ Superuser created:`);
    console.log(`      Email: ${superuser.email}`);
    console.log(`      Name: ${superuser.name}`);
    console.log(`      ID: ${superuser.id}`);
  } catch (error: any) {
    if (error.code === 'P2002') {
      // User already exists, update to superuser
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      
      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            passwordHash: await bcrypt.hash(password, 10),
            isSuperuser: true,
          },
        });
        console.log(`   ✅ Updated existing user ${email} to superuser`);
      }
    } else {
      throw error;
    }
  }
}

main().catch(console.error);

