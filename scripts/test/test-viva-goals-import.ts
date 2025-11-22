/**
 * Manual Test Script for Viva Goals CSV Import
 * 
 * Usage:
 *   ts-node scripts/test-viva-goals-import.ts <csv-file-path> <tenant-id> <user-id>
 * 
 * Example:
 *   ts-node scripts/test-viva-goals-import.ts ~/Downloads/VivaGoals_export.csv org-123 user-456
 */

import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { VivaGoalsCSVParserService } from '../src/modules/okr/viva-goals-csv-parser.service';
import { OkrImportService } from '../src/modules/okr/okr-import.service';
import { OkrCycleService } from '../src/modules/okr/okr-cycle.service';

const prismaClient = new PrismaClient();
const prisma = prismaClient as any as PrismaService; // Cast for test script
const csvParser = new VivaGoalsCSVParserService();
const cycleService = new OkrCycleService(prisma, null as any);
const importService = new OkrImportService(prisma, csvParser, cycleService);

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: ts-node scripts/test-viva-goals-import.ts <csv-file-path> <tenant-id> <user-id>');
    process.exit(1);
  }

  const [csvFilePath, tenantId, userId] = args;

  console.log('📄 Reading CSV file:', csvFilePath);
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');

  console.log('📊 Parsing CSV...');
  const parsedRows = csvParser.parseCSV(csvContent);
  console.log(`   Found ${parsedRows.length} rows`);
  console.log(`   - Objectives: ${parsedRows.filter(r => r.objectType === 'Objective').length}`);
  console.log(`   - Key Results: ${parsedRows.filter(r => r.objectType === 'Key result').length}`);
  console.log(`   - Deliverables: ${parsedRows.filter(r => r.objectType === 'Deliverable').length}`);

  console.log('\n🚀 Starting import...');
  const startTime = Date.now();

  try {
    const result = await importService.importFromCSV(csvContent, tenantId, userId);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ Import completed!');
    console.log(`   Duration: ${duration}s`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Objectives created: ${result.objectivesCreated}`);
    console.log(`   Objectives updated: ${result.objectivesUpdated}`);
    console.log(`   Key Results created: ${result.keyResultsCreated}`);
    console.log(`   Key Results updated: ${result.keyResultsUpdated}`);
    
    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.forEach(w => console.log(`   - ${w}`));
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach(e => {
        console.log(`   Row ${e.row}: ${e.title} (${e.externalId})`);
        console.log(`     Error: ${e.error}`);
      });
    } else {
      console.log('\n✨ No errors!');
    }

    // Verify import
    console.log('\n🔍 Verifying import...');
    const importedObjectives = await prisma.objective.count({
      where: {
        tenantId,
        source: 'VIVA_GOALS',
      },
    });

    const importedKeyResults = await prisma.keyResult.count({
      where: {
        tenantId,
        source: 'VIVA_GOALS',
      },
    });

    const importedCheckIns = await prisma.checkIn.count({
      where: {
        keyResult: {
          tenantId,
          source: 'VIVA_GOALS',
        },
      },
    });

    console.log(`   Imported Objectives: ${importedObjectives}`);
    console.log(`   Imported Key Results: ${importedKeyResults}`);
    console.log(`   Imported Check-ins: ${importedCheckIns}`);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prismaClient.$disconnect();
  }
}

main().catch(console.error);

