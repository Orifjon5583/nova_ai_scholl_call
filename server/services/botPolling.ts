import TelegramBot from 'node-telegram-bot-api';
import prisma from '../prismaClient';

let bot: any = null;
const userStates = new Map<number, string>(); // chatId -> state

export const initBotPolling = async () => {
    try {
        const tokenSetting = await prisma.systemSetting.findUnique({ where: { key: 'telegram_bot_token' } });
        const token = tokenSetting?.value || process.env.TELEGRAM_BOT_TOKEN;

        if (!token) {
            console.log('No Telegram bot token found, polling bot not started.');
            return;
        }

        bot = new TelegramBot(token, { polling: true });
        console.log('Telegram Bot Polling started...');

        bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            
            // Check if user already exists
            const existingUser = await prisma.telegramUser.findUnique({ where: { chatId: String(chatId) } });
            if (existingUser) {
                bot?.sendMessage(chatId, `Assalomu alaykum, ${existingUser.name}! / Здравствуйте, ${existingUser.name}!\n\nTilni o'zgartirish uchun /lang ni bosing. / Нажмите /lang для смены языка.`);
                return;
            }

            // Start registration flow
            userStates.set(chatId, 'AWAITING_NAME');
            bot?.sendMessage(chatId, "Assalomu alaykum! Iltimos, ismingizni kiriting:\n\nЗдравствуйте! Пожалуйста, введите ваше имя:");
        });

        bot.onText(/\/lang/, async (msg) => {
            const chatId = msg.chat.id;
            sendLanguageOptions(chatId);
        });

        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            
            if (msg.text?.startsWith('/')) return; // Ignore commands

            const state = userStates.get(chatId);
            if (state === 'AWAITING_NAME' && msg.text) {
                const name = msg.text;
                
                // Save name and default lang
                await prisma.telegramUser.upsert({
                    where: { chatId: String(chatId) },
                    update: { name },
                    create: { chatId: String(chatId), name, language: 'uz' }
                });

                userStates.delete(chatId);
                sendLanguageOptions(chatId);
            }
        });

        bot.on('callback_query', async (query) => {
            if (!query.message) return;
            const chatId = query.message.chat.id;
            const data = query.data;

            if (data === 'lang_uz' || data === 'lang_ru') {
                const lang = data.replace('lang_', '');
                await prisma.telegramUser.update({
                    where: { chatId: String(chatId) },
                    data: { language: lang }
                });

                const replyText = lang === 'uz' 
                    ? "Tilingiz O'zbek tiliga o'zgardi! ✅\n\nIltimos, admin sizni tasdiqlashini kuting. Tasdiqlangandan so'ng kunlik hisobotlarni qabul qilasiz." 
                    : "Язык изменен на Русский! ✅\n\nПожалуйста, подождите подтверждения от администратора. После подтверждения вы будете получать ежедневные отчеты.";
                
                bot?.sendMessage(chatId, replyText);
                bot?.answerCallbackQuery(query.id);
            }
        });

    } catch (e) {
        console.error('Error starting Telegram bot polling:', e);
    }
};

const sendLanguageOptions = (chatId: number) => {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🇺🇿 O'zbekcha", callback_data: 'lang_uz' },
                    { text: "🇷🇺 Русский", callback_data: 'lang_ru' }
                ]
            ]
        }
    };
    bot?.sendMessage(chatId, "Qaysi tilda hisobot olishni xohlaysiz? / На каком языке вы хотите получать отчет?", opts);
};
