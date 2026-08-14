import { Router, Response } from 'express';
import prisma from '../prismaClient';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET all announcements
router.get('/', authenticate, async (req: any, res: Response) => {
  try {
    const list = await prisma.announcement.findMany({
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "E'lonlarni yuklashda xatolik" });
  }
});

// POST new announcement (Admin only)
router.post('/', authenticate, async (req: any, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: "Faqat admin e'lon joylay oladi" });
    }
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Sarlavha va matn kiritilishi shart" });
    }

    const item = await prisma.announcement.create({
      data: {
        title,
        content,
        authorId: req.user.id
      },
      include: { author: { select: { id: true, name: true, role: true } } }
    });

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "E'lon saqlashda xatolik" });
  }
});

// DELETE announcement (Admin only)
router.delete('/:id', authenticate, async (req: any, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: "Ruxsat etilmagan" });
    }
    await prisma.announcement.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
});

// GET support tickets
router.get('/tickets', authenticate, async (req: any, res: Response) => {
  try {
    const isOperator = req.user?.role === 'operator';
    const tickets = await prisma.supportTicket.findMany({
      where: isOperator ? { operatorId: req.user.id } : {},
      include: { operator: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Murojaatlarni yuklashda xatolik" });
  }
});

// POST new support ticket (Operator / Admin)
router.post('/tickets', authenticate, async (req: any, res: Response) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: "Mavzu va xabar kiritilishi shart" });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        subject,
        message,
        operatorId: req.user!.id
      },
      include: { operator: { select: { id: true, name: true } } }
    });

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Murojaat yuborishda xatolik" });
  }
});

// PATCH respond/resolve support ticket (Admin only)
router.patch('/tickets/:id', authenticate, async (req: any, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: "Faqat admin javob bera oladi" });
    }
    const { response, status } = req.body;
    const ticket = await prisma.supportTicket.update({
      where: { id: Number(req.params.id) },
      data: {
        response: response || undefined,
        status: status || 'resolved'
      },
      include: { operator: { select: { id: true, name: true } } }
    });

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Murojaatni yangilashda xatolik" });
  }
});

export default router;
