
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'Frederic.laziou@puzzel.com';
    console.log(`Looking up user: ${email}`);

    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
            roleAssignments: true,
            organizationMembers: true,
            workspaceMembers: true,
            teamMembers: true,
        },
    });

    if (!user) {
        console.log('User not found!');
        return;
    }

    console.log('User found:', JSON.stringify(user, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
