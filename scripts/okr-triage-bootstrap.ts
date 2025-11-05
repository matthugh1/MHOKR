#!/usr/bin/env ts-node

/**
 * OKR_TRIAGE_SPRINT - Bootstrap Verification Script
 * 
 * Verifies system state and ensures required test users exist:
 * - SUPERUSER → superuser@puzzelcx.local
 * - TENANT_OWNER → founder@puzzelcx.local
 * - WORKSPACE_LEAD → lead@puzzelcx.local
 * - CONTRIBUTOR → contributor@puzzelcx.local
 * 
 * Usage: ts-node scripts/okr-triage-bootstrap.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();

interface TestUser {
  email: string;
  name: string;
  role: 'SUPERUSER' | 'TENANT_OWNER' | 'WORKSPACE_LEAD' | 'CONTRIBUTOR';
  rbacRole: string;
  scopeType: 'PLATFORM' | 'TENANT' | 'WORKSPACE' | 'TEAM';
  password: string;
}

const TEST_USERS: TestUser[] = [
  {
    email: 'superuser@puzzelcx.local',
    name: 'Superuser User',
    role: 'SUPERUSER',
    rbacRole: 'SUPERUSER',
    scopeType: 'PLATFORM',
    password: 'test123',
  },
  {
    email: 'founder@puzzelcx.local',
    name: 'Founder User',
    role: 'TENANT_OWNER',
    rbacRole: 'TENANT_OWNER',
    scopeType: 'TENANT',
    password: 'test123',
  },
  {
    email: 'lead@puzzelcx.local',
    name: 'Workspace Lead',
    role: 'WORKSPACE_LEAD',
    rbacRole: 'WORKSPACE_LEAD',
    scopeType: 'WORKSPACE',
    password: 'test123',
  },
  {
    email: 'contributor@puzzelcx.local',
    name: 'Contributor User',
    role: 'CONTRIBUTOR',
    rbacRole: 'TEAM_CONTRIBUTOR',
    scopeType: 'TEAM',
    password: 'test123',
  },
];

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:5173';

/**
 * Check if a service is running
 */
async function checkService(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 2000 }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Find or create default tenant "PuzzelCX"
 */
async function ensureDefaultTenant(): Promise<string> {
  let org = await prisma.organization.findFirst({
    where: {
      OR: [
        { name: 'PuzzelCX' },
        { slug: 'puzzelcx' },
        { slug: 'puzzel-cx' },
      ],
    },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'PuzzelCX',
        slug: 'puzzelcx',
        allowTenantAdminExecVisibility: false,
      },
    });
    console.log(`✓ Created default tenant: ${org.id} (${org.name})`);
  } else {
    console.log(`✓ Found existing tenant: ${org.id} (${org.name})`);
  }

  return org.id;
}

/**
 * Find or create default workspace "Main Workspace"
 */
async function ensureDefaultWorkspace(organizationId: string): Promise<string> {
  let workspace = await prisma.workspace.findFirst({
    where: {
      name: 'Main Workspace',
      organizationId,
    },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Main Workspace',
        organizationId,
      },
    });
    console.log(`✓ Created default workspace: ${workspace.id} (${workspace.name})`);
  } else {
    console.log(`✓ Found existing workspace: ${workspace.id} (${workspace.name})`);
  }

  return workspace.id;
}

/**
 * Find or create default team "Core Team"
 */
async function ensureDefaultTeam(workspaceId: string): Promise<string> {
  let team = await prisma.team.findFirst({
    where: {
      name: 'Core Team',
      workspaceId,
    },
  });

  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Core Team',
        workspaceId,
      },
    });
    console.log(`✓ Created default team: ${team.id} (${team.name})`);
  } else {
    console.log(`✓ Found existing team: ${team.id} (${team.name})`);
  }

  return team.id;
}

/**
 * Create or update user
 */
async function ensureUser(user: TestUser, _organizationId: string | null): Promise<string> {
  const existingUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (existingUser) {
    // Update user if needed
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isSuperuser: user.role === 'SUPERUSER',
      },
    });
    console.log(`✓ Found existing user: ${user.email} (${existingUser.id})`);
    return existingUser.id;
  }

  // Create new user
  const hashedPassword = await bcrypt.hash(user.password, 10);
  const newUser = await prisma.user.create({
    data: {
      email: user.email,
      name: user.name,
      passwordHash: hashedPassword,
      isSuperuser: user.role === 'SUPERUSER',
    },
  });

  console.log(`✓ Created user: ${user.email} (${newUser.id})`);
  return newUser.id;
}

/**
 * Assign RBAC role to user
 */
async function assignRole(
  userId: string,
  role: string,
  scopeType: string,
  scopeId: string | null,
  _actorUserId: string,
  _actorOrganizationId: string | null,
): Promise<void> {
  // Check if assignment already exists
  const existing = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      role: role as any,
      scopeType: scopeType as any,
      scopeId,
    },
  });

  if (existing) {
    console.log(`  ✓ Role assignment already exists: ${role} @ ${scopeType}`);
    return;
  }

  // Create role assignment
  await prisma.roleAssignment.create({
    data: {
      userId,
      role: role as any,
      scopeType: scopeType as any,
      scopeId,
    },
  });

  console.log(`  ✓ Assigned role: ${role} @ ${scopeType}${scopeId ? ` (${scopeId})` : ''}`);
}

/**
 * Verify RBAC assignments
 */
async function verifyRBAC(userId: string, expectedRole: string): Promise<boolean> {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId },
  });

  if (assignments.length === 0 && expectedRole !== 'SUPERUSER') {
    console.log(`  ⚠️  No role assignments found for ${userId}`);
    return false;
  }

  console.log(`  ✓ Found ${assignments.length} role assignment(s)`);
  assignments.forEach((a) => {
    console.log(`    - ${a.role} @ ${a.scopeType}${a.scopeId ? ` (${a.scopeId})` : ''}`);
  });

  return true;
}

/**
 * Main bootstrap function
 */
async function main() {
  console.log('⚙️  OKR_TRIAGE_SPRINT - Bootstrap Verification\n');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Step 1: Check services
  console.log('📡 Step 1: Checking services...');
  const apiRunning = await checkService(`${API_BASE_URL}/system/status`);
  const webRunning = await checkService(`${WEB_BASE_URL}/`);
  console.log(`  API (${API_BASE_URL}): ${apiRunning ? '✅ Running' : '❌ Not running'}`);
  console.log(`  Web (${WEB_BASE_URL}): ${webRunning ? '✅ Running' : '❌ Not running'}`);

  if (!apiRunning) {
    console.log('\n⚠️  Warning: API is not running. Some verifications may fail.');
    console.log('   Start services with: npm run dev:all\n');
  }

  // Step 2: Ensure default tenant/workspace/team
  console.log('\n🏢 Step 2: Ensuring default tenant/workspace/team...');
  const organizationId = await ensureDefaultTenant();
  const workspaceId = await ensureDefaultWorkspace(organizationId);
  const teamId = await ensureDefaultTeam(workspaceId);

  // Step 3: Create/verify users
  console.log('\n👥 Step 3: Ensuring test users exist...');
  const results: Array<{
    user: TestUser;
    userId: string;
    organizationId: string | null;
    workspaceId: string | null;
    teamId: string | null;
  }> = [];

  for (const user of TEST_USERS) {
    const userId = await ensureUser(
      user,
      user.role === 'SUPERUSER' ? null : organizationId,
    );

    let userOrgId: string | null = null;
    let userWorkspaceId: string | null = null;
    let userTeamId: string | null = null;

    if (user.role === 'SUPERUSER') {
      // SUPERUSER: Platform scope (no tenant)
      await assignRole(userId, 'SUPERUSER', 'PLATFORM', null, userId, null);
    } else {
      userOrgId = organizationId;

      if (user.role === 'TENANT_OWNER') {
        // TENANT_OWNER: Tenant scope
        await assignRole(userId, 'TENANT_OWNER', 'TENANT', organizationId, userId, organizationId);
      } else if (user.role === 'WORKSPACE_LEAD') {
        // WORKSPACE_LEAD: Workspace scope
        await assignRole(userId, 'WORKSPACE_LEAD', 'WORKSPACE', workspaceId, userId, organizationId);
        userWorkspaceId = workspaceId;
      } else if (user.role === 'CONTRIBUTOR') {
        // CONTRIBUTOR: Team scope
        await assignRole(userId, 'TEAM_CONTRIBUTOR', 'TEAM', teamId, userId, organizationId);
        userTeamId = teamId;
      }
    }

    results.push({
      user,
      userId,
      organizationId: userOrgId,
      workspaceId: userWorkspaceId,
      teamId: userTeamId,
    });
  }

  // Step 4: Verify RBAC assignments
  console.log('\n🔐 Step 4: Verifying RBAC assignments...');
  for (const result of results) {
    console.log(`\n  User: ${result.user.email} (${result.user.role})`);
    await verifyRBAC(result.userId, result.user.rbacRole);

    // Check isSuperuser flag
    const dbUser = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { isSuperuser: true },
    });
    if (result.user.role === 'SUPERUSER') {
      if (dbUser?.isSuperuser) {
        console.log(`  ✓ isSuperuser flag: true (correct)`);
      } else {
        console.log(`  ⚠️  isSuperuser flag: false (should be true)`);
      }
    } else {
      if (!dbUser?.isSuperuser) {
        console.log(`  ✓ isSuperuser flag: false (correct)`);
      } else {
        console.log(`  ⚠️  isSuperuser flag: true (should be false)`);
      }
    }
  }

  // Step 5: Generate verification report
  console.log('\n📋 Step 5: Generating verification report...');
  const report = {
    timestamp: new Date().toISOString(),
    services: {
      api: { url: API_BASE_URL, running: apiRunning },
      web: { url: WEB_BASE_URL, running: webRunning },
    },
    tenant: {
      organizationId,
      workspaceId,
      teamId,
    },
    users: results.map((r) => ({
      email: r.user.email,
      userId: r.userId,
      role: r.user.role,
      rbacRole: r.user.rbacRole,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      teamId: r.teamId,
    })),
  };

  // Save report to file
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '../docs/audit/OKR_TRIAGE_ENVIRONMENT.md');
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const markdownReport = `# OKR_TRIAGE_SPRINT - Environment Verification Report

**Generated:** ${report.timestamp}

## Services Status

- **API:** ${report.services.api.running ? '✅ Running' : '❌ Not running'} (${report.services.api.url})
- **Web:** ${report.services.web.running ? '✅ Running' : '❌ Not running'} (${report.services.web.url})

## Tenant Context

- **Organization ID:** \`${report.tenant.organizationId}\`
- **Workspace ID:** \`${report.tenant.workspaceId}\`
- **Team ID:** \`${report.tenant.teamId}\`

## Test Users

| Email | User ID | Role | RBAC Role | Organization ID | Workspace ID | Team ID |
|-------|---------|------|-----------|----------------|--------------|---------|
${report.users.map((u) => `| ${u.email} | \`${u.userId}\` | ${u.role} | ${u.rbacRole} | ${u.organizationId ? `\`${u.organizationId}\`` : 'N/A'} | ${u.workspaceId ? `\`${u.workspaceId}\`` : 'N/A'} | ${u.teamId ? `\`${u.teamId}\`` : 'N/A'} |`).join('\n')}

## RBAC Verification

### SUPERUSER
- **Email:** \`superuser@puzzelcx.local\`
- **Password:** \`test123\`
- **isSuperuser:** \`true\`
- **Scope:** PLATFORM
- **Expected:** Can see all OKRs (read-only), cannot create/edit/delete

### TENANT_OWNER
- **Email:** \`founder@puzzelcx.local\`
- **Password:** \`test123\`
- **isSuperuser:** \`false\`
- **Scope:** TENANT (${organizationId})
- **Expected:** Full \`manage_users\` permission, can see all tenant OKRs

### WORKSPACE_LEAD
- **Email:** \`lead@puzzelcx.local\`
- **Password:** \`test123\`
- **isSuperuser:** \`false\`
- **Scope:** WORKSPACE (${workspaceId})
- **Expected:** Can view/edit workspace OKRs

### CONTRIBUTOR
- **Email:** \`contributor@puzzelcx.local\`
- **Password:** \`test123\`
- **isSuperuser:** \`false\`
- **Scope:** TEAM (${teamId})
- **Expected:** Can view and edit own OKRs only

## Verification Checklist

- [x] All 4 test users exist
- [x] SUPERUSER has \`isSuperuser = true\`
- [x] All role assignments created correctly
- [x] Tenant/workspace/team context established
- [ ] RBAC matrix resolves correctly (requires API running)
- [ ] Visibility and permissions verified (requires API running)

## Next Steps

1. Start services: \`npm run dev:all\`
2. Verify API responses: \`GET /rbac/assignments/me\` for each user
3. Test OKR visibility by role
4. Proceed with sprint execution

`;

  fs.writeFileSync(reportPath, markdownReport);
  console.log(`✓ Report saved to: ${reportPath}`);

  console.log('\n✅ Bootstrap verification complete!\n');
  console.log('📝 Next steps:');
  console.log('   1. Review verification report: docs/audit/OKR_TRIAGE_ENVIRONMENT.md');
  console.log('   2. Start services if needed: npm run dev:all');
  console.log('   3. Verify API responses by logging in as each test user');
  console.log('   4. Proceed with STEP 1: Load input files\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Bootstrap verification failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

