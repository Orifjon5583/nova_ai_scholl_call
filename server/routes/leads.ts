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

        // Admin sees all active leads, Operator sees only assigned active leads
        const whereClause: any = role === 'admin' ? { deletedAt: null } : { assignedTo: userId, deletedAt: null };
        
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

// Helper to check if a phone number already exists
const checkDuplicatePhone = async (phone: string) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits || digits.length < 7) return false;
    const last7 = digits.slice(-7);
    const existing = await prisma.lead.findFirst({
        where: { phone: { contains: last7 } }
    });
    return !!existing;
};

// POST /api/leads - Yangi lid qo'shish (Takroriylikni tekshiradi)
router.post('/', authenticate, async (req: any, res: any) => {
    try {
        const { name, phone, source, region, grade } = req.body;
        const isDup = await checkDuplicatePhone(phone);
        
        const lead = await prisma.lead.create({
            data: {
                name,
                phone,
                source,
                region,
                grade: grade || null,
                isDuplicate: isDup,
                assignedTo: req.user.role === 'admin' ? null : req.user.id
            }
        });

        // Add activity
        await prisma.activityLog.create({
            data: { userId: req.user.id, action: isDup ? 'Takroriy lid qo\'shdi' : 'Lid qo\'shdi', details: `Lid ID: ${lead.id}` }
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
        let duplicateCount = 0;

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

            const isDup = await checkDuplicatePhone(cleanPhone);
            if (isDup) duplicateCount++;

            const lead = await prisma.lead.create({
                data: {
                    name: cleanName,
                    phone: cleanPhone,
                    source: item.source || 'Excel Import',
                    region: item.region || null,
                    grade: item.grade || null,
                    isDuplicate: isDup,
                    createdAt: parsedDate,
                    assignedTo: req.user.role === 'admin' ? null : req.user.id,
                    status: 'Yangi'
                }
            });
            createdLeads.push(lead);
        }

        res.json({ message: 'Success', count: createdLeads.length, duplicateCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Importing leads error' });
    }
});

// POST /api/leads/import-google-sheets - Google Sheets havolasi orqali import qilish
router.post('/import-google-sheets', authenticate, async (req: any, res: any) => {
    try {
        const { sheetUrl } = req.body;
        if (!sheetUrl || typeof sheetUrl !== 'string') {
            return res.status(400).json({ error: 'Google Sheets havolasi ko\'rsatilmadi' });
        }

        let sheetId = '';
        let gid = '';

        const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (idMatch && idMatch[1]) {
            sheetId = idMatch[1];
        }

        const gidMatch = sheetUrl.match(/[?&#]gid=([0-9]+)/);
        if (gidMatch && gidMatch[1]) {
            gid = gidMatch[1];
        }

        // Potential URLs to attempt fetching CSV data
        const urlsToTry = [];
        if (sheetId) {
            urlsToTry.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`);
            urlsToTry.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`);
            urlsToTry.push(`https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv${gid ? `&gid=${gid}` : ''}`);
        } else if (sheetUrl.includes('/pubhtml')) {
            urlsToTry.push(sheetUrl.replace('/pubhtml', '/pub?output=csv'));
        } else {
            urlsToTry.push(sheetUrl);
        }

        let csvText = '';
        let fetchSuccess = false;

        for (const targetUrl of urlsToTry) {
            try {
                const response = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/csv,text/plain,*/*'
                    }
                });

                if (response.ok) {
                    const text = await response.text();
                    // Ensure the content is actually CSV and not a Google Login/HTML page
                    const trimmed = text.trim();
                    if (trimmed && !trimmed.toLowerCase().startsWith('<!doctype') && !trimmed.toLowerCase().startsWith('<html')) {
                        csvText = trimmed;
                        fetchSuccess = true;
                        break;
                    }
                }
            } catch (err) {
                console.error(`Failed to fetch from ${targetUrl}`, err);
            }
        }

        if (!fetchSuccess || !csvText) {
            return res.status(400).json({ 
                error: 'Google Sheets faylini o\'qib bo\'lmadi.\nIltimos, Google Sheets jadvalida "Share" (Поделиться) tugmasini bosib, "Anyone with the link can view" (Все, u кого есть ссылка) qilib sozlang.' 
            });
        }

        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
            return res.status(400).json({ error: 'Google Sheets jadvalida yetarli ma\'lumotlar topilmadi' });
        }

        // Parse CSV Header
        const parseCSVLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' || char === "'") {
                    inQuotes = !inQuotes;
                } else if ((char === ',' || char === '\t') && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
        
        // Find indexes with flexible keyword matching
        const findColIdx = (...keywords: string[]) => {
            return headers.findIndex(h => keywords.some(k => h.includes(k)));
        };

        const nameIdx = findColIdx('ism', 'name', 'fio', 'full', 'foydalanuvchi');
        const phoneIdx = findColIdx('tel', 'phone', 'nomer', 'num', 'raqam');
        const sourceIdx = findColIdx('manba', 'source', 'kanal');
        const regionIdx = findColIdx('hudud', 'viloyat', 'region', 'tuman', 'shahar');
        const gradeIdx = findColIdx('sinf', 'guruh', 'grade', 'class');

        const createdLeads = [];
        let duplicateCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]).map(c => c.replace(/^['"]|['"]$/g, ''));
            if (cols.length === 0) continue;

            const rawName = nameIdx !== -1 ? cols[nameIdx] : cols[0];
            const rawPhone = phoneIdx !== -1 ? cols[phoneIdx] : cols[1];
            
            const name = (rawName || 'Noma\'lum').trim();
            const phone = (rawPhone || '').trim();
            if (!phone || phone.length < 5) continue; // Skip lines without valid phone

            const source = sourceIdx !== -1 ? cols[sourceIdx] : 'Google Sheets';
            const region = regionIdx !== -1 ? cols[regionIdx] : null;
            const grade = gradeIdx !== -1 ? cols[gradeIdx] : null;

            const isDup = await checkDuplicatePhone(phone);
            if (isDup) duplicateCount++;

            const lead = await prisma.lead.create({
                data: {
                    name,
                    phone,
                    source,
                    region,
                    grade,
                    isDuplicate: isDup,
                    assignedTo: req.user.role === 'admin' ? null : req.user.id,
                    status: 'Yangi'
                }
            });
            createdLeads.push(lead);
        }

        res.json({ message: 'Success', count: createdLeads.length, duplicateCount });
    } catch (error) {
        console.error('Google Sheets Import error', error);
        res.status(500).json({ error: 'Google Sheets faylidan import qilishda xatolik yuz berdi' });
    }
});

// PUT /api/leads/:id - Lidni yangilash
router.put('/:id', authenticate, async (req: any, res: any) => {
    try {
        const id = parseInt(req.params.id);
        const { status, quality, assignedTo, nextCallAt, region, grade, isDuplicate } = req.body;

        const currentLead = await prisma.lead.findUnique({ where: { id } });
        if (!currentLead) return res.status(404).json({ error: 'Lead not found' });

        const updateData: any = {};
        if (status) updateData.status = status;
        if (quality) updateData.quality = quality;
        if (region !== undefined) updateData.region = region;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        if (grade !== undefined) updateData.grade = grade;
        if (isDuplicate !== undefined) updateData.isDuplicate = isDuplicate;
        
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

// GET /api/leads/deleted - Admin/Super Admin uchun o'chirilgan lidlar va o'chirish sabablari
router.get('/deleted', authenticate, async (req: any, res: any) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Ruxsat etilmagan. Faqat Admin uchun!' });
        }

        const deletedLeads = await prisma.lead.findMany({
            where: {
                deletedAt: { not: null }
            },
            include: {
                operator: { select: { id: true, name: true } },
                deletedBy: { select: { id: true, name: true, role: true } }
            },
            orderBy: { deletedAt: 'desc' }
        });

        res.json(deletedLeads);
    } catch (error) {
        console.error('Fetch deleted leads error', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/leads/:id - Lidni sababi bilan o'chirish (Soft delete)
router.delete('/:id', authenticate, async (req: any, res: any) => {
    try {
        const leadId = parseInt(req.params.id);
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Lidni o\'chirish sababini kiritish majburiy!' });
        }

        const existing = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!existing) {
            return res.status(404).json({ error: 'Lid topilmadi' });
        }

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                deletedAt: new Date(),
                deletionReason: reason.trim(),
                deletedById: req.user.id
            }
        });

        res.json({ message: 'Lid muvaffaqiyatli o\'chirildi', lead: updatedLead });
    } catch (error) {
        console.error('Delete lead error', error);
        res.status(500).json({ error: 'Lidni o\'chirishda xatolik' });
    }
});

// POST /api/leads/:id/restore - O'chirilgan lidni qayta tiklash (Faqat Admin)
router.post('/:id/restore', authenticate, async (req: any, res: any) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Faqat Admin qayta tiklay oladi!' });
        }

        const leadId = parseInt(req.params.id);
        const restoredLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                deletedAt: null,
                deletionReason: null,
                deletedById: null
            }
        });

        res.json({ message: 'Lid muvaffaqiyatli qayta tiklandi', lead: restoredLead });
    } catch (error) {
        console.error('Restore lead error', error);
        res.status(500).json({ error: 'Lidni tiklashda xatolik' });
    }
});

export default router;
