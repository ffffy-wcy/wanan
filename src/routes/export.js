require('dotenv').config();
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');
const router = require('express').Router();

// GET /api/export - 导出用户所有数据
router.get('/export', auth, async (req, res) => {
  try {
    // 查找用户的 Room
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { userAId: req.user.id },
          { userBId: req.user.id }
        ]
      }
    });

    const result = {
      exportedAt: new Date().toISOString(),
      roomId: null,
      settings: null,
      wall: [],
      wishes: [],
      anniversaries: [],
      moods: [],
      locations: []
    };

    if (room) {
      result.roomId = room.id;

      const [
        wallEntries,
        wishes,
        anniversaries,
        moods,
        locations
      ] = await Promise.all([
        prisma.wallEntry.findMany({ where: { roomId: room.id } }),
        prisma.wish.findMany({ where: { roomId: room.id } }),
        prisma.anniversary.findMany({ where: { roomId: room.id } }),
        prisma.mood.findMany({ where: { roomId: room.id } }),
        prisma.location.findMany({ where: { roomId: room.id } })
      ]);

      result.settings = {
        meName: room.meName,
        taName: room.taName,
        sinceDate: room.sinceDate,
        nextMeetDate: room.nextMeetDate
      };
      result.wall = wallEntries;
      result.wishes = wishes;
      result.anniversaries = anniversaries;
      result.moods = moods;
      result.locations = locations;
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: '导出失败' });
  }
});

module.exports = router;