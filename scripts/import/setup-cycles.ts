#!/usr/bin/env ts-node

/**
 * Cycle Pre-Generation Script
 * 
 * Creates standard cycles (quarterly and annual) for a tenant.
 * This should be run BEFORE importing Viva Goals data to avoid cycle creation errors.
 * 
 * Usage:
 *   DATABASE_URL="..." npx ts-node scripts/import/setup-cycles.ts --tenant=<tenant-slug> [--years=3] [--start-year=2023]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CycleSetupOptions {
  tenantSlug: string;
  years: number;       // How many years to generate
  startYear: number;   // First year to generate
}

interface CycleDefinition {
  name: string;
  startDate: Date;
  endDate: Date;
  isStandard: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: CycleSetupOptions = {
    tenantSlug: '',
    years: 3,
    startYear: 2023,
  };

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--tenant=')) {
      options.tenantSlug = arg.split('=')[1];
    } else if (arg.startsWith('--years=')) {
      options.years = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--start-year=')) {
      options.startYear = parseInt(arg.split('=')[1], 10);
    }
  }

  if (!options.tenantSlug) {
    console.error('Error: --tenant=<tenant-slug> is required');
    process.exit(1);
  }

  console.log(`\n🗓️  Cycle Pre-Generation Script`);
  console.log(`   Tenant: ${options.tenantSlug}`);
  console.log(`   Years: ${options.startYear} to ${options.startYear + options.years - 1}`);
  console.log();

  try {
    // Get or create tenant
    let tenant = await prisma.organization.findUnique({
      where: { slug: options.tenantSlug },
    });

    if (!tenant) {
      tenant = await prisma.organization.create({
        data: {
          slug: options.tenantSlug,
          name: options.tenantSlug.charAt(0).toUpperCase() + options.tenantSlug.slice(1).replace(/-/g, ' '),
        },
      });
      console.log(`✅ Created tenant: ${tenant.name}`);
    } else {
      console.log(`✅ Using existing tenant: ${tenant.name}`);
    }

    // Generate cycle definitions
    const cycles = generateCycleDefinitions(options.startYear, options.years);
    console.log(`\n📅 Generating ${cycles.length} cycles...\n`);

    let created = 0;
    let skipped = 0;

    for (const cycle of cycles) {
      try {
        // Check if cycle already exists by name and approximate dates
        const existing = await prisma.cycle.findFirst({
          where: {
            tenantId: tenant.id,
            name: cycle.name,
          },
        });

        if (existing) {
          // Update dates if needed
          const existingStart = existing.startDate.toISOString().split('T')[0];
          const existingEnd = existing.endDate.toISOString().split('T')[0];
          const newStart = cycle.startDate.toISOString().split('T')[0];
          const newEnd = cycle.endDate.toISOString().split('T')[0];
          
          if (existingStart !== newStart || existingEnd !== newEnd) {
            await prisma.cycle.update({
              where: { id: existing.id },
              data: {
                startDate: cycle.startDate,
                endDate: cycle.endDate,
              },
            });
            console.log(`   🔄 Updated: ${cycle.name} (${newStart} to ${newEnd})`);
          } else {
            console.log(`   ⏭️  Exists: ${cycle.name}`);
          }
          skipped++;
        } else {
          // Create new cycle - bypass validation for imports
          await prisma.cycle.create({
            data: {
              tenantId: tenant.id,
              name: cycle.name,
              startDate: cycle.startDate,
              endDate: cycle.endDate,
              status: isCurrentOrFutureCycle(cycle) ? 'ACTIVE' : 'ARCHIVED',
              isStandard: cycle.isStandard,
            },
          });
          console.log(`   ✅ Created: ${cycle.name} (${cycle.startDate.toISOString().split('T')[0]} to ${cycle.endDate.toISOString().split('T')[0]})`);
          created++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${cycle.name} - ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`\n📊 Summary`);
    console.log(`═══════════════════════════════════════`);
    console.log(`Created: ${created}`);
    console.log(`Skipped/Updated: ${skipped}`);
    console.log(`\n✅ Cycle setup complete!\n`);

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate cycle definitions for given years
 */
function generateCycleDefinitions(startYear: number, years: number): CycleDefinition[] {
  const cycles: CycleDefinition[] = [];

  for (let year = startYear; year < startYear + years; year++) {
    // Q1: Jan 1 - Mar 31
    cycles.push({
      name: `Q1 ${year}`,
      startDate: new Date(`${year}-01-01`),
      endDate: new Date(`${year}-03-31`),
      isStandard: true,
    });

    // Q2: Apr 1 - Jun 30
    cycles.push({
      name: `Q2 ${year}`,
      startDate: new Date(`${year}-04-01`),
      endDate: new Date(`${year}-06-30`),
      isStandard: true,
    });

    // Q3: Jul 1 - Sep 30
    cycles.push({
      name: `Q3 ${year}`,
      startDate: new Date(`${year}-07-01`),
      endDate: new Date(`${year}-09-30`),
      isStandard: true,
    });

    // Q4: Oct 1 - Dec 31
    cycles.push({
      name: `Q4 ${year}`,
      startDate: new Date(`${year}-10-01`),
      endDate: new Date(`${year}-12-31`),
      isStandard: true,
    });

    // Annual: Jan 1 - Dec 31
    cycles.push({
      name: `Annual ${year}`,
      startDate: new Date(`${year}-01-01`),
      endDate: new Date(`${year}-12-31`),
      isStandard: true,
    });

    // H1: Jan 1 - Jun 30
    cycles.push({
      name: `H1 ${year}`,
      startDate: new Date(`${year}-01-01`),
      endDate: new Date(`${year}-06-30`),
      isStandard: true,
    });

    // H2: Jul 1 - Dec 31
    cycles.push({
      name: `H2 ${year}`,
      startDate: new Date(`${year}-07-01`),
      endDate: new Date(`${year}-12-31`),
      isStandard: true,
    });
  }

  // Sort by start date
  cycles.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return cycles;
}

/**
 * Check if cycle is current or future (for setting status)
 */
function isCurrentOrFutureCycle(cycle: CycleDefinition): boolean {
  const now = new Date();
  return cycle.endDate >= now;
}

main().catch(console.error);

