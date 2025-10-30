/**
 * RBAC Migration Script
 * 
 * Run this script to migrate existing OrganizationMember, WorkspaceMember, and TeamMember
 * records to the new RoleAssignment model.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-rbac.ts [userId]
 * 
 * If userId is provided, migrates only that user. Otherwise migrates all users.
 */

import { PrismaClient } from '@prisma/client';
import { RBACService } from '../src/modules/rbac/rbac.service';
import { RBACMigrationService } from '../src/modules/rbac/migration.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

async function main() {
  const prisma = new PrismaClient();
  const prismaService = new PrismaService();
  const rbacService = new RBACService(prismaService as any);
  const migrationService = new RBACMigrationService(prismaService as any, rbacService);

  const userId = process.argv[2];

  try {
    if (userId) {
      console.log(`Migrating user ${userId}...`);
      await migrationService.migrateUserMemberships(userId, 'system');
      console.log(`✅ Migration completed for user ${userId}`);
    } else {
      console.log('Migrating all memberships...');
      const result = await migrationService.migrateAllMemberships('system');
      console.log('✅ Migration completed:');
      console.log(`   Organization members: ${result.organizationMembers}`);
      console.log(`   Workspace members: ${result.workspaceMembers}`);
      console.log(`   Team members: ${result.teamMembers}`);
      console.log(`   Total: ${result.total}`);
    }

    // Verify migration
    console.log('\nVerifying migration...');
    const verification = await migrationService.verifyMigration();
    console.log('Verification results:');
    console.log(`   Unmigrated org members: ${verification.organizationMembersNotMigrated}`);
    console.log(`   Unmigrated workspace members: ${verification.workspaceMembersNotMigrated}`);
    console.log(`   Unmigrated team members: ${verification.teamMembersNotMigrated}`);
    // Get total role assignments count
    const roleAssignmentCount = await prisma.roleAssignment.count();
    console.log(`   Total role assignments: ${roleAssignmentCount}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

