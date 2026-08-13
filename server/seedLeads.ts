import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    await prisma.lead.createMany({
        data: [
            { name: 'Sardor', phone: '+998901112233', source: 'Instagram', status: 'waiting', assignedTo: 2 },
            { name: 'Madina', phone: '+998934445566', source: 'Telegram', status: 'waiting', assignedTo: 2 },
            { name: 'Otabek', phone: '+998997778899', source: 'Facebook', status: 'Gaplashildi', assignedTo: 2 },
        ]
    });
    console.log('Leads added successfully');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
