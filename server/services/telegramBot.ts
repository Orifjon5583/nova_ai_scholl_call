import cron from 'node-cron';
import prisma from '../prismaClient';

export const generateDailyReportText = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Today's total new leads
    const todayLeadsCount = await prisma.lead.count({
        where: {
            createdAt: { gte: todayStart, lte: todayEnd },
            deletedAt: null
        }
    });

    // 2. Total active leads in system
    const totalActiveLeads = await prisma.lead.count({
        where: { deletedAt: null }
    });

    // 3. Quality breakdown
    const qualitySifatli = await prisma.lead.count({
        where: { quality: 'Sifatli', deletedAt: null }
    });

    const qualitySifatsiz = await prisma.lead.count({
        where: { quality: 'Sifatsiz', deletedAt: null }
    });

    const qualityPending = await prisma.lead.count({
        where: {
            quality: { notIn: ['Sifatli', 'Sifatsiz'] },
            deletedAt: null
        }
    });

    // 4. Grades breakdown (1-8 sinf)
    const schoolGrades = ['1-sinf', '2-sinf', '3-sinf', '4-sinf', '5-sinf', '6-sinf', '7-sinf', '8-sinf'];
    const gradeStats: { [key: string]: number } = {};

    for (const g of schoolGrades) {
        const count = await prisma.lead.count({
            where: { grade: g, deletedAt: null }
        });
        gradeStats[g] = count;
    }

    const unassignedGradeCount = await prisma.lead.count({
        where: { grade: null, deletedAt: null }
    });

    // 5. Operators stats today
    const operators = await prisma.user.findMany({
        where: { role: 'operator' },
        select: { id: true, name: true }
    });

    const operatorReport = [];
    for (const op of operators) {
        const callsCount = await prisma.callLog.count({
            where: {
                operatorId: op.id,
                createdAt: { gte: todayStart, lte: todayEnd }
            }
        });
        const assignedLeadsCount = await prisma.lead.count({
            where: { assignedTo: op.id, deletedAt: null }
        });
        operatorReport.push(`• 👤 <b>${op.name}</b>: ${callsCount} ta qo'ng'iroq | ${assignedLeadsCount} ta lid biriktirilgan`);
    }

    // 6. Deleted leads today
    const deletedTodayCount = await prisma.lead.count({
        where: {
            deletedAt: { gte: todayStart, lte: todayEnd }
        }
    });

    const formattedDate = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' });

    let msg = `<b>📊 NOVA INTERNATIONAL AI SCHOOL</b>\n`;
    msg += `<b>📅 KUNLIK HISOBOT: ${formattedDate} (22:00)</b>\n\n`;
    
    msg += `📥 <b>Bugun kelib tushgan yangi lidlar:</b> <code>${todayLeadsCount} ta</code>\n`;
    msg += `📦 <b>Tizimdagi jami faol lidlar:</b> <code>${totalActiveLeads} ta</code>\n\n`;

    msg += `<b>⭐ LIDLAR SIFATI VA HOLATI:</b>\n`;
    msg += `🔥 Sifatli lidlar: <b>${qualitySifatli} ta</b>\n`;
    msg += `❌ Sifatsiz lidlar: <b>${qualitySifatsiz} ta</b>\n`;
    msg += `⏳ Jarayonda / Kutilmoqda: <b>${qualityPending} ta</b>\n\n`;

    msg += `<b>🎓 SINF GURUHLARI BO'YICHA:</b>\n`;
    schoolGrades.forEach(g => {
        msg += `• ${g}: <b>${gradeStats[g] || 0} ta</b>\n`;
    });
    msg += `• ⚠️ Sinfga biriktirilmagan: <b>${unassignedGradeCount} ta</b>\n\n`;

    if (operatorReport.length > 0) {
        msg += `<b>👥 OPERATORLAR FAOLIYATI (BUGUN):</b>\n`;
        msg += operatorReport.join('\n') + `\n\n`;
    }

    if (deletedTodayCount > 0) {
        msg += `<b>🗑️ Bugun o'chirilgan lidlar:</b> ${deletedTodayCount} ta\n\n`;
    }

    msg += `----------------------------------------\n`;
    msg += `🤖 <i>Nova Call CRM avtomatik hisobot tizimi</i>`;

    return msg;
};

export const getTelegramConfig = async () => {
    let token = process.env.TELEGRAM_BOT_TOKEN || '';
    let chatId = process.env.TELEGRAM_CHAT_ID || '';

    try {
        const tokenSetting = await prisma.systemSetting.findUnique({ where: { key: 'telegram_bot_token' } });
        const chatSetting = await prisma.systemSetting.findUnique({ where: { key: 'telegram_chat_id' } });

        if (tokenSetting && tokenSetting.value) token = tokenSetting.value;
        if (chatSetting && chatSetting.value) chatId = chatSetting.value;
    } catch (e) {
        console.error('Error fetching telegram config from db', e);
    }

    return { token, chatId };
};

export const sendTelegramMessage = async (token: string, chatId: string, text: string) => {
    if (!token || !chatId) {
        throw new Error('Telegram Bot Token yoki Chat ID sozlanmagan!');
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML'
        })
    });

    const data: any = await res.json();
    if (!res.ok || !data.ok) {
        throw new Error(data.description || 'Telegram Botga xabar yuborishda xatolik');
    }
    return data;
};

export const sendDailyReportToTelegram = async () => {
    const { token, chatId } = await getTelegramConfig();
    if (!token || !chatId) {
        console.log('Telegram Bot Token yoki Chat ID kiritilmagan. Avto-hisobot o\'tkazib yuborildi.');
        return false;
    }

    const reportText = await generateDailyReportText();
    await sendTelegramMessage(token, chatId, reportText);
    console.log('Daily 22:00 Telegram report sent successfully!');
    return true;
};

// Scheduler for 22:00 daily
export const initTelegramScheduler = () => {
    // Schedule task at 22:00 (10:00 PM) every day
    cron.schedule('0 22 * * *', async () => {
        console.log('Running daily 22:00 Telegram report task...');
        try {
            await sendDailyReportToTelegram();
        } catch (e) {
            console.error('Cron job error sending Telegram report', e);
        }
    });
    console.log('Telegram daily 22:00 scheduler initialized successfully!');
};
