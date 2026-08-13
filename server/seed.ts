import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 10);
    const operatorPassword = await bcrypt.hash('123456', 10);

    // Create Admin
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            name: 'Admin',
            username: 'admin',
            password: adminPassword,
            role: 'admin',
        },
    });

    // Create Operator
    const operator = await prisma.user.upsert({
        where: { username: 'azizbek' },
        update: {},
        create: {
            name: 'Azizbek',
            username: 'azizbek',
            password: operatorPassword,
            role: 'operator',
        },
    });

    console.log('Seed completed:', { admin, operator });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
