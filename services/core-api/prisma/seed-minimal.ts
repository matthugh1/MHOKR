import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating minimal seed data...');

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Organization',
      slug: 'demo',
    },
  });
  console.log('Created tenant:', tenant.name);

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      displayName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      password: hashedPassword,
      primaryTenantId: tenant.id,
    },
  });
  console.log('Created user:', admin.email);

  // Create role assignment
  await prisma.roleAssignment.upsert({
    where: {
      userId_tenantId: {
        userId: admin.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      tenantId: tenant.id,
      role: 'ADMIN',
    },
  });
  console.log('Created role assignment');

  // Create a cycle
  const cycle = await prisma.cycle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Q1 2025',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      tenantId: tenant.id,
      isStandard: true,
    },
  });
  console.log('Created cycle:', cycle.name);

  console.log('\\nSeed completed! You can login with:');
  console.log('Email: admin@example.com');
  console.log('Password: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
