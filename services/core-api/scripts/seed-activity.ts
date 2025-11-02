import { PrismaClient, ActivityAction, EntityType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding activity data...');

  // Get objectives and users
  const objectives = await prisma.objective.findMany({
    where: { organizationId: 'cmhdp7oby0001rp5pzwtlch3j' },
    select: { id: true, title: true },
  });

  const users = await prisma.user.findMany({
    where: {
      organizationMembers: {
        some: {
          organizationId: 'cmhdp7oby0001rp5pzwtlch3j',
        },
      },
    },
    select: { id: true, name: true, email: true },
  });

  if (objectives.length === 0) {
    console.log('❌ No objectives found. Please create objectives first.');
    return;
  }

  if (users.length === 0) {
    console.log('❌ No users found. Please create users first.');
    return;
  }

  console.log(`📋 Found ${objectives.length} objectives and ${users.length} users`);

  // Clear existing activities for these objectives
  await prisma.activity.deleteMany({
    where: {
      entityType: 'OBJECTIVE',
      entityId: { in: objectives.map((o) => o.id) },
    },
  });

  console.log('🧹 Cleared existing activities');

  // Create activities for each objective
  const activities = [];

  for (const objective of objectives) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const owner = users.find((u) => u.email === 'admin@org1.com') || randomUser;

    // CREATED activity (oldest)
    activities.push({
      entityType: 'OBJECTIVE' as EntityType,
      entityId: objective.id,
      userId: owner.id,
      action: 'CREATED' as ActivityAction,
      metadata: {
        title: objective.title,
      },
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    });

    // UPDATED activity - progress change
    activities.push({
      entityType: 'OBJECTIVE' as EntityType,
      entityId: objective.id,
      userId: owner.id,
      action: 'UPDATED' as ActivityAction,
      metadata: {
        before: { progress: 0 },
        after: { progress: 25 },
      },
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    });

    // UPDATED activity - status change
    activities.push({
      entityType: 'OBJECTIVE' as EntityType,
      entityId: objective.id,
      userId: owner.id,
      action: 'UPDATED' as ActivityAction,
      metadata: {
        before: { status: 'ON_TRACK', progress: 25 },
        after: { status: 'AT_RISK', progress: 30 },
      },
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    });

    // UPDATED activity - progress update
    activities.push({
      entityType: 'OBJECTIVE' as EntityType,
      entityId: objective.id,
      userId: owner.id,
      action: 'UPDATED' as ActivityAction,
      metadata: {
        before: { progress: 30 },
        after: { progress: 45 },
      },
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    });

    // UPDATED activity - recent progress
    activities.push({
      entityType: 'OBJECTIVE' as EntityType,
      entityId: objective.id,
      userId: owner.id,
      action: 'UPDATED' as ActivityAction,
      metadata: {
        before: { progress: 45, status: 'AT_RISK' },
        after: { progress: 60, status: 'ON_TRACK' },
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    });

    // COMMENTED activity
    activities.push({
      entityType: 'OBJECTIVE' as EntityType,
      entityId: objective.id,
      userId: randomUser.id,
      action: 'COMMENTED' as ActivityAction,
      metadata: {
        comment: 'Great progress on this objective!',
      },
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    });

    // ALIGNED activity
    activities.push({
      entityType: 'OBJECTIVE' as EntityType,
      entityId: objective.id,
      userId: owner.id,
      action: 'ALIGNED' as ActivityAction,
      metadata: {
        alignedWith: 'Strategic Initiative: Q2 Launch',
      },
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    });

    // Recent UPDATED activity
    activities.push({
      entityType: 'OBJECTIVE' as EntityType,
      entityId: objective.id,
      userId: owner.id,
      action: 'UPDATED' as ActivityAction,
      metadata: {
        before: { progress: 60 },
        after: { progress: 75 },
      },
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });
  }

  // Insert all activities
  await prisma.activity.createMany({
    data: activities,
  });

  console.log(`✅ Created ${activities.length} activity records`);
  console.log(`   - ${objectives.length} objectives × ~8 activities each`);
  console.log('\n🎉 Activity seeding complete!');
  console.log('   You can now view the animated audit drawer by clicking the History button on any OKR.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding activities:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



