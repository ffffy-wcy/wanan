require('dotenv').config();
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');
const roomGuard = require('../middleware/roomGuard.js');
const router = require('express').Router({ mergeParams: true });

// GET /api/room/:roomId/moods - 获取所有心情
router.get('/', auth, roomGuard, async (req, res) => {
  try {
    const moods = await prisma.mood.findMany({
      where: { roomId: req.room.id }
    });
    return res.json({ moods });
  } catch (err) {
    return res.status(500).json({ error: '获取心情失败' });
  }
});

// POST /api/room/:roomId/moods - 创建或更新今日心情
router.post('/', auth, roomGuard, async (req, res) => {
  try {
    const { level, date, note } = req.body;
    const mood = await prisma.mood.upsert({
      where: {
        roomId_userId_date: {
          roomId: req.room.id,
          userId: req.user.id,
          date
        }
      },
      update: { level, note },
      create: {
        level,
        date,
        note: note || '',
        userId: req.user.id,
        roomId: req.room.id
      }
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.room.id}`).emit('mood:update', { mood });
    }
    return res.json({ mood });
  } catch (err) {
    return res.status(500).json({ error: '保存心情失败' });
  }
});

module.exports = router;