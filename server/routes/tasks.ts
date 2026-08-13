import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';

const router = express.Router();

// GET /api/tasks
router.get('/', authenticate, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        // Custom tasks from DB
        const taskWhere = role === 'admin' ? {} : { assignedTo: userId };
        const tasks = await prisma.task.findMany({
            where: taskWhere,
            orderBy: { createdAt: 'desc' },
            include: {
                assignedUser: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } }
            }
        });

        // Also fetch lead deadlines (calls to be made today or overdue)
        const leadWhere = role === 'admin' ? {} : { assignedTo: userId };
        const leadDeadlines = await prisma.lead.findMany({
            where: {
                ...leadWhere,
                nextCallAt: { not: null },
                status: { notIn: ['Aloqa bo\'ldi', 'Rad etdi'] }
            },
            select: {
                id: true,
                name: true,
                phone: true,
                region: true,
                nextCallAt: true,
                status: true,
                quality: true,
                operator: { select: { id: true, name: true } },
                comments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { nextCallAt: 'asc' }
        });

        // List of operators for admin dropdown
        let operators: any[] = [];
        if (role === 'admin') {
            operators = await prisma.user.findMany({
                where: { role: 'operator' },
                select: { id: true, name: true }
            });
        }

        res.json({
            tasks,
            leadDeadlines,
            operators
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/tasks - Admin creates a task
router.post('/', authenticate, async (req: any, res: any) => {
    try {
        const { title, description, assignedTo, dueDate } = req.body;

        if (!title || !assignedTo) {
            return res.status(400).json({ error: 'Sarlavha va operator ko\'rsatilishi shart' });
        }

        const task = await prisma.task.create({
            data: {
                title,
                description,
                assignedTo: parseInt(assignedTo),
                assignedBy: req.user.id,
                dueDate: dueDate ? new Date(dueDate) : null
            },
            include: {
                assignedUser: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } }
            }
        });

        res.json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/tasks/:id/toggle - Toggle task status
router.put('/:id/toggle', authenticate, async (req: any, res: any) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await prisma.task.findUnique({ where: { id: taskId } });

        if (!task) return res.status(404).json({ error: 'Vazifa topilmadi' });

        const updated = await prisma.task.update({
            where: { id: taskId },
            data: {
                status: task.status === 'completed' ? 'pending' : 'completed'
            }
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
