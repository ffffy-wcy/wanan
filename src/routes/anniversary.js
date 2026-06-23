require('dotenv').config();
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');
const roomGuard = require('../middleware/roomGuard.js');
const router = require('express').Router({ mergeParams: true });

// GET /api/room/:roomId/anniversaries - 获取所有纪念日
router.get('/', auth, roomGuard, async (req, res) => {
  try {
    const anniversaries = await prisma.anniversary.findMany({
      where: { roomId: req.room.id }
    });
    return res.json({ anniversaries });
  } catch (err) {
    return res.status(500).json({ error: '获取纪念日失败' });
  }
});

// POST /api/room/:roomId/anniversaries - 创建纪念日
router.post('/', auth, roomGuard, async (req, res) => {
  try {
    const { name, date } = req.body;
    const anniversary = await prisma.anniversary.create({
      data: {
        name,
        date,
        roomId: req.room.id
      }
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.room.id}`).emit('anniv:new', { anniversary });
    }
    return res.json({ anniversary });
  } catch (err) {
    return res.status(500).json({ error: '创建纪念日失败' });
  }
});

// DELETE /api/room/:roomId/anniversaries/:annivId - 删除纪念日
router.delete('/:annivId', auth, roomGuard, async (req, res) => {
  try {
    await prisma.anniversary.delete({
      where: { id: req.params.annivId }
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.room.id}`).emit('anniv:delete', { annivId: req.params.annivId });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: '删除纪念日失败' });
  }
});

module.exports = router;