import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Hash for password "password123" (generated with bcrypt hash 10 rounds)
const PASSWORD_HASH = '$2b$10$G8uy5oB216ldG4Z7WHayLOrAG1t7Epxew1zM4N970PD9X0c1TSV3O';

async function main() {
  console.log('🌱 Starting comprehensive RBAC test data seed...');

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('🧹 Clearing existing data...');
  await prisma.roleAssignment.deleteMany({});
  await prisma.initiative.deleteMany({});
  await prisma.objectiveKeyResult.deleteMany({});
  await prisma.keyResult.deleteMany({});
  await prisma.objective.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.workspaceMember.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ Cleared existing data');

  // Create Superuser
  const superuser = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      name: 'Superuser Admin',
      passwordHash: PASSWORD_HASH,
      isSuperuser: true,
    },
  });
  console.log('✅ Created superuser:', superuser.email);

  // Create Organization 1
  const org1 = await prisma.organization.create({
    data: {
      name: 'Test Organization 1',
      slug: 'org1',
    },
  });
  console.log('✅ Created organization:', org1.name);

  // Create Organization 2 (for testing multi-tenant scenarios)
  const org2 = await prisma.organization.create({
    data: {
      name: 'Test Organization 2',
      slug: 'org2',
    },
  });
  console.log('✅ Created organization:', org2.name);

  // Create Workspaces for Org1
  const workspace1 = await prisma.workspace.create({
    data: {
      name: 'Product Development',
      organizationId: org1.id,
    },
  });

  const workspace2 = await prisma.workspace.create({
    data: {
      name: 'Marketing',
      organizationId: org1.id,
    },
  });
  console.log('✅ Created workspaces for Org1');

  // Create Workspace for Org2
  await prisma.workspace.create({
    data: {
      name: 'Engineering',
      organizationId: org2.id,
    },
  });
  console.log('✅ Created workspace for Org2');

  // Create Teams
  const engineeringTeam = await prisma.team.create({
    data: {
      name: 'Engineering',
      workspaceId: workspace1.id,
    },
  });

  const productTeam = await prisma.team.create({
    data: {
      name: 'Product',
      workspaceId: workspace1.id,
    },
  });

  await prisma.team.create({
    data: {
      name: 'Design',
      workspaceId: workspace2.id,
    },
  });
  console.log('✅ Created teams');

  // Create all test users from test plan
  const tenantOwner = await prisma.user.create({
    data: {
      email: 'owner@test.com',
      name: 'Tenant Owner',
      passwordHash: PASSWORD_HASH,
    },
  });

  const tenantAdmin = await prisma.user.create({
    data: {
      email: 'admin@org1.com',
      name: 'Tenant Admin',
      passwordHash: PASSWORD_HASH,
    },
  });

  const workspaceOwner = await prisma.user.create({
    data: {
      email: 'workspace@org1.com',
      name: 'Workspace Owner',
      passwordHash: PASSWORD_HASH,
    },
  });

  const teamLead = await prisma.user.create({
    data: {
      email: 'teamlead@org1.com',
      name: 'Team Lead',
      passwordHash: PASSWORD_HASH,
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'member@org1.com',
      name: 'Member User',
      passwordHash: PASSWORD_HASH,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@org1.com',
      name: 'Viewer User',
      passwordHash: PASSWORD_HASH,
    },
  });

  // Additional users for testing
  const member2 = await prisma.user.create({
    data: {
      email: 'member2@org1.com',
      name: 'Member 2',
      passwordHash: PASSWORD_HASH,
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      email: 'owner2@org2.com',
      name: 'Org2 Owner',
      passwordHash: PASSWORD_HASH,
    },
  });
  console.log('✅ Created all test users');

  // Assign roles using NEW RBAC system (RoleAssignment)
  // Tenant Owner - TENANT_OWNER in org1
  await prisma.roleAssignment.create({
    data: {
      userId: tenantOwner.id,
      role: 'TENANT_OWNER',
      scopeType: 'TENANT',
      scopeId: org1.id,
    },
  });

  // Tenant Admin - TENANT_ADMIN in org1
  await prisma.roleAssignment.create({
    data: {
      userId: tenantAdmin.id,
      role: 'TENANT_ADMIN',
      scopeType: 'TENANT',
      scopeId: org1.id,
    },
  });

  // Workspace Owner - WORKSPACE_LEAD in workspace1
  await prisma.roleAssignment.create({
    data: {
      userId: workspaceOwner.id,
      role: 'WORKSPACE_LEAD',
      scopeType: 'WORKSPACE',
      scopeId: workspace1.id,
    },
  });
  // Also give them workspace member role at tenant level
  await prisma.roleAssignment.create({
    data: {
      userId: workspaceOwner.id,
      role: 'WORKSPACE_MEMBER',
      scopeType: 'TENANT',
      scopeId: org1.id,
    },
  });

  // Team Lead - TEAM_LEAD in engineeringTeam
  await prisma.roleAssignment.create({
    data: {
      userId: teamLead.id,
      role: 'TEAM_LEAD',
      scopeType: 'TEAM',
      scopeId: engineeringTeam.id,
    },
  });
  // Also give them workspace member role
  await prisma.roleAssignment.create({
    data: {
      userId: teamLead.id,
      role: 'WORKSPACE_MEMBER',
      scopeType: 'WORKSPACE',
      scopeId: workspace1.id,
    },
  });
  await prisma.roleAssignment.create({
    data: {
      userId: teamLead.id,
      role: 'WORKSPACE_MEMBER',
      scopeType: 'TENANT',
      scopeId: org1.id,
    },
  });

  // Member - WORKSPACE_MEMBER in workspace1
  await prisma.roleAssignment.create({
    data: {
      userId: member.id,
      role: 'WORKSPACE_MEMBER',
      scopeType: 'WORKSPACE',
      scopeId: workspace1.id,
    },
  });
  // Member also needs TENANT_VIEWER role at tenant level to access tenant resources
  await prisma.roleAssignment.create({
    data: {
      userId: member.id,
      role: 'TENANT_VIEWER',
      scopeType: 'TENANT',
      scopeId: org1.id,
    },
  });
  await prisma.roleAssignment.create({
    data: {
      userId: member.id,
      role: 'TEAM_CONTRIBUTOR',
      scopeType: 'TEAM',
      scopeId: engineeringTeam.id,
    },
  });

  // Member 2 - WORKSPACE_MEMBER in workspace2
  await prisma.roleAssignment.create({
    data: {
      userId: member2.id,
      role: 'WORKSPACE_MEMBER',
      scopeType: 'WORKSPACE',
      scopeId: workspace2.id,
    },
  });
  // Member 2 also needs TENANT_VIEWER role at tenant level to access tenant resources
  await prisma.roleAssignment.create({
    data: {
      userId: member2.id,
      role: 'TENANT_VIEWER',
      scopeType: 'TENANT',
      scopeId: org1.id,
    },
  });

  // Viewer - TENANT_VIEWER in org1
  await prisma.roleAssignment.create({
    data: {
      userId: viewer.id,
      role: 'TENANT_VIEWER',
      scopeType: 'TENANT',
      scopeId: org1.id,
    },
  });
  await prisma.roleAssignment.create({
    data: {
      userId: viewer.id,
      role: 'WORKSPACE_MEMBER',
      scopeType: 'WORKSPACE',
      scopeId: workspace1.id,
    },
  });

  // Org2 Owner - TENANT_OWNER in org2
  await prisma.roleAssignment.create({
    data: {
      userId: owner2.id,
      role: 'TENANT_OWNER',
      scopeType: 'TENANT',
      scopeId: org2.id,
    },
  });
  console.log('✅ Created RBAC role assignments');

  // Also create old-style memberships for backward compatibility
  // Tenant Owner - ORG_ADMIN in org1
  await prisma.organizationMember.create({
    data: {
      userId: tenantOwner.id,
      organizationId: org1.id,
      role: 'ORG_ADMIN',
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId: tenantAdmin.id,
      organizationId: org1.id,
      role: 'ORG_ADMIN',
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId: workspaceOwner.id,
      organizationId: org1.id,
      role: 'MEMBER',
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId: teamLead.id,
      organizationId: org1.id,
      role: 'MEMBER',
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId: member.id,
      organizationId: org1.id,
      role: 'MEMBER',
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId: member2.id,
      organizationId: org1.id,
      role: 'MEMBER',
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId: viewer.id,
      organizationId: org1.id,
      role: 'VIEWER',
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId: owner2.id,
      organizationId: org2.id,
      role: 'ORG_ADMIN',
    },
  });

  // Workspace memberships
  await prisma.workspaceMember.create({
    data: {
      userId: workspaceOwner.id,
      workspaceId: workspace1.id,
      role: 'WORKSPACE_OWNER',
    },
  });

  await prisma.workspaceMember.create({
    data: {
      userId: teamLead.id,
      workspaceId: workspace1.id,
      role: 'MEMBER',
    },
  });

  await prisma.workspaceMember.create({
    data: {
      userId: member.id,
      workspaceId: workspace1.id,
      role: 'MEMBER',
    },
  });

  await prisma.workspaceMember.create({
    data: {
      userId: viewer.id,
      workspaceId: workspace1.id,
      role: 'VIEWER',
    },
  });

  await prisma.workspaceMember.create({
    data: {
      userId: member2.id,
      workspaceId: workspace2.id,
      role: 'MEMBER',
    },
  });

  // Team memberships
  await prisma.teamMember.create({
    data: {
      userId: teamLead.id,
      teamId: engineeringTeam.id,
      role: 'TEAM_LEAD',
    },
  });

  await prisma.teamMember.create({
    data: {
      userId: member.id,
      teamId: engineeringTeam.id,
      role: 'MEMBER',
    },
  });

  await prisma.teamMember.create({
    data: {
      userId: member2.id,
      teamId: productTeam.id,
      role: 'MEMBER',
    },
  });
  console.log('✅ Created old-style memberships');

  // Create sample OKRs for testing visibility
  // Objective owned by member in workspace1
  const objective1 = await prisma.objective.create({
    data: {
      title: 'Launch MVP by Q2 2025',
      description: 'Build and launch the minimum viable product to market',
      workspaceId: workspace1.id,
      teamId: engineeringTeam.id,
      ownerId: member.id,
      period: 'QUARTERLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      status: 'ON_TRACK',
      progress: 35,
      visibilityLevel: 'TEAM_ONLY',
    },
  });

  // Objective owned by workspaceOwner
  const objective2 = await prisma.objective.create({
    data: {
      title: 'Improve Product Performance',
      description: 'Optimize application performance and user experience',
      workspaceId: workspace1.id,
      ownerId: workspaceOwner.id,
      period: 'QUARTERLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      status: 'ON_TRACK',
      progress: 50,
      visibilityLevel: 'WORKSPACE_ONLY',
    },
  });

  // Objective owned by tenantOwner (tenant-wide visibility)
  const objective3 = await prisma.objective.create({
    data: {
      title: 'Increase Customer Satisfaction',
      description: 'Achieve 90% customer satisfaction score',
      workspaceId: workspace1.id,
      ownerId: tenantOwner.id,
      period: 'QUARTERLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      status: 'ON_TRACK',
      progress: 65,
      visibilityLevel: 'PUBLIC_TENANT',
    },
  });

  // Objective in workspace2 (different workspace)
  await prisma.objective.create({
    data: {
      title: 'Expand Marketing Reach',
      description: 'Increase brand awareness and market presence',
      workspaceId: workspace2.id,
      ownerId: member2.id,
      period: 'QUARTERLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      status: 'ON_TRACK',
      progress: 40,
      visibilityLevel: 'WORKSPACE_ONLY',
    },
  });
  console.log('✅ Created sample objectives');

  // Create Key Results
  const keyResult1 = await prisma.keyResult.create({
    data: {
      title: 'Achieve 1000 active users',
      description: 'Grow user base to 100.root active monthly users',
      ownerId: member.id,
      metricType: 'REACH',
      startValue: 0,
      targetValue: 1000,
      currentValue: 350,
      unit: 'users',
      progress: 35,
      period: 'QUARTERLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      visibilityLevel: 'TEAM_ONLY',
    },
  });

  await prisma.objectiveKeyResult.create({
    data: {
      objectiveId: objective1.id,
      keyResultId: keyResult1.id,
    },
  });

  const keyResult2 = await prisma.keyResult.create({
    data: {
      title: 'Reduce page load time to under 2 seconds',
      description: 'Optimize application performance',
      ownerId: workspaceOwner.id,
      metricType: 'DECREASE',
      startValue: 5.2,
      targetValue: 2.0,
      currentValue: 3.8,
      unit: 'seconds',
      progress: 43.75,
      period: 'QUARTERLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      visibilityLevel: 'WORKSPACE_ONLY',
    },
  });

  await prisma.objectiveKeyResult.create({
    data: {
      objectiveId: objective2.id,
      keyResultId: keyResult2.id,
    },
  });

  const keyResult3 = await prisma.keyResult.create({
    data: {
      title: 'Achieve 90% customer satisfaction',
      description: 'Measure and improve customer satisfaction',
      ownerId: tenantOwner.id,
      metricType: 'REACH',
      startValue: 75,
      targetValue: 90,
      currentValue: 82,
      unit: 'percentage',
      progress: 58.33,
      period: 'QUARTERLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      visibilityLevel: 'PUBLIC_TENANT',
    },
  });

  await prisma.objectiveKeyResult.create({
    data: {
      objectiveId: objective3.id,
      keyResultId: keyResult3.id,
    },
  });
  console.log('✅ Created sample key results');

  // Create Initiatives
  await prisma.initiative.create({
    data: {
      title: 'Implement caching layer',
      description: 'Add Redis caching to improve performance',
      objectiveId: objective1.id,
      ownerId: member.id,
      status: 'IN_PROGRESS',
      period: 'MONTHLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-04-30'),
      dueDate: new Date('2025-04-15'),
    },
  });

  await prisma.initiative.create({
    data: {
      title: 'Database optimization',
      description: 'Optimize database queries and indexing',
      objectiveId: objective2.id,
      ownerId: workspaceOwner.id,
      status: 'IN_PROGRESS',
      period: 'MONTHLY',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-04-30'),
      dueDate: new Date('2025-04-20'),
    },
  });
  console.log('✅ Created sample initiatives');

  console.log('\n🎉 Comprehensive RBAC test data seed completed successfully!');
  console.log('\n📋 Test Users Created:');
  console.log('  Superuser: admin@test.com / password123');
  console.log('  Tenant Owner: owner@test.com / password123');
  console.log('  Tenant Admin: admin@org1.com / password123');
  console.log('  Workspace Owner: workspace@org1.com / password123');
  console.log('  Team Lead: teamlead@org1.com / password123');
  console.log('  Member: member@org1.com / password123');
  console.log('  Viewer: viewer@org1.com / password123');
  console.log('  Member 2: member2@org1.com / password123');
  console.log('  Org2 Owner: owner2@org2.com / password123');
  console.log('\n✅ All users have both RBAC role assignments and old-style memberships');
  console.log('✅ Sample OKRs created with different visibility levels');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
