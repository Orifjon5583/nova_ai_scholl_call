import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';

const router = express.Router();

router.get('/', authenticate, async (req: any, res: any) => {
    try {
        const role = req.user.role;
        const userId = req.user.id;

        const whereClause = role === 'admin' ? {} : { assignedTo: userId };

        // 1. Status stats
        const statusGroups = await prisma.lead.groupBy({
            by: ['status'],
            where: whereClause,
            _count: { status: true }
        });

        // 2. Quality stats
        const qualityGroups = await prisma.lead.groupBy({
            by: ['quality'],
            where: whereClause,
            _count: { quality: true }
        });

        // 3. Operator performance (Admin only)
        let operatorPerformance: any[] = [];
        if (role === 'admin') {
            const operators = await prisma.user.findMany({
                where: { role: 'operator' },
                include: {
                    assignedLeads: true,
                    callLogs: true
                }
            });

            operatorPerformance = operators.map(op => {
                const totalLeads = op.assignedLeads.length;
                const totalCalls = op.callLogs.length;
                const totalDuration = op.callLogs.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
                const answeredCalls = op.callLogs.filter(c => c.result === 'Oldi').length;
                const qualityLeads = op.assignedLeads.filter(l => l.quality === 'Sifatli').length;

                return {
                    id: op.id,
                    name: op.name,
                    totalLeads,
                    totalCalls,
                    totalDuration,
                    answeredCalls,
                    qualityLeads
                };
            });
        }

        // 4. All leads export data
        const allLeads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                operator: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            statusStats: statusGroups.map(g => ({ name: g.status || 'Noma\'lum', count: g._count.status })),
            qualityStats: qualityGroups.map(g => ({ name: g.quality || 'Noma\'lum', count: g._count.quality })),
            operatorPerformance,
            leadsExport: allLeads.map(l => ({
                id: l.id,
                name: l.name,
                phone: l.phone,
                source: l.source || 'Boshqa',
                region: l.region || 'Noma\'lum',
                status: l.status,
                quality: l.quality,
                operator: l.operator?.name || 'Biriktirilmagan',
                createdAt: l.createdAt,
                lastCallAt: l.lastCallAt
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
