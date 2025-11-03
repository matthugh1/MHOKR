import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Authoritative IDs - these entities already exist in the DB
const PUZZEL_CX_ORG_ID = 'cmhesnyvx00004xhjjxs272gs';
const WORKSPACE_CX_ID = 'cmhesnyxl00024xhjlkpwnhzr'; // Customer Experience & AI
const WORKSPACE_REVOPS_ID = 'cmhesnyxo00044xhjhqw8ycib'; // Revenue Operations
const USER_FOUNDER_ID = 'cmhesnyxo00054xhjb6h2qm1v'; // founder@puzzelcx.local
const USER_AGENT_ID = 'cmhesnyxt00064xhjwh8jy6g7'; // agent@puzzelcx.local
const CYCLE_Q3_2025_ID = 'cmhesnyzo00104xhjwqnemyfe'; // Q3 2025 - ARCHIVED
const CYCLE_Q4_2025_ID = 'cmhesnyzr00124xhjtmx1ak82'; // Q4 2025 - ACTIVE
const CYCLE_Q1_2026_ID = 'cmhesnyzs00144xhjd8gqpyti'; // Q1 2026 - DRAFT

async function main() {
  console.log('🌱 Starting demo-ready seed data generation for Puzzel CX...');

  // ==========================================
  // 1. Verify authoritative entities exist
  // ==========================================
  const org = await prisma.organization.findUnique({
    where: { id: PUZZEL_CX_ORG_ID },
  });
  if (!org) {
    throw new Error(`Organization ${PUZZEL_CX_ORG_ID} (Puzzel CX) not found`);
  }

  const workspaceCx = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_CX_ID },
  });
  if (!workspaceCx) {
    throw new Error(`Workspace ${WORKSPACE_CX_ID} (Customer Experience & AI) not found`);
  }

  const workspaceRevOps = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_REVOPS_ID },
  });
  if (!workspaceRevOps) {
    throw new Error(`Workspace ${WORKSPACE_REVOPS_ID} (Revenue Operations) not found`);
  }

  const orgOwner = await prisma.user.findUnique({
    where: { id: USER_FOUNDER_ID },
  });
  if (!orgOwner) {
    throw new Error(`User ${USER_FOUNDER_ID} (founder@puzzelcx.local) not found`);
  }

  const member = await prisma.user.findUnique({
    where: { id: USER_AGENT_ID },
  });
  if (!member) {
    throw new Error(`User ${USER_AGENT_ID} (agent@puzzelcx.local) not found`);
  }

  const cycleQ3 = await prisma.cycle.findUnique({
    where: { id: CYCLE_Q3_2025_ID },
  });
  if (!cycleQ3) {
    throw new Error(`Cycle ${CYCLE_Q3_2025_ID} (Q3 2025) not found`);
  }

  const cycleQ4 = await prisma.cycle.findUnique({
    where: { id: CYCLE_Q4_2025_ID },
  });
  if (!cycleQ4) {
    throw new Error(`Cycle ${CYCLE_Q4_2025_ID} (Q4 2025) not found`);
  }

  const cycleQ1 = await prisma.cycle.findUnique({
    where: { id: CYCLE_Q1_2026_ID },
  });
  if (!cycleQ1) {
    throw new Error(`Cycle ${CYCLE_Q1_2026_ID} (Q1 2026) not found`);
  }

  console.log('✅ Verified authoritative entities exist');

  // ==========================================
  // 2. Strategic Pillars (for reporting)
  // ==========================================
  let pillarAgentProductivity = await prisma.strategicPillar.findFirst({
    where: {
      name: 'Agent Productivity',
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!pillarAgentProductivity) {
    pillarAgentProductivity = await prisma.strategicPillar.create({
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        name: 'Agent Productivity',
        description: 'Initiatives focused on improving agent efficiency and reducing handling time',
        color: '#3B82F6',
      },
    });
  }

  let pillarCxQuality = await prisma.strategicPillar.findFirst({
    where: {
      name: 'Customer Experience Quality',
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!pillarCxQuality) {
    pillarCxQuality = await prisma.strategicPillar.create({
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        name: 'Customer Experience Quality',
        description: 'Measures and improvements to first contact resolution and customer satisfaction',
        color: '#10B981',
      },
    });
  }
  console.log('✅ Strategic pillars ready');

  // ==========================================
  // 3. Objectives
  // ==========================================

  // PAST CYCLE (Q3 2025) - ARCHIVED, completed objectives (isPublished = true, status = COMPLETED)
  let objPast1 = await prisma.objective.findFirst({
    where: {
      title: 'Improve First Contact Resolution in Priority Channels',
      cycleId: CYCLE_Q3_2025_ID,
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!objPast1) {
    objPast1 = await prisma.objective.create({
      data: {
        title: 'Improve First Contact Resolution in Priority Channels',
        description: 'Increase first contact resolution rate across email and chat channels to reduce repeat contacts and improve customer satisfaction',
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q3_2025_ID,
        pillarId: pillarCxQuality.id,
        ownerId: USER_FOUNDER_ID,
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-09-30'),
        status: 'COMPLETED',
        progress: 95,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
      },
    });
  } else {
    objPast1 = await prisma.objective.update({
      where: { id: objPast1.id },
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q3_2025_ID,
        pillarId: pillarCxQuality.id,
        ownerId: USER_FOUNDER_ID,
        status: 'COMPLETED',
        isPublished: true,
      },
    });
  }

  let objPast2 = await prisma.objective.findFirst({
    where: {
      title: 'Increase Automation Rate on Tier 1 Requests',
      cycleId: CYCLE_Q3_2025_ID,
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!objPast2) {
    objPast2 = await prisma.objective.create({
      data: {
        title: 'Increase Automation Rate on Tier 1 Requests',
        description: 'Deploy AI-assisted resolution for common billing and account management queries',
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q3_2025_ID,
        pillarId: pillarAgentProductivity.id,
        ownerId: USER_AGENT_ID,
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-09-30'),
        status: 'COMPLETED',
        progress: 88,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
      },
    });
  } else {
    objPast2 = await prisma.objective.update({
      where: { id: objPast2.id },
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q3_2025_ID,
        pillarId: pillarAgentProductivity.id,
        ownerId: USER_AGENT_ID,
        status: 'COMPLETED',
        isPublished: true,
      },
    });
  }

  // CURRENT CYCLE (Q4 2025) - ACTIVE
  // Mix: one ON_TRACK published, one AT_RISK published, one ON_TRACK NOT published
  let objCurrent1 = await prisma.objective.findFirst({
    where: {
      title: 'Improve First Contact Resolution in Priority Channels',
      cycleId: CYCLE_Q4_2025_ID,
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!objCurrent1) {
    objCurrent1 = await prisma.objective.create({
      data: {
        title: 'Improve First Contact Resolution in Priority Channels',
        description: 'Target 75% FCR in email and chat channels, focusing on billing-related repeat contacts',
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q4_2025_ID,
        pillarId: pillarCxQuality.id,
        ownerId: USER_FOUNDER_ID,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
        status: 'AT_RISK',
        progress: 42,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
      },
    });
  } else {
    objCurrent1 = await prisma.objective.update({
      where: { id: objCurrent1.id },
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q4_2025_ID,
        pillarId: pillarCxQuality.id,
        ownerId: USER_FOUNDER_ID,
        status: 'AT_RISK',
        isPublished: true,
      },
    });
  }

  let objCurrent2 = await prisma.objective.findFirst({
    where: {
      title: 'Reduce Agent Attrition in Core Support Teams',
      cycleId: CYCLE_Q4_2025_ID,
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!objCurrent2) {
    objCurrent2 = await prisma.objective.create({
      data: {
        title: 'Reduce Agent Attrition in Core Support Teams',
        description: 'Lower voluntary attrition rate in primary support shifts through improved coaching and career development',
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q4_2025_ID,
        pillarId: pillarAgentProductivity.id,
        ownerId: USER_AGENT_ID,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
        status: 'ON_TRACK',
        progress: 58,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
      },
    });
  } else {
    objCurrent2 = await prisma.objective.update({
      where: { id: objCurrent2.id },
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q4_2025_ID,
        pillarId: pillarAgentProductivity.id,
        ownerId: USER_AGENT_ID,
        status: 'ON_TRACK',
        isPublished: true,
      },
    });
  }

  let objCurrent3 = await prisma.objective.findFirst({
    where: {
      title: 'Stabilise Cost to Serve for Voice Contact',
      cycleId: CYCLE_Q4_2025_ID,
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!objCurrent3) {
    objCurrent3 = await prisma.objective.create({
      data: {
        title: 'Stabilise Cost to Serve for Voice Contact',
        description: 'Maintain cost per contact within target range while improving quality metrics',
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_REVOPS_ID,
        cycleId: CYCLE_Q4_2025_ID,
        ownerId: USER_FOUNDER_ID,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
        status: 'ON_TRACK',
        progress: 65,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
      },
    });
  } else {
    objCurrent3 = await prisma.objective.update({
      where: { id: objCurrent3.id },
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_REVOPS_ID,
        cycleId: CYCLE_Q4_2025_ID,
        ownerId: USER_FOUNDER_ID,
        status: 'ON_TRACK',
        isPublished: false,
      },
    });
  }

  // FUTURE CYCLE (Q1 2026) - DRAFT (all isPublished = false)
  let objFuture1 = await prisma.objective.findFirst({
    where: {
      title: 'Accelerate AI-led Resolution for Tier 1 Billing Queries',
      cycleId: CYCLE_Q1_2026_ID,
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!objFuture1) {
    objFuture1 = await prisma.objective.create({
      data: {
        title: 'Accelerate AI-led Resolution for Tier 1 Billing Queries',
        description: 'Expand AI containment to 40% of billing inquiries through enhanced knowledge base and intent recognition',
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q1_2026_ID,
        pillarId: pillarAgentProductivity.id,
        ownerId: USER_FOUNDER_ID,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: 'ON_TRACK',
        progress: 0,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
      },
    });
  } else {
    objFuture1 = await prisma.objective.update({
      where: { id: objFuture1.id },
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q1_2026_ID,
        pillarId: pillarAgentProductivity.id,
        ownerId: USER_FOUNDER_ID,
        isPublished: false,
      },
    });
  }

  let objFuture2 = await prisma.objective.findFirst({
    where: {
      title: 'Improve Knowledge Retrieval Time for Agents',
      cycleId: CYCLE_Q1_2026_ID,
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!objFuture2) {
    objFuture2 = await prisma.objective.create({
      data: {
        title: 'Improve Knowledge Retrieval Time for Agents',
        description: 'Reduce average time to locate relevant knowledge articles from 2.5 minutes to 1.5 minutes',
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q1_2026_ID,
        pillarId: pillarAgentProductivity.id,
        ownerId: USER_AGENT_ID,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: 'ON_TRACK',
        progress: 0,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
      },
    });
  } else {
    objFuture2 = await prisma.objective.update({
      where: { id: objFuture2.id },
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_CX_ID,
        cycleId: CYCLE_Q1_2026_ID,
        pillarId: pillarAgentProductivity.id,
        ownerId: USER_AGENT_ID,
        isPublished: false,
      },
    });
  }

  let objFuture3 = await prisma.objective.findFirst({
    where: {
      title: 'Optimise Revenue Operations Workflow Efficiency',
      cycleId: CYCLE_Q1_2026_ID,
      organizationId: PUZZEL_CX_ORG_ID,
    },
  });
  if (!objFuture3) {
    objFuture3 = await prisma.objective.create({
      data: {
        title: 'Optimise Revenue Operations Workflow Efficiency',
        description: 'Streamline quote-to-cash processes to reduce cycle time',
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_REVOPS_ID,
        cycleId: CYCLE_Q1_2026_ID,
        ownerId: USER_FOUNDER_ID,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        status: 'ON_TRACK',
        progress: 0,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
      },
    });
  } else {
    objFuture3 = await prisma.objective.update({
      where: { id: objFuture3.id },
      data: {
        organizationId: PUZZEL_CX_ORG_ID,
        workspaceId: WORKSPACE_REVOPS_ID,
        cycleId: CYCLE_Q1_2026_ID,
        ownerId: USER_FOUNDER_ID,
        isPublished: false,
      },
    });
  }
  console.log('✅ Objectives created');

  // ==========================================
  // 4. Key Results
  // ==========================================

  // Past cycle KRs
  let krPast1 = await prisma.keyResult.findFirst({
    where: {
      title: 'Raise First Contact Resolution from 62% to 75%',
      ownerId: USER_FOUNDER_ID,
      startDate: new Date('2025-07-01'),
    },
  });
  if (!krPast1) {
    krPast1 = await prisma.keyResult.create({
      data: {
        title: 'Raise First Contact Resolution from 62% to 75%',
        description: 'Target FCR improvement in email and chat channels',
        ownerId: USER_FOUNDER_ID,
        metricType: 'INCREASE',
        startValue: 62,
        targetValue: 75,
        currentValue: 73,
        unit: 'percentage',
        status: 'COMPLETED',
        progress: 85,
        cycleId: CYCLE_Q3_2025_ID, // Sync cycleId from parent objective
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-09-30'),
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
        checkInCadence: 'WEEKLY',
      },
    });
  } else {
    krPast1 = await prisma.keyResult.update({
      where: { id: krPast1.id },
      data: {
        ownerId: USER_FOUNDER_ID,
        cycleId: CYCLE_Q3_2025_ID, // Sync cycleId from parent objective
        status: 'COMPLETED',
        isPublished: true,
      },
    });
  }

  await prisma.objectiveKeyResult.upsert({
    where: {
      objectiveId_keyResultId: {
        objectiveId: objPast1.id,
        keyResultId: krPast1.id,
      },
    },
    update: {},
    create: {
      objectiveId: objPast1.id,
      keyResultId: krPast1.id,
    },
  });

  // Current cycle KRs
  let krCurrent1 = await prisma.keyResult.findFirst({
    where: {
      title: 'Raise First Contact Resolution from 62% to 75%',
      ownerId: USER_FOUNDER_ID,
      startDate: new Date('2025-10-01'),
    },
  });
  if (!krCurrent1) {
    krCurrent1 = await prisma.keyResult.create({
      data: {
        title: 'Raise First Contact Resolution from 62% to 75%',
        description: 'Focus on billing queue to reduce repeat contacts',
        ownerId: USER_FOUNDER_ID,
        metricType: 'INCREASE',
        startValue: 62,
        targetValue: 75,
        currentValue: 63,
        unit: 'percentage',
        status: 'AT_RISK',
        progress: 8,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
        checkInCadence: 'WEEKLY',
      },
    });
  } else {
    krCurrent1 = await prisma.keyResult.update({
      where: { id: krCurrent1.id },
      data: {
        ownerId: USER_FOUNDER_ID,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        status: 'AT_RISK',
        isPublished: true,
      },
    });
  }

  await prisma.objectiveKeyResult.upsert({
    where: {
      objectiveId_keyResultId: {
        objectiveId: objCurrent1.id,
        keyResultId: krCurrent1.id,
      },
    },
    update: {},
    create: {
      objectiveId: objCurrent1.id,
      keyResultId: krCurrent1.id,
    },
  });

  let krCurrent2 = await prisma.keyResult.findFirst({
    where: {
      title: 'Cut average handling time from 6m20s to 5m00s',
      ownerId: USER_FOUNDER_ID,
      startDate: new Date('2025-10-01'),
    },
  });
  if (!krCurrent2) {
    krCurrent2 = await prisma.keyResult.create({
      data: {
        title: 'Cut average handling time from 6m20s to 5m00s',
        description: 'Reduce time per contact through improved workflows and agent tools',
        ownerId: USER_FOUNDER_ID,
        metricType: 'DECREASE',
        startValue: 380,
        targetValue: 300,
        currentValue: 340,
        unit: 'seconds',
        status: 'ON_TRACK',
        progress: 50,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
        checkInCadence: 'WEEKLY',
      },
    });
  } else {
    krCurrent2 = await prisma.keyResult.update({
      where: { id: krCurrent2.id },
      data: {
        ownerId: USER_FOUNDER_ID,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        status: 'ON_TRACK',
        isPublished: true,
      },
    });
  }

  await prisma.objectiveKeyResult.upsert({
    where: {
      objectiveId_keyResultId: {
        objectiveId: objCurrent1.id,
        keyResultId: krCurrent2.id,
      },
    },
    update: {},
    create: {
      objectiveId: objCurrent1.id,
      keyResultId: krCurrent2.id,
    },
  });

  let krCurrent3 = await prisma.keyResult.findFirst({
    where: {
      title: 'Lower voluntary attrition from 32% to 24%',
      ownerId: USER_AGENT_ID,
      startDate: new Date('2025-10-01'),
    },
  });
  if (!krCurrent3) {
    krCurrent3 = await prisma.keyResult.create({
      data: {
        title: 'Lower voluntary attrition from 32% to 24%',
        description: 'Reduce turnover in core support teams through retention initiatives',
        ownerId: USER_AGENT_ID,
        metricType: 'DECREASE',
        startValue: 32,
        targetValue: 24,
        currentValue: 28,
        unit: 'percentage',
        status: 'ON_TRACK',
        progress: 50,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
        checkInCadence: 'BIWEEKLY',
      },
    });
  } else {
    krCurrent3 = await prisma.keyResult.update({
      where: { id: krCurrent3.id },
      data: {
        ownerId: USER_AGENT_ID,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        status: 'ON_TRACK',
        isPublished: true,
      },
    });
  }

  await prisma.objectiveKeyResult.upsert({
    where: {
      objectiveId_keyResultId: {
        objectiveId: objCurrent2.id,
        keyResultId: krCurrent3.id,
      },
    },
    update: {},
    create: {
      objectiveId: objCurrent2.id,
      keyResultId: krCurrent3.id,
    },
  });

  // KR with overdue check-in (WEEKLY cadence, last check-in 14 days ago)
  let krCurrent4 = await prisma.keyResult.findFirst({
    where: {
      title: 'Maintain cost per contact under £8.50',
      ownerId: USER_FOUNDER_ID,
      startDate: new Date('2025-10-01'),
    },
  });
  if (!krCurrent4) {
    krCurrent4 = await prisma.keyResult.create({
      data: {
        title: 'Maintain cost per contact under £8.50',
        description: 'Control operational costs while maintaining quality',
        ownerId: USER_FOUNDER_ID,
        metricType: 'MAINTAIN',
        startValue: 8.2,
        targetValue: 8.5,
        currentValue: 8.4,
        unit: 'GBP',
        status: 'ON_TRACK',
        progress: 67,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        checkInCadence: 'WEEKLY',
      },
    });
  } else {
    krCurrent4 = await prisma.keyResult.update({
      where: { id: krCurrent4.id },
      data: {
        ownerId: USER_FOUNDER_ID,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        status: 'ON_TRACK',
        isPublished: false,
        checkInCadence: 'WEEKLY',
      },
    });
  }

  await prisma.objectiveKeyResult.upsert({
    where: {
      objectiveId_keyResultId: {
        objectiveId: objCurrent3.id,
        keyResultId: krCurrent4.id,
      },
    },
    update: {},
    create: {
      objectiveId: objCurrent3.id,
      keyResultId: krCurrent4.id,
    },
  });

  // Future cycle KRs
  let krFuture1 = await prisma.keyResult.findFirst({
    where: {
      title: 'Achieve 40% AI containment for billing queries',
      ownerId: USER_FOUNDER_ID,
      startDate: new Date('2026-01-01'),
    },
  });
  if (!krFuture1) {
    krFuture1 = await prisma.keyResult.create({
      data: {
        title: 'Achieve 40% AI containment for billing queries',
        description: 'Expand AI-assisted resolution through improved intent recognition',
        ownerId: USER_FOUNDER_ID,
        metricType: 'INCREASE',
        startValue: 25,
        targetValue: 40,
        currentValue: 25,
        unit: 'percentage',
        status: 'ON_TRACK',
        progress: 0,
        cycleId: CYCLE_Q1_2026_ID, // Sync cycleId from parent objective
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        checkInCadence: 'MONTHLY',
      },
    });
  } else {
    krFuture1 = await prisma.keyResult.update({
      where: { id: krFuture1.id },
      data: {
        ownerId: USER_FOUNDER_ID,
        cycleId: CYCLE_Q1_2026_ID, // Sync cycleId from parent objective
        isPublished: false,
      },
    });
  }

  await prisma.objectiveKeyResult.upsert({
    where: {
      objectiveId_keyResultId: {
        objectiveId: objFuture1.id,
        keyResultId: krFuture1.id,
      },
    },
    update: {},
    create: {
      objectiveId: objFuture1.id,
      keyResultId: krFuture1.id,
    },
  });

  let krFuture2 = await prisma.keyResult.findFirst({
    where: {
      title: 'Reduce knowledge retrieval time from 2.5m to 1.5m',
      ownerId: USER_AGENT_ID,
      startDate: new Date('2026-01-01'),
    },
  });
  if (!krFuture2) {
    krFuture2 = await prisma.keyResult.create({
      data: {
        title: 'Reduce knowledge retrieval time from 2.5m to 1.5m',
        description: 'Improve search and navigation in knowledge base',
        ownerId: USER_AGENT_ID,
        metricType: 'DECREASE',
        startValue: 150,
        targetValue: 90,
        currentValue: 150,
        unit: 'seconds',
        status: 'ON_TRACK',
        progress: 0,
        cycleId: CYCLE_Q1_2026_ID, // Sync cycleId from parent objective
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: false,
        checkInCadence: 'MONTHLY',
      },
    });
  } else {
    krFuture2 = await prisma.keyResult.update({
      where: { id: krFuture2.id },
      data: {
        ownerId: USER_AGENT_ID,
        cycleId: CYCLE_Q1_2026_ID, // Sync cycleId from parent objective
        isPublished: false,
      },
    });
  }

  await prisma.objectiveKeyResult.upsert({
    where: {
      objectiveId_keyResultId: {
        objectiveId: objFuture2.id,
        keyResultId: krFuture2.id,
      },
    },
    update: {},
    create: {
      objectiveId: objFuture2.id,
      keyResultId: krFuture2.id,
    },
  });
  console.log('✅ Key Results created');

  // ==========================================
  // 5. Check-ins (recent for Q4 2025 KRs, overdue for one)
  // ==========================================

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Delete existing check-ins for seeded KRs to ensure idempotency
  await prisma.checkIn.deleteMany({
    where: {
      keyResultId: {
        in: [krCurrent1.id, krCurrent2.id, krCurrent3.id, krCurrent4.id],
      },
    },
  });

  // Recent check-ins (within last 5 days for Q4 2025 cycle KRs)
  await prisma.checkIn.create({
    data: {
      keyResultId: krCurrent1.id,
      userId: USER_FOUNDER_ID,
      value: 63,
      confidence: 2, // 1-5 scale (low confidence = 2)
      note: 'Billing queue continues to create repeat contacts, knowledge gap not closed. Need additional training resources.',
      blockers: 'Knowledge base missing critical billing scenarios, training needed',
      createdAt: threeDaysAgo,
    },
  });

  await prisma.checkIn.create({
    data: {
      keyResultId: krCurrent2.id,
      userId: USER_FOUNDER_ID,
      value: 340,
      confidence: 4, // 1-5 scale (high confidence = 4)
      note: 'Pilot rollout of Agent Assist in UK support team increased containment by ~8pp. Positive feedback from agents.',
      blockers: null,
      createdAt: fiveDaysAgo,
    },
  });

  await prisma.checkIn.create({
    data: {
      keyResultId: krCurrent3.id,
      userId: USER_AGENT_ID,
      value: 28,
      confidence: 3, // 1-5 scale (medium confidence = 3)
      note: 'Attrition risk remains high in evening shift; coaching sessions scheduled. Early signs of improvement.',
      blockers: 'Evening shift coverage gaps creating burnout risk',
      createdAt: oneDayAgo,
    },
  });

  // Overdue check-in: WEEKLY cadence KR with last check-in 14 days ago
  await prisma.checkIn.create({
    data: {
      keyResultId: krCurrent4.id,
      userId: USER_FOUNDER_ID,
      value: 8.4,
      confidence: 3,
      note: 'Costs stable but monitoring volume increases. Need to reassess Q4 projections.',
      blockers: null,
      createdAt: twoWeeksAgo, // Makes it overdue for WEEKLY cadence
    },
  });
  console.log('✅ Check-ins created');

  // ==========================================
  // 6. Initiatives (linked to objectives)
  // ==========================================

  // One initiative per current-cycle objective (Q4 2025), plus one future initiative
  let initiative1 = await prisma.initiative.findFirst({
    where: {
      title: 'Agent Assist Rollout',
      objectiveId: objCurrent1.id,
    },
  });
  if (!initiative1) {
    initiative1 = await prisma.initiative.create({
      data: {
        title: 'Agent Assist Rollout',
        description: 'Deploy AI-powered agent assistance tool across UK and EU support teams',
        objectiveId: objCurrent1.id,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        ownerId: USER_FOUNDER_ID,
        status: 'IN_PROGRESS',
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
        positionX: 100,
        positionY: 100,
      },
    });
  } else {
    initiative1 = await prisma.initiative.update({
      where: { id: initiative1.id },
      data: {
        objectiveId: objCurrent1.id,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        ownerId: USER_FOUNDER_ID,
        status: 'IN_PROGRESS',
      },
    });
  }

  let initiative2 = await prisma.initiative.findFirst({
    where: {
      title: 'Unified Knowledge Base Programme',
      objectiveId: objCurrent1.id,
    },
  });
  if (!initiative2) {
    initiative2 = await prisma.initiative.create({
      data: {
        title: 'Unified Knowledge Base Programme',
        description: 'Consolidate and enhance knowledge base with billing scenarios and improved search',
        objectiveId: objCurrent1.id,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        ownerId: USER_AGENT_ID,
        status: 'IN_PROGRESS',
        startDate: new Date('2025-10-15'),
        endDate: new Date('2025-12-31'),
        positionX: 300,
        positionY: 100,
      },
    });
  } else {
    initiative2 = await prisma.initiative.update({
      where: { id: initiative2.id },
      data: {
        objectiveId: objCurrent1.id,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        ownerId: USER_AGENT_ID,
        status: 'IN_PROGRESS',
      },
    });
  }

  let initiative3 = await prisma.initiative.findFirst({
    where: {
      title: 'Self-Service Deflection Pilot',
      objectiveId: objCurrent2.id,
    },
  });
  if (!initiative3) {
    initiative3 = await prisma.initiative.create({
      data: {
        title: 'Self-Service Deflection Pilot',
        description: 'Launch self-service portal for common billing inquiries to reduce contact volume',
        objectiveId: objCurrent2.id,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        ownerId: USER_FOUNDER_ID,
        status: 'IN_PROGRESS',
        startDate: new Date('2025-10-20'),
        endDate: new Date('2025-12-31'),
        positionX: 200,
        positionY: 200,
      },
    });
  } else {
    initiative3 = await prisma.initiative.update({
      where: { id: initiative3.id },
      data: {
        objectiveId: objCurrent2.id,
        cycleId: CYCLE_Q4_2025_ID, // Sync cycleId from parent objective
        ownerId: USER_FOUNDER_ID,
        status: 'IN_PROGRESS',
      },
    });
  }

  // Future cycle initiative (Q1 2026)
  let initiative4 = await prisma.initiative.findFirst({
    where: {
      title: 'AI Intent Recognition Enhancement',
      objectiveId: objFuture1.id,
    },
  });
  if (!initiative4) {
    initiative4 = await prisma.initiative.create({
      data: {
        title: 'AI Intent Recognition Enhancement',
        description: 'Upgrade AI models to improve intent classification for billing queries',
        objectiveId: objFuture1.id,
        cycleId: CYCLE_Q1_2026_ID, // Sync cycleId from parent objective
        ownerId: USER_FOUNDER_ID,
        status: 'NOT_STARTED',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        positionX: 150,
        positionY: 150,
      },
    });
  } else {
    initiative4 = await prisma.initiative.update({
      where: { id: initiative4.id },
      data: {
        objectiveId: objFuture1.id,
        cycleId: CYCLE_Q1_2026_ID, // Sync cycleId from parent objective
        ownerId: USER_FOUNDER_ID,
        status: 'NOT_STARTED',
      },
    });
  }
  console.log('✅ Initiatives created');

  // ==========================================
  // 7. Activities (for /reports/analytics/feed)
  // ==========================================

  // Delete existing activities for seeded entities to ensure idempotency
  await prisma.activity.deleteMany({
    where: {
      OR: [
        { entityId: objCurrent1.id, entityType: 'OBJECTIVE' },
        { entityId: objCurrent2.id, entityType: 'OBJECTIVE' },
        { entityId: objCurrent3.id, entityType: 'OBJECTIVE' },
        { entityId: krCurrent1.id, entityType: 'KEY_RESULT' },
        { entityId: krCurrent2.id, entityType: 'KEY_RESULT' },
        { entityId: krCurrent3.id, entityType: 'KEY_RESULT' },
        { entityId: krCurrent4.id, entityType: 'KEY_RESULT' },
        { entityId: initiative1.id, entityType: 'INITIATIVE' },
        { entityId: initiative2.id, entityType: 'INITIATIVE' },
      ],
    },
  });

  const activities = [
    // Recent activities (within last 3 days)
    {
      entityType: 'OBJECTIVE' as const,
      entityId: objCurrent1.id,
      userId: USER_FOUNDER_ID,
      action: 'UPDATED' as const,
      metadata: {
        before: { status: 'ON_TRACK', progress: 50 },
        after: { status: 'AT_RISK', progress: 42 },
        message: "Status updated: 'Improve First Contact Resolution in Priority Channels' marked as At Risk due to billing queue challenges",
      },
      createdAt: threeDaysAgo,
    },
    {
      entityType: 'KEY_RESULT' as const,
      entityId: krCurrent1.id,
      userId: USER_FOUNDER_ID,
      action: 'UPDATED' as const,
      metadata: {
        before: { confidence: 70 },
        after: { confidence: 40 },
        message: "Confidence updated: FCR confidence dropped from 70% to 40% due to billing-related repeat contacts",
      },
      createdAt: threeDaysAgo,
    },
    {
      entityType: 'CHECK_IN' as const,
      entityId: krCurrent1.id,
      userId: USER_FOUNDER_ID,
      action: 'CREATED' as const,
      metadata: {
        message: 'Check-in recorded: FCR at 63%, confidence 2/5. Knowledge gap identified in billing scenarios.',
      },
      createdAt: threeDaysAgo,
    },
    {
      entityType: 'OBJECTIVE' as const,
      entityId: objCurrent2.id,
      userId: USER_AGENT_ID,
      action: 'UPDATED' as const,
      metadata: {
        message: 'Progress update: Attrition reduction initiatives showing positive early results. Coaching sessions well-received.',
      },
      createdAt: oneDayAgo,
    },
    {
      entityType: 'KEY_RESULT' as const,
      entityId: krCurrent2.id,
      userId: USER_FOUNDER_ID,
      action: 'UPDATED' as const,
      metadata: {
        message: "Weekly check-in posted to KR 'Cut average handling time from 6m20s to 5m00s'. Agent Assist pilot showing promise.",
      },
      createdAt: fiveDaysAgo,
    },
    {
      entityType: 'INITIATIVE' as const,
      entityId: initiative1.id,
      userId: USER_FOUNDER_ID,
      action: 'UPDATED' as const,
      metadata: {
        message: 'Agent Assist rollout expanded to 3 additional teams. Positive feedback from agents on productivity gains.',
      },
      createdAt: fiveDaysAgo,
    },
    {
      entityType: 'INITIATIVE' as const,
      entityId: initiative2.id,
      userId: USER_AGENT_ID,
      action: 'UPDATED' as const,
      metadata: {
        message: 'Knowledge base programme: Added 15 new billing scenario articles. Search functionality improvements in progress.',
      },
      createdAt: oneDayAgo,
    },
    {
      entityType: 'CHECK_IN' as const,
      entityId: krCurrent3.id,
      userId: USER_AGENT_ID,
      action: 'CREATED' as const,
      metadata: {
        message: 'Check-in recorded: Attrition at 28%, confidence 3/5. Evening shift concerns addressed with scheduling adjustments.',
      },
      createdAt: oneDayAgo,
    },
  ];

  await prisma.activity.createMany({
    data: activities,
  });
  console.log('✅ Activities created');

  // ==========================================
  // 8. Summary (count actual records)
  // ==========================================
  const totalObjectives = await prisma.objective.count({
    where: { organizationId: PUZZEL_CX_ORG_ID },
  });

  const totalKeyResults = await prisma.keyResult.count({
    where: {
      objectives: {
        some: {
          objective: {
            organizationId: PUZZEL_CX_ORG_ID,
          },
        },
      },
    },
  });

  const totalCheckIns = await prisma.checkIn.count({
    where: {
      keyResult: {
        objectives: {
          some: {
            objective: {
              organizationId: PUZZEL_CX_ORG_ID,
            },
          },
        },
      },
    },
  });

  // Get all entity IDs for activity count
  const objectiveIds = await prisma.objective
    .findMany({
      where: { organizationId: PUZZEL_CX_ORG_ID },
      select: { id: true },
    })
    .then((objs) => objs.map((o) => o.id));

  const keyResultIds = await prisma.keyResult
    .findMany({
      where: {
        objectives: {
          some: {
            objective: {
              organizationId: PUZZEL_CX_ORG_ID,
            },
          },
        },
      },
      select: { id: true },
    })
    .then((krs) => krs.map((kr) => kr.id));

  const initiativeIds = await prisma.initiative
    .findMany({
      where: {
        objective: {
          organizationId: PUZZEL_CX_ORG_ID,
        },
      },
      select: { id: true },
    })
    .then((inits) => inits.map((i) => i.id));

  const checkInIds = await prisma.checkIn
    .findMany({
      where: {
        keyResult: {
          objectives: {
            some: {
              objective: {
                organizationId: PUZZEL_CX_ORG_ID,
              },
            },
          },
        },
      },
      select: { id: true },
    })
    .then((cis) => cis.map((ci) => ci.id));

  const totalActivities = await prisma.activity.count({
    where: {
      OR: [
        { entityType: 'OBJECTIVE', entityId: { in: objectiveIds } },
        { entityType: 'KEY_RESULT', entityId: { in: keyResultIds } },
        { entityType: 'INITIATIVE', entityId: { in: initiativeIds } },
        { entityType: 'CHECK_IN', entityId: { in: checkInIds } },
      ],
    },
  });

  console.log('\n🎉 Demo-ready seed data generation completed successfully!');
  console.log('\n📊 Puzzel CX Seed Data Summary:');
  console.log(`  - Organization: ${org.name} (${PUZZEL_CX_ORG_ID})`);
  console.log(`  - Total Objectives: ${totalObjectives}`);
  console.log(`  - Total Key Results: ${totalKeyResults}`);
  console.log(`  - Total Check-ins: ${totalCheckIns}`);
  console.log(`  - Total Activities: ${totalActivities}`);
  console.log('\n✅ All demo data belongs to Puzzel CX organization');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
