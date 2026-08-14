import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './prismaClient';

dotenv.config();

import { authenticate } from './middleware/auth';

const app = express();

app.use(cors({
    origin: 'http://localhost:5173',
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

        res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 12 * 60 * 60 * 1000 });
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

app.use('/api/leads', leadsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/calls', callsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/operators', operatorsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/announcements', announcementsRouter);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
