import cron from 'node-cron';
import prisma from '../prismaClient';

export const generateDailyReportText = async (language: string = 'uz') => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Leads overview
    const todayLeadsCount = await prisma.lead.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, deletedAt: null }
    });
    const totalActiveLeads = await prisma.lead.count({ where: { deletedAt: null } });
    const qualitySifatli = await prisma.lead.count({ where: { quality: 'Sifatli', deletedAt: null } });
    const qualitySifatsiz = await prisma.lead.count({ where: { quality: 'Sifatsiz', deletedAt: null } });
    const qualityPending = await prisma.lead.count({ where: { quality: { notIn: ['Sifatli', 'Sifatsiz'] }, deletedAt: null } });
    
    const sifatliPercent = totalActiveLeads > 0 ? Math.round((qualitySifatli / totalActiveLeads) * 100) : 0;

    // 2. Grades
    const schoolGrades = ['1-sinf', '2-sinf', '3-sinf', '4-sinf', '5-sinf', '6-sinf', '7-sinf', '8-sinf'];
    const gradeStats: { [key: string]: number } = {};
    for (const g of schoolGrades) {
        gradeStats[g] = await prisma.lead.count({ where: { grade: g, deletedAt: null } });
    }
    const unassignedGradeCount = await prisma.lead.count({ where: { grade: null, deletedAt: null } });

    // 3 & 4. Operators and Calls today
    const operators = await prisma.user.findMany({ where: { role: 'operator' }, select: { id: true, name: true } });
    
    const operatorReports = [];
    let totalCallsToday = 0;
    let totalAnsweredToday = 0;
    let totalNoAnswerToday = 0;
    
    let pendingLeadsWithoutCalls = 0;

    for (const op of operators) {
        const assigned = await prisma.lead.count({ where: { assignedTo: op.id, deletedAt: null } });
        
        const todayCalls = await prisma.callLog.findMany({
            where: { operatorId: op.id, createdAt: { gte: todayStart, lte: todayEnd } }
        });
        
        const callsCount = todayCalls.length;
        const answered = todayCalls.filter(c => c.status === 'answered').length;
        const noAnswer = todayCalls.filter(c => c.status === 'no_answer').length;
        
        totalCallsToday += callsCount;
        totalAnsweredToday += answered;
        totalNoAnswerToday += noAnswer;

        // Pending leads (assigned but no call today)
        const leadsWithCallsTodayIds = [...new Set(todayCalls.map(c => c.leadId))];
        const kutilayotgan = assigned - leadsWithCallsTodayIds.length;
        if (kutilayotgan > 0) {
            pendingLeadsWithoutCalls += kutilayotgan;
        }

        operatorReports.push({
            name: op.name,
            assigned,
            callsCount,
            answered,
            noAnswer,
            kutilayotgan: kutilayotgan > 0 ? kutilayotgan : 0
        });
    }

    const qaytaIshlashPercent = totalActiveLeads > 0 ? Math.round(((totalCallsToday) / totalActiveLeads) * 100) : 0;

    // 5. Important events / Issues
    const muammolar = [];
    if (totalNoAnswerToday > totalAnsweredToday) {
        muammolar.push(language === 'ru' ? '🔴 Очень высокая доля неотвеченных звонков.' : '🔴 Javobsiz qo\'ng\'iroqlar ulushi juda yuqori.');
    }
    if (unassignedGradeCount > 10) {
        muammolar.push(language === 'ru' ? `🟠 ${unassignedGradeCount} лидов без указанного класса.` : `🟠 ${unassignedGradeCount} ta lidning sinfi belgilanmagan.`);
    }
    if (pendingLeadsWithoutCalls > 0) {
        muammolar.push(language === 'ru' ? `🟠 ${pendingLeadsWithoutCalls} лидов ожидают звонка.` : `🟠 ${pendingLeadsWithoutCalls} ta lidga bugun qo'ng'iroq qilinmagan.`);
    }
    if (qualitySifatli > 0) {
        muammolar.push(language === 'ru' ? `🟢 Добавлено ${qualitySifatli} качественных лидов!` : `🟢 Jami ${qualitySifatli} ta sifatli lid mavjud!`);
    }
    if (muammolar.length === 0) {
        muammolar.push(language === 'ru' ? '🟢 Серьезных проблем не выявлено.' : '🟢 Jiddiy muammolar aniqlanmadi.');
    }

    // 6. Recommendations
    const tavsiyalar = [];
    if (unassignedGradeCount > 0) tavsiyalar.push(language === 'ru' ? `1️⃣ Уточнить классы для ${unassignedGradeCount} лидов.` : `1️⃣ Sinfga biriktirilmagan ${unassignedGradeCount} ta lidni aniqlashtirish.`);
    if (totalNoAnswerToday > 0) tavsiyalar.push(language === 'ru' ? `2️⃣ Перезвонить по ${totalNoAnswerToday} недозвонам.` : `2️⃣ Javobsiz qolgan ${totalNoAnswerToday} ta lidga qayta aloqaga chiqish.`);
    if (pendingLeadsWithoutCalls > 0) tavsiyalar.push(language === 'ru' ? `3️⃣ Обработать ${pendingLeadsWithoutCalls} новых/ожидающих лидов.` : `3️⃣ Kutilayotgan ${pendingLeadsWithoutCalls} ta lidga zudlik bilan qo'ng'iroq qilish.`);
    if (tavsiyalar.length === 0) {
        tavsiyalar.push(language === 'ru' ? `1️⃣ Продолжать в том же духе!` : `1️⃣ Shu tempda davom etish!`);
    }

    const dateStr = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

    let msg = language === 'ru' ? `📊 <b>NOVA INTERNATIONAL AI SCHOOL — ЕЖЕДНЕВНЫЙ ОТЧЕТ</b>\n\n` : `📊 <b>NOVA INTERNATIONAL AI SCHOOL — KUNLIK HISOBOT</b>\n\n`;
    msg += language === 'ru' ? `📅 Дата: ${dateStr}\n🕙 Время отчета: ${timeStr}\n\n` : `📅 Sana: ${dateStr}\n🕙 Hisobot vaqti: ${timeStr}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;
    
    msg += language === 'ru' ? `## 📥 ЛИДЫ\n\n` : `## 📥 LIDLAR\n\n`;
    msg += language === 'ru' ? `🆕 Новые лиды за сегодня: <b>${todayLeadsCount} шт</b>\n` : `🆕 Bugungi yangi lidlar: <b>${todayLeadsCount} ta</b>\n`;
    msg += language === 'ru' ? `📦 Всего активных лидов: <b>${totalActiveLeads} шт</b>\n\n` : `📦 Jami faol lidlar: <b>${totalActiveLeads} ta</b>\n\n`;
    msg += language === 'ru' ? `🔥 Качественные: <b>${qualitySifatli} шт</b>\n` : `🔥 Sifatli: <b>${qualitySifatli} ta</b>\n`;
    msg += language === 'ru' ? `⏳ В процессе: <b>${qualityPending} шт</b>\n` : `⏳ Jarayonda: <b>${qualityPending} ta</b>\n`;
    msg += language === 'ru' ? `❌ Некачественные: <b>${qualitySifatsiz} шт</b>\n\n` : `❌ Sifatsiz: <b>${qualitySifatsiz} ta</b>\n\n`;
    msg += language === 'ru' ? `📈 Доля качественных лидов: <b>${sifatliPercent}%</b>\n\n` : `📈 Sifatli lidlar ulushi: <b>${sifatliPercent}%</b>\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;

    msg += language === 'ru' ? `## 🎓 ПО КЛАССАМ\n\n` : `## 🎓 SINF BO‘YICHA\n\n`;
    const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
    schoolGrades.forEach((g, idx) => {
        const val = gradeStats[g] || 0;
        const e = emojis[idx] || '🔹';
        msg += language === 'ru' ? `${e} ${idx+1}-класс — ${val} шт\n` : `${e} ${g} — ${val} ta\n`;
    });
    msg += language === 'ru' ? `\n⚠️ Класс не назначен: <b>${unassignedGradeCount} шт</b>\n\n` : `\n⚠️ Sinfga biriktirilmagan: <b>${unassignedGradeCount} ta</b>\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;

    msg += language === 'ru' ? `## 👥 АКТИВНОСТЬ ОПЕРАТОРОВ\n\n` : `## 👥 OPERATORLAR FAOLIYATI\n\n`;
    operatorReports.forEach(op => {
        msg += `👤 <b>${op.name}</b>\n`;
        msg += language === 'ru' ? `• Прикреплено лидов: ${op.assigned}\n` : `• Biriktirilgan lidlar: ${op.assigned}\n`;
        msg += language === 'ru' ? `• Звонков за сегодня: ${op.callsCount}\n` : `• Bugungi qo‘ng‘iroqlar: ${op.callsCount}\n`;
        msg += language === 'ru' ? `• Дозвонились: ${op.answered}\n` : `• Bog‘langan lidlar: ${op.answered}\n`;
        msg += language === 'ru' ? `• Недозвон: ${op.noAnswer}\n` : `• Javobsiz lidlar: ${op.noAnswer}\n`;
        msg += language === 'ru' ? `• Ожидающие (без звонка): ${op.kutilayotgan}\n\n` : `• Kutilayotgan lidlar: ${op.kutilayotgan}\n\n`;
    });
    if (operatorReports.length === 0) msg += (language === 'ru' ? `Нет активных операторов\n\n` : `Faol operatorlar yo'q\n\n`);
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;

    msg += language === 'ru' ? `## 📞 АКТИВНОСТЬ (СЕГОДНЯ)\n\n` : `## 📞 BUGUNGI FAOLLIK\n\n`;
    msg += language === 'ru' ? `📲 Всего звонков: <b>${totalCallsToday} шт</b>\n` : `📲 Jami qo‘ng‘iroqlar: <b>${totalCallsToday} ta</b>\n`;
    msg += language === 'ru' ? `📞 Дозвонились: <b>${totalAnsweredToday} шт</b>\n` : `📞 Bog‘lanilgan: <b>${totalAnsweredToday} ta</b>\n`;
    msg += language === 'ru' ? `❌ Недозвон: <b>${totalNoAnswerToday} шт</b>\n\n` : `❌ Javobsiz: <b>${totalNoAnswerToday} ta</b>\n\n`;
    msg += language === 'ru' ? `📊 Обработка лидов: <b>${qaytaIshlashPercent}%</b> (оценочно)\n\n` : `📊 Lidlarni qayta ishlash: <b>${qaytaIshlashPercent}%</b> (taxminiy)\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;

    msg += language === 'ru' ? `## 🚨 ВАЖНЫЕ СОБЫТИЯ\n\n` : `## 🚨 MUHIM HOLATLAR\n\n`;
    muammolar.forEach(m => msg += `${m}\n\n`);
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;

    msg += language === 'ru' ? `## 🎯 РЕКОМЕНДАЦИИ НА ЗАВТРА\n\n` : `## 🎯 KEYINGI KUN UCHUN TAVSIYALAR\n\n`;
    tavsiyalar.forEach(t => msg += `${t}\n`);
    msg += `\n━━━━━━━━━━━━━━━━━━\n\n`;

    msg += language === 'ru' ? `🤖 <b>Nova Call CRM</b>\n<i>Система автоматических ежедневных отчетов</i>` : `🤖 <b>Nova Call CRM</b>\n<i>Avtomatik kundalik hisobot tizimi</i>`;

    return msg;
};

export const getTelegramConfig = async () => {
    let token = process.env.TELEGRAM_BOT_TOKEN || '';
    let chatIds: string[] = [];

    try {
        const tokenSetting = await prisma.systemSetting.findUnique({ where: { key: 'telegram_bot_token' } });
        if (tokenSetting && tokenSetting.value) token = tokenSetting.value;

        const chatIdsSetting = await prisma.systemSetting.findUnique({ where: { key: 'telegram_chat_ids' } });
        if (chatIdsSetting && chatIdsSetting.value) {
            try {
                chatIds = JSON.parse(chatIdsSetting.value);
            } catch {
                chatIds = chatIdsSetting.value.split(',').map(s => s.trim()).filter(Boolean);
            }
        } else {
            const singleSetting = await prisma.systemSetting.findUnique({ where: { key: 'telegram_chat_id' } });
            if (singleSetting && singleSetting.value) {
                chatIds = [singleSetting.value.trim()];
            }
        }
    } catch (e) {
        console.error('Error fetching telegram config from db', e);
    }

    return { token, chatIds };
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
    const { token, chatIds } = await getTelegramConfig();
    
    if (!token) {
        console.log('Telegram Bot Token kiritilmagan. Avto-hisobot o\'tkazib yuborildi.');
        return false;
    }

    const users = await prisma.telegramUser.findMany();
    let sentCount = 0;
    
    const reportUz = await generateDailyReportText('uz');
    const reportRu = await generateDailyReportText('ru');

    // 1. Send to old configured chat IDs (default uzbek)
    for (const chatId of chatIds) {
        try {
            const foundUser = users.find(u => u.chatId === chatId);
            const userName = foundUser?.name ? foundUser.name : '';
            const greeting = userName ? `Assalomu aleykum hurmatli ${userName}!\n\n` : '';
            await sendTelegramMessage(token, chatId, greeting + reportUz);
            sentCount++;
        } catch (e) {
            console.error(`Failed to send report to chat ${chatId}`, e);
        }
    }

    // 2. Send to newly registered bot users based on language
    for (const user of users) {
        if (!user.isApproved) continue; // ONLY SEND TO APPROVED USERS
        if (chatIds.includes(user.chatId)) continue; // avoid duplicate
        
        try {
            let text = user.language === 'ru' ? reportRu : reportUz;
            const userName = user.name ? user.name : '';
            if (userName) {
                const greeting = user.language === 'ru' 
                    ? `Здравствуйте, уважаемый(ая) ${userName}!\n\n`
                    : `Assalomu aleykum hurmatli ${userName}!\n\n`;
                text = greeting + text;
            }
            await sendTelegramMessage(token, user.chatId, text);
            sentCount++;
        } catch (e) {
            console.error(`Failed to send report to user ${user.chatId}`, e);
        }
    }

    console.log(`Daily 22:00 Telegram report sent successfully to ${sentCount} chat(s)!`);
    return sentCount > 0;
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
