import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';

const router = express.Router();

// Only admin can manage operators
const adminOnly = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Ruxsat berilmagan. Faqat Admin buni bajarishi mumkin.' });
    }
    next();
};

// GET /api/operators - List all operators with stats
router.get('/', authenticate, adminOnly, async (req: any, res: any) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const operators = await prisma.user.findMany({
            where: { role: 'operator' },
            select: {
                id: true,
                name: true,
                username: true,
                phone: true,
                status: true,
                createdAt: true,
                _count: {
                    select: {
                        assignedLeads: true,
                        callLogs: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate today's calls for each operator
        const operatorsWithStats = await Promise.all(operators.map(async (op) => {
            const todayCallsCount = await prisma.callLog.count({
                where: {
                    operatorId: op.id,
                    createdAt: { gte: today }
                }
            });

            return {
                ...op,
                todayCallsCount
            };
        }));

        res.json(operatorsWithStats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/operators - Create new operator
router.post('/', authenticate, adminOnly, async (req: any, res: any) => {
    try {
        const { name, username, password, phone } = req.body;

        if (!name || !username || !password) {
            return res.status(400).json({ error: 'Ism, login va parol kiritilishi shart' });
        }

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return res.status(400).json({ error: 'Ushbu login band, boshqa login tanlang' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newOperator = await prisma.user.create({
            data: {
                name,
                username,
                password: hashedPassword,
                phone: phone || null,
                role: 'operator',
                status: 'online'
            },
            select: {
                id: true,
                name: true,
                username: true,
                phone: true,
                status: true,
                createdAt: true
            }
        });

        res.json(newOperator);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/operators/:id/password - Reset operator password
router.put('/:id/password', authenticate, adminOnly, async (req: any, res: any) => {
    try {
        const operatorId = parseInt(req.params.id);
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'Yangi parol kamida 4 belgidan iborat bo\'lishi kerak' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: operatorId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/operators/:id - Delete operator
router.delete('/:id', authenticate, adminOnly, async (req: any, res: any) => {
    try {
        const operatorId = parseInt(req.params.id);

        // Unassign leads from this operator before deleting
        await prisma.lead.updateMany({
            where: { assignedTo: operatorId },
            data: { assignedTo: null }
        });

        await prisma.user.delete({
            where: { id: operatorId }
        });

        res.json({ message: 'Operator o\'chirildi' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
