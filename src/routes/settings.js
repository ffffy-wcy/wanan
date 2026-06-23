require('dotenv').config();
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');
const roomGuard = require('../middleware/roomGuard.js');
const router = require('express').Router({ mergeParams: true });

// GET /api/room/:roomId/settings - 获取房间设置
router.get('/', auth, roomGuard, async (req, res) => {
  try {
    const locations = await prisma.location.findMany({
      where: { roomId: req.room.id }
    });

    return res.json({
      settings: {
        meName: req.room.meName,
        taName: req.room.taName,
        sinceDate: req.room.sinceDate,
        nextMeetDate: req.room.nextMeetDate,
        locations
      }
    });
  } catch (err) {
    return res.status(500).json({ error: '获取设置失败' });
  }
});

// PUT /api/room/:roomId/settings - 更新房间设置
router.put('/', auth, roomGuard, async (req, res) => {
  try {
    const { meName, taName, sinceDate, nextMeetDate } = req.body;
    const data = {};
    if (meName !== undefined) data.meName = meName;
    if (taName !== undefined) data.taName = taName;
    if (sinceDate !== undefined) data.sinceDate = sinceDate;
    if (nextMeetDate !== undefined) data.nextMeetDate = nextMeetDate;

    const room = await prisma.room.update({
      where: { id: req.room.id },
      data
    });

    const locations = await prisma.location.findMany({
      where: { roomId: room.id }
    });

    const settingsPayload = {
      meName: room.meName,
      taName: room.taName,
      sinceDate: room.sinceDate,
      nextMeetDate: room.nextMeetDate,
      locations
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.room.id}`).emit('settings:update', { settings: settingsPayload });
    }

    return res.json({
      settings: settingsPayload
    });
  } catch (err) {
    return res.status(500).json({ error: '更新设置失败' });
  }
});

module.exports = router;