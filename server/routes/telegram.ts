import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';
import { 
    getTelegramConfig, 
    sendTelegramMessage, 
    sendDailyReportToTelegram, 
    generateDailyReportText 
} from '../services/telegramBot';

const router = express.Router();

// GET /api/telegram/settings - Get current Telegram Bot settings
router.get('/settings', authenticate, async (req: any, res: any) => {
    try {
        const { token, chatId } = await getTelegramConfig();
        res.json({
            token: token ? '••••••••' + token.slice(-5) : '',
            hasToken: !!token,
            chatId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/telegram/settings - Save Telegram Bot settings (Admin only)
router.post('/settings', authenticate, async (req: any, res: any) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Faqat Admin Telegram sozlamalarini o\'zgartirishi mumkin' });
        }

        const { token, chatId } = req.body;

        if (token && typeof token === 'string' && !token.includes('••••')) {
            await prisma.systemSetting.upsert({
                where: { key: 'telegram_bot_token' },
                update: { value: token.trim() },
                create: { key: 'telegram_bot_token', value: token.trim() }
            });
        }

        if (chatId !== undefined && typeof chatId === 'string') {
            await prisma.systemSetting.upsert({
                where: { key: 'telegram_chat_id' },
                update: { value: chatId.trim() },
                create: { key: 'telegram_chat_id', value: chatId.trim() }
            });
        }

        res.json({ message: 'Telegram bot sozlamalari saqlandi!' });
    } catch (error) {
        console.error('Save telegram settings error', error);
        res.status(500).json({ error: 'Sozlamalarni saqlashda xatolik' });
    }
});

// POST /api/telegram/send-test - Send test message
router.post('/send-test', authenticate, async (req: any, res: any) => {
    try {
        const { token, chatId } = await getTelegramConfig();
        if (!token || !chatId) {
            return res.status(400).json({ error: 'Iltimos, Telegram Bot Token va Chat ID ni saqlang!' });
        }

        const testMsg = `<b>🔔 NOVA CALL CRM - TEST XABAR</b>\n\nTelegram Bot ulanishi muvaffaqiyatli o'rnatildi! Har kuni soat 22:00 da ushbu chatga avtomatik kunlik hisobot yuboriladi.`;
        await sendTelegramMessage(token, chatId, testMsg);

        res.json({ message: 'Test xabari Telegram botga yuborildi! ✅' });
    } catch (error: any) {
        console.error('Send test message error', error);
        res.status(400).json({ error: error.message || 'Test xabarini yuborishda xatolik' });
    }
});

// POST /api/telegram/send-report - Send daily report immediately to Telegram
router.post('/send-report', authenticate, async (req: any, res: any) => {
    try {
        const success = await sendDailyReportToTelegram();
        if (success) {
            res.json({ message: 'Kunlik hisobot Telegram botga muvaffaqiyatli yuborildi! 🚀' });
        } else {
            res.status(400).json({ error: 'Telegram Bot Token yoki Chat ID sozlanmagan!' });
        }
    } catch (error: any) {
        console.error('Send report error', error);
        res.status(500).json({ error: error.message || 'Hisobotni yuborishda xatolik' });
    }
});

// GET /api/telegram/download-report - Download report as text file
router.get('/download-report', authenticate, async (req: any, res: any) => {
    try {
        const reportHtml = await generateDailyReportText();
        // Convert HTML tags to plain text for download
        const plainText = reportHtml.replace(/<[^>]+>/g, '');
        const filename = `kunlik_hisobot_${new Date().toISOString().slice(0, 10)}.txt`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(plainText);
    } catch (error) {
        console.error('Download report error', error);
        res.status(500).json({ error: 'Hisobotni yuklab olishda xatolik' });
    }
});

export default router;
