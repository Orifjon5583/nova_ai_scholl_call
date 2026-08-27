import { parse } from 'csv-parse/sync';
import prisma from '../prismaClient';

export const syncGoogleSheets = async () => {
    try {
        console.log('[SheetSync] Boshlanmoqda...');
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'GOOGLE_SHEET_URL' }
        });
        
        let sheetUrl = setting?.value;
        if (!sheetUrl) {
            sheetUrl = process.env.GOOGLE_SHEET_URL;
        }

        if (!sheetUrl) {
            console.log('[SheetSync] GOOGLE_SHEET_URL topilmadi. Sozlamalardan kiriting.');
            return;
        }

        let csvUrl = sheetUrl;
        if (csvUrl.includes('/edit')) {
            csvUrl = csvUrl.replace(/\/edit.*$/, '/export?format=csv');
        }

        console.log(`[SheetSync] URL dan ma'lumot yuklanmoqda: ${csvUrl}`);
        const response = await fetch(csvUrl);
        const dataText = await response.text();
        
        const records = parse(dataText, {
            columns: true,
            skip_empty_lines: true
        });

        console.log(`[SheetSync] Jadvaldan ${records.length} ta qator topildi.`);

        let addedCount = 0;
        let duplicateCount = 0;
        let lastAssignedOperatorIndex = -1;

        const operators = await prisma.user.findMany({
            where: { role: 'operator', status: 'online' },
            select: { 
                id: true,
                _count: { select: { assignedLeads: { where: { status: { notIn: ['Arxiv', 'Sotildi', 'Qiziqmadi'] }, deletedAt: null } } } }
            }
        });

        for (const record of (records as any[])) {
            const keys = Object.keys(record);
            const findVal = (...keywords: string[]) => {
                for (const key of keys) {
                    const k = key.toLowerCase().trim();
                    if (keywords.some(kw => k === kw || k.includes(kw))) {
                        return record[key];
                    }
                }
                return undefined;
            };

            // 1. Cheated validation: skip if cheated is not 'no' / 'yo'q' / 'false' / '0'
            const cheatedVal = (findVal('cheated', 'cheat', 'g\'irrom', 'shoxlik') || '').toString().trim().toLowerCase();
            if (cheatedVal && cheatedVal !== 'no' && cheatedVal !== 'yo\'q' && cheatedVal !== 'false' && cheatedVal !== '0') {
                continue;
            }

            // 2. Score & MaxScore parsing
            const scoreVal = findVal('score', 'ball', 'natija', 'bäll', 'point', 'mark', 'bal');
            const maxScoreVal = findVal('max score', 'maxscore', 'maksimal', 'max_score', 'max');

            let rawScore: number | null = null;
            let rawMaxScore: number | null = null;

            if (scoreVal !== undefined && scoreVal !== null && scoreVal.toString().trim() !== '') {
                const scoreStr = scoreVal.toString().trim();
                if (scoreStr.includes('/')) {
                    const parts = scoreStr.split('/');
                    const parsedS = parseInt(parts[0].replace(/\D/g, ''));
                    const parsedM = parseInt(parts[1].replace(/\D/g, ''));
                    if (!isNaN(parsedS)) rawScore = parsedS;
                    if (!isNaN(parsedM)) rawMaxScore = parsedM;
                } else if (scoreStr.includes('-') && !scoreStr.startsWith('-')) {
                    const parts = scoreStr.split('-');
                    const parsedS = parseInt(parts[0].replace(/\D/g, ''));
                    const parsedM = parseInt(parts[1].replace(/\D/g, ''));
                    if (!isNaN(parsedS)) rawScore = parsedS;
                    if (!isNaN(parsedM)) rawMaxScore = parsedM;
                } else {
                    const parsedS = parseInt(scoreStr.replace(/\D/g, ''));
                    if (!isNaN(parsedS)) rawScore = parsedS;
                }
            }

            if (rawMaxScore === null && maxScoreVal !== undefined && maxScoreVal !== null && maxScoreVal.toString().trim() !== '') {
                const parsedM = parseInt(maxScoreVal.toString().replace(/\D/g, ''));
                if (!isNaN(parsedM)) rawMaxScore = parsedM;
            }

            // 3. Filter score: If score is present, only take score >= 10 (10 va undan yuqori ballilar)
            if (scoreVal !== undefined && rawScore !== null && rawScore < 10) {
                continue;
            }

            const rawName = (findVal('name', 'ism', 'fio', 'full') || 'Noma\'lum').toString().trim();
            const rawPhone = findVal('phone', 'tel', 'nomer', 'num', 'raqam')?.toString().trim();
            const rawClass = findVal('class', 'sinf', 'guruh', 'grade')?.toString().trim();

            if (!rawPhone) continue; // Raqami yo'qlarni o'tkazib yuboramiz
            
            let formattedPhone = rawPhone.replace(/\D/g, ''); // Faqat raqamlarni olamiz
            if (formattedPhone.length === 9) {
                formattedPhone = '998' + formattedPhone;
            } else if (formattedPhone.startsWith('998') && formattedPhone.length === 12) {
                formattedPhone = '+' + formattedPhone;
            } else {
                formattedPhone = '+' + formattedPhone;
            }

            let grade = null;
            if (rawClass) {
                grade = rawClass.toLowerCase().includes('sinf') ? rawClass : `${rawClass}-sinf`;
            }

            // Takrorlanishni tekshirish (Faqat o'chirilmaganlar orasidan)
            const existingLead = await prisma.lead.findFirst({
                where: { phone: formattedPhone, deletedAt: null }
            });

            if (existingLead) {
                duplicateCount++;
                continue;
            }

            let assignedOperatorId = null;
            if (operators.length > 0) {
                operators.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads);
                const op = operators[0];
                assignedOperatorId = op.id;
                op._count.assignedLeads++; // Yangi berilgan lidni hisobga qo'shamiz
            }

            await prisma.lead.create({
                data: {
                    name: rawName || 'Noma\'lum',
                    phone: formattedPhone,
                    source: 'Google Sheets',
                    grade: grade,
                    score: rawScore,
                    maxScore: rawMaxScore,
                    status: 'Yangi',
                    assignedTo: assignedOperatorId
                }
            });
            addedCount++;
        }

        console.log(`[SheetSync] Yakunlandi! Qo'shildi: ${addedCount} ta. Takroriy: ${duplicateCount} ta.`);

    } catch (error: any) {
        console.error('[SheetSync] Xatolik yuz berdi:', error.message);
    }
};
