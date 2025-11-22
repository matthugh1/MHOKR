/**
 * Backfill script for primaryOrganizationId
 * 
 * This script backfills primaryOrganizationId for users who don't have it set.
 * It derives the organization from role assignments in priority order:
 * 1. TENANT role assignments (direct)
 * 2. WORKSPACE role assignments → get workspace → get tenantId
 * 3. TEAM role assignments → get team → get workspace → get tenantId
 * 
 * Uses the earliest role assignment (by creation date) as the primary organization.
 * 
 * Usage: npx ts-node scripts/backfill-primary-organization-id.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillPrimaryOrganizationId() {
  console.log('🔄 Backfilling primaryOrganizationId for users...\n');
  console.log('Priority order: TENANT → WORKSPACE → TEAM\n');

  try {
    // Find users without primaryOrganizationId
    const usersWithoutPrimaryOrg = await prisma.user.findMany({
      where: {
        primaryOrganizationId: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    console.log(`Found ${usersWithoutPrimaryOrg.length} users without primaryOrganizationId\n`);

    if (usersWithoutPrimaryOrg.length === 0) {
      console.log('✅ All users already have primaryOrganizationId set!');
      return;
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const stats = {
      fromTenant: 0,
      fromWorkspace: 0,
      fromTeam: 0,
    };

    for (const user of usersWithoutPrimaryOrg) {
      try {
        let organizationId: string | null = null;
        let source = '';

        // Priority 1: TENANT role assignment (direct)
        const tenantAssignment = await prisma.roleAssignment.findFirst({
          where: {
            userId: user.id,
            scopeType: 'TENANT',
            scopeId: { not: null },
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            scopeId: true,
          },
        });

        if (tenantAssignment?.scopeId) {
          organizationId = tenantAssignment.scopeId;
          source = 'TENANT';
        } else {
          // Priority 2: WORKSPACE role assignment → get workspace → get tenantId
          const workspaceAssignment = await prisma.roleAssignment.findFirst({
            where: {
              userId: user.id,
              scopeType: 'WORKSPACE',
              scopeId: { not: null },
            },
            orderBy: {
              createdAt: 'asc',
            },
            select: {
              scopeId: true,
            },
          });

          if (workspaceAssignment?.scopeId) {
            const workspace = await prisma.workspace.findUnique({
              where: { id: workspaceAssignment.scopeId },
              select: { tenantId: true },
            });

            if (workspace?.tenantId) {
              organizationId = workspace.tenantId;
              source = 'WORKSPACE';
            }
          }

          // Priority 3: TEAM role assignment → get team → get workspace → get tenantId
          if (!organizationId) {
            const teamAssignment = await prisma.roleAssignment.findFirst({
              where: {
                userId: user.id,
                scopeType: 'TEAM',
                scopeId: { not: null },
              },
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                scopeId: true,
              },
            });

            if (teamAssignment?.scopeId) {
              const team = await prisma.team.findUnique({
                where: { id: teamAssignment.scopeId },
                include: {
                  workspace: {
                    select: { tenantId: true },
                  },
                },
              });

              if (team?.workspace?.tenantId) {
                organizationId = team.workspace.tenantId;
                source = 'TEAM';
              }
            }
          }
        }

        if (!organizationId) {
          console.log(`⚠️  Skipping user ${user.email} (${user.id}): No role assignments found (TENANT/WORKSPACE/TEAM)`);
          skipped++;
          continue;
        }

        // Verify organization exists
        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true },
        });

        if (!organization) {
          console.log(`⚠️  Skipping user ${user.email} (${user.id}): Organization ${organizationId} not found`);
          skipped++;
          continue;
        }

        // Update user with primaryOrganizationId
        await prisma.user.update({
          where: { id: user.id },
          data: {
            primaryOrganizationId: organizationId,
          },
        });

        console.log(`✅ Updated user ${user.email} (${user.id}) → ${organization.name} (${organizationId}) [from ${source}]`);
        updated++;
        stats[source === 'TENANT' ? 'fromTenant' : source === 'WORKSPACE' ? 'fromWorkspace' : 'fromTeam']++;
      } catch (error) {
        console.error(`❌ Error updating user ${user.email} (${user.id}):`, error);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   - Updated: ${updated}`);
    console.log(`     • From TENANT assignments: ${stats.fromTenant}`);
    console.log(`     • From WORKSPACE assignments: ${stats.fromWorkspace}`);
    console.log(`     • From TEAM assignments: ${stats.fromTeam}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors}`);

    // Verify final count
    const finalCount = await prisma.user.count({
      where: {
        primaryOrganizationId: { not: null },
      },
    });

    const totalUsers = await prisma.user.count();
    console.log(`\n✅ Final status: ${finalCount}/${totalUsers} users have primaryOrganizationId set`);

    if (finalCount < totalUsers) {
      const remaining = totalUsers - finalCount;
      console.log(`\n⚠️  ${remaining} users still don't have primaryOrganizationId`);
      console.log('   These users have no role assignments (TENANT/WORKSPACE/TEAM).');
      console.log('   Consider reviewing these users and assigning them to an organization.');
    } else {
      console.log('\n🎉 All users now have primaryOrganizationId set!');
      console.log('   This improves RLS query performance and data consistency.');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backfillPrimaryOrganizationId().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

