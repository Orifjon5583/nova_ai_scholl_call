import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';

const router = express.Router();

// GET /api/leads - Barcha lidlarni olish
router.get('/', authenticate, async (req: any, res: any) => {
    try {
        const role = req.user.role;
        const userId = req.user.id;
        const { sortBy, regions, grade } = req.query;

        // Admin sees all leads, Operator sees only assigned leads
        const whereClause: any = role === 'admin' ? {} : { assignedTo: userId };
        
        if (regions) {
            whereClause.region = { in: (regions as string).split(',') };
        }

        if (grade) {
            whereClause.grade = grade;
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
        const { name, phone, source, region, grade } = req.body;
        
        const lead = await prisma.lead.create({
            data: {
                name,
                phone,
                source,
                region,
                grade: grade || null,
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

// POST /api/leads/import - Bulk import leads from Excel/CSV
router.post('/import', authenticate, async (req: any, res: any) => {
    try {
        const { leads } = req.body;
        if (!Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'Lidlar ro\'yxati bo\'sh' });
        }

        const createdLeads = [];
        for (const item of leads) {
            let cleanPhone = (item.phone || item.phone_number || '').toString().trim();
            if (cleanPhone.startsWith('p:')) {
                cleanPhone = cleanPhone.replace('p:', '').trim();
            }
            if (!cleanPhone) cleanPhone = 'Noma\'lum';

            const cleanName = (item.name || item.full_name || '').toString().trim() || 'Noma\'lum';
            
            const rawDate = item.createdAt || item.created_time || item.created_at;
            let parsedDate = rawDate ? new Date(rawDate) : new Date();
            if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date();
            }

            const lead = await prisma.lead.create({
                data: {
                    name: cleanName,
                    phone: cleanPhone,
                    source: item.source || 'Excel Import',
                    region: item.region || null,
                    createdAt: parsedDate,
                    assignedTo: req.user.role === 'admin' ? null : req.user.id,
                    status: 'Yangi'
                }
            });
            createdLeads.push(lead);
        }

        res.json({ message: 'Success', count: createdLeads.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Importing leads error' });
    }
});

// PUT /api/leads/:id - Lidni yangilash
router.put('/:id', authenticate, async (req: any, res: any) => {
    try {
        const id = parseInt(req.params.id);
        const { status, quality, assignedTo, nextCallAt, region, grade } = req.body;

        const currentLead = await prisma.lead.findUnique({ where: { id } });
        if (!currentLead) return res.status(404).json({ error: 'Lead not found' });

        const updateData: any = {};
        if (status) updateData.status = status;
        if (quality) updateData.quality = quality;
        if (region !== undefined) updateData.region = region;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        if (grade !== undefined) updateData.grade = grade;
        
        const isFinishedStatus = (s: string) => {
            if (!s) return false;
            const lower = s.toLowerCase();
            return lower.includes('sot') || lower.includes('shartnoma') || lower.includes('rad') || lower.includes('yakun');
        };

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
                        delayMinutes: 0,
                        oldDueAt: currentLead.nextCallAt,
                        newDueAt: new Date(nextCallAt),
                        reason: 'Sana o\'zgartirildi'
                    }
                });
            }
        } else if (status && isFinishedStatus(status)) {
            updateData.nextCallAt = null;
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

// POST /api/leads/:id/call - Qo'ng'iroq ma'lumotlarini to'liq saqlash (Call Wrap-up)
router.post('/:id/call', authenticate, async (req: any, res: any) => {
    try {
        const leadId = parseInt(req.params.id);
        const { durationSeconds, result, comment, status, quality, nextCallAt, grade } = req.body;

        const currentLead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!currentLead) return res.status(404).json({ error: 'Lead not found' });

        // 1. Create Call Log
        const callLog = await prisma.callLog.create({
            data: {
                leadId,
                operatorId: req.user.id,
                durationSeconds: durationSeconds || 0,
                result: result || 'Oldi',
                startedAt: new Date(Date.now() - (durationSeconds || 0) * 1000),
                endedAt: new Date()
            }
        });

        // 2. Create Comment if provided
        if (comment && comment.trim()) {
            await prisma.comment.create({
                data: {
                    leadId,
                    operatorId: req.user.id,
                    comment: comment.trim()
                }
            });
        }

        // 3. Prepare Lead updates
        const leadUpdateData: any = {
            totalCallSeconds: { increment: durationSeconds || 0 },
            lastCallAt: new Date()
        };

        // Helper to check finished statuses (sotildi, shartnoma, rad, aloqa, etc.)
        const isFinishedStatus = (s: string) => {
            if (!s) return false;
            const lower = s.toLowerCase();
            return lower.includes('sot') || lower.includes('shartnoma') || lower.includes('rad') || lower.includes('yakun');
        };

        if (status) leadUpdateData.status = status;
        if (quality) leadUpdateData.quality = quality;
        if (grade) leadUpdateData.grade = grade;

        if (nextCallAt !== undefined) {
            const newDate = nextCallAt ? new Date(nextCallAt) : null;
            leadUpdateData.nextCallAt = newDate;
            
            // Check if deadline was pushed/changed
            if (newDate && (!currentLead.nextCallAt || newDate.getTime() !== currentLead.nextCallAt.getTime())) {
                leadUpdateData.delayCount = { increment: 1 };
                await prisma.leadDelay.create({
                    data: {
                        leadId,
                        operatorId: req.user.id,
                        delayMinutes: 0,
                        oldDueAt: currentLead.nextCallAt,
                        newDueAt: newDate,
                        reason: 'Qo\'ng\'iroq yakunida ko\'chirildi'
                    }
                });
            }
        } else if (status && isFinishedStatus(status)) {
            // Auto clear deadline if lead reached finished status
            leadUpdateData.nextCallAt = null;
        }

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: leadUpdateData,
            include: {
                operator: { select: { id: true, name: true } },
                callLogs: true,
                comments: {
                    include: { operator: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                leadDelays: true
            }
        });

        res.json({ callLog, updatedLead });
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
