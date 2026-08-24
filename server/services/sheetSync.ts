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

        for (const record of records) {
            // Ustun nomlari aynan rasmdagidek bo'lishi kutilmoqda:
            // Timestamp | User ID | Name | Phone | Class | Score | Max Score | Cheated
            
            const cheated = record['Cheated']?.toString().trim().toLowerCase() || '';
            if (cheated !== 'no') {
                continue; // Faqat "no" bo'lganlarni olamiz
            }

            const rawName = record['Name']?.toString().trim() || 'Noma\'lum';
            const rawPhone = record['Phone']?.toString().trim();
            const rawClass = record['Class']?.toString().trim(); // masalan "5", biz "5-sinf" ga aylantiramiz
            const rawScore = parseInt(record['Score']) || 0;
            const rawMaxScore = parseInt(record['Max Score']) || 0;

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
                // Agar allaqachon "sinf" so'zi bo'lsa, tegmaymiz. Yo'q bo'lsa qo'shamiz
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
                    name: rawName,
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
