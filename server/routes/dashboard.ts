import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';

const router = express.Router();

router.get('/', authenticate, async (req: any, res: any) => {
    try {
        const role = req.user.role;
        const userId = req.user.id;

        const whereClause = role === 'admin' ? {} : { assignedTo: userId };
        const operatorWhereClause = role === 'admin' ? {} : { operatorId: userId };

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // 1. Jami lidlar
        const totalLeads = await prisma.lead.count({ where: whereClause });
        
        // 2. Yangi lidlar (Bugun tushgan lidlar)
        const newLeads = await prisma.lead.count({ 
            where: { 
                ...whereClause, 
                createdAt: { gte: todayStart } 
            } 
        });

        // 3. Kutayotgan lidlar (Hali biror bosqichga o'tmagan/ishlanmagan kutilayotgan lidlar)
        const waitingLeads = await prisma.lead.count({ 
            where: { 
                ...whereClause, 
                status: { in: ['Yangi', 'Kutilmoqda', 'waiting', 'Yangi Lidlar', 'yangi'] } 
            } 
        });
        
        // 4. Sifatli lidlar
        const qualityLeads = await prisma.lead.count({ where: { ...whereClause, quality: 'Sifatli' } });

        // 5. Sifatsiz lidlar
        const badLeads = await prisma.lead.count({ where: { ...whereClause, quality: 'Sifatsiz' } });
        
        // 6. Faol qo'ng'iroq deadline'lari (nextCallAt mavjud bo'lganlar)
        const rawOverdueLeadsList = await prisma.lead.findMany({ 
            where: { 
                ...whereClause, 
                nextCallAt: { not: null }
            },
            select: { 
                id: true, 
                name: true, 
                status: true,
                nextCallAt: true,
                comments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { comment: true }
                }
            }
        });

        const isFinishedStatus = (s: string) => {
            if (!s) return false;
            const lower = s.toLowerCase();
            return lower.includes('sot') || lower.includes('shartnoma') || lower.includes('rad') || lower.includes('yakun');
        };

        const now = new Date();
        const overdueLeadsList = rawOverdueLeadsList.filter(l => {
            if (isFinishedStatus(l.status)) return false;
            const deadline = new Date(l.nextCallAt);
            // Active starting at 06:00:00 AM on the deadline date
            const activeAt = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 6, 0, 0, 0);
            return now.getTime() >= activeAt.getTime();
        });
        const overdueLeads = overdueLeadsList.length;

        // 7. Bugungi qo'ng'iroqlar
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const callsToday = await prisma.callLog.count({
            where: {
                ...operatorWhereClause,
                createdAt: { gte: today }
            }
        });

        // 8. Jami delay
        const totalDelays = await prisma.leadDelay.count({
            where: operatorWhereClause
        });

        // 9. Bugungi gaplashuv vaqti (sekundlarda, formatni frontendda qilamiz)
        const todayCalls = await prisma.callLog.findMany({
            where: {
                ...operatorWhereClause,
                createdAt: { gte: today }
            },
            select: { durationSeconds: true }
        });
        const todayCallDuration = todayCalls.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);

        // --- Pie Chart: Lidlar manbalari ---

        const sourceGroups = await prisma.lead.groupBy({
            by: ['source'],
            where: whereClause,
            _count: { source: true }
        });
        
        const sources = sourceGroups.map(s => ({
            name: s.source || 'Boshqa',
            value: s._count.source
        }));

        // --- Operatorlar samaradorligi ---
        const operators = await prisma.user.findMany({
            where: role === 'admin' ? { role: 'operator' } : { id: userId },
            select: {
                id: true,
                name: true,
                status: true,
                assignedLeads: { select: { id: true, status: true, quality: true, delayCount: true, nextCallAt: true } },
                callLogs: { select: { id: true, result: true, durationSeconds: true } },
                leadDelays: { select: { id: true } }
            }
        });

        const operatorStats = operators.map(op => {
            const totalOpLeads = op.assignedLeads.length;
            const opCalls = op.callLogs.length;
            const successCalls = op.callLogs.filter(c => c.result === 'Oldi').length;
            const missedCalls = op.callLogs.filter(c => c.result === 'Olmadi').length;
            const delays = op.leadDelays.length;
            
            const now = new Date();
            const overdue = op.assignedLeads.filter(l => l.nextCallAt && new Date(l.nextCallAt) < now && !isFinishedStatus(l.status)).length;
            
            const totalDuration = op.callLogs.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
            
            // Konversiya = (sifatli lidlar / jami ishlangan lidlar) * 100
            const qualityOpLeads = op.assignedLeads.filter(l => l.quality === 'Sifatli').length;
            const conversion = totalOpLeads > 0 ? Math.round((qualityOpLeads / totalOpLeads) * 100) : 0;

            return {
                id: op.id,
                name: op.name,
                status: op.status,
                totalLeads: totalOpLeads,
                totalCalls: opCalls,
                successCalls: successCalls,
                missedCalls: missedCalls,
                delays: delays,
                overdue: overdue,
                totalDuration: totalDuration,
                conversion: conversion
            };
        });

        // 10. Admin biriktirgan topshiriqlar (Tasks)
        const assignedTasksList = await prisma.task.findMany({
            where: {
                assignedTo: userId,
                status: 'pending'
            },
            include: {
                creator: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            stats: {
                totalLeads,
                newLeads,
                waitingLeads,
                qualityLeads,
                badLeads,
                overdueLeads,
                overdueLeadsList,
                assignedTasksList,
                callsToday,
                totalDelays,
                todayCallDuration
            },
            sources,
            operators: operatorStats
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
