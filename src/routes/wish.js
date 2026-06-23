require('dotenv').config();
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');
const roomGuard = require('../middleware/roomGuard.js');
const router = require('express').Router({ mergeParams: true });

// GET /api/room/:roomId/wishes - 获取所有心愿
router.get('/', auth, roomGuard, async (req, res) => {
  try {
    const wishes = await prisma.wish.findMany({
      where: { roomId: req.room.id }
    });
    return res.json({ wishes });
  } catch (err) {
    return res.status(500).json({ error: '获取心愿失败' });
  }
});

// POST /api/room/:roomId/wishes - 创建心愿
router.post('/', auth, roomGuard, async (req, res) => {
  try {
    const { text } = req.body;
    const wish = await prisma.wish.create({
      data: {
        text,
        roomId: req.room.id
      }
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.room.id}`).emit('wish:new', { wish });
    }
    return res.json({ wish });
  } catch (err) {
    return res.status(500).json({ error: '创建心愿失败' });
  }
});

// PATCH /api/room/:roomId/wishes/:wishId - 更新心愿
router.patch('/:wishId', auth, roomGuard, async (req, res) => {
  try {
    const { text, done } = req.body;
    const data = {};
    if (text !== undefined) data.text = text;
    if (done !== undefined) data.done = done;

    const wish = await prisma.wish.update({
      where: { id: req.params.wishId },
      data
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.room.id}`).emit('wish:update', { wish });
    }
    return res.json({ wish });
  } catch (err) {
    return res.status(500).json({ error: '更新心愿失败' });
  }
});

// DELETE /api/room/:roomId/wishes/:wishId - 删除心愿
router.delete('/:wishId', auth, roomGuard, async (req, res) => {
  try {
    await prisma.wish.delete({
      where: { id: req.params.wishId }
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.room.id}`).emit('wish:delete', { wishId: req.params.wishId });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: '删除心愿失败' });
  }
});

module.exports = router;