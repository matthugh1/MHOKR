import { PrismaClient, RBACRole, ScopeType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating minimal seed data for Azure...');

  // Create organization (tenant)
  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      id: 'org-00000000-0000-0001',
      name: 'Demo Organization',
      slug: 'demo',
    },
  });
  console.log('Created organization:', org.name);

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash: hashedPassword,
      primaryOrganizationId: org.id,
    },
  });
  console.log('Created user:', admin.email);

  // Create role assignment - TENANT_ADMIN at organization scope
  await prisma.roleAssignment.upsert({
    where: {
      userId_role_scopeType_scopeId: {
        userId: admin.id,
        role: RBACRole.TENANT_ADMIN,
        scopeType: ScopeType.TENANT,
        scopeId: org.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      role: RBACRole.TENANT_ADMIN,
      scopeType: ScopeType.TENANT,
      scopeId: org.id,
    },
  });
  console.log('Created role assignment');

  // Create a cycle
  const cycle = await prisma.cycle.upsert({
    where: { id: 'cycle-00000000-0001' },
    update: {},
    create: {
      id: 'cycle-00000000-0001',
      name: 'Q1 2025',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      tenantId: org.id,
      isStandard: true,
    },
  });
  console.log('Created cycle:', cycle.name);

  console.log('\n✅ Seed completed! You can login with:');
  console.log('📧 Email: admin@example.com');
  console.log('🔑 Password: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
