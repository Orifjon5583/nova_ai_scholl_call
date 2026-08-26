import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './prismaClient';
import cron from 'node-cron';

dotenv.config();

import { authenticate } from './middleware/auth';

const app = express();

const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        'https://crm.call.nova-maktab.uz',
        'https://call.nova-maktab.uz',
      ]
    : ['http://localhost:5173'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });
        
        await prisma.activityLog.create({
            data: { userId: user.id, action: 'Tizimga kirdi' }
        });

        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', token, { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax', maxAge: 12 * 60 * 60 * 1000 });
        res.json({ message: 'Success', user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout Route
app.post('/api/logout', authenticate, async (req: any, res: any) => {
    await prisma.activityLog.create({
        data: { userId: req.user.id, action: 'Tizimdan chiqdi' }
    });
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

// Check Auth Status
app.get('/api/me', authenticate, async (req: any, res: any) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, username: true, role: true, status: true }
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

import leadsRouter from './routes/leads';
import dashboardRouter from './routes/dashboard';
import callsRouter from './routes/calls';
import tasksRouter from './routes/tasks';
import operatorsRouter from './routes/operators';
import reportsRouter from './routes/reports';
import announcementsRouter from './routes/announcements';
import telegramRouter from './routes/telegram';
import { initTelegramScheduler } from './services/telegramBot';
import { initBotPolling } from './services/botPolling';
import { syncGoogleSheets } from './services/sheetSync';

app.use('/api/leads', leadsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/calls', callsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/operators', operatorsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/telegram', telegramRouter);

const ensureAdminExists = async () => {
    try {
        const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
        if (!admin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await prisma.user.create({
                data: {
                    name: 'Super Admin',
                    username: 'admin',
                    password: hashedPassword,
                    role: 'admin',
                    phone: '+998901234567'
                }
            });
            console.log('Default admin user (admin / admin123) created successfully!');
        }

        const botToken = await prisma.systemSetting.findUnique({ where: { key: 'telegram_bot_token' } });
        if (!botToken) {
            await prisma.systemSetting.create({
                data: { key: 'telegram_bot_token', value: '8871556377:AAGnfS9t1KpUM03AeA-0yxouhrFKyRy8LvQ' }
            });
            console.log('Default Telegram Bot Token saved to database!');
        }
    } catch (e) {
        console.error('Failed to ensure admin user exists', e);
    }
};

import path from 'path';

// Serve React static files in production
if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../client/dist');
    app.use(express.static(frontendPath));
    app.get('*', (req, res) => {
        // Exclude API routes from serving index.html
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(frontendPath, 'index.html'));
        }
    });
}

app.listen(PORT, async () => {
    await ensureAdminExists();
    initTelegramScheduler();
    await initBotPolling();
    
    // Google Sheets jadvalidan avtomatik tekshiruv (Har 1 soatda)
    cron.schedule('0 * * * *', () => {
        syncGoogleSheets();
    });

    console.log(`Server running on http://localhost:${PORT}`);
});

// Trigger nodemon restart for new bot token

