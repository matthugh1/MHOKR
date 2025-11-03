/**
 * Migration script to copy data from local PostgreSQL (5432) to Docker PostgreSQL (5433)
 * 
 * This ensures we have a single source of truth in the Docker database.
 * 
 * Run with: npx ts-node scripts/migrate-database-5432-to-5433.ts
 */

import { PrismaClient } from '@prisma/client';

const sourceDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://okr_user:okr_password@localhost:5432/okr_nexus?schema=public',
    },
  },
});

const targetDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://okr_user:okr_password@localhost:5433/okr_nexus?schema=public',
    },
  },
});

async function migrate() {
  console.log('Starting database migration from port 5432 to 5433...\n');

  try {
    // Get counts
    const sourceCounts = {
      objectives: await sourceDb.objective.count(),
      keyResults: await sourceDb.keyResult.count(),
      users: await sourceDb.user.count(),
      organizations: await sourceDb.organization.count(),
    };

    const targetCounts = {
      objectives: await targetDb.objective.count(),
      keyResults: await targetDb.keyResult.count(),
      users: await targetDb.user.count(),
      organizations: await targetDb.organization.count(),
    };

    console.log('Source DB (5432) counts:', sourceCounts);
    console.log('Target DB (5433) counts:', targetCounts);
    console.log('\n⚠️  WARNING: This will merge data. Make sure you have backups!\n');

    // For now, just show what would be migrated
    console.log('To actually migrate, you would need to:');
    console.log('1. Export data from 5432');
    console.log('2. Import into 5433');
    console.log('3. Handle conflicts (IDs, foreign keys, etc.)');
    console.log('\nThis is a complex operation. Consider using pg_dump/pg_restore instead.');

    // Check for recent data that needs migration
    const recentObjectives = await sourceDb.objective.findMany({
      where: {
        createdAt: {
          gte: new Date('2025-11-03T00:00:00Z'),
        },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\nFound ${recentObjectives.length} objectives created on or after Nov 3, 2025:`);
    recentObjectives.forEach((obj, i) => {
      console.log(`  ${i + 1}. ${obj.title} (created: ${obj.createdAt.toISOString()})`);
    });

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await sourceDb.$disconnect();
    await targetDb.$disconnect();
  }
}

migrate();

