
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const email = 'Frederic.laziou@puzzel.com';
    console.log(`Looking up user: ${email}`);

    try {
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            include: {
                roleAssignments: true,
            },
        });

        if (!user) {
            console.log('User not found!');
        } else {
            console.log('User found:', JSON.stringify(user, null, 2));
        }
    } catch (e) {
        console.error('Error querying user:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
