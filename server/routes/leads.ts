import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';

const router = express.Router();

// GET /api/leads - Barcha lidlarni olish
router.get('/', authenticate, async (req: any, res: any) => {
    try {
        const role = req.user.role;
        const userId = req.user.id;
        const { sortBy, regions } = req.query;

        // Admin sees all leads, Operator sees only assigned leads
        const whereClause: any = role === 'admin' ? {} : { assignedTo: userId };
        
        if (regions) {
            whereClause.region = { in: (regions as string).split(',') };
        }

        let orderByClause: any = { createdAt: 'desc' };
        if (sortBy === 'most_delayed') {
            orderByClause = [{ delayCount: 'desc' }, { createdAt: 'desc' }];
        } else if (sortBy === 'oldest') {
            orderByClause = { createdAt: 'asc' };
        }

        const leads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                operator: { select: { id: true, name: true } },
                callLogs: true,
                comments: {
                    include: { operator: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                leadDelays: true
            },
            orderBy: orderByClause
        });

        res.json(leads);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/leads - Yangi lid qo'shish
router.post('/', authenticate, async (req: any, res: any) => {
    try {
        const { name, phone, source, region } = req.body;
        
        const lead = await prisma.lead.create({
            data: {
                name,
                phone,
                source,
                region,
                assignedTo: req.user.role === 'admin' ? null : req.user.id
            }
        });

        // Add activity
        await prisma.activityLog.create({
            data: { userId: req.user.id, action: 'Lid qo\'shdi', details: `Lid ID: ${lead.id}` }
        });

        res.json(lead);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/leads/:id - Lidni yangilash
router.put('/:id', authenticate, async (req: any, res: any) => {
    try {
        const id = parseInt(req.params.id);
        const { status, quality, assignedTo, nextCallAt, region } = req.body;

        const currentLead = await prisma.lead.findUnique({ where: { id } });
        if (!currentLead) return res.status(404).json({ error: 'Lead not found' });

        const updateData: any = {};
        if (status) updateData.status = status;
        if (quality) updateData.quality = quality;
        if (region !== undefined) updateData.region = region;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        
        if (nextCallAt !== undefined) {
            updateData.nextCallAt = nextCallAt ? new Date(nextCallAt) : null;
            // If the new nextCallAt is different and further in the future, it's a delay!
            if (nextCallAt && (!currentLead.nextCallAt || new Date(nextCallAt).getTime() !== currentLead.nextCallAt.getTime())) {
                updateData.delayCount = { increment: 1 };
                // Also create a LeadDelay record for history
                await prisma.leadDelay.create({
                    data: {
                        leadId: id,
                        operatorId: req.user.id,
                        delayMinutes: 0, // Not explicitly specified
                        oldDueAt: currentLead.nextCallAt,
                        newDueAt: new Date(nextCallAt),
                        reason: 'Sana o\'zgartirildi'
                    }
                });
            }
        }

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: updateData
        });

        res.json(updatedLead);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/leads/:id/call - Qo'ng'iroq ma'lumotlarini saqlash
router.post('/:id/call', authenticate, async (req: any, res: any) => {
    try {
        const leadId = parseInt(req.params.id);
        const { durationSeconds, result } = req.body;

        const callLog = await prisma.callLog.create({
            data: {
                leadId,
                operatorId: req.user.id,
                durationSeconds,
                result,
                startedAt: new Date(Date.now() - durationSeconds * 1000),
                endedAt: new Date()
            }
        });

        // Update lead total call seconds and lastCallAt
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                totalCallSeconds: { increment: durationSeconds },
                lastCallAt: new Date(),
                status: 'Gaplashildi' // Auto-update status
            }
        });

        res.json(callLog);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/leads/:id/comment - Izoh qo'shish
router.post('/:id/comment', authenticate, async (req: any, res: any) => {
    try {
        const leadId = parseInt(req.params.id);
        const { comment } = req.body;

        const newComment = await prisma.comment.create({
            data: {
                leadId,
                operatorId: req.user.id,
                comment
            }
        });

        res.json(newComment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/leads/:id/delay - Delay o'rnatish
router.post('/:id/delay', authenticate, async (req: any, res: any) => {
    try {
        const leadId = parseInt(req.params.id);
        const { delayMinutes, reason } = req.body;

        const now = new Date();
        const newDueAt = new Date(now.getTime() + delayMinutes * 60000);

        const delay = await prisma.leadDelay.create({
            data: {
                leadId,
                operatorId: req.user.id,
                delayMinutes,
                reason,
                newDueAt
            }
        });

        // Update lead
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                delayCount: { increment: 1 },
                nextCallAt: newDueAt,
                status: 'Kechiktirildi'
            }
        });

        res.json(delay);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
