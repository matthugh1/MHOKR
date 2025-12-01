
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.com';
    const password = 'Password123!';

    console.log(`Resetting password for ${email}...`);

    const tenantSlug = 'puzzel-cx-demo';
    const tenant = await prisma.organization.findUnique({
        where: { slug: tenantSlug },
    });

    if (!tenant) {
        console.error(`Tenant ${tenantSlug} not found!`);
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash: hashedPassword,
            isSuperuser: true,
        },
        create: {
            email,
            name: 'Admin User',
            passwordHash: hashedPassword,
            isSuperuser: true,
            primaryOrganizationId: tenant.id,
        },
    });

    console.log('Password reset successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
