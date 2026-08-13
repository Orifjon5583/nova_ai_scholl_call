import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';

const router = express.Router();

router.get('/', authenticate, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        const operatorWhereClause = role === 'admin' ? {} : { operatorId: userId };

        // Pagination if needed later, for now we can just return top 100 calls
        const callLogs = await prisma.callLog.findMany({
            where: operatorWhereClause,
            take: 100,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                lead: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        comments: {
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                },
                operator: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Stats for today
        const callsTodayList = await prisma.callLog.findMany({
            where: {
                ...operatorWhereClause,
                createdAt: { gte: today }
            }
        });

        const totalCallsToday = callsTodayList.length;
        const totalDurationToday = callsTodayList.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
        const answeredCallsToday = callsTodayList.filter(c => c.result === 'Oldi').length;

        res.json({
            callLogs,
            stats: {
                totalCallsToday,
                totalDurationToday,
                answeredCallsToday
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
