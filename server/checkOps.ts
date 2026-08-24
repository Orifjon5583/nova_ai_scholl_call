import prisma from './prismaClient';
async function run() {
    const ops = await prisma.user.findMany({ where: { role: 'operator' }, select: { name: true, status: true, _count: { select: { assignedLeads: true } } } });
    console.log(ops);
}
run();
